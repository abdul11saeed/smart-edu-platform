/**
 * Recommendation Router — Express Router for all /api/recommendations/* endpoints.
 * Ported from server/recommendationRouter.js to TypeScript for Firebase Cloud Functions.
 *
 * Delegates helper logic to the recommendation/ subdirectory to avoid code duplication.
 */

import {Router} from "express";
import type {Request as ExpressRequest, Response as ExpressResponse} from "express";

import {adminDb, FieldValue, generativeModel, projectId, location} from "./recommendation/initialization.js";
import {extractKeywordsWithGemini, classifyContentWithGemini} from "./recommendation/gemini.js";
import {runContentAggregation} from "./recommendation/aggregation.js";
import {
  setAggregationRunning,
  aggregationRunning,
  guaranteeMinimumItems,
  getUidFromRequest,
  getCachedRecommendations,
  setCachedRecommendations,
  invalidateUserRecommendations,
  recCacheKey,
  langFirstComparator,
  sortByBadgePriority,
  calculateBadge,
  getStudentInterests,
  getStudentHiddenIds,
  getStudentLikedIds,
  getStudentSavedIds,
  trackActivity,
} from "./recommendation/helpers";

import {MAX_RECOMMENDATION_SCAN, ACTIVITY_POINTS, NON_STORED_CATEGORIES} from "./recommendation/constants.js";

const router = Router();

// ── Recommendation generation ───────────────────────────────────────

