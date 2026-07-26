// Firebase Realtime Database service for course-specific real-time chat
import { database } from '../firebase/config';
import { ref, set, push, get, onValue, query, limitToLast, update, remove } from 'firebase/database';
import { trackMessageSent } from '../utils/analyticsTracker';

// Data model: chat_rooms/{courseId}/messages/{messageId}
export interface ReplyTo {
    id: string;
    text: string;
    senderName: string;
}

export interface ChatRoomMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt: number;
    replyTo?: ReplyTo;
    reactions?: Record<string, string[]>; // emoji -> array of userIds (cached)
    editedAt?: number;
    isDeleted?: boolean;
    readBy?: Record<string, boolean>; // userId -> true (read receipts)
}

const CHAT_ROOMS_REF = 'chat_rooms';
const CHAT_REACTIONS_REF = 'chat_reactions';

/**
 * Send a message to a course chat room
 */
export const sendMessage = async (
    courseId: string,
    text: string,
    sender: { id: string; name: string },
    replyTo?: ReplyTo
): Promise<ChatRoomMessage> => {
    const messagesRef = ref(database, `${CHAT_ROOMS_REF}/${courseId}/messages`);
    const newMessageRef = push(messagesRef);
    const messageId = newMessageRef.key || Date.now().toString();

    const newMessage: ChatRoomMessage = {
        id: messageId,
        text: text.trim(),
        senderId: sender.id,
        senderName: sender.name,
        createdAt: Date.now(),
        ...(replyTo && { replyTo })
    };

    await set(newMessageRef, newMessage);

    trackMessageSent(sender.id, sender.name).catch(err =>
        console.warn('Analytics tracking skipped:', err)
    );

    return newMessage;
};

/**
 * Subscribe to real-time messages for a course chat room
 */
export const subscribeMessages = (
    courseId: string,
    callback: (messages: ChatRoomMessage[]) => void,
    onError?: (error: Error) => void,
    limit: number = 50
): (() => void) => {
    if (!courseId) {
        callback([]);
        return () => { };
    }

    const messagesRef = ref(database, `${CHAT_ROOMS_REF}/${courseId}/messages`);
    const messagesQuery = query(messagesRef, limitToLast(limit));
    const reactionsRef = ref(database, `${CHAT_REACTIONS_REF}/${courseId}`);

    let cachedMessages: ChatRoomMessage[] = [];
    let cachedReactions: Record<string, Record<string, string[]>> = {};

    const mergeAndCallback = () => {
        const merged = cachedMessages.map(msg => ({
            ...msg,
            reactions: cachedReactions[msg.id] || msg.reactions || {}
        }));
        merged.sort((a, b) => a.createdAt - b.createdAt);
        callback(merged);
    };

    const _unsubMessages = onValue(messagesQuery, (snapshot) => {
        try {
            if (snapshot.exists()) {
                cachedMessages = [];
                snapshot.forEach((childSnapshot) => {
                    const message = childSnapshot.val() as ChatRoomMessage;
                    cachedMessages.push({
                        ...message,
                        id: childSnapshot.key || message.id
                    });
                });
            } else {
                cachedMessages = [];
            }
            mergeAndCallback();
        } catch (error) {
            console.error('Error in subscribeMessages:', error);
            callback([]);
            if (onError && error instanceof Error) onError(error);
        }
    }, (error) => {
        console.error('Firebase error in subscribeMessages:', error);
        callback([]);
    });

    const _unsubReactions = onValue(reactionsRef, (snapshot) => {
        try {
            cachedReactions = {};
            if (snapshot.exists()) {
                snapshot.forEach((msgSnapshot) => {
                    const msgId = msgSnapshot.key || '';
                    const emojis: Record<string, string[]> = {};
                    msgSnapshot.forEach((emojiSnapshot) => {
                        const emoji = emojiSnapshot.key || '';
                        const userIds: string[] = [];
                        emojiSnapshot.forEach((userSnapshot) => {
                            userIds.push(userSnapshot.key || '');
                        });
                        if (userIds.length > 0) {
                            emojis[emoji] = userIds;
                        }
                    });
                    if (Object.keys(emojis).length > 0) {
                        cachedReactions[msgId] = emojis;
                    }
                });
            }
            mergeAndCallback();
        } catch (error) {
            console.error('Error in subscribeReactions:', error);
        }
    });

    return () => {
        try { _unsubMessages(); } catch (e) { console.warn('Error unsubscribing messages:', e); }
        try { _unsubReactions(); } catch (e) { console.warn('Error unsubscribing reactions:', e); }
    };
};

/**
 * Add a reaction to a message
 */
export const addReaction = async (
    chatId: string,
    messageId: string,
    emoji: string,
    userId: string
): Promise<boolean> => {
    const reactionRef = ref(database, `${CHAT_REACTIONS_REF}/${chatId}/${messageId}/${emoji}/${userId}`);
    await set(reactionRef, true);
    return true;
};

/**
 * Remove a reaction from a message
 */
export const removeReaction = async (
    chatId: string,
    messageId: string,
    emoji: string,
    userId: string
): Promise<boolean> => {
    const reactionRef = ref(database, `${CHAT_REACTIONS_REF}/${chatId}/${messageId}/${emoji}/${userId}`);
    await remove(reactionRef);
    return true;
};

