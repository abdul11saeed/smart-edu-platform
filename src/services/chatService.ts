// Firebase Realtime Database service for course-specific real-time chat
import { database } from '../firebase/config';
import { ref, set, push, get, onValue, query, limitToLast, update, remove, onDisconnect, serverTimestamp } from 'firebase/database';
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

// createdAt must use the Firebase server timestamp (not the sender's device
    // clock) so every client sorts messages by the same authoritative time.
    // Using Date.now() makes messages appear out of order when the two users'
    // device clocks differ. serverTimestamp() is a sentinel that Firebase
    // replaces with the real server time when the write is stored.
    const newMessage = {
        id: messageId,
        text: text.trim(),
        senderId: sender.id,
        senderName: sender.name,
        createdAt: serverTimestamp(),
        ...(replyTo && { replyTo })
    };

    await set(newMessageRef, newMessage);

    trackMessageSent(sender.id, sender.name).catch(err =>
        console.warn('Analytics tracking skipped:', err)
    );

    // Return a number-based createdAt (Date.now()) so the returned object still
    // satisfies the ChatRoomMessage type (serverTimestamp() is an opaque sentinel).
    return { ...newMessage, createdAt: Date.now() } as ChatRoomMessage;
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
        // Remove the message first. Its removal is the authoritative operation.
        await remove(messageRef);

        // Best-effort cleanup of the associated reactions node. The security
        // rules for `chat_reactions` only let a user delete their OWN reaction
        // slot, so removing the whole node may be denied when other users have
        // reacted. We must never let that permission failure abort the message
        // deletion (it would surface as an error in the UI even though the
        // message was already removed).
        try {
            const reactionsRef = ref(database, `${CHAT_REACTIONS_REF}/${chatId}/${messageId}`);
            await remove(reactionsRef);
        } catch (e) {
            console.warn('Reactions cleanup skipped (best-effort):', e);
        }
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
            // Remove the message first. Its removal is the authoritative operation.
            await remove(messageRef);

            // Best-effort cleanup of the associated reactions node. The security
            // rules for `chat_reactions` only let a user delete their OWN reaction
            // slot, so removing the whole node may be denied when other users have
            // reacted. We must never let that permission failure abort the message
            // deletion (it would surface as an error in the UI even though the
            // message was already removed).
            try {
                const reactionsRef = ref(database, `${CHAT_REACTIONS_REF}/${chatId}/${messageId}`);
                await remove(reactionsRef);
            } catch (e) {
                console.warn('Reactions cleanup skipped (best-effort):', e);
            }
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

// ============================================
// Presence & Typing Indicator Services
// ============================================

const PRESENCE_REF = 'presence';
const TYPING_REF = 'typing';

/**
 * Set the current user as online in a specific room.
 * Uses onDisconnect to automatically set offline when connection drops.
 */
export const setUserOnline = async (userId: string, userName: string, roomId: string): Promise<void> => {
    const userPresenceRef = ref(database, `${PRESENCE_REF}/${userId}`);
    const presenceData = {
        status: 'online',
        lastSeen: Date.now(),
        currentRoom: roomId,
        userName: userName
    };

    await set(userPresenceRef, presenceData);
    onDisconnect(userPresenceRef).set({
        status: 'offline',
        lastSeen: Date.now(),
        currentRoom: null,
        userName: userName
    });
};

/**
 * Set the current user as offline (e.g., when leaving a chat)
 */
export const setUserOffline = async (userId: string): Promise<void> => {
    const userPresenceRef = ref(database, `${PRESENCE_REF}/${userId}`);
    await set(userPresenceRef, {
        status: 'offline',
        lastSeen: Date.now(),
        currentRoom: null,
        userName: null
    });
};

/**
 * Subscribe to online status of all users
 * Returns a map of userId -> presence data
 */
export const subscribeToPresence = (callback: (presenceMap: Record<string, { status: string; lastSeen: number; currentRoom: string | null; userName: string }>) => void): (() => void) => {
    const presenceRef = ref(database, PRESENCE_REF);

    const unsubscribe = onValue(presenceRef, (snapshot) => {
        const presenceMap: Record<string, { status: string; lastSeen: number; currentRoom: string | null; userName: string }> = {};
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                presenceMap[childSnapshot.key || ''] = {
                    status: data.status || 'offline',
                    lastSeen: data.lastSeen || Date.now(),
                    currentRoom: data.currentRoom || null,
                    userName: data.userName || ''
                };
            });
        }
        callback(presenceMap);
    });

    return () => unsubscribe();
};

/**
 * Subscribe to typing indicators in a specific room
 */
export const subscribeToTyping = (roomId: string, callback: (typingMap: Record<string, { isTyping: boolean; timestamp: number; userName: string }>) => void): (() => void) => {
    const typingRef = ref(database, `${TYPING_REF}/${roomId}`);

    const unsubscribe = onValue(typingRef, (snapshot) => {
        const typingMap: Record<string, { isTyping: boolean; timestamp: number; userName: string }> = {};
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                typingMap[childSnapshot.key || ''] = {
                    isTyping: data.isTyping || false,
                    timestamp: data.timestamp || 0,
                    userName: data.userName || ''
                };
            });
        }
        callback(typingMap);
    });

    return () => unsubscribe();
};

/**
 * Set typing status for the current user in a room
 */
export const setTypingStatus = async (userId: string, userName: string, roomId: string, isTyping: boolean): Promise<void> => {
    const typingRef = ref(database, `${TYPING_REF}/${roomId}/${userId}`);
    if (isTyping) {
        await set(typingRef, {
            isTyping: true,
            timestamp: Date.now(),
            userName: userName
        });
    } else {
        await set(typingRef, null);
    }
};

/**
 * Clear typing status for the current user in a room
 */
export const clearTypingStatus = async (userId: string, roomId: string): Promise<void> => {
    const typingRef = ref(database, `${TYPING_REF}/${roomId}/${userId}`);
    await set(typingRef, null);
};
