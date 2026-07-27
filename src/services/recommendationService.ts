// Recommendation Service - Frontend service for intelligent recommendations
// All API calls go through the backend to keep credentials secure

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

import {
    RecommendationContent,
    ContentCategory,
    RecommendationStats,
} from '../types';
import { getCurrentUser } from './authService';

// --- In-memory cache for recommendation listings ---
// Avoids refetch storms on every mount/refresh and reduces backend load (Requirement #7).
const CACHE_TTL_MS = 60 * 1000;
const recommendationsCache = new Map<string, { ts: number; data: RecommendationContent[] }>();

// --- Request deduplication map ---
// Prevents concurrent identical requests from hitting the network simultaneously.
const pendingRequests = new Map<string, Promise<RecommendationContent[]>>();

// --- Stats cache ---
// Reduces redundant calls to /api/recommendations/stats which has stricter rate limits.
const STATS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const statsCache = new Map<string, { ts: number; data: RecommendationStats | null }>();
const pendingStatsRequests = new Map<string, Promise<RecommendationStats | null>>();

function recommendationsCacheKey(userId: string | undefined, filters: RecommendationFilters): string {
    return [
        userId || 'public',
        filters.category || 'recommended',
        filters.limit || 20,
        filters.searchQuery || '',
        filters.page || 1,
        filters.preferredLanguage || 'ar',
    ].join('|');
}

