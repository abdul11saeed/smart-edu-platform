/**
 * Firebase Cloud Functions entry point.
 *
 * Replaces server/index.js with a unified Express app exported as the `api`
 * function via `onRequest`. All sub-routers (aiRouter, recommendationRouter,
 * fileDownloadProxy, health) are mounted under /api/.
 *
 * A scheduled function (scheduledAggregation) replaces the setInterval-based
 * scheduler from server/index.js.
 */

import { setGlobalOptions } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import express from 'express';
import cors from 'cors';

import aiRouter from './aiRouter.js';
import recommendationRouter from './recommendationRouter.js';
import fileDownloadProxyRouter from './fileDownloadProxy.js';
import healthRouter from './health.js';
import { generalRateLimiter, aiRateLimiter } from './rateLimiter.js';
import { runContentAggregation } from './recommendation/aggregation.js';
import { setAggregationRunning, aggregationRunning } from './recommendation/helpers.js';

setGlobalOptions({ maxInstances: 10 });

// ── CORS: allow Firebase Hosting origins + local dev ──────────────────

const projectId = process.env.GCLOUD_PROJECT || 'eduaiplatform-39fe9';
const allowedOrigins: string[] = [
  `https://${projectId}.web.app`,
  `https://${projectId}.firebaseapp.com`,
  process.env.CORS_ORIGIN || 'http://localhost:5173',
];

// ── Express app factory ────────────────────────────────────────────────

function createApp(): express.Express {
  const app = express();

  // CORS — allow Firebase Hosting origin dynamically
  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));

  // ── AI routes (single catch-all handler for /api/ai/*) ─────────────
  app.use('/api/ai', aiRateLimiter, aiRouter as express.RequestHandler);

  // ── Recommendation routes (Express Router for /api/recommendations/*) ─
  app.use('/api/recommendations', aiRateLimiter, recommendationRouter);

  // ── General rate limiting for all remaining endpoints ───────────────
  app.use(generalRateLimiter);

  // ── File download proxy (/api/files/download) ──────────────────────
  app.use('/api/files', fileDownloadProxyRouter);

  // ── Health check (/api/health) ───────────────────────────────────────
  app.use('/api', healthRouter);

  // ── Catch-all for unknown API routes ───────────────────────────────
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { message: 'API endpoint not found' } });
  });

  return app;
}

const app = createApp();

// Export the Express app as a Firebase Cloud Function (v2 onRequest)
export const api = onRequest(app);

// ── Scheduled function: recommendation content aggregation ─────────────
// Replaces the setInterval-based scheduler in server/index.js.
// Runs every 6 hours to populate the recommendation_contents collection.
export const scheduledAggregation = onSchedule(
  { schedule: 'every 6 hours', maxInstances: 1 },
  async () => {
    if (aggregationRunning) {
      console.log('[scheduler] Aggregation already running, skipping.');
      return;
    }
    setAggregationRunning(true);
    try {
      const result = await runContentAggregation();
      console.log('[scheduler] Aggregation completed:', JSON.stringify(result).slice(0, 200));
    } catch (e: any) {
      console.error('[scheduler] Aggregation failed:', e?.message || e);
    } finally {
      setAggregationRunning(false);
    }
  }
);
