/**
 * Helper functions for the recommendation engine.
 * Ported from server/recommendationRouter.js
 */

import type { Request as ExpressRequest } from 'express';
import { getAuth } from './initialization.js';
import { adminDb, FieldValue } from './initialization.js';
import {
  BADGE_PRIORITY,
  FALLBACK_CATEGORIES,
  MAX_RECOMMENDATION_SCAN,
  ACTIVITY_POINTS,
  REC_CACHE_TTL_MS,
  NON_STORED_CATEGORIES,
  CONTENT_TYPE_MAP,
  VALID_CATEGORIES,
} from './constants.js';

// ── Short-TTL server-side cache for generated recommendation lists ──
const recommendationCache = new Map<string, { ts: number; data: any }>();

// In-memory flag so concurrent triggers never overlap.
export let aggregationRunning = false;
export function setAggregationRunning(value: boolean): void {
  aggregationRunning = value;
}

// ── Authentication ──────────────────────────────────────────────────

/**
 * Resolve the authenticated user id from a Firebase ID token in the
 * Authorization header. Returns null for anonymous requests.
 *
 * SECURITY: We ONLY trust a uid cryptographically verified from a Firebase
 * ID token. We never fall back to a client-supplied userId.
 */
export async function getUidFromRequest(req: ExpressRequest): Promise<string | null> {
  const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      const auth = getAuth();
      const decoded = await auth.verifyIdToken(authHeader.slice(7));
      if (decoded && decoded.uid) return decoded.uid;
    } catch (e: any) {
      console.warn('[recommendations] Token verification failed:', e?.message || String(e));
    }
  } else {
    if (authHeader) {
      console.warn('[recommendations] Authorization header present but not Bearer');
    } else {
      console.warn('[recommendations] Missing Authorization header');
    }
  }
  return null;
}

// ── Content ID generation ───────────────────────────────────────────

export function generateContentId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ── Cache helpers ───────────────────────────────────────────────────

export function recCacheKey(
  category: string,
  userId: string | null,
  searchQuery: string,
  page: number,
  pageSize: number,
  preferredLanguage: string
): string {
  return [
    userId || 'public',
    category || 'recommended',
    (searchQuery || '').toLowerCase().trim(),
    page || 1,
    pageSize || 20,
    preferredLanguage || 'ar',
  ].join('|');
}

