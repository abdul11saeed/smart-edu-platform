// Recommendation Router - Handles intelligent recommendations using Vertex AI Gemini
// All AI calls go through the backend to keep credentials secure
// Uses the project's Vertex AI Gemini instance (eduaiplatform-39fe9)

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import Firebase Admin for server-side Firestore access
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Resolve the service-account credentials path robustly.
// The env value may be relative (e.g. ./service-account-key.json), which breaks
// when the server is launched from a different working directory. We resolve it
// against this file's directory so it works regardless of the launch CWD.
function resolveServiceAccountPath() {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const candidates = [];
    if (raw) {
        candidates.push(path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw));
        candidates.push(path.resolve(__dirname, raw));
    }
    // Fallback to the conventional location next to this file.
    candidates.push(path.resolve(__dirname, 'service-account-key.json'));
    for (const p of candidates) {
        try {
            if (p && fs.existsSync(p)) return p;
        } catch {
            // ignore and try next candidate
        }
    }
    return null;
}

// Initialize Firebase Admin (server-side)
let adminDb;
try {
    let adminApp;
    if (getApps().length === 0) {
        const saPath = resolveServiceAccountPath();
        if (saPath) {
            // Ensure downstream Google libraries can also find the credentials.
            process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;
            const serviceAccount = require(saPath);
            adminApp = initializeApp({ credential: cert(serviceAccount) });
            console.log(`✅ Firebase Admin initialized with service account: ${saPath}`);
        } else {
            // Fall back to Application Default Credentials (e.g. on GCP).
            adminApp = initializeApp();
            console.warn('⚠️ Firebase Admin initialized without an explicit service account (using ADC). Set GOOGLE_APPLICATION_CREDENTIALS if this is unintended.');
        }
    } else {
        adminApp = getApps()[0];
    }
    adminDb = getFirestore(adminApp);
} catch (error) {
    console.error('Firebase Admin initialization failed. Ensure service-account-key.json exists in server/ and GOOGLE_APPLICATION_CREDENTIALS is set in server/.env:', error.message);
}

// Import Vertex AI
const { VertexAI } = require('@google-cloud/vertexai');

// Initialize Vertex AI
let vertexAI;
let generativeModel;
let projectId = process.env.GOOGLE_CLOUD_PROJECT || 'eduaiplatform-39fe9';
let location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

try {
    vertexAI = new VertexAI({
        project: projectId,
        location: location,
    });
    // Use Gemini 1.5 Flash for cost efficiency, or Pro for better quality
    const modelName = process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash';
    generativeModel = vertexAI.preview.getGenerativeModel({
        model: modelName,
    });
    console.log(`✅ Vertex AI Gemini initialized: ${modelName} (${projectId}/${location})`);
} catch (error) {
    console.warn('⚠️ Vertex AI initialization failed (recommendations will use fallback logic):', error.message);
}

const router = express.Router();

// Middleware
router.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));
router.use(express.json({ limit: '10mb' }));

// ============================================
// HELPER FUNCTIONS
// ============================================

// Resolve the authenticated user id.
//
// SECURITY (C4): we ONLY trust a uid that is cryptographically verified from a
// Firebase ID token in the Authorization header. We never fall back to a
// client-supplied `x-user-id` / body `userId` — that would let any caller forge
// another user's identity on /save, /like, /hide and /activity. If no valid
// token is present the request is treated as anonymous (null uid), which is only
// acceptable for the public /generate endpoint.
async function getUidFromRequest(req) {
    const authHeader = req.headers?.['authorization'] || req.headers?.['Authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const auth = getAuth();
            const decoded = await auth.verifyIdToken(authHeader.slice(7));
            if (decoded && decoded.uid) return decoded.uid;
        } catch (e) {
            // Do not leak secrets/tokens; only log category
            console.warn('[recommendations] Token verification failed:', e?.message || String(e));
        }
    } else {
        // Helps diagnose 401 issues: missing Authorization header or wrong scheme
        if (authHeader) {
            console.warn('[recommendations] Authorization header present but not Bearer');
        } else {
            console.warn('[recommendations] Missing Authorization header');
        }
    }
    // No valid token → anonymous.
    return null;
}

