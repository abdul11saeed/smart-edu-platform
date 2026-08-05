// Shared Chat Hook - Unified logic for ChatPage, PrivateChatPage and ChatTab
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
    sendMessage,
    subscribeMessages,
    editMessage,
    deleteMessage,
    adminDeleteMessage,
    addReaction,
    removeReaction,
    markMessageAsRead,
    markAllMessagesAsRead,
    ChatRoomMessage,
    setUserOnline,
    setUserOffline,
    subscribeToPresence,
    subscribeToTyping,
    setTypingStatus,
    clearTypingStatus
} from '../services/chatService';
import { createNotification } from '../services/notificationService';
import { isBlocked, isBlockedBy, blockUser, unblockUser, getBlockedUsers, subscribeToBlockedUsers } from '../services/blockService';
import { useAppStore } from '../stores/appStore';

const MESSAGE_EMOJIS = [
    '😀','😂','😮','😢','😡','👍','❤️','👏','🎉','🔥',
    '✨','🙏','💯','🤔','😉','😅','🤗','🤩','🤷','👌',
    '👀','🙌','💪','🥳','⚡','⭐','✅','💖','💔','🎊',
    '📚','📝','📢','✉️','📱','💻','🎓','🏆','🎯','🚀',
    '😍','🥰','😘','😎','🤓','🧐','😏','😒','😞','😔',
    '😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭',
    '😤','😠','🤬','🤯','😳','🥵','🥶','😱','😨','😰',
    '😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑',
    '😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤',
    '😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕',
    '🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀',
    '☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼',
    '😽','🙀','😿','😾','🐶','🐱','🐭','🐹','🐰','🦊',
    '🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵',
    '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥',
    '🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛',
    '🦋','🐌','🐞','🐜','🦟','🦗','🕷','🕸','🦂','🐢',
    '🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡',
    '🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓',
    '🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃',
    '🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕',
    '🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦃','🦚','🦜','🦢',
    '🦩','🕊','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀',
    '🐿','🦔'
];

const REACTION_EMOJIS = [
    '👍','❤️','😂','😮','😢','🙏','🔥','👏','💯','😍',
    '🎉','🤔','😡','👀','✨','💪','🙌','🥳','⚡','⭐',
    '🤗','🤩','👌','🥺','😎','🤓','😏','😒','😤','🤯'
];

const DEFAULT_LIMIT = 50;
const LOAD_STEP = 50;

export interface ReplyMessage {
    id: string;
    text: string;
    senderName: string;
}

interface UseChatOptions {
    roomId: string;
    courseName?: string;
    targetUserId?: string | null;
}

