import { ref, update, push, serverTimestamp, set, increment } from 'firebase/database';
import { database, auth } from '../firebase/config';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Analytics event types
export type AnalyticsEventType =
    | 'user_registered'
    | 'file_uploaded'
    | 'discussion_created'
    | 'message_sent'
    | 'course_entered';

// Event payload interface
export interface AnalyticsEventPayload {
    userId?: string;
    userName?: string;
    courseId?: string;
    courseName?: string;
    fileName?: string;
    discussionTitle?: string;
    [key: string]: string | undefined;
}

// Analytics data interface
export interface AnalyticsData {
    totalUsers: number;
    totalFiles: number;
    totalDiscussions: number;
    totalMessages: number;
    activeCourses: number;
    lastActivityTimestamp: number;
}

// Activity feed item interface
export interface ActivityItem {
    id: string;
    type: AnalyticsEventType;
    timestamp: number;
    payload: AnalyticsEventPayload;
}

/**
 * Check if current user has admin role
 */
const isAdmin = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            return data.role === 'admin';
        }
        return false;
    } catch {
        return false;
    }
};

/**
 * Initialize analytics in Firebase with default values
 * This should be called once on app startup to ensure analytics node exists
 * Note: Only admin users have write access to analytics
 */
export const initializeAnalytics = async (): Promise<void> => {
    // Only initialize when a user is authenticated
    if (!auth.currentUser) {
        return;
    }

    // Check if user is admin before attempting to write
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
        return;
    }

    try {
        const analyticsRef = ref(database, 'analytics');
        await update(analyticsRef, {
            totalUsers: 0,
            totalFiles: 0,
            totalDiscussions: 0,
            totalMessages: 0,
            activeCourses: 0,
            lastActivityTimestamp: serverTimestamp()
        });
    } catch (error) {
        // Analytics initialization may fail for non-admin users - this is expected
        // The analytics data will be created when an admin user logs in
        console.warn('[Analytics] Initialization skipped (requires admin role):', error);
    }
};

/**
 * Track an analytics event and update the counters
 * @param eventName - The type of event to track
 * @param payload - Additional data about the event
 */
export const trackEvent = async (
    eventName: AnalyticsEventType,
    payload: AnalyticsEventPayload = {}
): Promise<void> => {
    // The live activity feed is writable by any signed-in user, so always record it
    // (per Realtime DB rules: activityFeed .write = "auth != null").
    if (!auth.currentUser) {
        return;
    }

    try {
        const activityRef = ref(database, 'activityFeed');
        const newActivityRef = push(activityRef);
        const activityId = newActivityRef.key || Date.now().toString();

        const activityData: ActivityItem = {
            id: activityId,
            type: eventName,
            timestamp: Date.now(),
            payload
        };

        await set(newActivityRef, activityData);
    } catch (error) {
        console.error('[Analytics] Error writing activity feed:', error);
    }

    // Aggregated counters live under /analytics which is admin-only (per Realtime DB rules),
    // so update them best-effort. Non-admin events still populate the activity feed above.
    try {
        const userIsAdmin = await isAdmin();
        if (!userIsAdmin) {
            return;
        }

        const analyticsRef = ref(database, 'analytics');
        const updates: Record<string, any> = {
            lastActivityTimestamp: serverTimestamp()
        };

        switch (eventName) {
            case 'user_registered':
                updates.totalUsers = increment(1);
                break;
            case 'file_uploaded':
                updates.totalFiles = increment(1);
                break;
            case 'discussion_created':
                updates.totalDiscussions = increment(1);
                break;
            case 'message_sent':
                updates.totalMessages = increment(1);
                break;
            default:
                break;
        }

        await update(analyticsRef, updates);
        console.log(`[Analytics] Event tracked: ${eventName}`, payload);
    } catch (error) {
        console.warn('[Analytics] Counter update skipped (requires admin role):', error);
    }
};

/**
 * Track user registration
 */
export const trackUserRegistration = (userId: string, userName: string): Promise<void> => {
    return trackEvent('user_registered', { userId, userName });
};

/**
 * Track file upload
 */
export const trackFileUpload = (courseId: string, courseName: string, fileName: string): Promise<void> => {
    return trackEvent('file_uploaded', { courseId, courseName, fileName });
};

/**
 * Track discussion creation
 */
export const trackDiscussionCreated = (discussionTitle: string, courseId?: string): Promise<void> => {
    return trackEvent('discussion_created', { discussionTitle, courseId });
};

/**
 * Track message sent
 */
export const trackMessageSent = (userId: string, userName: string): Promise<void> => {
    return trackEvent('message_sent', { userId, userName });
};

/**
 * Track course entry
 */
export const trackCourseEntered = (courseId: string, courseName: string): Promise<void> => {
    return trackEvent('course_entered', { courseId, courseName });
};

/**
 * Set active courses count (called when initializing or updating courses)
 */
export const setActiveCoursesCount = async (count: number): Promise<void> => {
    // Check if user is admin before attempting to write
    const userIsAdmin = await isAdmin();
    if (!userIsAdmin) {
        return;
    }

    try {
        const analyticsRef = ref(database, 'analytics');
        await update(analyticsRef, { activeCourses: count });
    } catch (error) {
        console.warn('[Analytics] Failed to update active courses (requires admin role):', error);
    }
};