router.post("/generate", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);

    if (!adminDb) {
      console.error("[recommendations] adminDb not initialized. Check service-account / env.");
      return void res.status(503).json({
        error: {message: "Recommendations backend is not ready (database not initialized)."},
      });
    }

    const {
      category = "recommended",
      limit = 20,
      searchQuery = "",
      page = 1,
      preferredLanguage,
      requiredCount,
    } = req.body as {
      category?: string;
      limit?: number;
      searchQuery?: string;
      page?: number;
      preferredLanguage?: string;
      requiredCount?: number;
    };

    const pageSize = Math.min(parseInt(limit as any) || 20, 50);
    const effectivePreferredLanguage = preferredLanguage === "ar" ? "ar" : "en";
    const minRequired = parseInt(requiredCount as any) || pageSize;

    const recKey = recCacheKey(category, userId, searchQuery, page, pageSize, effectivePreferredLanguage);
    const cachedRecs = getCachedRecommendations(recKey);
    if (cachedRecs) {
      return void res.json(cachedRecs);
    }

    const interests = await getStudentInterests(userId || "");
    const hiddenIds = await getStudentHiddenIds(userId || "");
    const savedIds = await getStudentSavedIds(userId || "");
    const likedIds = userId ? await getStudentLikedIds(userId) : [];

    let query = adminDb
      .collection("recommendation_contents")
      .where("isActive", "==", true);
    if (!NON_STORED_CATEGORIES.includes(category)) {
      query = query.where("category", "==", category);
    }
    query = query.orderBy("createdAt", "desc").limit(MAX_RECOMMENDATION_SCAN);

    let snapshot;
    try {
      snapshot = await query.get();
    } catch (e) {
      console.warn("Ordered query failed, trying fallback:", (e as any).message);
      let fallbackQuery = adminDb
        .collection("recommendation_contents")
        .where("isActive", "==", true);
      if (!NON_STORED_CATEGORIES.includes(category)) {
        fallbackQuery = fallbackQuery.where("category", "==", category);
      }
      snapshot = await fallbackQuery.limit(MAX_RECOMMENDATION_SCAN).get();
    }

    let contents: any[] = snapshot.docs.map((doc: any) => ({id: doc.id, ...doc.data()}));
    contents = contents.filter((c) => !hiddenIds.includes(c.id));

    const nowMs = Date.now();
    contents = contents.filter((c: any) => !c.expiresAt || c.expiresAt > nowMs);

    if (searchQuery && searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      contents = contents.filter((c: any) => {
        const searchFields = [
          c.title, c.summary, c.description, c.category,
          ...(c.keywords || []), ...(c.tags || []), c.source,
        ].filter(Boolean).join(" ").toLowerCase();
        return searchFields.includes(queryLower);
      });
    }

    contents = contents.filter((c: any) => c.title && c.sourceUrl && c.title.trim() && c.sourceUrl.trim());
    const scannedPool = contents;

    if (category === "recommended") {
      const userCategories: string[] = [];
      const userKeywords: string[] = [];
      const VALID_RECOMMEND_CATS = [
        "tech", "ai", "programming", "cybersecurity", "medical", "engineering", "free_courses",
        "news", "research", "scholarships", "training", "competitions",
      ];

      if (interests?.interests) {
        Object.entries(interests.interests).forEach(([key, weight]) => {
          if ((weight as number) >= 1) {
            const k = String(key).toLowerCase();
            if (VALID_RECOMMEND_CATS.includes(k)) {
              userCategories.push(k);
            } else {
              userKeywords.push(k);
            }
          }
        });
      }

      if (userCategories.length === 0 && userKeywords.length === 0) {
        const DEFAULT_PUBLIC_LIMIT = 30;
        const categoryOrder = [
          "free_courses", "news", "research", "tech", "ai", "scholarships",
          "medical", "engineering", "competitions", "training", "programming", "cybersecurity",
        ];
        const byCat = new Map<string, any[]>();
        contents.forEach((c) => {
          const key = c.category || "general";
          if (!byCat.has(key)) byCat.set(key, []);
          byCat.get(key)!.push(c);
        });

        const langSortKey = (a: any, b: any): number => {
          const aLang = (a.language || "").toLowerCase();
          const bLang = (b.language || "").toLowerCase();
          const aIsPreferred = aLang === effectivePreferredLanguage ? 1 : 0;
          const bIsPreferred = bLang === effectivePreferredLanguage ? 1 : 0;
          if (aIsPreferred !== bIsPreferred) return bIsPreferred - aIsPreferred;
          const aScore = (a.viewsCount || 0) + (a.likesCount || 0) * 10;
          const bScore = (b.viewsCount || 0) + (b.likesCount || 0) * 10;
          return bScore - aScore;
        };

        const diversified: any[] = [];
        let added = true;
        for (let round = 0; added && diversified.length < DEFAULT_PUBLIC_LIMIT; round++) {
          added = false;
          for (const cat of categoryOrder) {
            const arr = byCat.get(cat);
            if (arr && arr[round]) {
              const sortedArr = [...arr].sort(langSortKey);
              const item = sortedArr[round];
              if (item) {
                diversified.push(item); added = true;
              }
            }
          }
          const others = byCat.get("general");
          if (others && others[round]) {
            const sortedOthers = [...others].sort(langSortKey);
            const item = sortedOthers[round];
            if (item) {
              diversified.push(item); added = true;
            }
          }
        }

        const popularSorted = [...contents].sort(
          langFirstComparator(effectivePreferredLanguage, (a, b) =>
            ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
            ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
          )
        );
        const seen = new Set(diversified.map((d) => d.id));
        for (const p of popularSorted) {
          if (!seen.has(p.id) && diversified.length < DEFAULT_PUBLIC_LIMIT) diversified.push(p);
        }
        contents = diversified;
      } else {
        contents = contents.map((content) => {
          let score = 0;
          const contentCategory = content.category || "";
          const contentKeywords = content.keywords || [];
          const contentTags = content.tags || [];
          const contentSource = (content.source || "").toLowerCase();
          const contentTitle = (content.title || "").toLowerCase();

          userCategories.forEach((cat) => {
            if (contentCategory === cat) score += 10;
            if (cat === "tech" && ["tech", "ai", "programming", "cybersecurity"].includes(contentCategory)) score += 8;
            if (cat === "ai" && contentCategory === "ai") score += 12;
            if (cat === "programming" && contentCategory === "programming") score += 12;
            if (cat === "cybersecurity" && contentCategory === "cybersecurity") score += 12;
            if (cat === "medical" && contentCategory === "medical") score += 12;
            if (cat === "engineering" && contentCategory === "engineering") score += 12;
          });

          userKeywords.forEach((keyword) => {
            const kwLower = keyword.toLowerCase();
            if (contentKeywords.some((k: string) => k.toLowerCase().includes(kwLower))) score += 5;
            if (contentTags.some((t: string) => t.toLowerCase().includes(kwLower))) score += 3;
            if (contentTitle.includes(kwLower)) score += 2;
            if (contentSource.includes(kwLower)) score += 1;
          });

          if (savedIds.includes(content.id)) score += 15;

          const contentLang = (content.language || "").toLowerCase();
          if (contentLang === effectivePreferredLanguage) {
            score += effectivePreferredLanguage === "ar" ? 8 : 3;
          }

          score += Math.min((content.viewsCount || 0) / 100, 10);
          score += Math.min((content.likesCount || 0) / 10, 5);

          const ageHours = (Date.now() - (content.createdAt || Date.now())) / (1000 * 60 * 60);
          if (ageHours < 24) score += 3;
          else if (ageHours < 72) score += 1;

          return {...content, recommendationScore: score};
        });

        contents.sort(
          langFirstComparator(effectivePreferredLanguage, (a, b) =>
            (b.recommendationScore || 0) - (a.recommendationScore || 0)
          )
        );
      }
    } else if (category === "saved") {
      try {
        const savedSnapshot = await adminDb
          .collection("saved_recommendations")
          .where("userId", "==", userId)
          .get();
        const savedMap = new Map<string, number>();
        savedSnapshot.forEach((d: any) => {
          const data = d.data();
          savedMap.set(data.contentId, data.savedAt || 0);
        });
        if (savedMap.size === 0) {
          contents = [];
        } else {
          const docs = await Promise.all(
            [...savedMap.keys()].map((id) =>
              adminDb.collection("recommendation_contents").doc(id).get()
            )
          );
          contents = docs
            .filter((d: any) => d.exists)
            .map((d: any) => ({id: d.id, ...d.data()}));
          contents = contents.filter((c) => !hiddenIds.includes(c.id));
          contents = contents.filter((c: any) => !c.expiresAt || c.expiresAt > nowMs);
          if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            contents = contents.filter((c: any) => {
              const fields = [c.title, c.summary, c.description, c.category, ...(c.keywords || []), ...(c.tags || []), c.source].filter(Boolean).join(" ").toLowerCase();
              return fields.includes(q);
            });
          }
          contents.sort(
            langFirstComparator(effectivePreferredLanguage, (a, b) =>
              (savedMap.get(b.id) || 0) - (savedMap.get(a.id) || 0)
            )
          );
        }
      } catch (e) {
        console.warn("Saved items fetch failed, falling back to scan:", (e as any).message);
        contents = contents.filter((c) => savedIds.includes(c.id));
      }
    } else if (category === "popular") {
      contents.sort(
        langFirstComparator(effectivePreferredLanguage, (a, b) =>
          ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
          ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
        )
      );
    } else {
      const typeMap: Record<string, string> = {
        news: "news",
        research: "research",
        scholarships: "scholarship",
        competitions: "competition",
        training: "training",
      };
      if (typeMap[category]) {
        contents = contents.filter((c: any) => c.category === category || c.contentType === typeMap[category]);
      } else {
        contents = contents.filter((c: any) => c.category === category);
      }
      contents.sort(
        langFirstComparator(effectivePreferredLanguage, (a, b) =>
          (b.createdAt || 0) - (a.createdAt || 0)
        )
      );

      const MIN_CATEGORY_ITEMS = 6;
      if (contents.length < MIN_CATEGORY_ITEMS) {
        const popularSorted = [...scannedPool].sort(
          langFirstComparator(effectivePreferredLanguage, (a, b) =>
            ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
            ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
          )
        );
        const existingIds = new Set(contents.map((c) => c.id));
        const filler = popularSorted
          .filter((c) => !existingIds.has(c.id))
          .slice(0, MIN_CATEGORY_ITEMS - contents.length);
        contents = [...contents, ...filler];
      }
    }

    // Blend popular items for 'recommended' when sparse
    if (category === "recommended" && contents.length < pageSize) {
      const popularSorted = [...scannedPool].sort(
        langFirstComparator(effectivePreferredLanguage, (a, b) =>
          ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
          ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
        )
      );
      const existingIds = new Set(contents.map((c) => c.id));
      const filler = popularSorted.filter((c) => !existingIds.has(c.id)).slice(0, pageSize - contents.length);
      contents = [...contents, ...filler];
    }

    // Guarantee minimum items via fallback categories
    contents = await guaranteeMinimumItems(
      contents, category, minRequired, userId, searchQuery,
      effectivePreferredLanguage, hiddenIds, savedIds, nowMs, scannedPool
    );

    // Pagination
    const fullContentsList = [...contents];
    const totalItems = fullContentsList.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const currentPage = Math.min(Math.max(1, parseInt(page as any) || 1), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedContents = fullContentsList.slice(startIndex, startIndex + pageSize);

    // Assign badges and saved/liked state
    const contentsWithBadges = paginatedContents.map((content) => ({
      ...content,
      badge: calculateBadge(content),
      ...(userId ? {
        isSaved: savedIds.includes(content.id),
        isLiked: likedIds.includes(content.id),
      } : {}),
    }));

    const sortedContents = sortByBadgePriority(contentsWithBadges);
    sortedContents.sort(
      langFirstComparator("ar", (a, b) =>
        ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
        ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
      )
    );

    // Self-healing: trigger aggregation if collection is critically low
    const isCriticallyLow = category === "recommended" && totalItems < 5;
    if ((totalItems === 0 || isCriticallyLow) && adminDb && !aggregationRunning) {
      console.warn(`[recommendations] Self-healing triggered: category=${category}, items=${totalItems}. Starting background aggregation...`);
      setAggregationRunning(true);
      Promise.resolve()
        .then(() => runContentAggregation())
        .then((result) => console.log("[aggregation] Self-healing run complete:", result))
        .catch((e: any) => console.error("[aggregation] Self-healing run failed:", e.message))
        .finally(() => setAggregationRunning(false));
    }

    const responsePayload = {
      success: true,
      data: sortedContents,
      category,
      total: totalItems,
      page: currentPage,
      pageSize,
      totalPages,
    };

    if (sortedContents.length > 0) {
      setCachedRecommendations(recKey, responsePayload);
    }

    res.json(responsePayload);
  } catch (error: any) {
    console.error("Generate recommendations error:", error);
    res.status(500).json({error: {message: "Failed to generate recommendations"}});
  }
});

