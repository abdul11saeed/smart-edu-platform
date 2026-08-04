// Backend API Server for EduAI Platform
// Handles AI API calls and the Firebase Storage file-download proxy.
// The Neon/PostgreSQL database layer has been removed; the app uses Firebase
// (Firestore, Storage, and Realtime Database) as its single source of truth.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');

const aiRouter = require('./aiRouter');
const recommendationRouter = require('./recommendationRouter');

const app = express();
const PORT = process.env.PORT || 3002;

// ============================================
// SIMPLE FILE-PERSISTED RATE LIMITER
// ============================================
// Sliding window rate limiter to prevent abuse of AI and other endpoints.
// Uses IP-based tracking with configurable limits.
// Data is persisted to disk so rate limits survive server restarts.
// ============================================

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10);
const RATE_LIMIT_AI_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_AI_MAX_REQUESTS || '10', 10);

const RATE_LIMIT_FILE = process.env.RATE_LIMIT_FILE || path.join(process.cwd(), 'data', 'rate-limit-store.json');
const RATE_LIMIT_SAVE_INTERVAL_MS = parseInt(process.env.RATE_LIMIT_SAVE_INTERVAL_MS || '30000', 10);

let rateLimitStore = new Map();

// Load rate limit data from file on startup
function loadRateLimitStore() {
    try {
        if (fs.existsSync(RATE_LIMIT_FILE)) {
            const raw = fs.readFileSync(RATE_LIMIT_FILE, 'utf8');
            const data = JSON.parse(raw);
            const now = Date.now();
            const windowStart = now - RATE_LIMIT_WINDOW_MS;
            
            // Filter out expired entries and rebuild Map
            const cleaned = new Map();
            for (const [ip, timestamps] of Object.entries(data)) {
                const valid = (Array.isArray(timestamps) ? timestamps : [])
                    .filter((t) => t > windowStart);
                if (valid.length > 0) {
                    cleaned.set(ip, valid);
                }
            }
            rateLimitStore = cleaned;
            console.log(`[rate-limit] Loaded ${cleaned.size} IP entries from ${RATE_LIMIT_FILE}`);
        }
    } catch (error) {
        console.warn('[rate-limit] Failed to load store from file, starting fresh:', error.message);
        rateLimitStore = new Map();
    }
}

// Save rate limit data to file
function saveRateLimitStore() {
    try {
        const dir = path.dirname(RATE_LIMIT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const now = Date.now();
        const cutoff = now - RATE_LIMIT_WINDOW_MS * 2;
        const toSave = {};
        
        for (const [ip, timestamps] of rateLimitStore.entries()) {
            const recent = timestamps.filter((t) => t > cutoff);
            if (recent.length > 0) {
                toSave[ip] = recent;
            }
        }
        
        fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(toSave, null, 2));
    } catch (error) {
        console.warn('[rate-limit] Failed to save store to file:', error.message);
    }
}

// Periodic save
setInterval(saveRateLimitStore, RATE_LIMIT_SAVE_INTERVAL_MS);

// Save on graceful shutdown
process.on('SIGTERM', saveRateLimitStore);
process.on('SIGINT', saveRateLimitStore);

// Load on startup
loadRateLimitStore();

// Initialize rate limiting system properly
try {
    const dataDir = path.dirname(RATE_LIMIT_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(RATE_LIMIT_FILE)) {
        const initialStore = {};
        fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(initialStore, null, 2), 'utf8');
        console.log('[rate-limit] Initialized empty rate limit store');
    }
    
    // Ensure file contains valid JSON
    const fileContent = fs.readFileSync(RATE_LIMIT_FILE, 'utf8');
    const parsed = JSON.parse(fileContent);
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(parsed, null, 2), 'utf8');
    console.log('[rate-limit] Rate limit store initialization confirmed');
} catch (error) {
    console.error('[rate-limit] CRITICAL: Failed to initialize rate limiting:', error.message);
    console.warn('[rate-limit] System will continue but rate limiting is disabled');
}

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter(maxRequests) {
  return (req, res, next) => {
    const ip = getClientIp(req);
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Internal aggregation calls (identified by x-aggregation-key header)
    // bypass rate limiting to prevent scheduler from exhausting user-facing quota.
    if (req.headers?.['x-aggregation-key']) {
      return next();
    }

    let requests = rateLimitStore.get(ip) || [];
    // Clean old requests outside the window
    requests = requests.filter((timestamp) => timestamp > windowStart);
    requests.push(now);
    rateLimitStore.set(ip, requests);

    if (requests.length > maxRequests) {
      console.warn(`Rate limit exceeded for IP ${ip}: ${requests.length} requests in ${RATE_LIMIT_WINDOW_MS}ms`);
      return res.status(429).json({
        error: { message: 'Too many requests. Please try again later.' },
        retryAfter: Math.ceil((requests[0] + RATE_LIMIT_WINDOW_MS - now) / 1000)
      });
    }

    // Cleanup: remove entries for IPs that haven't made requests in a while
    if (rateLimitStore.size > 1000) {
      const cutoff = now - RATE_LIMIT_WINDOW_MS * 2;
      for (const [key, timestamps] of rateLimitStore.entries()) {
        const recent = timestamps.some((t) => t > cutoff);
        if (!recent) rateLimitStore.delete(key);
      }
    }

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - requests.length)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((requests[0] + RATE_LIMIT_WINDOW_MS) / 1000)));

    next();
  };
}

