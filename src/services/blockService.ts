// Firebase Realtime Database service for blocking users
import { database } from '../firebase/config';
import { ref, set, remove, get, onValue, off } from 'firebase/database';

const BLOCKED_USERS_REF = 'blocked_users';

/**
 * Block a user - prevents them from sending messages to the current user
 * @param currentUserId - The user who is blocking
 * @param blockedUserId - The user being blocked
 */
export const blockUser = async (currentUserId: string, blockedUserId: string): Promise<void> => {
    if (!currentUserId || !blockedUserId) return;
    if (currentUserId === blockedUserId) return; // Can't block yourself

    const blockRef = ref(database, `${BLOCKED_USERS_REF}/${currentUserId}/${blockedUserId}`);
    await set(blockRef, {
        blockedAt: Date.now(),
        blockedBy: currentUserId,
        blockedUser: blockedUserId
    });
};

/**
 * Unblock a user
 * @param currentUserId - The user who is unblocking
 * @param blockedUserId - The user being unblocked
 */
export const unblockUser = async (currentUserId: string, blockedUserId: string): Promise<void> => {
    if (!currentUserId || !blockedUserId) return;

    const blockRef = ref(database, `${BLOCKED_USERS_REF}/${currentUserId}/${blockedUserId}`);
    await remove(blockRef);
};

/**
 * Check if a user is blocked
 * @param currentUserId - The user who might have blocked
 * @param blockedUserId - The user who might be blocked
 * @returns Promise<boolean> - true if blocked
 */
export const isBlocked = async (currentUserId: string, blockedUserId: string): Promise<boolean> => {
    if (!currentUserId || !blockedUserId) return false;
    if (currentUserId === blockedUserId) return false;

    const blockRef = ref(database, `${BLOCKED_USERS_REF}/${currentUserId}/${blockedUserId}`);
    const snapshot = await get(blockRef);
    return snapshot.exists();
};

/**
 * Check if the current user is blocked by another user
 * (i.e., can the current user send messages to the other user?)
 * @param currentUserId - The current user
 * @param otherUserId - The other user
 * @returns Promise<boolean> - true if the current user is blocked by the other user
 */
export const isBlockedBy = async (currentUserId: string, otherUserId: string): Promise<boolean> => {
    if (!currentUserId || !otherUserId) return false;
    if (currentUserId === otherUserId) return false;

    const blockRef = ref(database, `${BLOCKED_USERS_REF}/${otherUserId}/${currentUserId}`);
    const snapshot = await get(blockRef);
    return snapshot.exists();
};

/**
 * Get list of users blocked by the current user
 * @param userId - The user who blocked others
 * @returns Promise<string[]> - Array of blocked user IDs
 */
export const getBlockedUsers = async (userId: string): Promise<string[]> => {
    if (!userId) return [];

    const blockedRef = ref(database, `${BLOCKED_USERS_REF}/${userId}`);
    const snapshot = await get(blockedRef);

    if (snapshot.exists()) {
        return Object.keys(snapshot.val());
    }
    return [];
};

/**
 * Subscribe to real-time updates of blocked users
 * @param userId - The user whose block list to watch
 * @param callback - Callback with array of blocked user IDs
 * @returns Unsubscribe function
 */
export const subscribeToBlockedUsers = (
    userId: string,
    callback: (blockedUserIds: string[]) => void
): (() => void) => {
    if (!userId) {
        callback([]);
        return () => {};
    }

    const blockedRef = ref(database, `${BLOCKED_USERS_REF}/${userId}`);

    const unsubscribe = onValue(blockedRef, (snapshot) => {
        if (snapshot.exists()) {
            const blockedIds = Object.keys(snapshot.val());
            callback(blockedIds);
        } else {
            callback([]);
        }
    }, (error) => {
        console.error('Error subscribing to blocked users:', error);
        callback([]);
    });

    return () => {
        try { off(blockedRef); } catch (e) { console.warn('Error unsubscribing from blocked users:', e); }
    };
};

/**
 * Check if two users can message each other
 * (neither has blocked the other)
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Promise<boolean> - true if they can message each other
 */
export const canMessageEachOther = async (userId1: string, userId2: string): Promise<boolean> => {
    if (!userId1 || !userId2) return false;
    if (userId1 === userId2) return true;

    const [blocked1, blocked2] = await Promise.all([
        isBlocked(userId1, userId2),
        isBlocked(userId2, userId1)
    ]);

    return !blocked1 && !blocked2;
};