// ── Save / Unsave ───────────────────────────────────────────────────

router.post("/save", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);
    if (!userId) return void res.status(401).json({error: {message: "Unauthorized"}});

    const {contentId} = req.body as { contentId?: string };
    if (!contentId) return void res.status(400).json({error: {message: "contentId is required"}});
    if (!adminDb) return void res.status(500).json({error: {message: "Database not initialized"}});

    const saveRef = adminDb.collection("saved_recommendations").doc(`${userId}_${contentId}`);
    await saveRef.set({
      id: `${userId}_${contentId}`,
      userId,
      contentId,
      savedAt: Date.now(),
      createdAt: Date.now(),
    });

    await trackActivity(userId, "save", {contentType: "recommendation", contentId});
    invalidateUserRecommendations(userId);

    res.json({success: true, message: "Saved successfully"});
  } catch (error: any) {
    console.error("Save recommendation error:", error);
    res.status(500).json({error: {message: "Failed to save recommendation"}});
  }
});

router.delete("/save", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);
    if (!userId) return void res.status(401).json({error: {message: "Unauthorized"}});

    const {contentId} = req.body as { contentId?: string };
    if (!contentId) return void res.status(400).json({error: {message: "contentId is required"}});
    if (!adminDb) return void res.status(500).json({error: {message: "Database not initialized"}});

    await adminDb.collection("saved_recommendations").doc(`${userId}_${contentId}`).delete();
    res.json({success: true, message: "Removed from saved"});
  } catch (error: any) {
    console.error("Unsave recommendation error:", error);
    res.status(500).json({error: {message: "Failed to unsave recommendation"}});
  }
});

