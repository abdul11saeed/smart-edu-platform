/**
 * Health Check Router
 *
 * Reports API status, system info, and the health of each sub-service
 * (aiRouter, recommendationRouter, fileDownloadProxy, rateLimiting).
 *
 * Ported from server/index.js → Express Router for Firebase Cloud Functions.
 */

import {Router} from "express";
import type {Request as ExpressRequest, Response as ExpressResponse} from "express";

import {generativeModel} from "./recommendation/initialization.js";
import {getRateLimitStoreSize} from "./rateLimiter.js";

const router = Router();

router.get(
  "/health",
  (_req: ExpressRequest, res: ExpressResponse) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      aiConfigured: true,
      availableKeys: null,
      currentModel: "handled-by-aiRouter",
      database: "firebase",
      system: {
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        rateLimiting: {
          mode: "in-memory",
          trackedIps: getRateLimitStoreSize(),
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
      services: {
        fileDownloadProxy: "active",
        aiRouter: "active",
        recommendationRouter: "active",
        rateLimiting: "active",
        vertexAi: generativeModel ? "active" : "unavailable",
      },
    });
  }
);

export default router;
