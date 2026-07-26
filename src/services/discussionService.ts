// Firebase Realtime Database service for discussions and chat
import { database } from '../firebase/config';
import { ref, set, push, get, update, remove, onValue, off, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';
import { Discussion, Comment, UserRole } from '../types';
import { trackDiscussionCreated } from '../utils/analyticsTracker';
import { recommendationService } from './recommendationService';

const DISCUSSIONS_REF = 'discussions';
const DISCUSSION_LIKES_REF = 'discussion_likes';
const PUBLIC_DISCUSSIONS_REF = 'publicDiscussions';

// Shared utility functions

/**
 * Normalize comments array from various storage formats into a consistent Comment[] array
 * Handles: array format, object map format with IDs as keys
 */
export const normalizeDiscussionComments = (raw: any): Comment[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((c: any) => ({
            id: c?.id || '',
            authorId: c?.authorId || '',
            authorName: c?.authorName || '',
            authorRole: c?.authorRole || 'student',
            content: c?.content || '',
            createdAt: c?.createdAt || '',
        }));
    }
    
    // Handle object map format where comments are stored as a dict with IDs as keys
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        return Object.values(raw).map((c: any) => ({
            id: c?.id || '',
            authorId: c?.authorId || '',
            authorName: c?.authorName || '',
            authorRole: c?.authorRole || 'student',
            content: c?.content || '',
            createdAt: c?.createdAt || '',
        }));
    }
    
    return [];
};

/**
 * Interface for real-time like information
 */
export interface DiscussionLikes {
    likeCount: number;
    likedByCurrentUser: boolean;
    userIds: Record<string, boolean>;
}

/**
 * Toggle like for a discussion (add or remove)
 * This implements a toggle mechanism: if user hasn't liked, add like; if liked, remove it
 * This function only uses the discussion_likes node for consistency and to avoid
 * duplicate source of truth with discussion.likes and discussion.likedBy fields
 * @param discussionId - The discussion ID
 * @param userId - The user ID who wants to toggle their like
 * @returns Promise<boolean> - true if now liked, false if unliked
 */