// ── Like ────────────────────────────────────────────────────────────

router.post("/like", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);
    if (!userId) return void res.status(401).json({error: {message: "Unauthorized"}});

    const {contentId} = req.body as { contentId?: string };
    if (!contentId) return void res.status(400).json({error: {message: "contentId is required"}});
    if (!adminDb) return void res.status(500).json({error: {message: "Database not initialized"}});

    const likeRef = adminDb.collection("liked_recommendations").doc(`${userId}_${contentId}`);
    const doc = await likeRef.get();

    if (doc.exists) {
      await likeRef.delete();
      await adminDb.collection("recommendation_contents").doc(contentId).update({
        likesCount: FieldValue.increment(-1),
      });
    } else {
      await likeRef.set({
        id: `${userId}_${contentId}`,
        userId,
        contentId,
        likedAt: Date.now(),
        createdAt: Date.now(),
      });
      await adminDb.collection("recommendation_contents").doc(contentId).update({
        likesCount: FieldValue.increment(1),
      });
      await trackActivity(userId, "like", {contentType: "recommendation", contentId});
    }

    invalidateUserRecommendations(userId);
    res.json({success: true, liked: !doc.exists});
  } catch (error: any) {
    console.error("Like recommendation error:", error);
    res.status(500).json({error: {message: "Failed to like recommendation"}});
  }
});