function generateContentId() {
    return `rec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Badge priority order
const BADGE_PRIORITY = ['urgent', 'ending_soon', 'new', 'popular', 'recommended', 'free_course', 'trending'];

// Content categories matching frontend requirements
const CONTENT_CATEGORIES = {
    recommended: '⭐ المقترح لك',
    tech: '💻 تقنية المعلومات',
    ai: '🤖 الذكاء الاصطناعي',
    programming: '👨‍💻 البرمجة',
    cybersecurity: '🔒 الأمن السيبراني',
    medical: '🏥 الطب',
    engineering: '⚙️ الهندسة',
    free_courses: '📚 الدورات المجانية',
    news: '📰 الأخبار',
    research: '📄 الأبحاث العلمية',
    scholarships: '🎓 المنح',
    training: '💼 التدريب والوظائف',
    competitions: '🏆 المسابقات',
    popular: '🔥 الأكثر شيوعاً',
    saved: '❤️ المحفوظات',
};

// Content types
const CONTENT_TYPES = {
    article: 'مقال',
    news: 'خبر',
    course: 'دورة',
    research: 'بحث',
    pdf: 'ملف PDF',
    video: 'فيديو تعليمي',
    workshop: 'ورشة عمل',
    conference: 'مؤتمر',
    scholarship: 'منحة',
    competition: 'مسابقة',
    training: 'تدريب',
};

// Fallback categories when a specific category has insufficient content.
// The engine will pull from these related categories to guarantee filled cards.
const FALLBACK_CATEGORIES = {
    ai: ['tech', 'programming', 'free_courses', 'research', 'recommended'],
    tech: ['ai', 'programming', 'cybersecurity', 'engineering', 'free_courses', 'recommended'],
    programming: ['tech', 'ai', 'free_courses', 'recommended'],
    cybersecurity: ['tech', 'ai', 'programming', 'recommended'],
    medical: ['research', 'ai', 'free_courses', 'recommended'],
    engineering: ['tech', 'free_courses', 'research', 'recommended'],
    free_courses: ['tech', 'ai', 'programming', 'training', 'recommended'],
    news: ['research', 'tech', 'recommended'],
    research: ['news', 'medical', 'ai', 'recommended'],
    scholarships: ['training', 'free_courses', 'recommended'],
    training: ['free_courses', 'scholarships', 'recommended'],
    competitions: ['scholarships', 'free_courses', 'recommended'],
    popular: ['recommended', 'free_courses', 'news'],
    recommended: ['free_courses', 'news', 'tech', 'ai', 'research', 'scholarships', 'training', 'competitions', 'medical', 'engineering', 'popular', 'programming', 'cybersecurity'],
};

// Activity points configuration
// Cap how many active docs we scan for virtual categories (recommended/saved)
// to bound Firestore read cost as the collection grows.
const MAX_RECOMMENDATION_SCAN = 300;

const ACTIVITY_POINTS = {
    open_file: 5,
    download_file: 3,
    search: 4,
    like: 2,
    save: 3,
    discussion: 5,
    ask_question: 6,
    complete_course: 8,
    upload_file: 4,
};

// Short-TTL server-side cache for generated recommendation lists. Keeps the
// endpoint cheap under load (it otherwise re-runs scoring + several Firestore
// reads on every request). Concurrent users share it. Volatile/empty results
// are NOT cached, so the self-healing aggregation still triggers on empty.
const recommendationCache = new Map();

// Comparator that sorts items by preferred language first (Arabic when UI is Arabic),
// then by a secondary comparator (e.g. engagement, date, score).
function langFirstComparator(preferredLanguage, secondaryFn) {
    return (a, b) => {
        const aLang = (a.language || '').toLowerCase();
        const bLang = (b.language || '').toLowerCase();
        const aPref = aLang === preferredLanguage ? 1 : 0;
        const bPref = bLang === preferredLanguage ? 1 : 0;
        if (aPref !== bPref) return bPref - aPref; // preferred language first
        if (secondaryFn) return secondaryFn(a, b);
        return 0;
    };
}
const REC_CACHE_TTL_MS = 30 * 1000;

function recCacheKey(category, userId, searchQuery, page, pageSize, preferredLanguage) {
    return [
        userId || 'public',
        category || 'recommended',
        (searchQuery || '').toLowerCase().trim(),
        page || 1,
        pageSize || 20,
        preferredLanguage || 'en',
    ].join('|');
}

function getCachedRecommendations(key) {
    const entry = recommendationCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > REC_CACHE_TTL_MS) {
        recommendationCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCachedRecommendations(key, data) {
    if (recommendationCache.size >= 200) {
        const oldest = recommendationCache.keys().next().value;
        if (oldest) recommendationCache.delete(oldest);
    }
    recommendationCache.set(key, { ts: Date.now(), data });
}

function invalidateUserRecommendations(userId) {
    if (!userId) return;
    for (const key of recommendationCache.keys()) {
        if (key.startsWith(`${userId}|`)) recommendationCache.delete(key);
    }
}

// Guarantee that a category has at least requiredCount items by pulling
// from fallback categories when the primary category is sparse.
// This ensures NO card is ever left empty.
async function guaranteeMinimumItems(
    contents,
    category,
    requiredCount,
    userId,
    searchQuery,
    effectivePreferredLanguage,
    hiddenIds,
    savedIds,
    nowMs,
    scannedPool
) {
    if (contents.length >= requiredCount) return contents;

    const existingIds = new Set(contents.map(c => c.id));
    const fallbacks = FALLBACK_CATEGORIES[category] || ['recommended'];

    for (const fallbackCat of fallbacks) {
        if (contents.length >= requiredCount) break;

        // Build query for fallback category
        const nonStoredCategories = [
            'recommended', 'saved', 'popular',
        ];

        let query = adminDb
            .collection('recommendation_contents')
            .where('isActive', '==', true);
        if (!nonStoredCategories.includes(fallbackCat)) {
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
            if (!nonStoredCategories.includes(fallbackCat)) {
                fallbackQuery = fallbackQuery.where('category', '==', fallbackCat);
            }
            snapshot = await fallbackQuery.limit(MAX_RECOMMENDATION_SCAN).get();
        }

        let fallbackContents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        fallbackContents = fallbackContents.filter(c => !hiddenIds.includes(c.id));
        fallbackContents = fallbackContents.filter(c => !c.expiresAt || c.expiresAt > nowMs);

        if (searchQuery && searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            fallbackContents = fallbackContents.filter(c => {
                const fields = [c.title, c.summary, c.description, c.category, ...(c.keywords || []), ...(c.tags || []), c.source].filter(Boolean).join(' ').toLowerCase();
                return fields.includes(q);
            });
        }

        // Sort by engagement for fallback
        fallbackContents.sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
            ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
            ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
        ));

        // Data quality: filter out items missing required fields
        fallbackContents = fallbackContents.filter(c => c.title && c.sourceUrl && c.title.trim() && c.sourceUrl.trim());

        const newItems = fallbackContents.filter(c => !existingIds.has(c.id));
        newItems.forEach(c => existingIds.add(c.id));
        contents = [...contents, ...newItems];
    }

    return contents;
}

// ============================================
// GEMINI HELPER FUNCTIONS
// ============================================

async function callGemini(prompt, systemPrompt = null) {
    if (!generativeModel) {
        return null; // Fallback when Gemini is not available
    }

    try {
        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };

        if (systemPrompt) {
            request.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        const response = await generativeModel.generateContent(request);
        const result = await response.response;
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || null;
        return text;
    } catch (error) {
        console.error('Gemini call error:', error);
        return null;
    }
}

async function extractKeywordsWithGemini(text) {
    const prompt = `استخرج من النص التالي 5-10 كلمات مفتاحية مناسبة للتصنيف الأكاديمي. اكتبها كقائمة مفصولة بفواصل:
    
النص: "${text.slice(0, 2000)}"

الكلمات المفتاحية:`;

    const result = await callGemini(prompt, 'أنت مساعد متخصص في استخراج الكلمات المفتاحية الأكاديمية.');
    if (result) {
        return result.split(/[,\n]/).map(k => k.trim()).filter(k => k.length > 1).slice(0, 10);
    }
    // Fallback: simple word extraction
    const words = text.match(/[\u0600-\u06FFA-Za-z]{4,}/g) || [];
    return [...new Set(words)].slice(0, 10);
}

async function classifyContentWithGemini(title, description) {
    const prompt = `صنف المحتوى التالي إلى واحدة من هذه الفئات:
- تقنية المعلومات
- الذكاء الاصطناعي
- البرمجة
- الأمن السيبراني
- الطب
- الهندسة
- تعليم
- عام

العنوان: "${title}"
الوصف: "${description?.slice(0, 500) || ''}"

الفئة:`;

    const result = await callGemini(prompt, 'أنت مساعد متخصص في تصنيف المحتوى الأكاديمي.');
    if (result) {
        const lower = result.toLowerCase();
        if (lower.includes('ذكاء') || lower.includes('ai') || lower.includes('machine learning')) return 'ai';
        if (lower.includes('أمن') || lower.includes('cyber') || lower.includes('سيبراني') || lower.includes('حماية') || lower.includes('أمن معلومات')) return 'cybersecurity';
        if (lower.includes('برمجة') || lower.includes('programming') || lower.includes('كود') || lower.includes('تطوير ويب') || lower.includes('تطوير')) return 'programming';
        if (lower.includes('طب') || lower.includes('صحة') || lower.includes('طبى')) return 'medical';
        if (lower.includes('هندسة') || lower.includes('engineering')) return 'engineering';
        if (lower.includes('تقنية') || lower.includes('كمبيوتر') || lower.includes('حاسوب') || lower.includes('تكنولوجيا')) return 'tech';
        if (lower.includes('تعليم') || lower.includes('دورة') || lower.includes('course')) return 'education';
    }
    return 'general';
}

async function generateSummaryWithGemini(text, maxLength = 150) {
    const prompt = `لخص النص التالي في جملة واحدة قصيرة (أقل من ${maxLength} حرف) باللغة العربية:

"${text.slice(0, 3000)}"

الملخص:`;

    const result = await callGemini(prompt, 'أنت مساعد متخصص في التلخيص الأكاديمي.');
    if (result && result.length <= maxLength + 50) {
        return result.trim();
    }
    // Fallback
    const sentences = text.split(/[.!?。\n]+/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
        return sentences[0].trim().slice(0, maxLength);
    }
    return text.slice(0, maxLength) + '...';
}

async function determineDomainWithGemini(text) {
    const prompt = `حدد المجال الأكاديمي لهذا المحتوى من بين: تقنية المعلومات، الذكاء الاصطناعي، الطب، الهندسة، تعليم، عام.

"${text.slice(0, 2000)}"

المجال:`;

    const result = await callGemini(prompt, 'أنت مساعد متخصص في تحديد المجال الأكاديمي.');
    return result?.trim() || 'general';
}

// ============================================
// ACTIVITY TRACKING
// ============================================

async function trackActivity(userId, activityType, metadata = {}) {
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

        // Update user's total points and interests
        await updateUserInterests(userId, activityType, metadata);

        // Increment content view count when a recommendation is opened
        // (reuses the open_file activity already fired by the frontend card)
        if (activityType === 'open_file' && metadata?.contentId) {
            try {
                await adminDb.collection('recommendation_contents').doc(metadata.contentId).update({
                    viewsCount: FieldValue.increment(1),
                });
            } catch (e) {
                // Content may not exist; ignore.
            }
        }
    } catch (error) {
        console.error('Activity tracking error:', error);
    }
}

async function updateUserInterests(userId, activityType, metadata) {
    if (!userId || !adminDb) return;

    try {
        const interestsRef = adminDb.collection('student_interests').doc(userId);
        const doc = await interestsRef.get();

        const baseData = doc.exists ? doc.data() : {
            userId,
            interests: {},
            totalPoints: 0,
            lastUpdated: Date.now(),
        };

        // Add points
        baseData.totalPoints = (baseData.totalPoints || 0) + (ACTIVITY_POINTS[activityType] || 0);
        baseData.lastUpdated = Date.now();

        // Update interest weights based on activity
        if (metadata.category) {
            baseData.interests[metadata.category] = (baseData.interests[metadata.category] || 0) + 1;
        }
        if (metadata.keywords && Array.isArray(metadata.keywords)) {
            metadata.keywords.forEach(keyword => {
                baseData.interests[keyword] = (baseData.interests[keyword] || 0) + 0.5;
            });
        }

        await interestsRef.set(baseData, { merge: true });
    } catch (error) {
        console.error('Update interests error:', error);
    }
}

// ============================================
// CONTENT AGGREGATION (server-side, scheduled)
// Populates the recommendation_contents collection from RSS sources. This is the
// single source of truth for aggregation (the previous client-side duplicate was
// removed). Reuses the Gemini helpers defined above and the Admin Firestore instance.
// ============================================

const VALID_CATEGORIES = [
    'recommended', 'tech', 'ai', 'programming', 'cybersecurity', 'medical', 'engineering', 'free_courses',
    'news', 'research', 'scholarships', 'training', 'competitions', 'popular', 'saved',
];

const RSS_SOURCES = {
    tech: [
        // Arabic tech sources (prioritized for Arabic UI)
        { name: 'الجزيرة تِك', url: 'https://www.aljazeera.net/technology/rss' },
        { name: 'العربية - تكنولوجيا', url: 'https://www.alarabiya.net/technology.rss' },
        { name: 'الشرق - تكنولوجيا', url: 'https://asharq.com/feed/technology' },
        { name: 'أراجيك تك', url: 'https://www.arageek.com/feed/' },
        { name: 'عالم التقنية', url: 'https://www.tech-wd.com/feed/' },
        { name: 'أكاديمية طويق', url: 'https://tuwaiq.edu.sa/feed' },
        // International tech sources
        { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
        { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
        { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index' },
        { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
        { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/rss' },
        { name: 'Google Developers Blog', url: 'https://developers.googleblog.com/feed/' },
        { name: 'Microsoft Developer Blog', url: 'https://devblogs.microsoft.com/feed/' },
        { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
    ],
    programming: [
        // Arabic programming sources
        { name: 'أكاديمية حسوب', url: 'https://academy.hsoub.com/feed/' },
        { name: 'موسوعة حسوب', url: 'https://wiki.hsoub.com/feed/' },
        { name: 'أكاديمية سطر', url: 'https://satr.codes/feed' },
        // International programming sources
        { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org/news/rss/' },
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/blog/index.xml' },
        { name: 'DEV Community', url: 'https://dev.to/feed' },
        { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
    ],
    cybersecurity: [
        // International cybersecurity sources
        { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
        { name: 'The Hacker News', url: 'https://thehackernews.com/feed' },
    ],
    ai: [
        // International AI sources
        { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
        { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
        { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
        { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml' },
    ],
    medical: [
        // Arabic medical sources
        { name: 'ويب طب', url: 'https://www.webteb.com/rss' },
        { name: 'الطبي', url: 'https://altibbi.com/rss' },
        { name: 'منظمة الصحة العالمية -EMRO', url: 'https://www.emro.who.int/ar/feed' },
        { name: 'وزارة الصحة السعودية', url: 'https://www.moh.gov.sa/rss' },
        { name: 'وزارة الصحة المصرية', url: 'https://www.mohp.gov.eg/rss' },
        // International medical sources
        { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/rss/' },
        { name: 'WHO News', url: 'https://www.who.int/rss-feeds/news-english.xml' },
        { name: 'NIH News', url: 'https://www.nih.gov/news-events/rss-feeds' },
        { name: 'Mayo Clinic', url: 'https://www.mayoclinic.org/rss/all-news.xml' },
    ],
    free_courses: [
        // Arabic education sources
        { name: 'إدراك', url: 'https://www.edraak.org/feed' },
        { name: 'رواق', url: 'https://www.rwaq.org/feed' },
        { name: 'مهارة (HRDF)', url: 'https://maharah.hrdf.org.sa/feed' },
        { name: 'FutureX', url: 'https://futurex.sa/feed' },
        { name: 'أكاديمية مسك', url: 'https://academy.misk.org.sa/feed' },
        // International education sources
        { name: 'Coursera Blog', url: 'https://blog.coursera.org/feed/' },
        { name: 'edX Blog', url: 'https://www.edx.org/blog/feed' },
        { name: 'MIT OpenCourseWare', url: 'https://www.ocw.mit.edu/news/rss/' },
        { name: 'Harvard Online', url: 'https://pll.harvard.edu/rss.xml' },
        { name: 'Khan Academy', url: 'https://www.khanacademy.org/rss' },
    ],
    // The categories below had NO dedicated source before, so their tabs were
    // often empty. They are now fed by stable RSS feeds (failures are skipped
    // gracefully by fetchRssFeed, so a dead feed never breaks aggregation).
    engineering: [
        { name: 'Engineering.com', url: 'https://www.engineering.com/feed/' },
        { name: 'Design News', url: 'https://www.designnews.com/rss.xml' },
    ],
    news: [
        // Arabic general news sources
        { name: 'الجزيرة', url: 'https://www.aljazeera.net/rss' },
        { name: 'العربية', url: 'https://www.alarabiya.net/rss.xml' },
        { name: 'الشرق', url: 'https://asharq.com/feed/' },
        { name: 'CNN بالعربية', url: 'https://arabic.cnn.com/rss' },
        { name: 'BBC العربية', url: 'https://www.bbc.com/arabic/rss/index.xml' },
        { name: 'سكاي نيوز عربية', url: 'https://www.skynewsarabia.com/rss' },
        // International news sources
        { name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top.xml' },
        { name: 'University World News', url: 'https://www.universityworldnews.com/rss' },
    ],
    scholarships: [
        // Arabic scholarships sources
        { name: 'فرصة (For9a)', url: 'https://www.for9a.com/feed' },
        { name: 'StudyShoot', url: 'https://studyshoot.com/feed' },
        { name: 'Scholarship Roar', url: 'https://scholarshiproar.com/feed' },
        { name: 'Opportunities Corners', url: 'https://opportunitiescorners.com/feed' },
    ],
    training: [
        { name: 'Indeed Training', url: 'https://www.indeed.com/rss?q=training+jobs' },
    ],
    // Previously these two categories had NO source at all, so their tabs were
    // always empty. Fed now by stable feeds (dead feeds are skipped gracefully).
    research: [
        { name: 'arXiv - Computer Science', url: 'http://export.arxiv.org/rss/cs' },
        { name: 'Nature', url: 'https://www.nature.com/nature.rss' },
        { name: 'ScienceDaily - All', url: 'https://www.sciencedaily.com/rss/all.xml' },
        { name: 'DOAJ', url: 'https://doaj.org/feed' },
        { name: 'Crossref', url: 'https://www.crossref.org/rss' },
    ],
    competitions: [
        { name: 'Devpost Hackathons', url: 'https://devpost.com/hackathons.rss' },
        { name: 'Kaggle Blog', url: 'https://medium.com/feed/kaggle-blog' },
    ],
};

// Unwrap any CDATA sections so their inner content is preserved. Without this,
// the generic tag-stripper below would delete `<![CDATA[ ... ]]>` blocks whole
// (there is no `>` until `]]>`), wiping out titles/descriptions — which is very
// common in Arabic feeds (الجزيرة، العربية...) and caused missing Arabic content.
function unwrapCdata(text) {
    if (text == null) return '';
    return String(text).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function stripHtmlForRss(html) {
    return unwrapCdata(html)
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

// Extract a usable link from an RSS <item> or Atom <entry> block.
// RSS uses <link>URL</link>; Atom uses <link href="URL" .../> (often several,
// where rel="alternate" is the canonical page). Also try <guid> and <comments>
// as fallbacks for feeds that omit <link> or use non-standard formats.
function extractLink(blockXml) {
    // RSS style: <link>https://...</link> (ignore empty/self-closing matches)
    const rssLink = blockXml.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
    if (rssLink && rssLink[1] && rssLink[1].trim()) {
        return stripHtmlForRss(rssLink[1].trim());
    }
    // Atom style: prefer rel="alternate", else the first href present.
    const altLink = blockXml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
        || blockXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["']/i);
    if (altLink && altLink[1]) return altLink[1].trim();
    const anyHref = blockXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (anyHref && anyHref[1]) return anyHref[1].trim();
    // Fallback: <guid> often contains the article URL in RSS
    const guidMatch = blockXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
    if (guidMatch && guidMatch[1] && guidMatch[1].trim()) {
        const guid = stripHtmlForRss(guidMatch[1].trim());
        if (guid.startsWith('http://') || guid.startsWith('https://')) return guid;
    }
    // Fallback: <comments> sometimes contains a link to the article page
    const commentsMatch = blockXml.match(/<comments[^>]*>([\s\S]*?)<\/comments>/i);
    if (commentsMatch && commentsMatch[1] && commentsMatch[1].trim()) {
        const comments = stripHtmlForRss(commentsMatch[1].trim());
        if (comments.startsWith('http://') || comments.startsWith('https://')) return comments;
    }
    return '';
}

// Parse a single <item> (RSS) or <entry> (Atom) block into a normalized item.
function parseFeedBlock(blockXml) {
    const titleMatch = blockXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const link = extractLink(blockXml);
    // Atom uses <summary>/<content>; RSS uses <description>.
    const descMatch = blockXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i)
        || blockXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)
        || blockXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
    // Atom uses <published>/<updated>; RSS uses <pubDate>.
    const dateMatch = blockXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
        || blockXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i)
        || blockXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    // Try to extract a representative image (enclosure or media:content/thumbnail).
    const encMatch = blockXml.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
    const mediaMatch = blockXml.match(/<media:content[^>]*url=["']([^"']+)["']/i)
        || blockXml.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
    const imageUrl = encMatch?.[1] || mediaMatch?.[1] || '';

    if (!titleMatch) return null;
    const title = stripHtmlForRss(titleMatch[1].trim());
    if (!title) return null; // skip items whose title resolved to empty (e.g. broken CDATA)

    let pubDate;
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

function parseRss(xmlText) {
    const items = [];
    // RSS 2.0 <item> blocks.
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
        const parsed = parseFeedBlock(match[1]);
        if (parsed) items.push(parsed);
    }
    // Atom <entry> blocks — only if no RSS items were found (avoids duplicates).
    if (items.length === 0) {
        const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
        while ((match = entryRegex.exec(xmlText)) !== null) {
            const parsed = parseFeedBlock(match[1]);
            if (parsed) items.push(parsed);
        }
    }
    return items;
}

function generateContentHash(title, link) {
    const str = `${title.toLowerCase().trim()}-${link.toLowerCase().trim()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

// Normalize a title so the same story from different sources can be de-duplicated.
function normalizeTitle(title) {
    return String(title)
        .toLowerCase()
        .replace(/[\sـ_.,!?;:'"()[\]{}|/\\]/g, '')
        .trim();
}

function determineContentType(title, description) {
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

// Detect content language based on character analysis.
// Returns 'ar' if Arabic characters are dominant, otherwise 'en'.
function detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';
    const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    if (totalChars === 0) return 'en';
    const arabicRatio = arabicChars / totalChars;
    return arabicRatio > 0.3 ? 'ar' : 'en';
}

async function fetchRssFeed(url) {
    const maxRetries = 3;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ar,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                },
            });
            if (!response.ok) {
                if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
                    if (attempt < maxRetries) {
                        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                        console.warn(`[aggregation] Retrying ${url} after ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries}, status: ${response.status})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
                console.warn(`[aggregation] Failed to fetch RSS: ${url} - ${response.status}`);
                return [];
            }
            const text = await response.text();
            return parseRss(text);
        } catch (error) {
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
                console.warn(`[aggregation] Retrying ${url} after ${Math.round(delay)}ms (attempt ${attempt}/${maxRetries}: ${error.message})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            console.warn(`[aggregation] Error fetching RSS ${url}:`, error.message);
            return [];
        }
    }
    return [];
}

// Normalize a Gemini free-text category label into one of our stored categories.
function normalizeGeminiCategory(raw) {
    if (!raw) return null;
    let c = String(raw).toLowerCase().trim();
    if (c === 'education') c = 'free_courses'; // align with our stored category
    if (c === 'general') return null; // keep the RSS-derived category instead
    return VALID_CATEGORIES.includes(c) ? c : null;
}

// Store a single aggregated RSS item: classify via Gemini (keywords + category),
// derive content type, and write it to Firestore. Returns true if it was stored.
// Kept as its own task so runContentAggregation can run several in parallel.
async function storeOneItem(item, seenHashes, seenTitles) {
    // Skip items without a usable link — they would produce a blank/empty
    // sourceUrl in the database and open a blank tab in the frontend.
    if (!item.link || !item.link.trim()) {
        console.warn(`[aggregation] Skipped item with empty link: ${item.title?.slice(0, 60) || 'untitled'} (source: ${item.source || 'unknown'})`);
        return false;
    }
    const contentHash = generateContentHash(item.title, item.link);
    const normalizedTitle = normalizeTitle(item.title);
    // Guard against duplicates that appeared during this run.
    if (seenHashes.has(contentHash)) return false;
    if (normalizedTitle && seenTitles.has(normalizedTitle)) return false;

    const CONTENT_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days (reduced risk of total emptiness if aggregation is delayed)

    let keywords = [];
    let detectedCategory = item.category; // valid RSS-derived category
    const [kwRes, catRes] = await Promise.allSettled([
        extractKeywordsWithGemini(`${item.title} ${item.description}`),
        classifyContentWithGemini(item.title, item.description),
    ]);
    if (kwRes.status === 'fulfilled') keywords = kwRes.value || [];
    const normCat = normalizeGeminiCategory(catRes.status === 'fulfilled' ? catRes.value : null);
    // Preserve source-specific categories (news/research/scholarships/training/
    // competitions/programming/cybersecurity). Gemini only classifies into broad
    // domains (tech/ai/medical/engineering/education), so letting it override
    // here would empty these tabs.
    const PROTECTED_SOURCE_CATEGORIES = ['news', 'research', 'scholarships', 'training', 'competitions', 'programming', 'cybersecurity'];
    if (normCat && !PROTECTED_SOURCE_CATEGORIES.includes(item.category)) {
        detectedCategory = normCat;
    }

    const contentType = determineContentType(item.title, item.description);
    const contentId = contentHash;
    const now = Date.now();

    // Detect language from title + description (Arabic vs English)
    const detectedLanguage = detectLanguage(`${item.title} ${item.description || ''}`);

    try {
        await adminDb.collection('recommendation_contents').doc(contentId).set({
            id: contentId,
            title: item.title,
            summary: item.description.slice(0, 200) || item.title,
            description: item.description,
            imageUrl: item.imageUrl || '',
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
    } catch (error) {
        console.error('[aggregation] Error storing item:', error.message);
        return false;
    }
}

async function runContentAggregation() {
    if (!adminDb) {
        console.warn('[aggregation] Skipped: adminDb not initialized');
        return { fetched: 0, stored: 0, skipped: true };
    }

    const allSources = [
        ...RSS_SOURCES.tech.map(s => ({ ...s, category: 'tech' })),
        ...RSS_SOURCES.programming.map(s => ({ ...s, category: 'programming' })),
        ...RSS_SOURCES.ai.map(s => ({ ...s, category: 'ai' })),
        ...RSS_SOURCES.cybersecurity.map(s => ({ ...s, category: 'cybersecurity' })),
        ...RSS_SOURCES.medical.map(s => ({ ...s, category: 'medical' })),
        ...RSS_SOURCES.free_courses.map(s => ({ ...s, category: 'free_courses' })),
        ...RSS_SOURCES.engineering.map(s => ({ ...s, category: 'engineering' })),
        ...RSS_SOURCES.news.map(s => ({ ...s, category: 'news' })),
        ...RSS_SOURCES.scholarships.map(s => ({ ...s, category: 'scholarships' })),
        ...RSS_SOURCES.training.map(s => ({ ...s, category: 'training' })),
        ...RSS_SOURCES.research.map(s => ({ ...s, category: 'research' })),
        ...RSS_SOURCES.competitions.map(s => ({ ...s, category: 'competitions' })),
    ];

    let rawItems = [];
    const batchSize = 5;
    for (let i = 0; i < allSources.length; i += batchSize) {
        const batch = allSources.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(s => fetchRssFeed(s.url)));
        results.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
                r.value.forEach(item => rawItems.push({ ...item, source: batch[idx].name, category: batch[idx].category }));
            }
        });
        if (i + batchSize < allSources.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Build dedup sets from existing content (bounded read).
    const seenHashes = new Set();
    const seenTitles = new Set();
    try {
        const existing = await adminDb
            .collection('recommendation_contents')
            .orderBy('createdAt', 'desc')
            .limit(MAX_RECOMMENDATION_SCAN)
            .get();
        existing.forEach(doc => {
            const data = doc.data();
            if (data.contentHash) seenHashes.add(data.contentHash);
            if (data.normalizedTitle) seenTitles.add(data.normalizedTitle);
        });
    } catch (error) {
        console.warn('[aggregation] Could not fetch existing content for dedup:', error.message);
    }

    // 1) Pre-filter duplicates against existing content (synchronous, so there
    //    is no race between concurrent store tasks below).
    const newItems = [];
    for (const item of rawItems) {
        const h = generateContentHash(item.title, item.link);
        const n = normalizeTitle(item.title);
        if (seenHashes.has(h)) continue;
        if (n && seenTitles.has(n)) continue;
        newItems.push(item);
    }

    // 2) Store with bounded concurrency so Gemini + Firestore run in parallel
    //    batches (5 at a time) instead of one slow sequential loop. This keeps
    //    aggregation fast and cheap even with many RSS sources.
    const CONCURRENCY = 5;
    let storedCount = 0;
    for (let i = 0; i < newItems.length; i += CONCURRENCY) {
        const batch = newItems.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
            batch.map(item => storeOneItem(item, seenHashes, seenTitles))
        );
        storedCount += results.filter(Boolean).length;
    }

    const skippedCount = rawItems.length - newItems.length;
    console.log(`[aggregation] Fetched ${rawItems.length} items, pre-filtered ${skippedCount} (duplicates), stored ${storedCount} new.`);
    return { fetched: rawItems.length, stored: storedCount };
}

