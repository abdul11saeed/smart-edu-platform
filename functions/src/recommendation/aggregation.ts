/**
 * Content aggregation: fetches RSS feeds, classifies with Gemini,
 * and stores items in Firestore.
 * Ported from server/recommendationRouter.js
 */

import {adminDb} from "./initialization.js";
import {extractKeywordsWithGemini, classifyContentWithGemini} from "./gemini.js";
import {
  MAX_RECOMMENDATION_SCAN,
  PROTECTED_SOURCE_CATEGORIES,
  RSS_SOURCES,
} from "./constants.js";
import {generateContentHash, normalizeTitle, normalizeGeminiCategory, determineContentType, detectLanguage, parseRss, ParsedFeedItem, aggregationRunning, setAggregationRunning} from "./helpers.js";

// Content TTL: 60 days
const CONTENT_TTL_MS = 60 * 24 * 60 * 60 * 1000;

interface AggregationItem extends ParsedFeedItem {
  source: string;
  category: string;
}

export interface AggregationResult {
  fetched: number;
  stored: number;
}

// ── RSS fetching ─────────────────────────────────────────────────────

export async function fetchRssFeed(url: string): Promise<ParsedFeedItem[]> {
  const maxRetries = 3;
  const baseDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "ar,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
        },
      });
      if (!response.ok) {
        if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            console.warn(`[aggregation] Retrying ${url} after ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries}, status: ${response.status})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }
        console.warn(`[aggregation] Failed to fetch RSS: ${url} - ${response.status}`);
        return [];
      }
      const text = await response.text();
      return parseRss(text);
    } catch (error: any) {
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.warn(`[aggregation] Retrying ${url} after ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries}: ${error.message})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      console.warn(`[aggregation] Error fetching RSS ${url}:`, error.message);
      return [];
    }
  }
  return [];
}

// ── Store one item ───────────────────────────────────────────────────

/**
 * Store a single aggregated RSS item: classify via Gemini (keywords + category),
 * derive content type, and write it to Firestore. Returns true if it was stored.
 */
export async function storeOneItem(
  item: AggregationItem,
  seenHashes: Set<string>,
  seenTitles: Set<string>
): Promise<boolean> {
  if (!adminDb) return false;

  // Skip items without a usable link
  if (!item.link || !item.link.trim()) {
    console.warn(`[aggregation] Skipped item with empty link: ${item.title?.slice(0, 60) || "untitled"} (source: ${item.source || "unknown"})`);
    return false;
  }

  const contentHash = generateContentHash(item.title, item.link);
  const normalizedTitle = normalizeTitle(item.title);

  // Guard against duplicates that appeared during this run
  if (seenHashes.has(contentHash)) return false;
  if (normalizedTitle && seenTitles.has(normalizedTitle)) return false;

  let keywords: string[] = [];
  let detectedCategory = item.category; // valid RSS-derived category
  const [kwRes, catRes] = await Promise.allSettled([
    extractKeywordsWithGemini(`${item.title} ${item.description}`),
    classifyContentWithGemini(item.title, item.description || ""),
  ]);
  if (kwRes.status === "fulfilled") keywords = kwRes.value || [];
  const normCat = normalizeGeminiCategory(catRes.status === "fulfilled" ? catRes.value : null);
  // Preserve source-specific categories (news/research/scholarships/training/
  // competitions/programming/cybersecurity). Gemini only classifies into broad
  // domains (tech/ai/medical/engineering/education), so letting it override
  // here would empty these tabs.
  if (normCat && !PROTECTED_SOURCE_CATEGORIES.includes(item.category)) {
    detectedCategory = normCat;
  }

  const contentType = determineContentType(item.title, item.description || "");
  const contentId = contentHash;
  const now = Date.now();
  const detectedLanguage = detectLanguage(`${item.title} ${item.description || ""}`);

  try {
    await adminDb.collection("recommendation_contents").doc(contentId).set({
      id: contentId,
      title: item.title,
      summary: (item.description || "").slice(0, 200) || item.title,
      description: item.description,
      imageUrl: item.imageUrl || "",
      sourceUrl: item.link,
      contentType,
      category: detectedCategory,
      source: item.source,
      publishedAt: item.pubDate ? parseInt(item.pubDate) : now,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + CONTENT_TTL_MS,
      normalizedTitle,
      keywords,
      tags: keywords.slice(0, 5),
      language: detectedLanguage,
      isActive: true,
      viewsCount: 0,
      likesCount: 0,
      sharesCount: 0,
      contentHash,
    });
    seenHashes.add(contentHash);
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    return true;
  } catch (error: any) {
    console.error("[aggregation] Error storing item:", error.message);
    return false;
  }
}