// ── Hide ────────────────────────────────────────────────────────────

router.post("/hide", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);
    if (!userId) return void res.status(401).json({error: {message: "Unauthorized"}});

    const {contentId, reason = "user_hidden"} = req.body as { contentId?: string; reason?: string };
    if (!contentId) return void res.status(400).json({error: {message: "contentId is required"}});
    if (!adminDb) return void res.status(500).json({error: {message: "Database not initialized"}});

    const hideRef = adminDb.collection("hidden_recommendations").doc(`${userId}_${contentId}`);
    await hideRef.set({
      id: `${userId}_${contentId}`,
      userId,
      contentId,
      reason,
      hiddenAt: Date.now(),
      createdAt: Date.now(),
    });

    invalidateUserRecommendations(userId);
    res.json({success: true, message: "Hidden successfully"});
  } catch (error: any) {
    console.error("Hide recommendation error:", error);
    res.status(500).json({error: {message: "Failed to hide recommendation"}});
  }
});

// ── Activity tracking ───────────────────────────────────────────────

router.post("/activity", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);
    if (!userId) return void res.status(401).json({error: {message: "Unauthorized"}});

    const {activityType, metadata = {}} = req.body as {
      activityType?: string;
      metadata?: Record<string, any>;
    };

    await trackActivity(userId, activityType || "", metadata);
    res.json({success: true, points: ACTIVITY_POINTS[activityType || ""] || 0});
  } catch (error: any) {
    console.error("Track activity error:", error);
    res.status(500).json({error: {message: "Failed to track activity"}});
  }
});

// ── Stats ───────────────────────────────────────────────────────────

router.get("/stats", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const userId = await getUidFromRequest(req);
    if (!userId) {
      console.warn("[recommendations] /stats unauthorized: missing/invalid Authorization bearer token.");
      return void res.status(401).json({error: {message: "Unauthorized"}});
    }

    const interests = await getStudentInterests(userId);
    const savedIds = await getStudentSavedIds(userId);

    res.json({
      success: true,
      data: {
        totalPoints: interests?.totalPoints || 0,
        savedCount: savedIds.length,
        topInterests: interests?.interests ?
          Object.entries(interests.interests)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .slice(0, 10)
            .map(([name, count]) => ({name, count})) :
          [],
      },
    });
  } catch (error: any) {
    console.error("Get stats error:", error);
    res.status(500).json({error: {message: "Failed to get stats"}});
  }
});

// ── Enhance content ─────────────────────────────────────────────────

router.post("/enhance", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    if (!(await getUidFromRequest(req))) {
      return void res.status(401).json({error: {message: "Unauthorized"}});
    }

    const {title, description} = req.body as { title?: string; description?: string };
    if (!title) return void res.status(400).json({error: {message: "Title is required"}});

    const text = `${title} ${description || ""}`;
    const [keywordsResult, categoryResult] = await Promise.allSettled([
      extractKeywordsWithGemini(text),
      classifyContentWithGemini(title, description || ""),
    ]);

    const keywords = keywordsResult.status === "fulfilled" ? keywordsResult.value : [];
    const category = categoryResult.status === "fulfilled" ? categoryResult.value : null;
    const summary = description ? description.slice(0, 200) : title;

    res.json({
      success: true,
      data: {keywords, summary, category, domain: category},
    });
  } catch (error: any) {
    console.error("Enhance content error:", error);
    res.status(500).json({error: {message: "Failed to enhance content"}});
  }
});

// ── Aggregation trigger ─────────────────────────────────────────────

router.post("/aggregate", async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const expectedKey = process.env.RECOMMENDATION_AGGREGATION_KEY;
    if (expectedKey && req.headers?.["x-aggregation-key"] !== expectedKey) {
      return void res.status(401).json({error: {message: "Unauthorized"}});
    }
    const result = await runContentAggregation();
    res.json({success: true, data: result});
  } catch (error: any) {
    console.error("Aggregation error:", error);
    res.status(500).json({error: {message: "Aggregation failed"}});
  }
});

// ── Health ──────────────────────────────────────────────────────────

router.get("/health", (_req: ExpressRequest, res: ExpressResponse) => {
  res.json({
    status: "ok",
    geminiAvailable: !!generativeModel,
    projectId,
    location,
    timestamp: new Date().toISOString(),
  });
});

export default router;