/**
 * Edit a message (only by sender or admin)
 */
export const editMessage = async (
    chatId: string,
    messageId: string,
    newText: string,
    userId: string
): Promise<boolean> => {
    const messageRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages/${messageId}`);
    const snapshot = await get(messageRef);

    if (snapshot.exists()) {
        const message = snapshot.val() as ChatRoomMessage;
        if (message.senderId === userId) {
            await update(messageRef, {
                text: newText.trim(),
                editedAt: Date.now()
            });
            return true;
        }
    }
    return false;
};

/**
 * Admin delete any message in any chat
 * IMPORTANT: This should be called from a secure backend endpoint that
 * validates the user's admin role. Client-side checks are not sufficient
 * for security. Consider moving this to a Cloud Function or backend API.
 */
export const adminDeleteMessage = async (
    chatId: string,
    messageId: string,
    requesterId?: string
): Promise<boolean> => {
    const messageRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages/${messageId}`);
    const snapshot = await get(messageRef);

    if (snapshot.exists()) {
        // Security: In production, validate admin role on the backend
        // This is a client-side helper that should only be called after
        // proper authentication and authorization checks
        if (requesterId) {
            console.warn('adminDeleteMessage called with requesterId - ensure backend validation');
        }
        await remove(messageRef);
        const reactionsRef = ref(database, `${CHAT_REACTIONS_REF}/${chatId}/${messageId}`);
        await remove(reactionsRef);
        return true;
    }
    return false;
};

/**
 * Delete own message from a chat
 */
export const deleteMessage = async (
    chatId: string,
    messageId: string,
    senderId: string
): Promise<boolean> => {
    const messageRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages/${messageId}`);
    const snapshot = await get(messageRef);

    if (snapshot.exists()) {
        const message = snapshot.val() as ChatRoomMessage;
        if (message.senderId === senderId) {
            await remove(messageRef);
            const reactionsRef = ref(database, `${CHAT_REACTIONS_REF}/${chatId}/${messageId}`);
            await remove(reactionsRef);
            return true;
        }
    }
    return false;
};

/**
 * Soft delete a message (mark as deleted but keep in DB)
 */
export const softDeleteMessage = async (
    chatId: string,
    messageId: string
): Promise<boolean> => {
    const messageRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages/${messageId}`);
    const snapshot = await get(messageRef);

    if (snapshot.exists()) {
        await update(messageRef, { isDeleted: true });
        return true;
    }
    return false;
};

/**
 * Mark a message as read by a user (read receipts)
 */
export const markMessageAsRead = async (
    chatId: string,
    messageId: string,
    userId: string
): Promise<boolean> => {
    const readReceiptRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages/${messageId}/readBy/${userId}`);
    await set(readReceiptRef, true);
    return true;
};

/**
 * Get read status for messages
 */
export const getMessagesReadStatus = async (
    chatId: string,
    messageIds: string[]
): Promise<Record<string, string[]>> => {
    const result: Record<string, string[]> = {};

    for (const msgId of messageIds) {
        const readByRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages/${msgId}/readBy`);
        const snapshot = await get(readByRef);
        if (snapshot.exists()) {
            const readBy: Record<string, boolean> = snapshot.val();
            result[msgId] = Object.keys(readBy);
        } else {
            result[msgId] = [];
        }
    }

    return result;
};

/**
 * Subscribe to read receipts for messages
 */
export const subscribeToReadReceipts = (
    chatId: string,
    callback: (readReceipts: Record<string, string[]>) => void
): (() => void) => {
    const readReceiptsRef = ref(database, `${CHAT_ROOMS_REF}/${chatId}/messages`);

    const unsubscribe = onValue(readReceiptsRef, (snapshot) => {
        const result: Record<string, string[]> = {};
        if (snapshot.exists()) {
            snapshot.forEach((msgSnapshot) => {
                const msgId = msgSnapshot.key || '';
                const readBySnapshot = msgSnapshot.child('readBy');
                if (readBySnapshot.exists()) {
                    const readBy: Record<string, boolean> = readBySnapshot.val();
                    result[msgId] = Object.keys(readBy);
                }
            });
        }
        callback(result);
    });

    return () => unsubscribe();
};

/**
 * Mark all messages in a room as read for the current user
 */
export const markAllMessagesAsRead = async (
    chatId: string,
    userId: string,
    messageIds: string[]
): Promise<void> => {
    const updates: Record<string, boolean> = {};
    for (const msgId of messageIds) {
        updates[`${CHAT_ROOMS_REF}/${chatId}/messages/${msgId}/readBy/${userId}`] = true;
    }
    await update(ref(database), updates);
};

/**
 * Get all users for the chat user list (Realtime DB source).
 * NOTE: renamed from getAllUsers to avoid collision with the admin
 * user-listing function in authService (different source & shape).
 */
export const getChatUsers = async (): Promise<Array<{ id: string; name: string; email: string }>> => {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);

    if (snapshot.exists()) {
        const users: Array<{ id: string; name: string; email: string }> = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            users.push({
                id: childSnapshot.key || '',
                name: data.name || data.displayName || 'مستخدم',
                email: data.email || ''
            });
        });
        return users;
    }
    return [];
};