// ============================================
// RECOMMENDATION GENERATION
// ============================================

async function getStudentInterests(userId) {
    if (!userId || !adminDb) return null;

    try {
        const doc = await adminDb.collection('student_interests').doc(userId).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('Get interests error:', error);
        return null;
    }
}

async function getStudentHiddenIds(userId) {
    if (!userId || !adminDb) return [];

    try {
        const snapshot = await adminDb
            .collection('hidden_recommendations')
            .where('userId', '==', userId)
            .get();
        return snapshot.docs.map(d => d.data().contentId);
    } catch (error) {
        console.error('Get hidden error:', error);
        return [];
    }
}

async function getStudentLikedIds(userId) {
    if (!userId || !adminDb) return [];

    try {
        const snapshot = await adminDb
            .collection('liked_recommendations')
            .where('userId', '==', userId)
            .get();
        return snapshot.docs.map(d => d.data().contentId);
    } catch (error) {
        console.error('Get liked error:', error);
        return [];
    }
}

async function getStudentSavedIds(userId) {
    if (!userId || !adminDb) return [];

    try {
        const snapshot = await adminDb
            .collection('saved_recommendations')
            .where('userId', '==', userId)
            .get();
        return snapshot.docs.map(d => d.data().contentId);
    } catch (error) {
        console.error('Get saved error:', error);
        return [];
    }
}

