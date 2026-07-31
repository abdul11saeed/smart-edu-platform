/**
 * File Download Proxy Router
 *
 * Browser-based downloads from Firebase Storage can fail because the bucket is not
 * configured for CORS and objects may be served with `Content-Disposition: inline`.
 * This endpoint fetches the file on the server side (no browser CORS) and streams it
 * back to the SAME origin with `Content-Disposition: attachment`, so the client gets a
 * clean, named download without cross-origin fetch errors.
 *
 * Ported from server/index.js → Express Router for Firebase Cloud Functions.
 */

import {Router} from "express";
import type {Request as ExpressRequest, Response as ExpressResponse} from "express";
import {Readable} from "stream";

const router = Router();

const ALLOWED_DOWNLOAD_HOSTS = [
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
];

function isAllowedFirebaseHost(hostname: string): boolean {
  if (ALLOWED_DOWNLOAD_HOSTS.includes(hostname)) return true;
  return (
    hostname.endsWith(".firebasestorage.app") ||
    hostname.endsWith(".appspot.com") ||
    /^eduaiplatform-[a-zA-Z0-9]+\.firebasestorage\.app$/.test(hostname)
  );
}

router.get("/download", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const targetUrl = req.query.url;
    const requestedName =
      typeof req.query.name === "string" && req.query.name.trim() ?
        req.query.name.trim() :
        "download";

    if (typeof targetUrl !== "string") {
      return void res.status(400).json({success: false, error: "Missing url parameter"});
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return void res.status(400).json({success: false, error: "Invalid url"});
    }

    if (parsed.protocol !== "https:" || !isAllowedFirebaseHost(parsed.hostname)) {
      return void res.status(403).json({
        success: false,
        error: `Host not allowed: ${parsed.hostname}`,
      });
    }

    const upstream = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        Accept: "*/*",
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return void res.status(upstream.status).json({
        success: false,
        error: `Upstream returned ${upstream.status}: ${text || upstream.statusText}`,
      });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstream.headers.get("content-length");
    const disposition = upstream.headers.get("content-disposition") || "";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=0");
    if (contentLength) res.setHeader("Content-Length", contentLength);

    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      const finalName = match?.[1] ? decodeURIComponent(match[1]) : requestedName;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(finalName)}"; filename*=UTF-8''${encodeURIComponent(finalName)}`
      );
    } else {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(requestedName)}"; filename*=UTF-8''${encodeURIComponent(requestedName)}`
      );
    }

    try {
      if (upstream.body && typeof Readable.fromWeb === "function") {
        (Readable.fromWeb as any)(upstream.body).pipe(res);
      } else {
        const buf = Buffer.from(await upstream.arrayBuffer());
        res.send(buf);
      }
    } catch (streamError) {
      console.error("Streaming error:", streamError);
      if (!res.headersSent) {
        res.status(500).json({success: false, error: "Streaming failed"});
      } else {
        res.end();
      }
    }
  } catch (error: any) {
    console.error("Download proxy error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({success: false, error: "Download proxy failed", details: error.message});
    } else {
      res.end();
    }
  }
});

export default router;