export function getCachedRecommendations(key: string): any | null {
  const entry = recommendationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > REC_CACHE_TTL_MS) {
    recommendationCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedRecommendations(key: string, data: any): void {
  if (recommendationCache.size >= 200) {
    const oldest = recommendationCache.keys().next().value;
    if (oldest) recommendationCache.delete(oldest);
  }
  recommendationCache.set(key, { ts: Date.now(), data });
}

export function invalidateUserRecommendations(userId: string | null): void {
  if (!userId) return;
  for (const key of recommendationCache.keys()) {
    if (key.startsWith(`${userId}|`)) recommendationCache.delete(key);
  }
}

// ── Language sorting ────────────────────────────────────────────────

/**
 * Comparator that sorts items by preferred language first (Arabic when UI is Arabic),
 * then by a secondary comparator (e.g. engagement, date, score).
 */
export function langFirstComparator(
  preferredLanguage: string,
  secondaryFn?: (a: any, b: any) => number
) {
  return (a: any, b: any): number => {
    const aLang = (a.language || '').toLowerCase();
    const bLang = (b.language || '').toLowerCase();
    const aPref = aLang === preferredLanguage ? 1 : 0;
    const bPref = bLang === preferredLanguage ? 1 : 0;
    if (aPref !== bPref) return bPref - aPref;
    if (secondaryFn) return secondaryFn(a, b);
    return 0;
  };
}

// ── Guarantee minimum items ─────────────────────────────────────────

/**
 * Ensure a category has at least requiredCount items by pulling
 * from fallback categories when the primary category is sparse.
 */
export async function guaranteeMinimumItems(
  contents: any[],
  category: string,
  requiredCount: number,
  userId: string | null,
  searchQuery: string,
  effectivePreferredLanguage: string,
  hiddenIds: string[],
  savedIds: string[],
  nowMs: number,
  scannedPool: any[]
): Promise<any[]> {
  if (!adminDb) return contents;
  if (contents.length >= requiredCount) return contents;

  const existingIds = new Set(contents.map((c) => c.id));
  const fallbacks = FALLBACK_CATEGORIES[category] || ['recommended'];

  for (const fallbackCat of fallbacks) {
    if (contents.length >= requiredCount) break;

    let query = adminDb
      .collection('recommendation_contents')
      .where('isActive', '==', true);
    if (!NON_STORED_CATEGORIES.includes(fallbackCat)) {
      query = query.where('category', '==', fallbackCat);
    }
    query = query.orderBy('createdAt', 'desc').limit(MAX_RECOMMENDATION_SCAN);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (e) {
      let fallbackQuery = adminDb
        .collection('recommendation_contents')
        .where('isActive', '==', true);
      if (!NON_STORED_CATEGORIES.includes(fallbackCat)) {
        fallbackQuery = fallbackQuery.where('category', '==', fallbackCat);
      }
      snapshot = await fallbackQuery.limit(MAX_RECOMMENDATION_SCAN).get();
    }

    let fallbackContents = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    fallbackContents = fallbackContents.filter((c: any) => !hiddenIds.includes(c.id));
    fallbackContents = fallbackContents.filter((c: any) => !c.expiresAt || c.expiresAt > nowMs);

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      fallbackContents = fallbackContents.filter((c: any) => {
        const fields = [
          c.title, c.summary, c.description, c.category,
          ...(c.keywords || []), ...(c.tags || []), c.source,
        ].filter(Boolean).join(' ').toLowerCase();
        return fields.includes(q);
      });
    }

    fallbackContents.sort(
      langFirstComparator(effectivePreferredLanguage, (a, b) =>
        ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
        ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
      )
    );

    const newItems = fallbackContents.filter((c: any) => !existingIds.has(c.id));
    newItems.forEach((c: any) => existingIds.add(c.id));
    contents = [...contents, ...newItems];
  }

  return contents;
}

// ── Badges ──────────────────────────────────────────────────────────

export function calculateBadge(content: any): string | null {
  const now = Date.now();
  const createdAt = content.createdAt || content.publishedAt || now;
  const ageHours = (now - createdAt) / (1000 * 60 * 60);
  const views = content.viewsCount || 0;
  const engagement = content.likesCount || 0;
  const deadline = content.registrationDeadline || content.expiresAt;

  if (content.isUrgent) return 'urgent';
  if (deadline && deadline - now < 7 * 24 * 60 * 60 * 1000) return 'ending_soon';
  if (ageHours < 48) return 'new';
  if (views > 1000 && engagement > 50) return 'popular';
  if (content.isRecommended) return 'recommended';
  if (content.isFree || content.contentType === 'course') return 'free_course';
  if (views > 500 && engagement > 20) return 'trending';
  return null;
}

export function sortByBadgePriority(items: any[]): any[] {
  return items.sort((a, b) => {
    const badgeA = BADGE_PRIORITY.indexOf(a.badge || '');
    const badgeB = BADGE_PRIORITY.indexOf(b.badge || '');
    const indexA = badgeA === -1 ? BADGE_PRIORITY.length : badgeA;
    const indexB = badgeB === -1 ? BADGE_PRIORITY.length : badgeB;
    return indexA - indexB;
  });
}

// ── Student data helpers ────────────────────────────────────────────

export async function getStudentInterests(userId: string): Promise<any | null> {
  if (!userId || !adminDb) return null;
  try {
    const doc = await adminDb.collection('student_interests').doc(userId).get();
    return doc.exists ? doc.data() : null;
  } catch (error: any) {
    console.error('Get interests error:', error);
    return null;
  }
}