const generalRateLimiter = createRateLimiter(RATE_LIMIT_MAX_REQUESTS);
const aiRateLimiter = createRateLimiter(RATE_LIMIT_AI_MAX_REQUESTS);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// AI router: model selection and key rotation - ONLY implementation in aiRouter.js
// Apply stricter rate limiting to AI endpoints (expensive operations)
app.use('/api/ai', aiRateLimiter, aiRouter);

// Recommendation router: intelligent recommendations using Vertex AI Gemini
// Apply stricter rate limiting to recommendation endpoints
app.use('/api/recommendations', aiRateLimiter, recommendationRouter);

// Apply general rate limiting to all other endpoints
app.use(generalRateLimiter);

// Compatibility: unify old frontend/server endpoint
// Some parts may call POST /api/ai/chat, while the real implementation is POST /api/ai/route
// We forward the request to aiRouter's /route handler via the same payload format.
// Apply AI rate limiter since this is an AI endpoint
app.post('/api/ai/chat', aiRateLimiter, (req, res) => {
  // Legacy compatibility route: forward to /api/ai/route
  // Frontend should use /api/ai/route only.
  const body = req.body || {};
  return app.handle(
    {
      method: 'POST',
      url: '/api/ai/route',
      headers: req.headers,
      body: {
        taskType: body.taskType ?? 'chat',
        inputText: body.inputText ?? body.prompt ?? body.text ?? '',
        systemPrompt: typeof body.systemPrompt === 'string' ? body.systemPrompt : (body.systemPrompt ?? ''),
        messages: body.messages,
        options: body.options ?? {},
        attachments: body.attachments,
        files: body.files
      }
    },
    res
  );
});

// NOTE: OpenRouter configuration and model selection are handled ONLY inside ./aiRouter.js
// ===========================================================
// AI routing is handled ONLY by ./aiRouter.js
// ===========================================================
// NOTE: Legacy/duplicated OpenRouter key/model rotation logic was removed to prevent:
// - undefined models/keys being logged
// - conflicting provider behavior

// ============================================
// FILE DOWNLOAD PROXY
// =============================================
// Browser-based downloads from Firebase Storage fail because the bucket is not
// configured for CORS and the objects are served with `Content-Disposition: inline`.
// This endpoint fetches the file on the server side (no browser CORS) and streams it
// back to the SAME origin with `Content-Disposition: attachment`, so the client gets a
// clean, named download without cross-origin fetch errors.
const ALLOWED_DOWNLOAD_HOSTS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
];

const isAllowedFirebaseHost = (hostname) => {
  if (ALLOWED_DOWNLOAD_HOSTS.includes(hostname)) return true;
  return hostname.endsWith('.firebasestorage.app') ||
    hostname.endsWith('.appspot.com') ||
    /^eduaiplatform-[a-zA-Z0-9]+\.firebasestorage\.app$/.test(hostname);
};

