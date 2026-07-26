import { database } from '../firebase/config';
import { get, ref } from 'firebase/database';
import { getAllCourseFiles, getFileType, getTotalFileCount } from './courseFilesService';
import { getAllDiscussions } from './discussionService';
import { getAllUsers } from './authService';
import { File as AppFile, Discussion, User } from '../types';

// ============================================================
// ADMIN ANALYTICS AGGREGATION SERVICE
// ------------------------------------------------------------
// Centralizes all read-only aggregation used by the admin
// "Reports & Analytics" page. Every source used here is
// readable by an authenticated admin according to the deployed
// Firebase rules (courseFiles, discussions, users, activityFeed,
// discussion_likes). The `user_activity` node is intentionally
// NOT used because it has no read rule and would be denied.
// ============================================================

export interface CourseDownloadStat {
    courseId: string;
    courseName: string;
    downloads: number;
    filesCount: number;
}

export interface DiscussionStat {
    id: string;
    title: string;
    authorName: string;
    courseId: string;
    courseName: string;
    commentsCount: number;
    likesCount: number;
    engagementScore: number;
}

export interface ActiveUserStat {
    userId: string;
    name: string;
    email: string;
    filesUploaded: number;
    discussionsCreated: number;
    commentsMade: number;
    activityEvents: number;
    activeDays: number;
    score: number;
}

export interface NameCount {
    name: string;
    count: number;
}

export interface AnalyticsKpis {
    totalUsers: number;
    totalFiles: number;
    totalDownloads: number;
    totalDiscussions: number;
    totalComments: number;
    totalLikes: number;
    activeUsers: number;
}

export interface AdminAnalytics {
    kpis: AnalyticsKpis;
    topCoursesByDownloads: CourseDownloadStat[];
    topDiscussions: DiscussionStat[];
    mostActiveUsers: ActiveUserStat[];
    fileTypeDistribution: NameCount[];
    peakHours: number[];
    weekdayActivity: NameCount[];
    weeklyActivity: NameCount[];
    topColleges: NameCount[];
    generatedAt: number;
}

// Arabic week starting on Saturday (common in Saudi Arabia)
const ARABIC_WEEK = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const FILE_TYPE_LABELS: Record<string, string> = {
    pdf: 'PDF',
    doc: 'مستندات',
    ppt: 'عروض تقديمية',
    other: 'أخرى',
};

function safeTimestampToDate(value: unknown): Date | null {
    if (typeof value === 'number') {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'string') {
        const t = Date.parse(value);
        return isNaN(t) ? null : new Date(t);
    }
    return null;
}

const localKey = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Wraps a Realtime DB read so a permission error degrades gracefully
// instead of breaking the whole report.
async function safeRtGet<T = unknown>(path: string): Promise<T | null> {
    try {
        const snap = await get(ref(database, path));
        return snap.exists() ? (snap.val() as T) : null;
    } catch (err) {
        console.warn(`[adminAnalytics] Could not read "${path}":`, err);
        return null;
    }
}

const commentsLength = (d: Discussion | undefined): number => {
    if (!d || !d.comments) return 0;
    return Array.isArray(d.comments) ? d.comments.length : Object.keys(d.comments).length;
};

/**
 * Fetch & aggregate all admin analytics in a single call.
 * All sub-reads are individually guarded so a failure in one
 * source never blanks the entire dashboard.
 */