function calculateBadge(content) {
    const now = Date.now();
    const createdAt = content.createdAt || content.publishedAt || now;
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    const views = content.viewsCount || 0;
    const engagement = content.likesCount || 0;
    const deadline = content.registrationDeadline || content.expiresAt;

    // Priority 1: Urgent
    if (content.isUrgent) return 'urgent';

    // Priority 2: Ending soon
    if (deadline && (deadline - now) < 7 * 24 * 60 * 60 * 1000) return 'ending_soon';

    // Priority 3: New (less than 48 hours)
    if (ageHours < 48) return 'new';

    // Priority 4: Popular (high views + engagement)
    if (views > 1000 && engagement > 50) return 'popular';

    // Priority 5: Recommended (by Gemini or admin)
    if (content.isRecommended) return 'recommended';

    // Priority 6: Free course
    if (content.isFree || content.contentType === 'course') return 'free_course';

    // Priority 7: Trending
    if (views > 500 && engagement > 20) return 'trending';

    return null;
}

function sortByBadgePriority(items) {
    return items.sort((a, b) => {
        const badgeA = BADGE_PRIORITY.indexOf(a.badge || '');
        const badgeB = BADGE_PRIORITY.indexOf(b.badge || '');
        const indexA = badgeA === -1 ? BADGE_PRIORITY.length : badgeA;
        const indexB = badgeB === -1 ? BADGE_PRIORITY.length : badgeB;
        return indexA - indexB;
    });
}