export async function getStudentHiddenIds(userId: string): Promise<string[]> {
  if (!userId || !adminDb) return [];
  try {
    const snapshot = await adminDb
      .collection('hidden_recommendations')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map((d: any) => d.data().contentId);
  } catch (error: any) {
    console.error('Get hidden error:', error);
    return [];
  }
}

export async function getStudentLikedIds(userId: string): Promise<string[]> {
  if (!userId || !adminDb) return [];
  try {
    const snapshot = await adminDb
      .collection('liked_recommendations')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map((d: any) => d.data().contentId);
  } catch (error: any) {
    console.error('Get liked error:', error);
    return [];
  }
}

export async function getStudentSavedIds(userId: string): Promise<string[]> {
  if (!userId || !adminDb) return [];
  try {
    const snapshot = await adminDb
      .collection('saved_recommendations')
      .where('userId', '==', userId)
      .get();
    return snapshot.docs.map((d: any) => d.data().contentId);
  } catch (error: any) {
    console.error('Get saved error:', error);
    return [];
  }
}

// ── Activity tracking ───────────────────────────────────────────────

export async function trackActivity(
  userId: string,
  activityType: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  if (!userId || !adminDb) return;
  try {
    const activityRef = adminDb.collection('student_activity').doc();
    await activityRef.set({
      id: activityRef.id,
      userId,
      activityType,
      points: ACTIVITY_POINTS[activityType] || 0,
      metadata,
      timestamp: Date.now(),
      createdAt: Date.now(),
    });
    await updateUserInterests(userId, activityType, metadata);
    if (activityType === 'open_file' && metadata?.contentId) {
      try {
        await adminDb.collection('recommendation_contents').doc(metadata.contentId).update({
          viewsCount: FieldValue.increment(1),
        });
      } catch {
        // Content may not exist; ignore.
      }
    }
  } catch (error: any) {
    console.error('Activity tracking error:', error);
  }
}

export async function updateUserInterests(
  userId: string,
  activityType: string,
  metadata: Record<string, any>
): Promise<void> {
  if (!userId || !adminDb) return;
  try {
    const interestsRef = adminDb.collection('student_interests').doc(userId);
    const doc = await interestsRef.get();
    const baseData = doc.exists
      ? doc.data()
      : { userId, interests: {}, totalPoints: 0, lastUpdated: Date.now() };

    baseData.totalPoints = (baseData.totalPoints || 0) + (ACTIVITY_POINTS[activityType] || 0);
    baseData.lastUpdated = Date.now();

    if (metadata.category) {
      baseData.interests[metadata.category] = (baseData.interests[metadata.category] || 0) + 1;
    }
    if (metadata.keywords && Array.isArray(metadata.keywords)) {
      metadata.keywords.forEach((keyword: string) => {
        baseData.interests[keyword] = (baseData.interests[keyword] || 0) + 0.5;
      });
    }
    await interestsRef.set(baseData, { merge: true });
  } catch (error: any) {
    console.error('Update interests error:', error);
  }
}

// ── RSS parsing helpers ─────────────────────────────────────────────