export const getDashboardAnalytics = async (): Promise<AdminAnalytics> => {
    // Use reasonable limits for analytics aggregation to prevent loading unlimited data
    // Analytics only needs representative data for statistics, not every single record
    const [files, discussions, users, activityFeed, discussionLikes, fileCount] = await Promise.all([
        getAllCourseFiles(1000).catch(() => [] as AppFile[]),
        getAllDiscussions(500).catch(() => [] as Discussion[]),
        getAllUsers(1000).catch(() => [] as User[]),
        safeRtGet<Record<string, { timestamp?: number; payload?: Record<string, string> }>>('activityFeed'),
        safeRtGet<Record<string, Record<string, boolean>>>('discussion_likes'),
        getTotalFileCount().catch(() => 0),
    ]);

    const usersById = new Map(users.map((u) => [u.id, u]));

    // ---- 1) Most downloaded courses ----
    const courseMap = new Map<string, CourseDownloadStat>();
    let totalDownloads = 0;
    for (const f of files) {
        const cid = f.courseId || f.course?.id || '';
        const key = cid && cid !== 'unknown' ? cid : (f.courseName || f.course?.name || 'غير مصنف');
        const cname = f.courseName || f.course?.name || 'مقرر غير مصنف';
        const downloads = f.downloadsCount || 0;
        totalDownloads += downloads;
        const cur = courseMap.get(key) || { courseId: cid, courseName: cname, downloads: 0, filesCount: 0 };
        cur.downloads += downloads;
        cur.filesCount += 1;
        courseMap.set(key, cur);
    }
    const topCoursesByDownloads = Array.from(courseMap.values())
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 10);

    // ---- 2) Most engaged discussions ----
    const likeCounts = new Map<string, number>();
    if (discussionLikes) {
        for (const [discId, usersObj] of Object.entries(discussionLikes)) {
            likeCounts.set(discId, Object.keys(usersObj || {}).length);
        }
    }
    let totalLikes = 0;
    const totalComments = discussions.reduce((sum, d) => sum + commentsLength(d), 0);
    const topDiscussions = discussions
        .map((d) => {
            const likes = likeCounts.get(d.id || '') ?? 0; // Only use discussion_likes (single source of truth)
            totalLikes += likes;
            const cCount = commentsLength(d);
            return {
                id: d.id || '',
                title: d.title || 'مناقشة بدون عنوان',
                authorName: d.authorName || 'مستخدم',
                courseId: d.courseId || '',
                courseName: (d as { courseName?: string }).courseName || '',
                commentsCount: cCount,
                likesCount: likes,
                engagementScore: cCount * 2 + likes,
            } as DiscussionStat;
        })
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 10);

    // ---- 3) Most active users ----
    const userMap = new Map<string, ActiveUserStat>();

    // Track the distinct calendar days each user was active so the report can
    // show an accurate "active days" metric for the most-active-users list.
    const userActiveDays = new Map<string, Set<string>>();
    const recordActiveDay = (uid: string, raw: unknown): void => {
        if (!uid) return;
        const dt = safeTimestampToDate(raw);
        if (!dt) return;
        if (!userActiveDays.has(uid)) userActiveDays.set(uid, new Set<string>());
        userActiveDays.get(uid)!.add(localKey(dt));
    };

    const ensure = (uid: string, name: string, email: string): ActiveUserStat | null => {
        if (!uid) return null;
        let u = userMap.get(uid);
        if (!u) {
            u = {
                userId: uid,
                name: name || 'مستخدم',
                email: email || '',
                filesUploaded: 0,
                discussionsCreated: 0,
                commentsMade: 0,
                activityEvents: 0,
                activeDays: 0,
                score: 0,
            };
            userMap.set(uid, u);
        } else {
            if (name && (!u.name || u.name === 'مستخدم')) u.name = name;
            if (email && !u.email) u.email = email;
        }
        return u;
    };

    for (const f of files) {
        const uid = f.uploadedBy || f.owner?.uid || '';
        const u = ensure(uid, f.uploadedByName || f.owner?.name || '', f.uploadedByEmail || f.owner?.email || '');
        if (u) u.filesUploaded += 1;
        recordActiveDay(uid, f.uploadedAt || f.createdAt);
    }
    for (const d of discussions) {
        const uid = d.authorId || '';
        const info = usersById.get(uid);
        const u = ensure(uid, d.authorName || info?.name || '', info?.email || '');
        if (u) u.discussionsCreated += 1;
        recordActiveDay(uid, d.createdAt);
        const comments = (Array.isArray(d.comments) ? d.comments : Object.values(d.comments || {})) as Array<{
            authorId?: string;
            authorName?: string;
            createdAt?: string | number;
        }>;
        for (const c of comments) {
            const cuid = c?.authorId || '';
            if (!cuid) continue;
            const cu = ensure(cuid, c.authorName || usersById.get(cuid)?.name || '', usersById.get(cuid)?.email || '');
            if (cu) cu.commentsMade += 1;
            recordActiveDay(cuid, c.createdAt);
        }
    }
    if (activityFeed) {
        for (const item of Object.values(activityFeed)) {
            const uid = item?.payload?.userId || '';
            if (!uid) continue;
            const u = ensure(uid, item?.payload?.userName || usersById.get(uid)?.name || '', usersById.get(uid)?.email || '');
            if (u) u.activityEvents += 1;
            recordActiveDay(uid, item?.timestamp);
        }
    }
    const mostActiveUsers = Array.from(userMap.values())
        .map((u) => ({
            ...u,
            activeDays: userActiveDays.get(u.userId)?.size || 0,
            score: u.filesUploaded * 3 + u.discussionsCreated * 5 + u.commentsMade * 2 + u.activityEvents,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    // ---- 4) File type distribution ----
    const typeMap = new Map<string, number>();
    for (const f of files) {
        const t = getFileType(f.extension || f.fileExtension || '') || (f.type as string) || 'other';
        typeMap.set(t, (typeMap.get(t) || 0) + 1);
    }
    const fileTypeDistribution = Array.from(typeMap.entries())
        .map(([k, v]) => ({ name: FILE_TYPE_LABELS[k] || k, count: v }))
        .sort((a, b) => b.count - a.count);

    // ---- 5) Activity timeline (hours / weekday / last 7 days) ----
    const timestamps: number[] = [];
    if (activityFeed) {
        for (const item of Object.values(activityFeed)) {
            const d = safeTimestampToDate(item?.timestamp);
            if (d) timestamps.push(d.getTime());
        }
    }
    for (const d of discussions) {
        const dt = safeTimestampToDate(d.createdAt);
        if (dt) timestamps.push(dt.getTime());
    }
    for (const f of files) {
        const dt = safeTimestampToDate(f.uploadedAt || f.createdAt);
        if (dt) timestamps.push(dt.getTime());
    }

    const peakHours = new Array(24).fill(0);
    const weekdayCounts = new Array(7).fill(0);
    for (const t of timestamps) {
        const d = new Date(t);
        peakHours[d.getHours()] += 1;
        weekdayCounts[(d.getDay() + 1) % 7] += 1;
    }
    const weekdayActivity: NameCount[] = ARABIC_WEEK.map((name, i) => ({ name, count: weekdayCounts[i] }));

    const weeklyMap = new Map<string, number>();
    const weeklyOrder: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = localKey(day);
        weeklyMap.set(key, 0);
        weeklyOrder.push(key);
    }
    for (const t of timestamps) {
        const key = localKey(new Date(t));
        if (weeklyMap.has(key)) weeklyMap.set(key, (weeklyMap.get(key) || 0) + 1);
    }
    const weeklyActivity: NameCount[] = weeklyOrder.map((key) => {
        const dt = new Date(`${key}T00:00:00`);
        return {
            name: dt.toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric' }),
            count: weeklyMap.get(key) || 0,
        };
    });

    // ---- 6) Top colleges by file count ----
    const collegeMap = new Map<string, number>();
    for (const f of files) {
        const c = f.collegeName || f.college?.name || 'غير مصنف';
        collegeMap.set(c, (collegeMap.get(c) || 0) + 1);
    }
    const topColleges = Array.from(collegeMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    // Count users from the Firestore `users` collection — the same single source
    // of truth used by the Admin Dashboard (getAllUsers) — so both pages always
    // agree. User sync to this collection is enforced in authService, which keeps
    // the collection complete without merging in content-derived IDs here.
    const kpis: AnalyticsKpis = {
        totalUsers: users.length,
        totalFiles: fileCount,
        totalDownloads,
        totalDiscussions: discussions.length,
        totalComments,
        totalLikes,
        // Only count users present in the registered `users` collection so the
        // engagement rate (activeUsers / totalUsers) can never exceed 100%.
        activeUsers: Array.from(userMap.keys()).filter((uid) => usersById.has(uid)).length,
    };

    return {
        kpis,
        topCoursesByDownloads,
        topDiscussions,
        mostActiveUsers,
        fileTypeDistribution,
        peakHours,
        weekdayActivity,
        weeklyActivity,
        topColleges,
        generatedAt: Date.now(),
    };
};

export default getDashboardAnalytics;