// ============================================
// API ENDPOINTS
// ============================================

// Get recommendations for a student
router.post('/generate', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);

        if (!adminDb) {
            // Critical path: avoid generic 500; make it explicit without sensitive details.
            console.error('[recommendations] adminDb not initialized. Check server service-account / env.');
            return res.status(503).json({
                error: {
                    message: 'Recommendations backend is not ready (database not initialized).'
                }
            });
        }

        // Public/global access is allowed (no personalization, no hidden/saved filters).
        // Only mutation endpoints and per-user data require userId, enforced per-branch below.

        const { category = 'recommended', limit = 20, searchQuery = '', page = 1, preferredLanguage, requiredCount } = req.body;
        const pageSize = Math.min(parseInt(limit) || 20, 50); // Cap at 50 per page
        const effectivePreferredLanguage = preferredLanguage === 'ar' ? 'ar' : 'en';
        const minRequired = parseInt(requiredCount) || pageSize;

        // Server-side cache (short TTL) to avoid re-running scoring + Firestore
        // reads on every request (concurrent users share it).
        const recKey = recCacheKey(category, userId, searchQuery, page, pageSize, effectivePreferredLanguage);
        const cachedRecs = getCachedRecommendations(recKey);
        if (cachedRecs) {
            return res.json(cachedRecs);
        }

        // Recommendations are driven PURELY by the user's own activity signals
        // (interests collected from searches, downloads, discussions, replies,
        // file reads, saves and likes). We intentionally do NOT read
        // student_profile / major data, because users do not provide that info.

        // Get student interests
        const interests = await getStudentInterests(userId);
        const hiddenIds = await getStudentHiddenIds(userId);
        const savedIds = await getStudentSavedIds(userId);
        const likedIds = userId ? await getStudentLikedIds(userId) : [];

        // adminDb existence already checked above.

        // Build query for recommendation_contents
        // Only filter by the stored `category` field for categories that are
        // actually stored as such. Virtual/derived tabs (recommended, saved,
        // popular, and the contentType-derived tabs) are fetched unfiltered and
        // refined in the branch below, otherwise the base filter would return
        // nothing for them.
        const nonStoredCategories = [
            'recommended', 'saved', 'popular',
        ];
        let query = adminDb
            .collection('recommendation_contents')
            .where('isActive', '==', true);
        if (!nonStoredCategories.includes(category)) {
            query = query.where('category', '==', category);
        }
        query = query.orderBy('createdAt', 'desc').limit(MAX_RECOMMENDATION_SCAN);

        let snapshot;
        try {
            snapshot = await query.get();
        } catch (e) {
            // If index doesn't exist, try without orderBy
            console.warn('Ordered query failed, trying fallback:', e.message);
            let fallbackQuery = adminDb
                .collection('recommendation_contents')
                .where('isActive', '==', true);
            if (!nonStoredCategories.includes(category)) {
                fallbackQuery = fallbackQuery.where('category', '==', category);
            }
            snapshot = await fallbackQuery.limit(MAX_RECOMMENDATION_SCAN).get();
        }

        let contents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter out hidden
        contents = contents.filter(c => !hiddenIds.includes(c.id));

        // Drop expired content (aggregation sets a TTL)
        const nowMs = Date.now();
        contents = contents.filter(c => !c.expiresAt || c.expiresAt > nowMs);

        // Apply searchQuery filter if provided
        if (searchQuery && searchQuery.trim()) {
            const queryLower = searchQuery.toLowerCase().trim();
            contents = contents.filter(c => {
                const searchFields = [
                    c.title,
                    c.summary,
                    c.description,
                    c.category,
                    ...(c.keywords || []),
                    ...(c.tags || []),
                    c.source,
                ].filter(Boolean).join(' ').toLowerCase();
                return searchFields.includes(queryLower);
            });
        }

        // Data quality: filter out items missing required fields to prevent
        // empty cards/slides in the frontend carousel.
        contents = contents.filter(c => c.title && c.sourceUrl && c.title.trim() && c.sourceUrl.trim());

        // Keep the full post-filter pool so we can blend popular items as a
        // fallback when a category (especially 'recommended') is sparse.
        const scannedPool = contents;

        // Category filtering

        if (category === 'recommended') {
            // Personalized PURELY by the user's activity-derived interests.
            // NO student_profile / major data is consulted (users don't provide it).
            const userCategories = [];
            const userKeywords = [];

            // Valid stored content categories we can match a content item against.
            const VALID_RECOMMEND_CATS = [
                'tech', 'ai', 'programming', 'cybersecurity', 'medical', 'engineering', 'free_courses',
                'news', 'research', 'scholarships', 'training', 'competitions',
            ];

            if (interests?.interests) {
                Object.entries(interests.interests).forEach(([key, weight]) => {
                    if ((weight || 0) >= 1) {
                        const k = String(key).toLowerCase();
                        if (VALID_RECOMMEND_CATS.includes(k)) {
                            // A content-category signal (e.g. from an open/save/like
                            // whose metadata.category matched this interest key).
                            userCategories.push(k);
                        } else {
                            // A free-text keyword signal (e.g. a search query term,
                            // a discussion topic, or a downloaded file name token).
                            userKeywords.push(k);
                        }
                    }
                });
            }

        // New / low-signal user: show a SMART GENERAL mix (free courses, news,
        // research, articles, plus a balanced spread of categories) instead of
        // only popular+recent, so the page is never empty and feels relevant.
            if (userCategories.length === 0 && userKeywords.length === 0) {
                // BOOST: Increase default item limit for public/anonymous users from 20 to 30
                // This ensures public users see more variety when they have no activity signals
                const DEFAULT_PUBLIC_LIMIT = 30;
                // IMPROVEMENT: Prioritize content categories that typically have more public interest
                const categoryOrder = ['free_courses', 'news', 'research', 'tech', 'ai', 'scholarships', 'medical', 'engineering', 'competitions', 'training', 'programming', 'cybersecurity'];
            const byCat = new Map();
            contents.forEach(c => {
                const key = c.category || 'general';
                if (!byCat.has(key)) byCat.set(key, []);
                byCat.get(key).push(c);
            });

            // Sort each category's items: preferred language first, then by engagement.
            const langSortKey = (a, b) => {
                const aLang = (a.language || '').toLowerCase();
                const bLang = (b.language || '').toLowerCase();
                const aIsPreferred = aLang === effectivePreferredLanguage ? 1 : 0;
                const bIsPreferred = bLang === effectivePreferredLanguage ? 1 : 0;
                if (aIsPreferred !== bIsPreferred) return bIsPreferred - aIsPreferred;
                // Secondary sort: by engagement (views + likes)
                const aScore = (a.viewsCount || 0) + (a.likesCount || 0) * 10;
                const bScore = (b.viewsCount || 0) + (b.likesCount || 0) * 10;
                return bScore - aScore;
            };

            // Round-robin across categories so every section is represented.
            const diversified = [];
            let added = true;
            // BOOST: Limit round-robin to reasonable number to prevent excessive items
            const maxRounds = Math.min(3, Math.ceil(DEFAULT_PUBLIC_LIMIT / categoryOrder.length));
            for (let round = 0; added && diversified.length < DEFAULT_PUBLIC_LIMIT; round++) {
                added = false;
                for (const cat of categoryOrder) {
                    const arr = byCat.get(cat);
                    if (arr && arr[round]) {
                        // Sort the category slice by preferred language before picking
                        const sortedArr = [...arr].sort(langSortKey);
                        const item = sortedArr[round];
                        if (item) { diversified.push(item); added = true; }
                    }
                }
                const others = byCat.get('general');
                if (others && others[round]) {
                    const sortedOthers = [...others].sort(langSortKey);
                    const item = sortedOthers[round];
                    if (item) { diversified.push(item); added = true; }
                }
            }

            // Blend in the most popular items so engagement still surfaces.
            const popularSorted = [...contents].sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
                ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
            ));
            const seen = new Set(diversified.map(d => d.id));
            for (const p of popularSorted) {
                if (!seen.has(p.id) && diversified.length < DEFAULT_PUBLIC_LIMIT) { diversified.push(p); }
            }
            contents = diversified;
        } else {
                // Score each content item
                contents = contents.map(content => {
                    let score = 0;
                    const contentCategory = content.category || '';
                    const contentKeywords = content.keywords || [];
                    const contentTags = content.tags || [];
                    const contentSource = (content.source || '').toLowerCase();
                    const contentTitle = (content.title || '').toLowerCase();

                    // Category match from profile-derived categories
                    userCategories.forEach(cat => {
                        if (contentCategory === cat) score += 10;
                        if (cat === 'tech' && ['tech', 'ai', 'programming', 'cybersecurity'].includes(contentCategory)) score += 8;
                        if (cat === 'ai' && contentCategory === 'ai') score += 12;
                        if (cat === 'programming' && contentCategory === 'programming') score += 12;
                        if (cat === 'cybersecurity' && contentCategory === 'cybersecurity') score += 12;
                        if (cat === 'medical' && contentCategory === 'medical') score += 12;
                        if (cat === 'engineering' && contentCategory === 'engineering') score += 12;
                    });

                    // Keyword match (broader matching)
                    userKeywords.forEach(keyword => {
                        const kwLower = keyword.toLowerCase();
                        if (contentKeywords.some(k => k.toLowerCase().includes(kwLower))) score += 5;
                        if (contentTags.some(t => t.toLowerCase().includes(kwLower))) score += 3;
                        if (contentTitle.includes(kwLower)) score += 2;
                        if (contentSource.includes(kwLower)) score += 1;
                    });

                    // Saved items get a boost
                    if (savedIds.includes(content.id)) score += 15;

                    // Language preference boost: Arabic content gets a higher boost
                    // when the UI language is Arabic, ensuring relevant content surfaces.
                    const contentLang = (content.language || '').toLowerCase();
                    if (contentLang === effectivePreferredLanguage) {
                        score += effectivePreferredLanguage === 'ar' ? 8 : 3;
                    }

                    // Views and engagement boost
                    score += Math.min((content.viewsCount || 0) / 100, 10);
                    score += Math.min((content.likesCount || 0) / 10, 5);

                    // Freshness bonus (newer content gets a small boost)
                    const ageHours = (Date.now() - (content.createdAt || Date.now())) / (1000 * 60 * 60);
                    if (ageHours < 24) score += 3;
                    else if (ageHours < 72) score += 1;

                    return { ...content, recommendationScore: score };
                });

                // Sort by score with Arabic-first preference
                contents.sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                    (b.recommendationScore || 0) - (a.recommendationScore || 0)
                ));
            }
        } else if (category === 'saved') {
            // Show only saved items. Fetch them directly so items older than the
            // generic scan window are never lost.
            try {
                const savedSnapshot = await adminDb
                    .collection('saved_recommendations')
                    .where('userId', '==', userId)
                    .get();
                const savedMap = new Map();
                savedSnapshot.forEach(d => {
                    const data = d.data();
                    savedMap.set(data.contentId, data.savedAt || 0);
                });
                if (savedMap.size === 0) {
                    contents = [];
                } else {
                    const docs = await Promise.all(
                        [...savedMap.keys()].map(id =>
                            adminDb.collection('recommendation_contents').doc(id).get()
                        )
                    );
                    contents = docs
                        .filter(d => d.exists)
                        .map(d => ({ id: d.id, ...d.data() }));
                    // Re-apply shared filters for consistency.
                    contents = contents.filter(c => !hiddenIds.includes(c.id));
                    contents = contents.filter(c => !c.expiresAt || c.expiresAt > nowMs);
                    if (searchQuery && searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        contents = contents.filter(c => {
                            const fields = [c.title, c.summary, c.description, c.category, ...(c.keywords || []), ...(c.tags || []), c.source].filter(Boolean).join(' ').toLowerCase();
                            return fields.includes(q);
                        });
                    }
                    contents.sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                        (savedMap.get(b.id) || 0) - (savedMap.get(a.id) || 0)
                    ));
                }
            } catch (e) {
                console.warn('Saved items fetch failed, falling back to scan:', e.message);
                contents = contents.filter(c => savedIds.includes(c.id));
            }
        } else if (category === 'popular') {
            // Virtual category: rank by engagement, no category filter.
            contents.sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
                ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
            ));
        } else {
            // Some tabs can be satisfied EITHER by the stored (plural) category
            // that the RSS source was assigned (e.g. 'scholarships', 'training',
            // 'news') OR by the (singular) contentType derived from the title
            // (e.g. 'scholarship', 'competition'). Previously we only matched the
            // singular contentType, so items stored with contentType 'article'
            // (the common case) were filtered out and the tab looked empty.
            const typeMap = {
                news: 'news',
                research: 'research',
                scholarships: 'scholarship',
                competitions: 'competition',
                training: 'training',
            };
            if (typeMap[category]) {
                contents = contents.filter(c =>
                    c.category === category || c.contentType === typeMap[category]
                );
            } else {
                contents = contents.filter(c => c.category === category);
            }
            // Sort by date for non-personalized categories, Arabic first
            contents.sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                (b.createdAt || 0) - (a.createdAt || 0)
            ));

            // Fallback: keep category tabs from being blank or too-sparse
            // windows. Pad with the most popular items (from any category) when
            // the section has fewer than a small floor of items, so a tab with
            // only 1-2 matching items still shows a full, useful section.
            const MIN_CATEGORY_ITEMS = 6;
            if (contents.length < MIN_CATEGORY_ITEMS) {
                const popularSorted = [...scannedPool].sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                    ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
                    ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
                ));
                const existingIds = new Set(contents.map(c => c.id));
                const filler = popularSorted
                    .filter(c => !existingIds.has(c.id))
                    .slice(0, MIN_CATEGORY_ITEMS - contents.length);
                contents = [...contents, ...filler];
            }
        }

        // Resilience: guarantee the recommended section always has enough cards
        // even when the collection is sparse or the user's signals are weak.
        // Blend in the most popular items from the full scan so the carousel
        // shows a full set instead of a single (or zero) suggestion.
        if (category === 'recommended' && contents.length < pageSize) {
            const popularSorted = [...scannedPool].sort(langFirstComparator(effectivePreferredLanguage, (a, b) =>
                ((b.viewsCount || 0) + (b.likesCount || 0) * 10) -
                ((a.viewsCount || 0) + (a.likesCount || 0) * 10)
            ));
            const existingIds = new Set(contents.map(c => c.id));
            const filler = popularSorted.filter(c => !existingIds.has(c.id)).slice(0, pageSize - contents.length);
            contents = [...contents, ...filler];
        }

        // Guarantee minimum items: pull from fallback categories if needed.
        // This ensures NO card is ever left empty (Rules 1, 2, 3, 8, 9, 10).
        contents = await guaranteeMinimumItems(
            contents,
            category,
            minRequired,
            userId,
            searchQuery,
            effectivePreferredLanguage,
            hiddenIds,
            savedIds,
            nowMs,
            scannedPool
        );

        // Pagination
        const fullContentsList = [...contents];
        const totalItems = fullContentsList.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const currentPage = Math.min(Math.max(1, parseInt(page) || 1), totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const paginatedContents = fullContentsList.slice(startIndex, startIndex + pageSize);

        // Assign badges and (for logged-in users) saved/liked state, so the
        // frontend no longer needs one status request per item (avoids N+1 calls).
        const contentsWithBadges = paginatedContents.map(content => ({
            ...content,
            badge: calculateBadge(content),
            ...(userId ? {
                isSaved: savedIds.includes(content.id),
                isLiked: likedIds.includes(content.id),
            } : {}),
        }));

        // Sort by badge priority
        const sortedContents = sortByBadgePriority(contentsWithBadges);

        // Self-healing: if the full collection looks empty or critically low, kick off a background
        // aggregation so real recommendations appear on the next request without
        // any manual trigger. Runs only when not already running.
        // For 'recommended' category, also trigger if very few items remain (likely due to mass expiration).
        const isCriticallyLow = category === 'recommended' && totalItems < 5;
        if ((totalItems === 0 || isCriticallyLow) && adminDb && !aggregationRunning) {
            console.warn(`[recommendations] Self-healing triggered: category=${category}, items=${totalItems}. Starting background aggregation...`);
            scheduledAggregation();
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

        // Cache only non-empty results so personalization stays fresh and the
        // self-healing aggregation still fires on genuinely empty collections.
        if (sortedContents.length > 0) {
            setCachedRecommendations(recKey, responsePayload);
        }

        res.json(responsePayload);
    } catch (error) {
        console.error('Generate recommendations error:', error);
        res.status(500).json({ error: { message: 'Failed to generate recommendations' } });
    }
});