export const useChat = (options: UseChatOptions) => {
    const { roomId, courseName, targetUserId } = options;
    const { currentUser } = useAppStore();
    const { t } = useTranslation();

    // State
    const [messages, setMessages] = useState<ChatRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messageLimit, setMessageLimit] = useState(DEFAULT_LIMIT);
    const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
    const [isTargetBlocked, setIsTargetBlocked] = useState(false);
    const [isBlockedByTarget, setIsBlockedByTarget] = useState(false);

    // Presence & Typing state
    const [typingUsers, setTypingUsers] = useState<Record<string, { isTyping: boolean; timestamp: number; userName: string }>>({});
    const [onlineUsers, setOnlineUsers] = useState<Record<string, { status: string; lastSeen: number; currentRoom: string | null; userName: string }>>({});
    const typingTimeoutRef = useRef<number | null>(null);
    // Shared across effect instances (StrictMode mount->cleanup->mount) so a
    // pending offline timer from a previous instance can be cancelled by the
    // next mount instead of wiping the user's online status moments later.
    const offlineTimerRef = useRef<number | null>(null);

    // Memoized grouped messages by date
    const groupedMessages = useMemo(() => {
        return messages.reduce((groups, message) => {
            const date = new Date(message.createdAt).toDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(message);
            return groups;
        }, {} as Record<string, ChatRoomMessage[]>);
    }, [messages]);

    // Reply functionality
    const [replyTo, setReplyTo] = useState<ReplyMessage | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number; isOwnMessage: boolean } | null>(null);

    // Edit functionality
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    // Mobile action state
    const [swipedMessageId, setSwipedMessageId] = useState<string | null>(null);
    const [rightSwipedMessageId, setRightSwipedMessageId] = useState<string | null>(null);
    const touchStartXRef = useRef<number>(0);
    const touchStartYRef = useRef<number>(0);
    const touchStartTimeRef = useRef<number>(0);
    const touchHandledRef = useRef(false);

    // Scroll handling (shared across all chat surfaces)
    const containerRef = useRef<HTMLDivElement>(null);
    const userScrolledUpRef = useRef(false);
    const initialMountRef = useRef(true);
    const loadingOlderRef = useRef(false);

    const isAdmin = currentUser?.role === 'admin';
    const isPrivateChat = !!targetUserId;

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (containerRef.current) {
            containerRef.current.scrollTo({
                top: containerRef.current.scrollHeight,
                behavior
            });
        }
    }, []);

    // Auto-grow textarea: grows to fit content, capped by CSS max-h class on the element
    const autoGrow = useCallback((el: HTMLTextAreaElement | null) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }, []);

    // Track whether the user scrolled up to read older messages
    const handleScroll = useCallback(() => {
        if (containerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
            userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 100;
        }
    }, []);

    // Load older messages by increasing the subscription limit (pagination)
    const loadOlderMessages = useCallback(() => {
        loadingOlderRef.current = true;
        setMessageLimit((prev) => prev + LOAD_STEP);
    }, []);

    // Subscribe to blocked users list (for private chat)
    useEffect(() => {
        if (!currentUser || !targetUserId) {
            setBlockedUserIds([]);
            setIsTargetBlocked(false);
            setIsBlockedByTarget(false);
            return;
        }

        // Check if target user is blocked by current user
        isBlocked(currentUser.id, targetUserId).then(setIsTargetBlocked);

        // Check if target user has blocked the current user
        isBlockedBy(currentUser.id, targetUserId).then(setIsBlockedByTarget);

        // Subscribe to real-time blocked users list
        const unsubscribe = subscribeToBlockedUsers(currentUser.id, (blockedIds) => {
            setBlockedUserIds(blockedIds);
            // Update isTargetBlocked when the list changes
            if (targetUserId) {
                setIsTargetBlocked(blockedIds.includes(targetUserId));
            }
        });

        return () => unsubscribe();
    }, [currentUser?.id, targetUserId]);

    // ============================================
    // Presence & Typing Effects
    // ============================================

// Set user online when joining a room, offline when leaving.
    // We re-establish presence whenever the window regains focus or the app
    // comes back online, because the Firebase SDK may have dropped the
    // connection while the tab was backgrounded/offline (in which case the
    // onDisconnect handler already marked the user as offline even though the
    // user is still viewing the chat).
    //
    // IMPORTANT: React.StrictMode double-invokes effects in development
    // (mount -> cleanup -> mount). If the cleanup immediately calls
    // setUserOffline, the presence node is wiped right after it is set, so the
    // other party never sees the user as online. We therefore debounce the
    // offline write on a short timer: if the effect re-mounts (StrictMode or a
    // quick tab switch) the pending offline write is cancelled and online stays.