// ── Full aggregation run ─────────────────────────────────────────────

/**
 * Fetch all RSS sources, deduplicate against existing content, and store
 * new items via storeOneItem with bounded concurrency.
 */
export async function runContentAggregation(): Promise<AggregationResult> {
  if (!adminDb) {
    console.warn("[aggregation] Skipped: adminDb not initialized");
    return {fetched: 0, stored: 0};
  }

  // Build flat list of all sources with their category
  const sourceList: Array<{ name: string; url: string; category: string }> = [];
  for (const [cat, sources] of Object.entries(RSS_SOURCES)) {
    for (const s of sources) {
      sourceList.push({...s, category: cat});
    }
  }

  const rawItems: AggregationItem[] = [];
  const batchSize = 5;

  for (let i = 0; i < sourceList.length; i += batchSize) {
    const batch = sourceList.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((s) => fetchRssFeed(s.url)));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        r.value.forEach((item) =>
          rawItems.push({...item, source: batch[idx].name, category: batch[idx].category})
        );
      }
    });
    if (i + batchSize < sourceList.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Build dedup sets from existing content (bounded read)
  const seenHashes = new Set<string>();
  const seenTitles = new Set<string>();
  try {
    const existing = await adminDb
      .collection("recommendation_contents")
      .orderBy("createdAt", "desc")
      .limit(MAX_RECOMMENDATION_SCAN)
      .get();
    existing.forEach((doc: any) => {
      const data = doc.data();
      if (data.contentHash) seenHashes.add(data.contentHash);
      if (data.normalizedTitle) seenTitles.add(data.normalizedTitle);
    });
  } catch (error: any) {
    console.warn("[aggregation] Could not fetch existing content for dedup:", error.message);
  }

  // 1) Pre-filter duplicates against existing content
  const newItems: AggregationItem[] = [];
  for (const item of rawItems) {
    const h = generateContentHash(item.title, item.link);
    const n = normalizeTitle(item.title);
    if (seenHashes.has(h)) continue;
    if (n && seenTitles.has(n)) continue;
    newItems.push(item);
  }

  // 2) Store with bounded concurrency
  const CONCURRENCY = 5;
  let storedCount = 0;
  for (let i = 0; i < newItems.length; i += CONCURRENCY) {
    const batch = newItems.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((item) => storeOneItem(item, seenHashes, seenTitles))
    );
    storedCount += results.filter(Boolean).length;
  }

  const skippedCount = rawItems.length - newItems.length;
  console.log(`[aggregation] Fetched ${rawItems.length} items, pre-filtered ${skippedCount} (duplicates), stored ${storedCount} new.`);
  return {fetched: rawItems.length, stored: storedCount};
}

// ── Scheduled aggregation wrapper ────────────────────────────────────

/**
 * Lock-guarded runner so concurrent triggers (the Cloud Scheduler and the
 * lazy trigger in /generate) never overlap.
 */
export async function scheduledAggregation(): Promise<void> {
  if (aggregationRunning || !adminDb) return;
  setAggregationRunning(true);
  try {
    const result = await runContentAggregation();
    console.log("[aggregation] Run complete:", result);
  } catch (e: any) {
    console.error("[aggregation] Run failed:", e.message);
  } finally {
    setAggregationRunning(false);
  }
}