// Save a recommendation
router.post('/save', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const { contentId } = req.body;
        if (!contentId) {
            return res.status(400).json({ error: { message: 'contentId is required' } });
        }

        if (!adminDb) {
            return res.status(500).json({ error: { message: 'Database not initialized' } });
        }

        const saveRef = adminDb.collection('saved_recommendations').doc(`${userId}_${contentId}`);
        await saveRef.set({
            id: `${userId}_${contentId}`,
            userId,
            contentId,
            savedAt: Date.now(),
            createdAt: Date.now(),
        });

        // Track activity
        await trackActivity(userId, 'save', {
            contentType: 'recommendation',
            contentId,
        });

        // Invalidate cached recommendation lists for this user.
        invalidateUserRecommendations(userId);

        res.json({ success: true, message: 'Saved successfully' });
    } catch (error) {
        console.error('Save recommendation error:', error);
        res.status(500).json({ error: { message: 'Failed to save recommendation' } });
    }
});

// Remove saved recommendation
router.delete('/save', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const { contentId } = req.body;
        if (!contentId) {
            return res.status(400).json({ error: { message: 'contentId is required' } });
        }

        if (!adminDb) {
            return res.status(500).json({ error: { message: 'Database not initialized' } });
        }

        await adminDb.collection('saved_recommendations').doc(`${userId}_${contentId}`).delete();

        res.json({ success: true, message: 'Removed from saved' });
    } catch (error) {
        console.error('Unsave recommendation error:', error);
        res.status(500).json({ error: { message: 'Failed to unsave recommendation' } });
    }
});