useEffect(() => {
        if (!currentUser || !roomId) return;

        // Cancel any offline write scheduled by a previous effect instance. Under
        // React.StrictMode the effect runs mount -> cleanup -> mount; the first
        // cleanup schedules setUserOffline which would wipe the online status set
        // by the second mount. Using a shared ref lets the second mount cancel it.
        if (offlineTimerRef.current !== null) {
            clearTimeout(offlineTimerRef.current);
            offlineTimerRef.current = null;
        }

        const setupPresence = async () => {
            try {
                await setUserOnline(currentUser.id, currentUser.name, roomId);
            } catch (err) {
                console.warn('Failed to set user online:', err);
            }
        };

        setupPresence();

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') setupPresence();
        };
        const handleOnline = () => setupPresence();

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('online', handleOnline);
        window.addEventListener('focus', handleOnline);

        // Set offline when leaving the room (debounced so StrictMode's
        // immediate cleanup does not wipe the online status set above).
        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('focus', handleOnline);
            if (offlineTimerRef.current !== null) {
                clearTimeout(offlineTimerRef.current);
            }
            offlineTimerRef.current = window.setTimeout(() => {
                setUserOffline(currentUser.id).catch(() => { /* ignore */ });
                // Clear typing status on unmount
                clearTypingStatus(currentUser.id, roomId).catch(() => { /* ignore */ });
            }, 1500);
        };
    }, [currentUser?.id, roomId]);

    // Subscribe to all users presence
    useEffect(() => {
        if (!currentUser) return;

        const unsubscribe = subscribeToPresence((presenceMap) => {
            setOnlineUsers(presenceMap);
        });

        return () => unsubscribe();
    }, [currentUser?.id]);

    // Subscribe to typing indicators in current room
    useEffect(() => {
        if (!roomId) return;

        const unsubscribe = subscribeToTyping(roomId, (typingMap) => {
            // Filter out current user from typing display
            const filtered = { ...typingMap };
            if (currentUser && filtered[currentUser.id]) {
                delete filtered[currentUser.id];
            }
            setTypingUsers(filtered);
        });

        return () => unsubscribe();
    }, [roomId, currentUser?.id]);

    // Send typing indicator when user is typing
    useEffect(() => {
        if (!currentUser || !roomId) return;

        const trimmedMessage = newMessage.trim();

if (trimmedMessage.length > 0) {
            // User is typing - send typing status (fire-and-forget, never let a
            // transient write failure produce an unhandled rejection that could
            // hide the indicator from the other party).
            setTypingStatus(currentUser.id, currentUser.name, roomId, true).catch(() => { /* ignore */ });

            // Clear previous timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            // Auto-clear typing after 2 seconds of inactivity
            typingTimeoutRef.current = window.setTimeout(() => {
                clearTypingStatus(currentUser.id, roomId).catch(() => { /* ignore */ });
            }, 2000);
        } else {
            // User stopped typing or cleared message
            clearTypingStatus(currentUser.id, roomId).catch(() => { /* ignore */ });
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
                typingTimeoutRef.current = null;
            }
        }

        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [newMessage, currentUser, roomId]);

    // Filter out messages from blocked users
    const filteredMessages = useMemo(() => {
        if (blockedUserIds.length === 0) return messages;
        return messages.filter(msg => !blockedUserIds.includes(msg.senderId));
    }, [messages, blockedUserIds]);

    // Subscribe to real-time messages (with reactions merge handled by the service)
    useEffect(() => {
        if (!roomId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        initialMountRef.current = true;
        loadingOlderRef.current = false;
        userScrolledUpRef.current = false;

        const unsubscribe = subscribeMessages(
            roomId,
            (updatedMessages) => {
                setMessages(updatedMessages);
                setIsLoading(false);

                // Mark incoming messages as read by the current user (read receipts)
                if (currentUser) {
                    const unreadIds = updatedMessages
                        .filter(msg => msg.senderId !== currentUser.id && (!msg.readBy || !msg.readBy[currentUser.id]))
                        .map(msg => msg.id);

                    if (unreadIds.length > 0) {
                        markAllMessagesAsRead(roomId, currentUser.id, unreadIds).catch(() => { /* ignore */ });
                    }
                }

                if (loadingOlderRef.current) {
                    // Loading older messages: user is at the top, keep them there (no auto-scroll)
                    loadingOlderRef.current = false;
                } else if (initialMountRef.current || !userScrolledUpRef.current) {
                    // Initial load -> jump to bottom; new message while viewing -> smooth scroll
                    setTimeout(() => scrollToBottom(initialMountRef.current ? 'auto' : 'smooth'), initialMountRef.current ? 0 : 100);
                }

                initialMountRef.current = false;
            },
            undefined,
            messageLimit
        );

        return () => unsubscribe();
        // Depend on the stable user id (not the whole currentUser object) so the
        // subscription is not torn down and rebuilt every time the store emits a
        // new user reference — that churn caused loading flicker and delayed
        // messages from appearing.
    }, [roomId, messageLimit, currentUser?.id]);

    // Block/unblock handlers
    const handleBlockUser = useCallback(async (userId: string) => {
        if (!currentUser) return;
        try {
            await blockUser(currentUser.id, userId);
            setIsTargetBlocked(true);
            setBlockedUserIds(prev => [...prev, userId]);
            setToastMessage(t('chat.userBlocked'));
        } catch (err) {
            setError(t('chat.errorBlockingUser'));
        }
    }, [currentUser, t]);

    const handleUnblockUser = useCallback(async (userId: string) => {
        if (!currentUser) return;
        try {
            await unblockUser(currentUser.id, userId);
            setIsTargetBlocked(false);
            setBlockedUserIds(prev => prev.filter(id => id !== userId));
            setToastMessage(t('chat.userUnblocked'));
        } catch (err) {
            setError(t('chat.errorUnblockingUser'));
        }
    }, [currentUser, t]);

    // Hide toast indicator
    useEffect(() => {
        if (messageSent || toastMessage) {
            const timer = setTimeout(() => {
                setMessageSent(false);
                setToastMessage(null);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [messageSent, toastMessage]);

    // Send message
    const handleSendMessage = useCallback(async () => {
        if (!newMessage.trim() || !currentUser) return;
        if (isTargetBlocked) {
            setError(t('chat.cannotSendToBlockedUser'));
            return;
        }
        if (isBlockedByTarget) {
            setError(t('chat.blockedYou'));
            return;
        }

        const messageText = newMessage.trim();
        setNewMessage('');
        setIsSending(true);
        userScrolledUpRef.current = false;

        // Clear typing status after sending
        if (currentUser && roomId) {
            clearTypingStatus(currentUser.id, roomId).catch(() => { /* ignore */ });
        }

        try {
            await sendMessage(roomId, messageText, {
                id: currentUser.id,
                name: currentUser.name
            }, replyTo || undefined);

            scrollToBottom('smooth');
            setMessageSent(true);
            setReplyTo(null);

            if (isPrivateChat && targetUserId) {
                // Check if the recipient has blocked the sender
                const blockedByTarget = await isBlockedBy(currentUser.id, targetUserId);
                if (!blockedByTarget) {
                    createNotification({
                        type: 'private_message',
                        title: t('notifications.privateMessageTitle'),
                        body: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
                        fromUserId: currentUser.id,
                        fromUserName: currentUser.name,
                        toUserId: targetUserId,
                        link: `/chat/private?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}`
                    }).catch((err) => {
                        console.warn('Failed to create notification:', err);
                    });
                }
            }
        } catch (err) {
            setError('حدث خطأ أثناء إرسال الرسالة');
            setNewMessage(messageText);
        } finally {
            setIsSending(false);
        }
    }, [newMessage, currentUser, roomId, replyTo, isPrivateChat, targetUserId, scrollToBottom, isTargetBlocked, isBlockedByTarget, t]);

    // Handle reaction
    const handleReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!currentUser) return;

        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        const previousMessages = messages;
        const message = messages[messageIndex];
        const reactions = { ...(message.reactions || {}) };
        const currentReactions = reactions[emoji] || [];
        const hasReacted = currentReactions.includes(currentUser.id);

        // Optimistic update
        const newReactions = { ...reactions };
        if (hasReacted) {
            newReactions[emoji] = currentReactions.filter(id => id !== currentUser.id);
            if (newReactions[emoji].length === 0) delete newReactions[emoji];
        } else {
            newReactions[emoji] = [...(currentReactions || []), currentUser.id];
        }

        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = { ...message, reactions: newReactions };
        setMessages(updatedMessages);

        try {
            if (hasReacted) {
                await removeReaction(roomId, messageId, emoji, currentUser.id);
            } else {
                await addReaction(roomId, messageId, emoji, currentUser.id);
            }
        } catch (err) {
            setMessages(previousMessages); // Revert on error
        }

        setShowEmojiPicker(false);
        setSelectedMessage(null);
        setContextMenu(null);
    }, [messages, currentUser, roomId]);

    // Handle edit
    const handleEdit = useCallback((message: ChatRoomMessage) => {
        setEditingMessageId(message.id);
        setEditingText(message.text);
        setContextMenu(null);
    }, []);

    const handleSaveEdit = useCallback(async () => {
        if (!editingMessageId || !editingText.trim()) return;

        try {
            await editMessage(roomId, editingMessageId, editingText.trim(), currentUser?.id || '');

            if (currentUser && isPrivateChat && targetUserId) {
                createNotification({
                    type: 'message_edited',
                    title: t('notifications.messageEditedTitle'),
                    body: editingText.length > 50 ? editingText.substring(0, 50) + '...' : editingText,
                    fromUserId: currentUser.id,
                    fromUserName: currentUser.name,
                    toUserId: targetUserId,
                    link: `/chat/private?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}`
                }).catch((err) => {
                    console.warn('Failed to send notification:', err);
                });
            }
        } catch (err) {
            setError('حدث خطأ أثناء تعديل الرسالة');
        }

        setEditingMessageId(null);
        setEditingText('');
    }, [editingMessageId, editingText, roomId, currentUser, isPrivateChat, targetUserId]);

    // Handle delete (own message)
    const handleDelete = useCallback(async (messageId: string) => {
        try {
            await deleteMessage(roomId, messageId, currentUser?.id || '');
        } catch (err) {
            setError('حدث خطأ أثناء حذف الرسالة');
        }
        setContextMenu(null);
    }, [roomId, currentUser]);

    const handleAdminDelete = useCallback(async (messageId: string) => {
        try {
            await adminDeleteMessage(roomId, messageId, currentUser?.id);
            setMessageSent(true);
        } catch (err) {
            setError('حدث خطأ أثناء حذف الرسالة');
        }
        setContextMenu(null);
    }, [roomId, currentUser]);

    // Add emoji to message
    const handleAddEmojiToMessage = useCallback((emoji: string) => {
        setNewMessage(prev => prev + emoji);
    }, [setNewMessage]);

    // Touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchStartXRef.current = e.touches[0].clientX;
        touchStartYRef.current = e.touches[0].clientY;
        touchStartTimeRef.current = Date.now();
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent, message: ChatRoomMessage) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchStartXRef.current - touchEndX;
        const deltaY = touchStartYRef.current - touchEndY;
        const touchDuration = Date.now() - touchStartTimeRef.current;

        if (touchDuration >= 500 && Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30) {
            touchHandledRef.current = true;
            setSelectedMessage(message.id);
            return;
        }

if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 50) {
            if (deltaX < 0) {
                // Swipe RIGHT - start a reply directly (shows the quote/replyTo
                // indicator at the bottom and attaches the reply reference to the
                // next sent message). This is the expected mobile gesture.
                setReplyTo({ id: message.id, text: message.text, senderName: message.senderName });
                setShowEmojiPicker(false);
                setSwipedMessageId(null);
                setRightSwipedMessageId(null);
            } else if (deltaX > 0) {
                // Swipe LEFT - Other actions
                setRightSwipedMessageId(message.id);
                setSwipedMessageId(null);
            }
} else if (swipedMessageId === message.id || rightSwipedMessageId === message.id) {
            // If the tap is on one of the swipe action bar buttons, don't dismiss
            // the bar here. Otherwise the bar unmounts before the browser fires
            // the synthesized click, so the button's onClick (e.g. swipe-to-reply)
            // never runs and the reply quote is never created.
            const touchTarget = e.target as HTMLElement;
            if (!touchTarget.closest('button')) {
                setSwipedMessageId(null);
                setRightSwipedMessageId(null);
            }
        }
    }, [swipedMessageId, rightSwipedMessageId]);