function getCachedRecommendations(key: string): RecommendationContent[] | null {
    const entry = recommendationsCache.get(key);
    if (!entry) return null;
    
    // IMPROVEMENT: Different TTL for public vs user-specific cache entries
    // Public cache entries have longer TTL (2 minutes) to reduce API calls for anonymous users
    // User-specific cache entries have shorter TTL (60 seconds) for fresher personalization
    const isPublicKey = key.startsWith('public|') || !key.includes('|');
    const ttlMs = isPublicKey ? 120 * 1000 : CACHE_TTL_MS;
    
    if (Date.now() - entry.ts > ttlMs) {
        recommendationsCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedRecommendations(key: string, data: RecommendationContent[]): void {
    // Bound the cache size to avoid unbounded growth on long sessions.
    if (recommendationsCache.size >= 200) {
        const oldestKey = recommendationsCache.keys().next().value;
        if (oldestKey) recommendationsCache.delete(oldestKey);
    }
    recommendationsCache.set(key, { ts: Date.now(), data });
}

function invalidateUserRecommendations(userId?: string): void {
    if (!userId) {
        for (const key of recommendationsCache.keys()) {
            if (key.startsWith('public|')) recommendationsCache.delete(key);
        }
        return;
    }
    for (const key of recommendationsCache.keys()) {
        if (key.startsWith(`${userId}|`)) recommendationsCache.delete(key);
    }
}

function invalidateUserStats(userId?: string): void {
    if (!userId) {
        statsCache.clear();
        return;
    }
    const key = `stats|${userId}`;
    statsCache.delete(key);
}

export interface RecommendationFilters {
    category?: ContentCategory;
    limit?: number;
    searchQuery?: string;
    page?: number;
    requiredCount?: number;     // Guarantee at least this many cards
    fallbackOnEmpty?: boolean;  // Allow backend to pull from related categories
    preferredLanguage?: string;  // Language preference for cache differentiation
}

export interface TrackActivityPayload {
    activityType: 'open_file' | 'download_file' | 'search' | 'like' | 'save' | 'discussion' | 'ask_question' | 'complete_course' | 'upload_file';
    metadata?: Record<string, any>;
}

class RecommendationService {
    // The backend extracts userId from body or x-user-id header
    // We pass userId in the request body for all mutations
    private async getAuthHeader(): Promise<Record<string, string>> {
        const headers: Record<string, string> = {};
        try {
            const user = getCurrentUser();
            if (user) {
                // Attach a verifiable Firebase ID token so the backend can
                // authenticate the request instead of trusting the client uid.
                try {
                    const token = await user.getIdToken();
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                } catch (tokenError) {
                    console.warn('Failed to get auth token, attempting refresh:', tokenError);
                    // If token is stale/expired, try a forced refresh once.
                    try {
                        const token = await user.getIdToken(true);
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                    } catch (refreshError) {
                        console.error('Auth token refresh failed:', refreshError);
                        // Clear any stale auth state
                        headers['X-Auth-Error'] = 'token_refresh_failed';
                    }
                }
            }
        } catch (error) {
            console.warn('Auth header generation failed:', error);
            // Backend will return 401 where required; no need to block the request
        }
        return headers;
    }

    async getRecommendations(filters: RecommendationFilters = {}, userId?: string): Promise<RecommendationContent[]> {
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const key = recommendationsCacheKey(userId, { ...filters, page: filters.page || 1, preferredLanguage: filters.preferredLanguage || 'ar' });
                const cached = getCachedRecommendations(key);
                if (cached) return cached;

                // Request deduplication: if the same request is already in flight, return its promise
                const pending = pendingRequests.get(key);
                if (pending) return pending;

                const body: any = {
                    category: filters.category || 'recommended',
                    limit: userId ? (filters.limit || 20) : Math.min(filters.limit || 20, 30), // BOOST: Increase public limit
                    searchQuery: filters.searchQuery || '',
                    page: filters.page || 1,
                    preferredLanguage: 'ar', // UI is Arabic; prioritize Arabic content when available
                    requiredCount: filters.requiredCount || filters.limit || 20,
                    fallbackOnEmpty: true, // Always allow fallback to related categories
                };
                if (userId) body.userId = userId;

                const requestPromise = fetch(`${API_BASE_URL}/recommendations/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...await this.getAuthHeader(),
                    },
                    body: JSON.stringify(body),
                })
                    .then(async (response) => {
                        if (!response.ok) {
                            const retryAfter = response.headers.get('Retry-After');
                            const err = new Error(`API Error: ${response.status}`) as any;
                            if (response.status === 429 && retryAfter) {
                                err.retryAfterMs = parseInt(retryAfter) * 1000;
                            }
                            throw err;
                        }
                        const result = await response.json();
                        const data = result.data || [];
                        // Avoid caching partial/low results. When the backend collection is
                        // being (re)populated by the self-healing aggregation it may return
                        // only a handful of items; caching that would "freeze" the section on
                        // a tiny list for the whole TTL. By skipping the cache for low results
                        // the next load refetches and picks up freshly aggregated content.
                        const requested = body.limit || 20;
                        const minToCache = Math.min(requested, 5);
                        if (data.length >= minToCache) {
                            setCachedRecommendations(key, data);
                        }
                        return data;
                    })
                    .catch((error) => {
                        console.error(`Get recommendations error (attempt ${attempt}):`, error);
                        throw error;
                    })
                    .finally(() => {
                        pendingRequests.delete(key);
                    });

                pendingRequests.set(key, requestPromise);
                const data = await requestPromise;

                // If we got enough data, return it
                if (data.length >= (filters.requiredCount || filters.limit || 3)) {
                    return data;
                }

                // If not enough data but we have some, and this isn't the last attempt,
                // continue retrying (backend may have more data on next try)
                if (data.length > 0 && attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }

                return data;
            } catch (error) {
                lastError = error as Error;
                if (attempt < MAX_RETRIES) {
                    let delay = 1000 * attempt;
                    const errWithRetry = error as any;
                    if (errWithRetry.retryAfterMs) {
                        delay = errWithRetry.retryAfterMs;
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }
        }

        // All retries exhausted - log but do NOT return empty array as final result
        // The caller should handle the empty case appropriately
        console.error('Get recommendations failed after all retries:', lastError);
        throw lastError || new Error('Failed to fetch recommendations after all retries');
    }

    async getPublicRecommendations(limit: number = 10): Promise<RecommendationContent[]> {
        // Reuse getRecommendations (no userId => public, cached under 'public') to
        // avoid duplicating the fetch/cache logic.
        return this.getRecommendations({
            category: 'recommended',
            limit,
            searchQuery: '',
            page: 1,
            requiredCount: limit,
            fallbackOnEmpty: true,
        });
    }

    async saveRecommendation(contentId: string, userId: string): Promise<boolean> {
        try {
            invalidateUserRecommendations(userId);
            invalidateUserStats(userId);
            const response = await fetch(`${API_BASE_URL}/recommendations/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...await this.getAuthHeader(),
                },
                body: JSON.stringify({ contentId, userId }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Save recommendation error:', error);
            return false;
        }
    }

    async unsaveRecommendation(contentId: string, userId: string): Promise<boolean> {
        try {
            invalidateUserRecommendations(userId);
            invalidateUserStats(userId);
            const response = await fetch(`${API_BASE_URL}/recommendations/save`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...await this.getAuthHeader(),
                },
                body: JSON.stringify({ contentId, userId }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Unsave recommendation error:', error);
            return false;
        }
    }

    async likeRecommendation(contentId: string, userId: string): Promise<boolean> {
        try {
            invalidateUserRecommendations(userId);
            invalidateUserStats(userId);
            const response = await fetch(`${API_BASE_URL}/recommendations/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...await this.getAuthHeader(),
                },
                body: JSON.stringify({ contentId, userId }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const result = await response.json();
            return result.liked || false;
        } catch (error) {
            console.error('Like recommendation error:', error);
            return false;
        }
    }

    async hideRecommendation(contentId: string, userId: string, reason: string = 'user_hidden'): Promise<boolean> {
        try {
            invalidateUserRecommendations(userId);
            invalidateUserStats(userId);
            const response = await fetch(`${API_BASE_URL}/recommendations/hide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...await this.getAuthHeader(),
                },
                body: JSON.stringify({ contentId, userId, reason }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('Hide recommendation error:', error);
            return false;
        }
    }

    async getStats(_userId?: string): Promise<RecommendationStats | null> {
        const userId = _userId || 'public';
        const MAX_RETRIES = 3;
        let lastError: Error | null = null;

        // Check cache first
        const cachedEntry = statsCache.get(userId);
        if (cachedEntry && Date.now() - cachedEntry.ts < STATS_CACHE_TTL_MS) {
            return cachedEntry.data;
        }

        // Request deduplication: if the same request is already in flight, return its promise
        const pending = pendingStatsRequests.get(userId);
        if (pending) return pending;

        const executeRequest = async (attempt: number): Promise<RecommendationStats | null> => {
            try {
                // Server extracts uid from Authorization Bearer token only.
                // Do not send x-user-id here to avoid mismatch/confusion.
                const headers = await this.getAuthHeader();
                const response = await fetch(`${API_BASE_URL}/recommendations/stats`, {
                    method: 'GET',
                    headers,
                });

                if (!response.ok) {
                    const retryAfter = response.headers.get('Retry-After');
                    const err = new Error(`API Error: ${response.status}`) as any;
                    if (response.status === 429 && retryAfter) {
                        err.retryAfterMs = parseInt(retryAfter) * 1000;
                    }
                    throw err;
                }

                const result = await response.json();
                const data = result.data || null;
                // Cache the result
                statsCache.set(userId, { ts: Date.now(), data });
                return data;
            } catch (error) {
                lastError = error as Error;
                if (attempt < MAX_RETRIES) {
                    let delay = 1000 * Math.pow(2, attempt); // Exponential backoff: 2s, 4s
                    const errWithRetry = error as any;
                    if (errWithRetry.retryAfterMs) {
                        delay = Math.max(delay, errWithRetry.retryAfterMs);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return executeRequest(attempt + 1);
                }
                throw error;
            }
        };

        const requestPromise = executeRequest(1)
            .catch((error) => {
                console.error('Get stats error:', error);
                // Return null on final failure to avoid blocking the UI
                return null;
            })
            .finally(() => {
                pendingStatsRequests.delete(userId);
            });

        pendingStatsRequests.set(userId, requestPromise);
        return requestPromise;
    }

    // Track activity with error handling - non-blocking.
    // Sends the Firebase ID token so the backend can trust the acting user
    // (prevents client-side userId impersonation). See C4 security fix.
    async trackActivity(payload: TrackActivityPayload, userId: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/recommendations/activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...await this.getAuthHeader(),
                },
                body: JSON.stringify({ ...payload, userId }),
            });

            if (!response.ok) {
                console.warn('Activity tracking failed:', response.status);
            }
        } catch (error) {
            // Non-critical: don't block user actions for tracking failures
            console.warn('Activity tracking error:', error);
        }
    }

    // Track a search query as an interest signal. The query is tokenized into
    // keywords (Arabic + Latin, length >= 3) and sent as a 'search' activity so
    // the recommendation engine can learn what the user is looking for.
    async trackSearch(query: string, userId?: string): Promise<void> {
        if (!query || !query.trim() || !userId) return;
        const tokens = query
            .toLowerCase()
            .split(/[\s،,;]+/)
            .map(t => t.trim())
            .filter(t => /[؀-يa-z0-9]/.test(t) && t.length >= 3);
        const seen = new Set<string>();
        const keywords = tokens.filter(t => {
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        }).slice(0, 10);
        if (keywords.length === 0) return;
        return this.trackActivity({ activityType: 'search', metadata: { query, keywords } }, userId);
    }
}

export const recommendationService = new RecommendationService();
export default recommendationService;