// Like a recommendation
router.post('/like', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const { contentId } = req.body;
        if (!contentId) {
            return res.status(400).json({ error: { message: 'contentId is required' } });
        }

        if (!adminDb) {
            return res.status(500).json({ error: { message: 'Database not initialized' } });
        }

        const likeRef = adminDb.collection('liked_recommendations').doc(`${userId}_${contentId}`);
        const doc = await likeRef.get();

        if (doc.exists) {
            // Unlike
            await likeRef.delete();
            await adminDb.collection('recommendation_contents').doc(contentId).update({
                likesCount: FieldValue.increment(-1),
            });
        } else {
            // Like
            await likeRef.set({
                id: `${userId}_${contentId}`,
                userId,
                contentId,
                likedAt: Date.now(),
                createdAt: Date.now(),
            });
            await adminDb.collection('recommendation_contents').doc(contentId).update({
                likesCount: FieldValue.increment(1),
            });

            // Track activity
            await trackActivity(userId, 'like', {
                contentType: 'recommendation',
                contentId,
            });
        }

        // Invalidate cached recommendation lists for this user.
        invalidateUserRecommendations(userId);

        res.json({ success: true, liked: !doc.exists });
    } catch (error) {
        console.error('Like recommendation error:', error);
        res.status(500).json({ error: { message: 'Failed to like recommendation' } });
    }
});