export function unwrapCdata(text: string | null | undefined): string {
  if (text == null) return '';
  return String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

export function stripHtmlForRss(html: string): string {
  return unwrapCdata(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractLink(blockXml: string): string {
  const rssLink = blockXml.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  if (rssLink && rssLink[1] && rssLink[1].trim()) {
    return stripHtmlForRss(rssLink[1].trim());
  }
  const altLink =
    blockXml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ||
    blockXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i);
  if (altLink && altLink[1]) return altLink[1].trim();
  const anyHref = blockXml.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (anyHref && anyHref[1]) return anyHref[1].trim();
  const guidMatch = blockXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
  if (guidMatch && guidMatch[1] && guidMatch[1].trim()) {
    const guid = stripHtmlForRss(guidMatch[1].trim());
    if (guid.startsWith('http://') || guid.startsWith('https://')) return guid;
  }
  const commentsMatch = blockXml.match(/<comments[^>]*>([\s\S]*?)<\/comments>/i);
  if (commentsMatch && commentsMatch[1] && commentsMatch[1].trim()) {
    const comments = stripHtmlForRss(commentsMatch[1].trim());
    if (comments.startsWith('http://') || comments.startsWith('https://')) return comments;
  }
  return '';
}

export interface ParsedFeedItem {
  title: string;
  link: string;
  description: string;
  imageUrl: string;
  pubDate?: string;
}

export function parseFeedBlock(blockXml: string): ParsedFeedItem | null {
  const titleMatch = blockXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const link = extractLink(blockXml);
  const descMatch =
    blockXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
    blockXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
    blockXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
  const dateMatch =
    blockXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
    blockXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i) ||
    blockXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const encMatch = blockXml.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
  const mediaMatch =
    blockXml.match(/<media:content[^>]*url=["']([^"']+)["']/i) ||
    blockXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
  const imageUrl = encMatch?.[1] || mediaMatch?.[1] || '';

  if (!titleMatch) return null;
  const title = stripHtmlForRss(titleMatch[1].trim());
  if (!title) return null;

  let pubDate: string | undefined;
  if (dateMatch) {
    const t = new Date(stripHtmlForRss(dateMatch[1].trim())).getTime();
    if (!Number.isNaN(t)) pubDate = t.toString();
  }

  return {
    title,
    link,
    description: descMatch ? stripHtmlForRss(descMatch[1].trim()).slice(0, 500) : '',
    imageUrl,
    pubDate,
  };
}

export function parseRss(xmlText: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const parsed = parseFeedBlock(match[1]);
    if (parsed) items.push(parsed);
  }
  if (items.length === 0) {
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xmlText)) !== null) {
      const parsed = parseFeedBlock(match[1]);
      if (parsed) items.push(parsed);
    }
  }
  return items;
}

export function generateContentHash(title: string, link: string): string {
  const str = `${title.toLowerCase().trim()}-${link.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function normalizeTitle(title: string): string {
  return String(title)
    .toLowerCase()
    .replace(/[\sـ_.,!?;:'"()[\]{}|/\\]/g, '')
    .trim();
}

export function normalizeGeminiCategory(raw: string | null): string | null {
  if (!raw) return null;
  let c = String(raw).toLowerCase().trim();
  if (c === 'education') c = 'free_courses';
  if (c === 'general') return null;
  return VALID_CATEGORIES.includes(c) ? c : null;
}

export function determineContentType(title: string, description: string): string {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  if (lowerTitle.includes('دورة') || lowerTitle.includes('course') || lowerDesc.includes('دورة')) return 'course';
  if (lowerTitle.includes('بحث') || lowerTitle.includes('research') || lowerTitle.includes('paper')) return 'research';
  if (lowerTitle.includes('فيديو') || lowerTitle.includes('video')) return 'video';
  if (lowerTitle.includes('ورشة') || lowerTitle.includes('workshop')) return 'workshop';
  if (lowerTitle.includes('مؤتمر') || lowerTitle.includes('conference')) return 'conference';
  if (lowerTitle.includes('منحة') || lowerTitle.includes('scholarship')) return 'scholarship';
  if (lowerTitle.includes('مسابقة') || lowerTitle.includes('competition')) return 'competition';
  if (lowerTitle.includes('تدريب') || lowerTitle.includes('training') || lowerTitle.includes('وظيفة') || lowerTitle.includes('job')) return 'training';
  if (lowerTitle.includes('PDF') || lowerTitle.includes('pdf') || lowerDesc.includes('pdf')) return 'pdf';
  if (lowerTitle.includes('خبر') || lowerTitle.includes('news')) return 'news';
  return 'article';
}

export function detectLanguage(text: string | null | undefined): 'ar' | 'en' {
  if (!text || typeof text !== 'string') return 'en';
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return 'en';
  const arabicRatio = arabicChars / totalChars;
  return arabicRatio > 0.15 ? 'ar' : 'en';
}

export function contentTypeMap(category: string): string | null {
  return CONTENT_TYPE_MAP[category] || null;
}