app.get('/api/files/download', async (req, res) => {
  try {
    const targetUrl = req.query.url;
    const requestedName =
      typeof req.query.name === 'string' && req.query.name.trim()
        ? req.query.name.trim()
        : 'download';

    if (typeof targetUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid url' });
    }

    if (parsed.protocol !== 'https:' || !isAllowedFirebaseHost(parsed.hostname)) {
      return res.status(403).json({
        success: false,
        error: `Host not allowed: ${parsed.hostname}`
      });
    }

    const upstream = await fetch(targetUrl, {
      redirect: 'follow',
      headers: {
        // Some Firebase download URLs include an auth token in the query string;
        // explicitly allowing it here ensures the server forwards the request
        // without stripping query parameters.
        Accept: '*/*',
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      return res.status(upstream.status).json({
        success: false,
        error: `Upstream returned ${upstream.status}: ${text || upstream.statusText}`
      });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');
    const disposition = upstream.headers.get('content-disposition') || '';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=0');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      const finalName = match?.[1] ? decodeURIComponent(match[1]) : requestedName;
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
      );
    } else {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(requestedName)}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`
      );
    }

    try {
      if (upstream.body && typeof Readable.fromWeb === 'function') {
        Readable.fromWeb(upstream.body).pipe(res);
      } else {
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
      }
    } catch (streamError) {
      console.error('Streaming error:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Streaming failed' });
      } else {
        res.end();
      }
    }
  } catch (error) {
    console.error('Download proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Download proxy failed', details: error.message });
    } else {
      res.end();
    }
  }
});

// ============================================
// HEALTH CHECK & STATUS
// ============================================

app.get('/api/health', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  
  // Check rate limit store status
  let rateLimitStatus = {
    fileExists: false,
    fileSize: 0,
    validJson: false,
    storeSize: 0
  };
  
  try {
    if (fs.existsSync(RATE_LIMIT_FILE)) {
      rateLimitStatus.fileExists = true;
      rateLimitStatus.fileSize = fs.statSync(RATE_LIMIT_FILE).size;
      
      const content = fs.readFileSync(RATE_LIMIT_FILE, 'utf8');
      const parsed = JSON.parse(content);
      rateLimitStatus.validJson = true;
      rateLimitStatus.storeSize = Object.keys(parsed).length;
    }
  } catch (error) {
    rateLimitStatus.error = error.message;
  }
  
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    aiConfigured: true,
    availableKeys: null,
    currentModel: 'handled-by-aiRouter',
    // Neon/PostgreSQL removed; Firebase (Firestore / Storage / Realtime) is the database.
    database: 'firebase',
    system: {
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
      },
      rateLimiting: rateLimitStatus,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        port: PORT
      }
    },
    services: {
      fileDownloadProxy: 'active',
      aiRouter: 'active',
      recommendationRouter: 'active',
      rateLimiting: rateLimitStatus.fileExists && rateLimitStatus.validJson ? 'active' : 'limited'
    }
  });
});



// ============================================
// SCHEDULED CONTENT AGGREGATION (recommendations)
// Periodically populates the recommendation_contents collection by calling the
// aggregation endpoint on this server. Fully automatic — no admin action needed.
// ============================================
const AGGREGATION_INTERVAL_MS = parseInt(process.env.AGGREGATION_INTERVAL_MS || '') || (6 * 60 * 60 * 1000);
const aggregationKey = process.env.RECOMMENDATION_AGGREGATION_KEY;

const runScheduledAggregation = () => {
  const url = `http://localhost:${PORT}/api/recommendations/aggregate`;
  const headers = { 'Content-Type': 'application/json' };
  if (aggregationKey) headers['x-aggregation-key'] = aggregationKey;
  console.log(`[scheduler] Starting scheduled aggregation at ${new Date().toISOString()}...`);
  fetch(url, { method: 'POST', headers, body: JSON.stringify({}) })
    .then((r) => {
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }
      return r.json();
    })
    .then((d) => console.log('[scheduler] aggregation completed:', JSON.stringify(d)))
    .catch((e) => {
      console.error('[scheduler] aggregation request failed:', e.message);
      // If the server isn't ready yet (e.g., still starting), retry once after a short delay
      if (e.message.includes('ECONNREFUSED') || e.message.includes('fetch failed')) {
        console.log('[scheduler] Server not ready, will retry on next interval...');
      }
    });
};

// Initial run shortly after startup (so content exists without waiting a full interval),
// then repeat on the configured interval.
setTimeout(runScheduledAggregation, 30 * 1000);
setInterval(runScheduledAggregation, AGGREGATION_INTERVAL_MS);

function startServer() {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduAI API Server running on port ${PORT}`);
  });
}

startServer();

module.exports = app;
