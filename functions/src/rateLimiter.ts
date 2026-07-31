/**
 * Rate Limiter — in-memory sliding-window implementation for Cloud Functions.
 *
 * In Cloud Functions each container instance has its own memory space, so the
 * rate-limit state is scoped to a single instance. For multi-instance deployments
 * a production-grade solution would move this to Firestore or Redis; the in-memory
 * approach is sufficient for the current low-traffic project and avoids the
 * cold-start penalty of an extra DB round-trip on every request.
 *
 * NOTE: The file-based persistence from server/index.js is intentionally removed
 * because the Cloud Functions filesystem is read-only (except /tmp), and /tmp
 * is per-instance so it would not be shared anyway.
 */

import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10);
const RATE_LIMIT_AI_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_AI_MAX_REQUESTS || '10', 10);

interface RateEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateEntry>();

/**
 * Internal aggregation calls (identified by x-aggregation-key header)
 * bypass rate limiting to prevent the scheduler from exhausting user-facing quota.
 */
function isAggregationBypass(req: ExpressRequest): boolean {
  return !!req.headers?.['x-aggregation-key'];
}

function getClientIp(req: ExpressRequest): string {
  return (
    req.ip ||
    (req.connection as any)?.remoteAddress ||
    (req.socket as any)?.remoteAddress ||
    'unknown'
  );
}

export function createRateLimiter(maxRequests: number) {
  return (req: ExpressRequest, res: ExpressResponse, next: Function): void => {
    if (isAggregationBypass(req)) {
      next();
      return;
    }

    const ip = getClientIp(req);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    const entry = rateLimitStore.get(ip) || { timestamps: [] };
    // Clean old requests outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
    entry.timestamps.push(now);
    rateLimitStore.set(ip, entry);

    if (entry.timestamps.length > maxRequests) {
      console.warn(`Rate limit exceeded for IP ${ip}: ${entry.timestamps.length} requests in ${RATE_LIMIT_WINDOW_MS}ms`);
      res.status(429).json({
        error: { message: 'Too many requests. Please try again later.' },
        retryAfter: Math.ceil((entry.timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000),
      });
      return;
    }

    // Cleanup: remove entries for IPs that haven't made requests in a while
    if (rateLimitStore.size > 1000) {
      const cutoff = now - RATE_LIMIT_WINDOW_MS * 2;
      for (const [key, e] of rateLimitStore.entries()) {
        if (!e.timestamps.some((t) => t > cutoff)) {
          rateLimitStore.delete(key);
        }
      }
    }

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.timestamps.length)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((entry.timestamps[0] + RATE_LIMIT_WINDOW_MS) / 1000)));

    next();
  };
}

export const generalRateLimiter = createRateLimiter(RATE_LIMIT_MAX_REQUESTS);
export const aiRateLimiter = createRateLimiter(RATE_LIMIT_AI_MAX_REQUESTS);

/**
 * Returns the current number of tracked IPs in the in-memory rate-limit store.
 * Exposed for the /api/health endpoint.
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}