export const toggleLike = async (discussionId: string, userId: string): Promise<boolean> => {
    // Validate inputs
    if (!discussionId || typeof discussionId !== 'string') {
        console.error('Invalid discussionId:', discussionId);
        return false;
    }
    if (!userId || typeof userId !== 'string') {
        console.error('Invalid userId:', userId);
        return false;
    }

    const userLikeRef = ref(database, `${DISCUSSION_LIKES_REF}/${discussionId}/${userId}`);
    
    try {
        const snapshot = await get(userLikeRef);
        const alreadyLiked = snapshot.exists();
        
        if (alreadyLiked) {
            // User already liked - remove the like
            await remove(userLikeRef);
            return false;
        } else {
            // User hasn't liked - add the like
            await set(userLikeRef, true);
            return true;
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time like updates for a discussion
 * @param discussionId - The discussion ID
 * @param currentUserId - The current user's ID (to determine if they liked)
 * @param callback - Callback with like count and whether current user liked
 * @returns Unsubscribe function
 */
export const subscribeToLikes = (
    discussionId: string,
    currentUserId: string | null,
    callback: (likes: DiscussionLikes) => void
): (() => void) => {
    // Validate discussionId
    if (!discussionId || typeof discussionId !== 'string') {
        console.error('Invalid discussionId:', discussionId);
        callback({ likeCount: 0, likedByCurrentUser: false, userIds: {} });
        return () => {};
    }

    const likesRef = ref(database, `${DISCUSSION_LIKES_REF}/${discussionId}`);

    onValue(likesRef, (snapshot) => {
        if (snapshot.exists()) {
            const userIds = snapshot.val() as Record<string, boolean>;
            const likeCount = Object.keys(userIds).length;
            const likedByCurrentUser = currentUserId ? !!userIds[currentUserId] : false;
            
            callback({
                likeCount,
                likedByCurrentUser,
                userIds
            });
        } else {
            // No likes yet
            callback({ likeCount: 0, likedByCurrentUser: false, userIds: {} });
        }
    }, (error) => {
        console.error('Error subscribing to likes:', error);
        callback({ likeCount: 0, likedByCurrentUser: false, userIds: {} });
    });

    return () => off(likesRef);
};

/**
 * Get like count and check if user liked (one-time fetch)
 * @param discussionId - The discussion ID
 * @param userId - The user ID to check
 * @returns Promise<DiscussionLikes>
 */
export const getLikes = async (discussionId: string, userId: string): Promise<DiscussionLikes> => {
    // Validate inputs
    if (!discussionId || typeof discussionId !== 'string') {
        console.error('Invalid discussionId:', discussionId);
        return { likeCount: 0, likedByCurrentUser: false, userIds: {} };
    }
    if (!userId || typeof userId !== 'string') {
        return { likeCount: 0, likedByCurrentUser: false, userIds: {} };
    }

    const likesRef = ref(database, `${DISCUSSION_LIKES_REF}/${discussionId}`);
    
    try {
        const snapshot = await get(likesRef);
        
        if (snapshot.exists()) {
            const userIds = snapshot.val() as Record<string, boolean>;
            const likeCount = Object.keys(userIds).length;
            
            return {
                likeCount,
                likedByCurrentUser: !!userIds[userId],
                userIds
            };
        }
        
        return { likeCount: 0, likedByCurrentUser: false, userIds: {} };
    } catch (error) {
        console.error('Error getting likes:', error);
        return { likeCount: 0, likedByCurrentUser: false, userIds: {} };
    }
};

/**
 * Create a new discussion
 * @param discussion - The discussion to create
 * @returns The created discussion with ID
 */
export const createDiscussion = async (discussion: Omit<Discussion, 'id'>): Promise<Discussion> => {
    const discussionsRef = ref(database, DISCUSSIONS_REF);
    const newDiscussionRef = push(discussionsRef);
    const discussionId = newDiscussionRef.key || Date.now().toString();

    const newDiscussion: Discussion = {
        ...discussion,
        id: discussionId
    };

    await set(newDiscussionRef, newDiscussion);

    // Track analytics event - discussion created
    trackDiscussionCreated(newDiscussion.title, newDiscussion.courseId).catch(err =>
        console.warn('Analytics tracking skipped:', err)
    );

    // Track discussion creation for recommendations (non-blocking)
    if (discussion.authorId) {
        recommendationService.trackActivity({
            activityType: 'discussion',
            metadata: {
                contentType: 'discussion',
                contentId: discussionId,
                category: discussion.courseId || 'general',
                keywords: [],
                source: 'discussions',
            },
        }, discussion.authorId).catch(() => {});
    }

    // Sync to public collection for guest access with retry logic
    (async () => {
        const maxRetries = 3;
        const retryDelay = 1000;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await syncDiscussionToPublicCollection(newDiscussion);
                break; // Success
            } catch (e) {
                console.warn(`Failed to sync discussion to public collection (attempt ${attempt}/${maxRetries}):`, e);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        }
    })();

    return newDiscussion;
};

/**
 * Get all discussions for a course
 * @param courseId - The course ID
 * @returns Array of discussions
 */
export const getCourseDiscussions = async (courseId: string): Promise<Discussion[]> => {
    const discussionsRef = ref(database, DISCUSSIONS_REF);
    const discussionsQuery = query(discussionsRef, orderByChild('courseId'), equalTo(courseId));
    const snapshot = await get(discussionsQuery);

    if (snapshot.exists()) {
        const discussions: Discussion[] = [];
        snapshot.forEach((childSnapshot) => {
            const discussion = childSnapshot.val() as Discussion;
            // Normalize comments to always be an array
            let comments: Comment[] = [];
            if (Array.isArray(discussion.comments)) {
                comments = discussion.comments;
            } else if (discussion.comments && typeof discussion.comments === 'object') {
                comments = Object.values(discussion.comments);
            }
            discussions.push({
                ...discussion,
                id: childSnapshot.key || discussion.id,
                comments
            } as Discussion);
        });
        return discussions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    return [];
};

/**
 * Get all discussions from all courses (for the global discussions page)
 * @param maxResults - Maximum number of discussions to return (default: 500, max: 2000)
 * @returns Array of all discussions
 */
export const getAllDiscussions = async (maxResults: number = 500): Promise<Discussion[]> => {
    const safeLimit = Math.min(Math.max(1, maxResults), 2000);
    const discussionsRef = ref(database, DISCUSSIONS_REF);
    // Use limitToFirst for Realtime Database pagination
    const limitedRef = safeLimit < 2000 ? query(discussionsRef, limitToFirst(safeLimit)) : discussionsRef;
    const snapshot = await get(limitedRef);

    if (snapshot.exists()) {
        const discussions: Discussion[] = [];
        snapshot.forEach((childSnapshot) => {
            const discussion = childSnapshot.val() as Discussion;
            // Normalize comments to always be an array
            let comments: Comment[] = [];
            if (Array.isArray(discussion.comments)) {
                comments = discussion.comments;
            } else if (discussion.comments && typeof discussion.comments === 'object') {
                // Convert object with IDs as keys to array
                comments = Object.values(discussion.comments);
            }
            discussions.push({ ...discussion, comments } as Discussion);
        });
        return discussions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
    return [];
};

/**
 * Add a comment to a discussion
 * @param discussionId - The discussion ID
 * @param comment - The comment to add
 * @returns The added comment
 */
export const addComment = async (discussionId: string, comment: Comment): Promise<Comment> => {
    const commentsRef = ref(database, `${DISCUSSIONS_REF}/${discussionId}/comments`);
    const newCommentRef = push(commentsRef);
    const commentId = newCommentRef.key || Date.now().toString();

    const newComment: Comment = {
        ...comment,
        id: commentId
    };

    await set(newCommentRef, newComment);

    // Track comment for recommendations (non-blocking)
    if (comment.authorId) {
        recommendationService.trackActivity({
            activityType: 'discussion',
            metadata: {
                contentType: 'discussion',
                contentId: discussionId,
                category: 'general',
                keywords: [],
                source: 'discussions',
            },
        }, comment.authorId).catch(() => {});
    }

    return newComment;
};

/**
 * Like a discussion
 * @param discussionId - The discussion ID
 * @param userId - The user ID who is liking
 * @returns true if liked successfully, false if already liked
 */


/**
 * Delete a discussion and all its comments
 * @param discussionId - The discussion ID
 */
export const deleteDiscussion = async (discussionId: string): Promise<void> => {
    const discussionRef = ref(database, `${DISCUSSIONS_REF}/${discussionId}`);
    // Delete all comments first
    await remove(ref(database, `${DISCUSSIONS_REF}/${discussionId}/comments`));
    // Then delete the discussion itself
    await remove(discussionRef);

    // Remove from public collection with retry
    (async () => {
        const maxRetries = 3;
        const retryDelay = 500;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await removeDiscussionFromPublicCollection(discussionId);
                break;
            } catch (e) {
                console.warn(`Failed to remove discussion from public collection (attempt ${attempt}/${maxRetries}):`, e);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        }
    })();
};

/**
 * Update a discussion (title, content, courseId)
 * @param discussionId - The discussion ID
 * @param updates - Object containing fields to update
 */
export const updateDiscussion = async (
    discussionId: string,
    updates: { title?: string; content?: string; courseId?: string }
): Promise<void> => {
    const discussionRef = ref(database, `${DISCUSSIONS_REF}/${discussionId}`);
    await update(discussionRef, updates);
};

/**
 * Delete a comment from a discussion
 * @param discussionId - The discussion ID
 * @param commentId - The comment ID to delete
 */
export const deleteComment = async (discussionId: string, commentId: string): Promise<void> => {
    const commentRef = ref(database, `${DISCUSSIONS_REF}/${discussionId}/comments/${commentId}`);
    await remove(commentRef);
};

/**
 * Update a comment in a discussion
 * @param discussionId - The discussion ID
 * @param commentId - The comment ID to update
 * @param content - New content for the comment
 */
export const updateComment = async (discussionId: string, commentId: string, content: string): Promise<void> => {
    const commentRef = ref(database, `${DISCUSSIONS_REF}/${discussionId}/comments/${commentId}`);
    await update(commentRef, { content });
};

// Comment Likes references
const COMMENT_LIKES_REF = 'comment_likes';

/**
 * Toggle like for a comment (add or remove)
 * @param discussionId - The discussion ID
 * @param commentId - The comment ID
 * @param userId - The user ID who wants to toggle their like
 * @returns Promise<boolean> - true if now liked, false if unliked
 */
export const toggleCommentLike = async (discussionId: string, commentId: string, userId: string): Promise<boolean> => {
    // Validate inputs
    if (!discussionId || typeof discussionId !== 'string') {
        console.error('Invalid discussionId:', discussionId);
        return false;
    }
    if (!commentId || typeof commentId !== 'string') {
        console.error('Invalid commentId:', commentId);
        return false;
    }
    if (!userId || typeof userId !== 'string') {
        console.error('Invalid userId:', userId);
        return false;
    }

    const userLikeRef = ref(database, `${COMMENT_LIKES_REF}/${discussionId}/${commentId}/${userId}`);
    
    try {
        const snapshot = await get(userLikeRef);
        
        if (snapshot.exists()) {
            // User already liked - remove the like
            await remove(userLikeRef);
            return false;
        } else {
            // User hasn't liked - add the like
            await set(userLikeRef, true);
            return true;
        }
    } catch (error) {
        console.error('Error toggling comment like:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time like updates for a comment
 * @param discussionId - The discussion ID
 * @param commentId - The comment ID
 * @param currentUserId - The current user's ID (to determine if they liked)
 * @param callback - Callback with like count and whether current user liked
 * @returns Unsubscribe function
 */
export const subscribeToCommentLikes = (
    discussionId: string,
    commentId: string,
    currentUserId: string | null,
    callback: (likes: { likeCount: number; likedByCurrentUser: boolean }) => void
): (() => void) => {
    // Validate inputs
    if (!discussionId || typeof discussionId !== 'string' || !commentId || typeof commentId !== 'string') {
        callback({ likeCount: 0, likedByCurrentUser: false });
        return () => {};
    }

    const likesRef = ref(database, `${COMMENT_LIKES_REF}/${discussionId}/${commentId}`);

    onValue(likesRef, (snapshot) => {
        if (snapshot.exists()) {
            const userIds = snapshot.val() as Record<string, boolean>;
            const likeCount = Object.keys(userIds).length;
            const likedByCurrentUser = currentUserId ? !!userIds[currentUserId] : false;
            
            callback({
                likeCount,
                likedByCurrentUser
            });
        } else {
            // No likes yet
            callback({ likeCount: 0, likedByCurrentUser: false });
        }
    }, (error) => {
        console.error('Error subscribing to comment likes:', error);
        callback({ likeCount: 0, likedByCurrentUser: false });
    });

    return () => off(likesRef);
};

/**
 * Subscribe to real-time updates for course discussions
 * @param courseId - The course ID
 * @param callback - Callback for updates
 * @returns Unsubscribe function
 */
export const subscribeToDiscussions = (
    courseId: string,
    callback: (discussions: Discussion[]) => void
): (() => void) => {
    const discussionsRef = ref(database, DISCUSSIONS_REF);
    const discussionsQuery = query(discussionsRef, orderByChild('courseId'), equalTo(courseId));

    const unsubscribe = onValue(discussionsQuery, (snapshot) => {
        if (snapshot.exists()) {
            const discussions: Discussion[] = [];
            snapshot.forEach((childSnapshot) => {
                const discussion = childSnapshot.val() as Discussion;
                // Normalize comments to always be an array
                let comments: Comment[] = [];
                if (Array.isArray(discussion.comments)) {
                    comments = discussion.comments;
                } else if (discussion.comments && typeof discussion.comments === 'object') {
                    comments = Object.values(discussion.comments);
                }
                discussions.push({
                    ...discussion,
                    id: childSnapshot.key || discussion.id,
                    comments
                } as Discussion);
            });
            callback(discussions.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ));
        } else {
            callback([]);
        }
    });

    return unsubscribe;
};

/**
 * Subscribe to real-time updates for ALL discussions (global)
 * @param callback - Callback for updates
 * @returns Unsubscribe function
 */
export const subscribeToAllDiscussions = (
    callback: (discussions: Discussion[]) => void
): (() => void) => {
    const discussionsRef = ref(database, DISCUSSIONS_REF);

    onValue(discussionsRef, (snapshot) => {
        try {
            if (snapshot.exists()) {
                const discussions: Discussion[] = [];
                snapshot.forEach((childSnapshot) => {
                    const discussion = childSnapshot.val();
                    if (discussion) {
                        // Normalize comments to always be an array
                        let comments: Comment[] = [];
                        if (Array.isArray(discussion.comments)) {
                            comments = discussion.comments;
                        } else if (discussion.comments && typeof discussion.comments === 'object') {
                            comments = Object.values(discussion.comments);
                        }
                        discussions.push({
                            ...discussion,
                            id: childSnapshot.key || discussion.id,
                            comments
                        });
                    }
                });
                callback(discussions.sort((a, b) =>
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                ));
            } else {
                callback([]);
            }
        } catch (error) {
            console.error('Error in subscribeToAllDiscussions:', error);
            callback([]);
        }
    }, (error) => {
        console.error('Firebase error in subscribeToAllDiscussions:', error);
        callback([]);
    });

    return () => {
        try {
            off(discussionsRef);
        } catch (error) {
            console.warn('Error unsubscribing from discussions:', error);
        }
    };
};

/**
 * Subscribe to real-time updates for a single discussion
 * @param discussionId - The discussion ID
 * @param callback - Callback for updates
 * @returns Unsubscribe function
 */
export const subscribeToDiscussion = (
    discussionId: string,
    callback: (discussion: Discussion | null) => void
): (() => void) => {
    const discussionRef = ref(database, `${DISCUSSIONS_REF}/${discussionId}`);

    onValue(discussionRef, (snapshot) => {
        if (snapshot.exists()) {
            const discussion = snapshot.val() as Discussion;
            // Normalize comments to always be an array
            let comments: Comment[] = [];
            if (Array.isArray(discussion.comments)) {
                comments = discussion.comments;
            } else if (discussion.comments && typeof discussion.comments === 'object') {
                comments = Object.values(discussion.comments);
            }
            callback({ ...discussion, comments } as Discussion);
        } else {
            callback(null);
        }
    });

    return () => off(discussionRef);
};

// Chat/Message types for real-time chat
export interface ChatMessage {
    id: string;
    courseId: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    content: string;
    createdAt: string;
}

const CHAT_REF = 'chat';

/**
 * Send a chat message
 * @param message - The message to send
 * @returns The sent message
 */
export const sendChatMessage = async (message: Omit<ChatMessage, 'id'>): Promise<ChatMessage> => {
    const messagesRef = ref(database, `${CHAT_REF}/${message.courseId}`);
    const newMessageRef = push(messagesRef);
    const messageId = newMessageRef.key || Date.now().toString();

    const newMessage: ChatMessage = {
        ...message,
        id: messageId
    };

    await set(newMessageRef, newMessage);
    return newMessage;
};

/**
 * Get chat messages for a course
 * @param courseId - The course ID
 * @returns Array of chat messages
 */
export const getChatMessages = async (courseId: string): Promise<ChatMessage[]> => {
    const messagesRef = ref(database, `${CHAT_REF}/${courseId}`);
    const snapshot = await get(messagesRef);

    if (snapshot.exists()) {
        const messages: ChatMessage[] = [];
        snapshot.forEach((childSnapshot) => {
            messages.push(childSnapshot.val() as ChatMessage);
        });
        return messages.sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
    }
    return [];
};

/**
 * Subscribe to real-time chat messages for a specific course
 * @param courseId - The course ID
 * @param callback - Callback for updates
 * @returns Unsubscribe function
 */
export const subscribeToChat = (
    courseId: string,
    callback: (messages: ChatMessage[]) => void
): (() => void) => {
    const messagesRef = ref(database, `${CHAT_REF}/${courseId}`);

    onValue(messagesRef, (snapshot) => {
        if (snapshot.exists()) {
            const messages: ChatMessage[] = [];
            snapshot.forEach((childSnapshot) => {
                messages.push(childSnapshot.val() as ChatMessage);
            });
            callback(messages.sort((a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            ));
        } else {
            callback([]);
        }
    });

    return () => off(messagesRef);
};

/**
 * Subscribe to global chat (for all users)
 * @param callback - Callback for updates
 * @returns Unsubscribe function
 */
export const subscribeToGlobalChat = (
    callback: (messages: ChatMessage[]) => void
): (() => void) => {
    const messagesRef = ref(database, CHAT_REF);

    onValue(messagesRef, (snapshot) => {
        try {
            if (snapshot.exists()) {
                const messages: ChatMessage[] = [];
                snapshot.forEach((courseSnapshot) => {
                    if (courseSnapshot.exists()) {
                        courseSnapshot.forEach((messageSnapshot) => {
                            const message = messageSnapshot.val();
                            if (message) {
                                messages.push(message);
                            }
                        });
                    }
                });
                callback(messages.sort((a, b) =>
                    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
                ));
            } else {
                callback([]);
            }
        } catch (error) {
            console.error('Error in subscribeToGlobalChat:', error);
            callback([]);
        }
    }, (error) => {
        console.error('Firebase error in subscribeToGlobalChat:', error);
        callback([]);
    });

    return () => {
        try {
            off(messagesRef);
        } catch (error) {
            console.warn('Error unsubscribing from global chat:', error);
        }
    };
};

// ============================================
// PUBLIC DISCUSSIONS - Read-only access for guests
// ============================================

export interface PublicDiscussionComment {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    content: string;
    createdAt: string;
}

export interface PublicDiscussion {
    id: string;
    title: string;
    content: string;
    courseId: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    createdAt: string;
    commentsCount: number;
    comments?: PublicDiscussionComment[];
}

// Normalize the comments payload (array or object map) into a public-safe shape.
const normalizePublicComments = (raw: any): PublicDiscussionComment[] => {
    if (!raw) return [];
    const list: any[] = Array.isArray(raw) ? raw : Object.values(raw);
    return list.map((c: any) => ({
        id: c?.id || '',
        authorId: c?.authorId || '',
        authorName: c?.authorName || '',
        authorRole: c?.authorRole || 'student',
        content: c?.content || '',
        createdAt: c?.createdAt || '',
    }));
};

/**
 * Convert a guest-safe PublicDiscussion into the full Discussion shape,
 * carrying its already-synced comments so guests see real replies.
 * Shared by both the workspace forum and the global discussions page so
 * guest (public) discussions are mapped identically in both places.
 */
export const convertPublicToDiscussion = (pd: PublicDiscussion): Discussion => ({
    id: pd.id,
    title: pd.title,
    content: pd.content,
    courseId: pd.courseId,
    authorId: pd.authorId,
    authorName: pd.authorName,
    authorRole: pd.authorRole,
    createdAt: pd.createdAt,
    comments: (pd.comments || []).map((c) => ({
        id: c.id,
        authorId: c.authorId,
        authorName: c.authorName,
        authorRole: c.authorRole,
        content: c.content,
        createdAt: c.createdAt,
    })) as Comment[],
    likes: 0,
});

/**
 * Format an ISO date string into a human-readable Arabic date/time.
 * Shared date formatter for the discussion UIs to avoid duplication.
 */
export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export const subscribeToPublicDiscussions = (
    callback: (discussions: PublicDiscussion[]) => void
): (() => void) => {
    const publicDiscussionsRef = ref(database, PUBLIC_DISCUSSIONS_REF);

    onValue(publicDiscussionsRef, (snapshot) => {
        try {
            if (snapshot.exists()) {
                const discussions: PublicDiscussion[] = [];
                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val();
                    if (data) {
                    discussions.push({
                        id: childSnapshot.key || data.id,
                        title: data.title || '',
                        content: data.content || '',
                        courseId: data.courseId || '',
                        authorId: data.authorId || '',
                        authorName: data.authorName || '',
                        authorRole: data.authorRole || 'student',
                        createdAt: data.createdAt || '',
                        commentsCount: data.commentsCount || 0,
                        comments: normalizePublicComments(data.comments),
                    });
                    }
                });
                callback(discussions.sort((a, b) =>
                    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                ));
            } else {
                callback([]);
            }
        } catch (error) {
            console.error('Error in subscribeToPublicDiscussions:', error);
            callback([]);
        }
    }, (error) => {
        console.error('Firebase error in subscribeToPublicDiscussions:', error);
        callback([]);
    });

    return () => {
        try {
            off(publicDiscussionsRef);
        } catch (error) {
            console.warn('Error unsubscribing from public discussions:', error);
        }
    };
};

export const getPublicDiscussions = async (): Promise<PublicDiscussion[]> => {
    const publicDiscussionsRef = ref(database, PUBLIC_DISCUSSIONS_REF);
    const snapshot = await get(publicDiscussionsRef);

    if (snapshot.exists()) {
        const discussions: PublicDiscussion[] = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            if (data) {
                    discussions.push({
                        id: childSnapshot.key || data.id,
                        title: data.title || '',
                        content: data.content || '',
                        courseId: data.courseId || '',
                        authorId: data.authorId || '',
                        authorName: data.authorName || '',
                        authorRole: data.authorRole || 'student',
                        createdAt: data.createdAt || '',
                        commentsCount: data.commentsCount || 0,
                        comments: normalizePublicComments(data.comments),
                    });
            }
        });
        return discussions.sort((a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
    }
    return [];
};

export const syncDiscussionToPublicCollection = async (discussion: Discussion): Promise<void> => {
    try {
        const publicData = {
            id: discussion.id,
            title: discussion.title || '',
            content: discussion.content || '',
            courseId: discussion.courseId || '',
            authorId: discussion.authorId || '',
            authorName: discussion.authorName || '',
            authorRole: discussion.authorRole || 'student',
            createdAt: discussion.createdAt || new Date().toISOString(),
            commentsCount: Array.isArray(discussion.comments) ? discussion.comments.length : 0,
            comments: normalizePublicComments(discussion.comments),
        };

        await set(ref(database, `${PUBLIC_DISCUSSIONS_REF}/${discussion.id}`), publicData);
    } catch (error) {
        console.warn('Failed to sync discussion to public collection:', error);
    }
};

export const removeDiscussionFromPublicCollection = async (discussionId: string): Promise<void> => {
    try {
        await remove(ref(database, `${PUBLIC_DISCUSSIONS_REF}/${discussionId}`));
    } catch (error) {
        console.warn('Failed to remove discussion from public collection:', error);
    }
};