// Hide a recommendation
router.post('/hide', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const { contentId, reason = 'user_hidden' } = req.body;
        if (!contentId) {
            return res.status(400).json({ error: { message: 'contentId is required' } });
        }

        if (!adminDb) {
            return res.status(500).json({ error: { message: 'Database not initialized' } });
        }

        const hideRef = adminDb.collection('hidden_recommendations').doc(`${userId}_${contentId}`);
        await hideRef.set({
            id: `${userId}_${contentId}`,
            userId,
            contentId,
            reason,
            hiddenAt: Date.now(),
            createdAt: Date.now(),
        });

        // Invalidate cached recommendation lists for this user.
        invalidateUserRecommendations(userId);

        res.json({ success: true, message: 'Hidden successfully' });
    } catch (error) {
        console.error('Hide recommendation error:', error);
        res.status(500).json({ error: { message: 'Failed to hide recommendation' } });
    }
});

// Track student activity (called from frontend)
router.post('/activity', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);
        if (!userId) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const { activityType, metadata = {} } = req.body;

        await trackActivity(userId, activityType, metadata);

        res.json({ success: true, points: ACTIVITY_POINTS[activityType] || 0 });
    } catch (error) {
        console.error('Track activity error:', error);
        res.status(500).json({ error: { message: 'Failed to track activity' } });
    }
});

// Get student stats
router.get('/stats', async (req, res) => {
    try {
        const userId = await getUidFromRequest(req);
        if (!userId) {
            console.warn('[recommendations] /stats unauthorized: missing/invalid Authorization bearer token.');
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const interests = await getStudentInterests(userId);
        const savedIds = await getStudentSavedIds(userId);

        res.json({
            success: true,
            data: {
                totalPoints: interests?.totalPoints || 0,
                savedCount: savedIds.length,
                topInterests: interests?.interests
                    ? Object.entries(interests.interests)
                        .sort((a, b) => (b[1] - a[1]))
                        .slice(0, 10)
                        .map(([name, count]) => ({ name, count }))
                    : [],
            },
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: { message: 'Failed to get stats' } });
    }
});

// Enhance content using Gemini (for content aggregation)
router.post('/enhance', async (req, res) => {
    try {
        // Prevent anonymous/public abuse: this endpoint calls Gemini (cost).
        // Require an authenticated caller (same convention as the rest of the router).
        if (!(await getUidFromRequest(req))) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }

        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({ error: { message: 'Title is required' } });
        }

        const text = `${title} ${description || ''}`;

        // Use Gemini for keyword extraction and classification
        const [keywordsResult, categoryResult] = await Promise.allSettled([
            extractKeywordsWithGemini(text),
            classifyContentWithGemini(title, description || ''),
        ]);

        const keywords = keywordsResult.status === 'fulfilled' ? keywordsResult.value : [];
        const category = categoryResult.status === 'fulfilled' ? categoryResult.value : null;
        const summary = description ? description.slice(0, 200) : title;

        res.json({
            success: true,
            data: {
                keywords,
                summary,
                category,
                domain: category,
            },
        });
    } catch (error) {
        console.error('Enhance content error:', error);
        res.status(500).json({ error: { message: 'Failed to enhance content' } });
    }
});

// Run content aggregation. Intended to be triggered by the server-side scheduler.
// Protected by an optional aggregation key (RECOMMENDATION_AGGREGATION_KEY) so it
// cannot be triggered anonymously when deployed.
router.post('/aggregate', async (req, res) => {
    try {
        const expectedKey = process.env.RECOMMENDATION_AGGREGATION_KEY;
        if (expectedKey && req.headers?.['x-aggregation-key'] !== expectedKey) {
            return res.status(401).json({ error: { message: 'Unauthorized' } });
        }
        const result = await runContentAggregation();
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Aggregation error:', error);
        res.status(500).json({ error: { message: 'Aggregation failed' } });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        geminiAvailable: !!generativeModel,
        projectId,
        location,
        timestamp: new Date().toISOString(),
    });
});

// ============================================
// AUTOMATIC CONTENT AGGREGATION SCHEDULER
// Populates recommendation_contents on boot and on a fixed interval so the
// recommendations section always has fresh content without a manual trigger.
// ============================================
let aggregationRunning = false;

// Lock-guarded runner so concurrent triggers (the server's periodic scheduler in
// server/index.js and the lazy trigger in /generate) never overlap.
async function scheduledAggregation() {
    if (aggregationRunning || !adminDb) return;
    aggregationRunning = true;
    try {
        const result = await runContentAggregation();
        console.log('[aggregation] Run complete:', result);
    } catch (e) {
        console.error('[aggregation] Run failed:', e.message);
    } finally {
        aggregationRunning = false;
    }
}

module.exports = router;