// Utility functions
    const formatTime = useCallback((timestamp: number) => {
        // Respect the active UI language instead of always formatting in Arabic.
        const locale = t('language.code', { defaultValue: i18n.language === 'en' ? 'en-US' : 'ar-SA' });
        return new Date(timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }, [t]);

    const getReactionSummary = useCallback((reactions?: Record<string, string[]>): { emoji: string; count: number }[] => {
        if (!reactions) return [];
        return Object.entries(reactions)
            .filter(([, userIds]) => userIds.length > 0)
            .map(([emoji, userIds]) => ({ emoji, count: userIds.length }));
    }, []);

    const handleReply = useCallback((message: ChatRoomMessage) => {
        setReplyTo({ id: message.id, text: message.text, senderName: message.senderName });
        setShowEmojiPicker(false);
        setContextMenu(null);
    }, []);

    const cancelReply = useCallback(() => setReplyTo(null), []);

    // Close context menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Only close if the click is outside the emoji picker container
            if (!target.closest('[data-emoji-picker]')) {
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [showEmojiPicker]);

    return {
        // State
        messages: filteredMessages,
        newMessage,
        setNewMessage,
        isLoading,
        isSending,
        messageSent,
        toastMessage,
        setToastMessage,
        error,
        setError,
        setMessageSent,
        messageLimit,
        loadOlderMessages,
        groupedMessages,

        // Reply state
        replyTo,
        setReplyTo,

        // Emoji state
        showEmojiPicker,
        setShowEmojiPicker,
        selectedMessage,
        setSelectedMessage,

        // Edit state
        editingMessageId,
        editingText,
        setEditingText,
        setEditingMessageId,

        // Mobile state
        swipedMessageId,
        setSwipedMessageId,
        rightSwipedMessageId,
        setRightSwipedMessageId,
        touchHandledRef,

        // Context menu
        contextMenu,
        setContextMenu,

        // User info
        currentUser,
        isAdmin,
        isPrivateChat,
        courseName: courseName || 'الدردشة',

        // Presence & Typing
        typingUsers,
        onlineUsers,

        // Scroll (shared)
        containerRef,
        handleScroll,
        scrollToBottom,

        // Block handlers
        isTargetBlocked,
        isBlockedByTarget,
        blockedUserIds,
        handleBlockUser,
        handleUnblockUser,

        // Handlers
        handleSendMessage,
        handleReaction,
        handleEdit,
        handleSaveEdit,
        handleDelete,
        handleAdminDelete,
        handleAddEmojiToMessage,
        handleTouchStart,
        handleTouchEnd,
        handleReply,
        cancelReply,

        // Utils
        autoGrow,
        formatTime,
        getReactionSummary,
        MESSAGE_EMOJIS,
        REACTION_EMOJIS
    };
};
