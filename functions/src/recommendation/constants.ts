/**
 * Constants for the recommendation engine.
 * Ported from server/recommendationRouter.js
 */

// Badge priority order
export const BADGE_PRIORITY = ['urgent', 'ending_soon', 'new', 'popular', 'recommended', 'free_course', 'trending'];

// Content categories matching frontend requirements
export const CONTENT_CATEGORIES: Record<string, string> = {
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
export const CONTENT_TYPES: Record<string, string> = {
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
export const FALLBACK_CATEGORIES: Record<string, string[]> = {
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
    recommended: [
        'free_courses', 'news', 'tech', 'ai', 'research', 'scholarships',
        'training', 'competitions', 'medical', 'engineering', 'popular',
        'programming', 'cybersecurity',
    ],
};

// Cap how many active docs we scan for virtual categories.
export const MAX_RECOMMENDATION_SCAN = 300;

export const ACTIVITY_POINTS: Record<string, number> = {
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

export const REC_CACHE_TTL_MS = 30 * 1000;

// Categories that don't have a stored `category` field value and need
// to be fetched unfiltered + refined in code.
export const NON_STORED_CATEGORIES = ['recommended', 'saved', 'popular'];

// Categories that Gemini classifies into but are too broad to override
// source-specific categories during aggregation.
export const PROTECTED_SOURCE_CATEGORIES = [
    'news', 'research', 'scholarships', 'training', 'competitions',
    'programming', 'cybersecurity',
];

export const VALID_CATEGORIES = [
    'recommended', 'tech', 'ai', 'programming', 'cybersecurity', 'medical', 'engineering', 'free_courses',
    'news', 'research', 'scholarships', 'training', 'competitions', 'popular', 'saved',
];

export const RSS_SOURCES: Record<string, Array<{ name: string; url: string }>> = {
    tech: [
        { name: 'الجزيرة تِك', url: 'https://www.aljazeera.net/technology/rss' },
        { name: 'العربية - تكنولوجيا', url: 'https://www.alarabiya.net/technology.rss' },
        { name: 'الشرق - تكنولوجيا', url: 'https://asharq.com/feed/technology' },
        { name: 'أراجيك تك', url: 'https://www.arageek.com/feed/' },
        { name: 'عالم التقنية', url: 'https://www.tech-wd.com/feed/' },
        { name: 'أكاديمية طويق', url: 'https://tuwaiq.edu.sa/feed' },
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
        { name: 'أكاديمية حسوب', url: 'https://academy.hsoub.com/feed/' },
        { name: 'موسوعة حسوب', url: 'https://wiki.hsoub.com/feed/' },
        { name: 'أكاديمية سطر', url: 'https://satr.codes/feed' },
        { name: 'freeCodeCamp', url: 'https://www.freecodecamp.org/news/rss/' },
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/blog/index.xml' },
        { name: 'DEV Community', url: 'https://dev.to/feed' },
        { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/' },
    ],
    cybersecurity: [
        { name: 'أمن المعلومات العربي', url: 'https://www.arabsecurity.net/feed/' },
        { name: 'أكاديمية حسوب', url: 'https://academy.hsoub.com/feed/' },
        { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
        { name: 'The Hacker News', url: 'https://thehackernews.com/feed' },
    ],
    ai: [
        { name: 'عرب هاردوير', url: 'https://www.arabh.net/feed/' },
        { name: 'أراجيك', url: 'https://www.arageek.com/feed/' },
        { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
        { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
        { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
        { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml' },
    ],
    medical: [
        { name: 'ويب طب', url: 'https://www.webteb.com/rss' },
        { name: 'الطبي', url: 'https://altibbi.com/rss' },
        { name: 'منظمة الصحة العالمية -EMRO', url: 'https://www.emro.who.int/ar/feed' },
        { name: 'وزارة الصحة السعودية', url: 'https://www.moh.gov.sa/rss' },
        { name: 'وزارة الصحة المصرية', url: 'https://www.mohp.gov.eg/rss' },
        { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/rss/' },
        { name: 'WHO News', url: 'https://www.who.int/rss-feeds/news-english.xml' },
        { name: 'NIH News', url: 'https://www.nih.gov/news-events/rss-feeds' },
        { name: 'Mayo Clinic', url: 'https://www.mayoclinic.org/rss/all-news.xml' },
    ],
    free_courses: [
        { name: 'إدراك', url: 'https://www.edraak.org/feed' },
        { name: 'رواق', url: 'https://www.rwaq.org/feed' },
        { name: 'مهارة (HRDF)', url: 'https://maharah.hrdf.org.sa/feed' },
        { name: 'FutureX', url: 'https://futurex.sa/feed' },
        { name: 'أكاديمية مسك', url: 'https://academy.misk.org.sa/feed' },
        { name: 'Coursera Blog', url: 'https://blog.coursera.org/feed/' },
        { name: 'edX Blog', url: 'https://www.edx.org/blog/feed' },
        { name: 'MIT OpenCourseWare', url: 'https://www.ocw.mit.edu/news/rss/' },
        { name: 'Harvard Online', url: 'https://pll.harvard.edu/rss.xml' },
        { name: 'Khan Academy', url: 'https://www.khanacademy.org/rss' },
    ],
    engineering: [
        { name: 'Engineering.com', url: 'https://www.engineering.com/feed/' },
        { name: 'Design News', url: 'https://www.designnews.com/rss.xml' },
    ],
    news: [
        { name: 'الجزيرة', url: 'https://www.aljazeera.net/rss' },
        { name: 'العربية', url: 'https://www.alarabiya.net/rss.xml' },
        { name: 'الشرق', url: 'https://asharq.com/feed/' },
        { name: 'CNN بالعربية', url: 'https://arabic.cnn.com/rss' },
        { name: 'BBC العربية', url: 'https://www.bbc.com/arabic/rss/index.xml' },
        { name: 'سكاي نيوز عربية', url: 'https://www.skynewsarabia.com/rss' },
        { name: 'ScienceDaily', url: 'https://www.sciencedaily.com/rss/top.xml' },
        { name: 'University World News', url: 'https://www.universityworldnews.com/rss' },
    ],
    scholarships: [
        { name: 'فرصة (For9a)', url: 'https://www.for9a.com/feed' },
        { name: 'StudyShoot', url: 'https://studyshoot.com/feed' },
        { name: 'Scholarship Roar', url: 'https://scholarshiproar.com/feed' },
        { name: 'Opportunities Corners', url: 'https://opportunitiescorners.com/feed' },
    ],
    training: [
        { name: 'Indeed Training', url: 'https://www.indeed.com/rss?q=training+jobs' },
    ],
    research: [
        { name: 'المؤسسة العربية للعلوم ونشر الأبحاث', url: 'https://journals.ajsrp.com/feed' },
        { name: 'الشبكة العربية للصحافة العلمية', url: 'https://www.arabicnsj.org/feed' },
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

// Type for the typeMap used in /generate endpoint
export const CONTENT_TYPE_MAP: Record<string, string> = {
    news: 'news',
    research: 'research',
    scholarships: 'scholarship',
    competitions: 'competition',
    training: 'training',
};
