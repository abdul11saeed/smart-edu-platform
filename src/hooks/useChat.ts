// Shared Chat Hook - Unified logic for ChatPage, PrivateChatPage and ChatTab
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    sendMessage,
    subscribeMessages,
    editMessage,
    deleteMessage,
    adminDeleteMessage,
    addReaction,
    removeReaction,
    markMessageAsRead,
    ChatRoomMessage
} from '../services/chatService';
import { createNotification } from '../services/notificationService';
import { useAppStore } from '../stores/appStore';

const MESSAGE_EMOJIS = ['😀', '😂', '😮', '😢', '😡', '👍', '❤️', '👏', '🎉', '🔥', '✨', '🙏', '💯', '🤔', '😉', '😅', '🤗', '🤩', '🤷', '👌', '👀', '🙌', '💪', '🥳', '⚡', '⭐', '✅', '💖', '💔', '🎊', '📚', '📝', '📢', '✉️', '📱', '💻', '🎓', '🏆', '🎯', '🚀'];

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏', '💯'];

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

    // State
    const [messages, setMessages] = useState<ChatRoomMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [messageSent, setMessageSent] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [messageLimit, setMessageLimit] = useState(DEFAULT_LIMIT);

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
                    updatedMessages.forEach((msg) => {
                        if (msg.senderId !== currentUser.id && (!msg.readBy || !msg.readBy[currentUser.id])) {
                            markMessageAsRead(roomId, msg.id, currentUser.id).catch(() => { /* ignore */ });
                        }
                    });
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

        const messageText = newMessage.trim();
        setNewMessage('');
        setIsSending(true);
        userScrolledUpRef.current = false;

        try {
            await sendMessage(roomId, messageText, {
                id: currentUser.id,
                name: currentUser.name
            }, replyTo || undefined);

            scrollToBottom('smooth');
            setMessageSent(true);
            setReplyTo(null);

            if (isPrivateChat && targetUserId) {
                createNotification({
                    type: 'private_message',
                    title: 'رسالة خاصة جديدة',
                    body: messageText.length > 50 ? messageText.substring(0, 50) + '...' : messageText,
                    fromUserId: currentUser.id,
                    fromUserName: currentUser.name,
                    toUserId: targetUserId,
                    link: `/chat/private?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}`
                }).catch((err) => {
                    console.warn('Failed to create notification:', err);
                });
            }
        } catch (err) {
            setError('حدث خطأ أثناء إرسال الرسالة');
            setNewMessage(messageText);
        } finally {
            setIsSending(false);
        }
    }, [newMessage, currentUser, roomId, replyTo, isPrivateChat, targetUserId, scrollToBottom]);

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
                    title: 'تم تعديل رسالة',
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

        if (Math.abs(deltaX) > 80 && Math.abs(deltaY) < 50 && !swipedMessageId) {
            if (deltaX > 0) {
                setSwipedMessageId(message.id);
            }
        } else if (swipedMessageId === message.id) {
            setSwipedMessageId(null);
        }
    }, [swipedMessageId]);

    // Utility functions
    const formatTime = useCallback((timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }, []);

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
        messages,
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
        touchHandledRef,

        // Context menu
        contextMenu,
        setContextMenu,

        // User info
        currentUser,
        isAdmin,
        isPrivateChat,
        courseName: courseName || 'الدردشة',

        // Scroll (shared)
        containerRef,
        handleScroll,
        scrollToBottom,

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
        formatTime,
        getReactionSummary,
        MESSAGE_EMOJIS,
        REACTION_EMOJIS
    };
};
