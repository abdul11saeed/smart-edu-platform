import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Send,
    ArrowLeft,
    Lock,
    Check,
    CheckCheck,
    Smile,
    X,
    Reply,
    Copy,
    Trash2,
    Edit3,
    ShieldOff,
    Shield,
    UserX
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAppStore } from '../stores/appStore';
import { useChat } from '../hooks/useChat';
import { createNotification, markNotificationAsRead, getUserNotifications } from '../services/notificationService';
import { deleteMessage, ChatRoomMessage } from '../services/chatService';
import { getUserFromRealtimeDB } from '../services/authService';

const PrivateChatPage = () => {
    const { t } = useTranslation();
    const { currentUser } = useAppStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Authentication check
    useEffect(() => {
        if (!currentUser) {
            navigate('/login', { replace: true });
        }
    }, [currentUser, navigate]);

    // Render nothing while checking authentication
    if (!currentUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">{t('chat.verifyingLogin')}</p>
                </div>
            </div>
        );
    }

    // Get private chat info from URL params
    const targetUserId = searchParams.get('userId');
    const targetUserName = searchParams.get('userName') || t('privateChat.userNotFound');
    const decodedUserName = decodeURIComponent(targetUserName);

    // Target user profile data
    const [targetUser, setTargetUser] = useState<{ photoURL?: string; bio?: string }>({});

    // Profile modal state
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Create unique room ID for this private conversation
    const roomId = currentUser && targetUserId
        ? [currentUser.id, targetUserId].sort().join('_private_')
        : 'private';

    // Use the shared chat hook (single source of truth for chat logic)
    const {
        messages,
        newMessage,
        setNewMessage,
        isLoading,
        isSending,
        messageSent,
        setMessageSent,
        toastMessage,
        setToastMessage,
        error,
        setError,
        replyTo,
        setReplyTo,
        showEmojiPicker,
        setShowEmojiPicker,
        selectedMessage,
        editingMessageId,
        editingText,
        setEditingText,
        setEditingMessageId,
        handleSendMessage,
        handleSaveEdit,
        handleReaction,
        handleAddEmojiToMessage,
        handleTouchStart,
        handleTouchEnd,
        handleReply,
        handleEdit,
        handleAdminDelete,
        formatTime,
        getReactionSummary,
        MESSAGE_EMOJIS,
        REACTION_EMOJIS,
        swipedMessageId,
        rightSwipedMessageId,
        setRightSwipedMessageId,
        setSwipedMessageId,
        contextMenu,
        setContextMenu,
        touchHandledRef,
        isAdmin,
        containerRef,
        handleScroll,
        loadOlderMessages,
        isTargetBlocked,
        isBlockedByTarget,
        handleBlockUser,
        handleUnblockUser,
        autoGrow,
        typingUsers,
        onlineUsers
    } = useChat({
        roomId,
        courseName: decodedUserName,
        targetUserId
    });

    // "Delete for me" messages (UI only)
    const [deletedForMe, setDeletedForMe] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(`deletedForMe_${roomId}_${currentUser?.id}`);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

     const messagesEndRef = useRef<HTMLDivElement>(null);
     const inputRef = useRef<HTMLTextAreaElement>(null);

     // Track whether user has scrolled up (for scroll-to-bottom button)
     const [scrolledUp, setScrolledUp] = useState(false);

     const handleCopyMessage = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setToastMessage(t('chat.messageCopied'));
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        setContextMenu(null);
    };

    const handleDeleteForMe = (messageId: string) => {
        const newDeletedForMe = new Set(deletedForMe);
        newDeletedForMe.add(messageId);

        localStorage.setItem(`deletedForMe_${roomId}_${currentUser?.id}`, JSON.stringify(Array.from(newDeletedForMe)));
        setDeletedForMe(newDeletedForMe);
        setContextMenu(null);

        setToastMessage(t('chat.messageHidden'));
    };

    // Fetch target user profile data
    useEffect(() => {
        const fetchTargetUser = async () => {
            if (!targetUserId) return;
            try {
                const user = await getUserFromRealtimeDB(targetUserId);
                if (user) {
                    setTargetUser({
                        photoURL: user.photoURL || undefined,
                        bio: user.bio || undefined
                    });
                }
            } catch (err) {
                console.error('Failed to load target user profile:', err);
            }
        };
        fetchTargetUser();
    }, [targetUserId]);

    // Update deletedForMe when roomId changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`deletedForMe_${roomId}_${currentUser?.id}`);
            setDeletedForMe(saved ? new Set(JSON.parse(saved)) : new Set());
        } catch {
            setDeletedForMe(new Set());
        }
    }, [roomId, currentUser?.id]);

    // Mark private_message notifications as read when opening a private chat
    useEffect(() => {
        const markNotificationsAsRead = async () => {
            if (!targetUserId || !currentUser?.id) return;

            try {
                const notifications = await getUserNotifications(currentUser.id, 50);
                const unreadPrivateMessages = notifications.filter(
                    (n) => !n.read && n.type === 'private_message' && n.fromUserId === targetUserId
                );

                await Promise.all(
                    unreadPrivateMessages.map((n) => markNotificationAsRead(n.id))
                );
            } catch (err) {
                console.error('Failed to mark chat notifications as read:', err);
            }
        };

        markNotificationsAsRead();
    }, [targetUserId, currentUser?.id]);

    // Scroll page to top when the chat opens
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Handle delete for everyone with notification
    const handleDeleteForEveryone = async (messageId: string) => {
        try {
            await deleteMessage(roomId, messageId, currentUser.id);

            if (targetUserId) {
                try {
                    await createNotification({
                        type: 'message_deleted',
                        title: t('chat.deleteMessageTitle'),
                        body: t('chat.deleteMessageBody'),
                        fromUserId: currentUser.id,
                        fromUserName: currentUser.name,
                        toUserId: targetUserId,
                        link: `/chat/private?userId=${currentUser.id}&userName=${encodeURIComponent(currentUser.name)}`
                    });
                } catch (notifErr) {
                    console.warn('Failed to send notification:', notifErr);
                }
            }
        } catch (err) {
            console.error('Error deleting message:', err);
            setError(t('chat.errorDeletingMessage'));
        }
    };

    // Filter and group messages for private chat (memoized)
    const groupedMessages = useMemo(() => {
        const filteredMessages = messages.filter(msg =>
            msg.senderId === currentUser?.id || msg.senderId === targetUserId
        );
        return filteredMessages.reduce((groups, message) => {
            const date = new Date(message.createdAt).toDateString();
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(message);
            return groups;
        }, {} as Record<string, ChatRoomMessage[]>);
    }, [messages, currentUser?.id, targetUserId]);

    const renderMessageGroup = (date: string, dateMessages: ChatRoomMessage[]) => {
        const locale = i18n.language === 'en' ? 'en-US' : 'ar-SA';
        return (
            <div key={date}>
                <div className="flex items-center my-4">
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                    <span className="px-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(date).toLocaleDateString(locale, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </span>
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                </div>

            {dateMessages.map((message) => {
                if (deletedForMe.has(message.id)) return null;

                const reactionSummary = getReactionSummary(message.reactions);
                const isOwnMessage = message.senderId === currentUser?.id;
                const isEditing = editingMessageId === message.id;

                return (
                    <div
                        key={message.id}
                        className={`mb-2 flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
                        onContextMenu={(e) => {
                            if (touchHandledRef.current) {
                                touchHandledRef.current = false;
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();

                            const messageEl = e.currentTarget;
                            const bubbleEl = messageEl.querySelector('[data-bubble]') as HTMLElement | null;
                            const rect = bubbleEl ? bubbleEl.getBoundingClientRect() : messageEl.getBoundingClientRect();
                            const isOwn = message.senderId === currentUser?.id;
                            const isRTL = i18n.language === 'ar';

                            const menuWidth = 200;
                            let menuX: number, menuY: number;

                            if (window.innerWidth < 480) {
                                menuX = Math.max(10, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 10));
                                menuY = Math.min(rect.bottom + 8, window.innerHeight - 280);
                            } else {
                                // Position menu beside the message bubble (outer side)
                                if (isRTL) {
                                    if (isOwn) {
                                        menuX = rect.left - menuWidth - 8;
                                    } else {
                                        menuX = rect.right + 8;
                                    }
                                } else {
                                    if (isOwn) {
                                        menuX = rect.right + 8;
                                    } else {
                                        menuX = rect.left - menuWidth - 8;
                                    }
                                }

                                // Vertical center alignment with message bubble
                                menuY = rect.top + rect.height / 2 - 140; // approximate half menu height

                                menuX = Math.max(10, Math.min(menuX, window.innerWidth - menuWidth - 10));
                                menuY = Math.max(10, Math.min(menuY, window.innerHeight - 280));
                            }

                            setContextMenu({
                                messageId: message.id,
                                x: menuX,
                                y: menuY,
                                isOwnMessage: isOwn
                            });
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => handleTouchEnd(e, message)}
                    >
                        {/* Mobile swipe action bar - appears when swiping LEFT (Reply) */}
                        {!isEditing && !message.isDeleted && swipedMessageId === message.id && (
                            <div className={`flex gap-2 items-center ml-2 sm:hidden ${isOwnMessage ? 'order-first' : ''}`}>
                                <button
                                    onClick={() => {
                                        handleReply(message);
                                        setSwipedMessageId(null);
                                    }}
                                    className="p-2 bg-green-100 text-green-600 rounded-full shadow-md hover:bg-green-200 transition-colors"
                                    title={t('chat.reply')}
                                >
                                    <Reply className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                        {/* Mobile swipe action bar - appears when swiping RIGHT (Other actions) */}
                        {!isEditing && !message.isDeleted && rightSwipedMessageId === message.id && (
                            <div className={`flex gap-2 items-center order-last ml-2 sm:hidden`}>
                                <button
                                    onClick={() => {
                                        handleCopyMessage(message.text);
                                        setRightSwipedMessageId(null);
                                    }}
                                    className="p-2 bg-blue-100 text-blue-600 rounded-full shadow-md hover:bg-blue-200 transition-colors"
                                    title={t('chat.copy')}
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                                {(isOwnMessage || isAdmin) && (
                                    <button
                                        onClick={() => {
                                            handleDeleteForEveryone(message.id);
                                            setRightSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition-colors"
                                        title={t('chat.deleteForEveryone')}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                {!isOwnMessage && (
                                    <button
                                        onClick={() => {
                                            handleDeleteForMe(message.id);
                                            setRightSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-gray-200 text-gray-600 rounded-full shadow-md hover:bg-gray-300 transition-colors"
                                        title={t('chat.hide')}
                                    >
                                        <ShieldOff className="h-4 w-4" />
                                    </button>
                                )}
                                {isAdmin && !isOwnMessage && (
                                    <button
                                        onClick={() => {
                                            handleAdminDelete(message.id);
                                            setRightSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-red-50 text-red-600 rounded-full shadow-md hover:bg-red-100 transition-colors"
                                        title={t('chat.deleteAsAdmin')}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <div
                            data-bubble
                            className={`min-w-0 max-w-[85%] sm:max-w-[75%] rounded-2xl relative ${isOwnMessage
                                ? 'bg-gradient-to-br from-green-600 to-green-700 text-white rounded-br-md'
                                : 'bg-gradient-to-br from-white to-green-50/30 dark:from-green-800/60 dark:to-green-900/60 border border-green-100/50 dark:border-green-700/30 text-gray-800 dark:text-gray-100 rounded-bl-md shadow-sm'
                                }`}
                        >
                            {message.replyTo && (
                                <div className={`text-xs mb-2 pb-2 border-b ${isOwnMessage ? 'border-green-400 text-green-100' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                                    <div className="flex items-center gap-1">
                                        <Reply className="h-3 w-3" />
                                        <span className="font-medium">{message.replyTo.senderName}</span>
                                    </div>
                                    <p className="truncate">{message.replyTo.text}</p>
                                </div>
                            )}

                            {!isOwnMessage && (
                                <div className="flex items-center gap-1 mb-1 text-xs text-green-700 dark:text-green-400 font-medium">
                                    <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                                        <span className="text-xs text-green-700 dark:text-green-300">{message.senderName.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">{message.senderName}</span>
                                </div>
                            )}

                            {isEditing ? (
                                <div className="p-2">
                                    <textarea
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        placeholder={t('chat.edit') + '...'}
                                        className={`w-full p-2 rounded-lg text-sm resize-none ${isOwnMessage
                                            ? 'bg-green-400/20 text-white placeholder-green-200'
                                            : 'bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400'
                                            }`}
                                        rows={2}
                                        autoFocus
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={handleSaveEdit}
                                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700"
                                        >
                                            {t('chat.saveEdit')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingMessageId(null);
                                                setEditingText('');
                                            }}
                                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap px-3 py-1">
                                    {message.isDeleted ? (
                                        <span className="italic opacity-60">{t('chat.messageDeleted')}</span>
                                    ) : (
                                        <>
                                            {message.text}
                                            {message.editedAt && (
                                                <span className="text-xs opacity-60 ml-1">{t('chat.edited')}</span>
                                            )}
                                        </>
                                    )}
                                </p>
                            )}

                            {reactionSummary.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 px-3 pb-1">
                                    {reactionSummary.map(({ emoji, count }, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleReaction(message.id, emoji)}
                                            className="flex items-center gap-0.5 bg-white/90 dark:bg-gray-600/90 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-full text-xs shadow-sm hover:bg-white dark:hover:bg-gray-500 transition-colors border border-gray-200 dark:border-gray-500"
                                        >
                                            <span>{emoji}</span>
                                            <span className="text-gray-600 dark:text-gray-300">{count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!isEditing && (
                                <div className={`flex items-center justify-end gap-1.5 mt-1 px-3 pb-2 ${isOwnMessage ? 'text-green-100' : 'text-gray-400 dark:text-gray-500'}`}>
                                    <span className="text-[10px] sm:text-xs">{formatTime(message.createdAt)}</span>
                                    {isOwnMessage && !message.isDeleted && (
                                        <CheckCheck className="h-3 w-3 text-green-200" />
                                    )}
                                </div>
                            )}

                            
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

    return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px] max-w-[calc(100vw-20px)] max-h-[70vh] overflow-y-auto"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {(() => {
                        const menuMessage = messages.find(m => m.id === contextMenu?.messageId);
                        if (!menuMessage) return null;
                        const isOwn = menuMessage.senderId === currentUser?.id;

                        return (
                            <>
                                {isOwn ? (
                                    <>
                                        <button onClick={() => handleEdit(menuMessage)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                                            <span>{t('chat.edit')}</span>
                                        </button>
                                        <div className="border-t border-gray-100 my-0.5 sm:my-1"></div>
                                        <button onClick={() => handleDeleteForEveryone(menuMessage.id)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>{t('chat.deleteForEveryone')}</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleReply(menuMessage)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Reply className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                                            <span>{t('chat.reply')}</span>
                                        </button>
                                        <button onClick={() => handleCopyMessage(menuMessage.text)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Copy className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                                            <span>{t('chat.copy')}</span>
                                        </button>
                                        <div className="border-t border-gray-100 my-0.5 sm:my-1"></div>
                                        <div className="px-2 sm:px-4 py-1.5 sm:py-2 flex flex-wrap gap-0.5 sm:gap-1 max-h-[180px] overflow-y-auto">
                                            {REACTION_EMOJIS.map(emoji => (
                                                <button key={emoji} onClick={() => handleReaction(menuMessage.id, emoji)}
                                                    className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-base sm:text-lg transition-colors min-w-[30px] min-h-[30px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center">
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <div className="border-t border-gray-100 my-0.5 sm:my-1"></div>
                                        <button onClick={() => handleDeleteForMe(menuMessage.id)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                                            <ShieldOff className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>{t('chat.hideMessage')}</span>
                                        </button>
                                    </>
                                )}
                                {isAdmin && (
                                    <>
                                        {!isOwn && <div className="border-t border-gray-100 my-0.5 sm:my-1"></div>}
                                        <button onClick={() => handleAdminDelete(menuMessage.id)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>{t('chat.deleteAsAdmin')}</span>
                                        </button>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Header - Private Chat */}
            <div className="bg-gradient-to-r from-green-700 via-green-800 to-green-900 dark:from-green-800 dark:via-green-900 dark:to-green-950 rounded-2xl p-3 sm:p-4 mb-4 shadow-lg shadow-green-500/20 border border-white/10">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button
                        onClick={() => {
                            // Safely navigate back - if no history, go to home
                            if (window.history.length > 1) {
                                navigate(-1);
                            } else {
                                navigate('/');
                            }
                        }}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title={t('common.back')}
                    >
                        <ArrowLeft className="h-5 w-5 text-green-100" />
                    </button>

                    <button
                        onClick={() => setShowProfileModal(true)}
                        className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex-shrink-0 hover:ring-2 hover:ring-green-300 transition-all cursor-pointer"
                        title={t('chat.viewProfile')}
                    >
                        {targetUser.photoURL ? (
                            <img
                                src={targetUser.photoURL}
                                alt={decodedUserName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600">
                                <span className="text-white font-semibold">
                                    {decodedUserName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                    </button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                            <Lock className="h-5 w-5 text-green-300" />
                            {decodedUserName}
                            {targetUserId && onlineUsers[targetUserId] && (
                                <span className={`w-2.5 h-2.5 rounded-full ${
                                    onlineUsers[targetUserId].status === 'online' ? 'bg-green-400' : 'bg-gray-400'
                                }`} title={onlineUsers[targetUserId].status === 'online' ? 'متصل' : 'غير متصل'} />
                            )}
                        </h1>
                        <p className="text-sm text-green-200 dark:text-green-300 flex items-center gap-1">
                            {targetUserId && onlineUsers[targetUserId] && onlineUsers[targetUserId].status === 'online' ? (
                                <><span className="w-2 h-2 bg-green-400 rounded-full"></span> متصل</>
                            ) : (
                                <>
                                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                                    {targetUser.bio
                                        ? targetUser.bio.split(' ').slice(0, 3).join(' ')
                                        : t('chat.privateChatLabel')
                                    }
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            {/* Profile Modal */}
            {showProfileModal && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowProfileModal(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('chat.userProfile')}</h3>
                            <button onClick={() => setShowProfileModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-3">
                                {targetUser.photoURL ? (
                                    <img src={targetUser.photoURL} alt={decodedUserName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400 to-green-600">
                                        <span className="text-white font-bold text-2xl">
                                            {decodedUserName.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">{decodedUserName}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{t('chat.privateChatLabel')}</p>
                        </div>

                        {targetUser.bio && (
                            <div className="mb-6">
                                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('chat.bio')}</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                    {targetUser.bio}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {isTargetBlocked ? (
                                <button
                                    onClick={() => {
                                        if (targetUserId) {
                                            handleUnblockUser(targetUserId);
                                        }
                                        setShowProfileModal(false);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
                                >
                                    <Shield className="h-4 w-4" />
                                    {t('chat.unblockUser')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (targetUserId && window.confirm(t('chat.confirmBlockUser'))) {
                                            handleBlockUser(targetUserId);
                                            setShowProfileModal(false);
                                        }
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
                                >
                                    <UserX className="h-4 w-4" />
                                    {t('chat.blockUser')}
                                </button>
                            )}
                            <button
                                onClick={() => setShowProfileModal(false)}
                                className="px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast indicator */}
            {(messageSent || toastMessage) && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
                    <Check className="h-4 w-4" />
                    <span>{toastMessage || t('chat.messageSent')}</span>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <span className="text-sm text-red-700">{error}</span>
                    <button onClick={() => setError(null)} className="mr-auto text-red-500 hover:text-red-700">
                        ✕
                    </button>
                </div>
            )}

             {/* Messages Container - responsive height using viewport units for mobile compatibility */}
             <div className="bg-gradient-to-br from-green-50/80 to-white dark:from-green-900/30 dark:to-green-900/50 backdrop-blur-md rounded-xl shadow-lg shadow-green-500/10 border border-green-100/50 dark:border-green-700/30 h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)] flex flex-col">
                 <div
                     ref={containerRef}
                     className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-green-50/40 to-emerald-50/20 dark:from-green-900/20 dark:to-green-900/30"
                     onScroll={() => {
                         handleScroll();
                         const el = containerRef.current;
                         if (el) {
                             const { scrollTop, scrollHeight, clientHeight } = el;
                             setScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
                         }
                     }}
                 >
                    {messages.length > 0 && (
                        <div className="flex justify-center pb-2">
                            <button
                                onClick={loadOlderMessages}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline"
                            >
                                {t('chat.loadPreviousMessages')}
                            </button>
                        </div>
                    )}

                    {/* Typing indicator */}
                    {targetUserId && typingUsers[targetUserId] && typingUsers[targetUserId].isTyping && (
                        <div className="flex justify-start mb-2">
                            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full shadow-sm border border-green-200 dark:border-green-700">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                                <span>{decodedUserName} {t('chat.typingNow') || 'يكتب الآن...'}</span>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-gray-500 text-sm">{t('common.loading')}</div>
                            </div>
                        </div>
                    ) : isTargetBlocked && Object.keys(groupedMessages).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <ShieldOff className="h-12 w-12 mb-2 opacity-30" />
                            <p>{t('chat.userBlockedChat')}</p>
                            <p className="text-sm">{t('chat.userBlockedChatSubtitle')}</p>
                        </div>
                    ) : isTargetBlocked ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <ShieldOff className="h-12 w-12 mb-2 opacity-30" />
                            <p>{t('chat.userBlockedChat')}</p>
                            <p className="text-sm">{t('chat.userBlockedChatSubtitle')}</p>
                        </div>
                    ) : (
                        Object.entries(groupedMessages).map(([date, dateMessages]) =>
                            renderMessageGroup(date, dateMessages)
                        )
                    )}
                     <div ref={messagesEndRef} />
                 </div>

                 {/* Scroll-to-bottom button — appears when user has scrolled up */}
                 {scrolledUp && (
                     <button
                         onClick={() => {
                             containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
                             setScrolledUp(false);
                         }}
                         className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-full shadow-lg text-xs font-medium flex items-center gap-1 transition-all z-10 animate-fade-in"
                         aria-label={t('chat.scrollToBottom')}
                     >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                         {t('chat.scrollToBottom')}
                     </button>
                 )}

                 {/* Reply indicator */}
                {replyTo && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                                <Reply className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                <span className="text-gray-500 dark:text-gray-400">{t('chat.replyTo')}</span>
                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                                {replyTo.senderName}: {replyTo.text}
                            </span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title={t('chat.cancelReply')}>
                            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                )}

                {/* Message Input */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 rounded-b-xl">
                    {currentUser ? (
                        (isTargetBlocked || isBlockedByTarget) ? (
                            <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                <ShieldOff className={`h-5 w-5 ${isBlockedByTarget ? 'text-red-800 dark:text-red-300' : 'text-gray-400'}`} />
                                <p className={`text-sm font-medium ${isBlockedByTarget ? 'text-red-800 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>{isBlockedByTarget ? t('chat.blockedYou') : t('chat.cannotSendToBlockedUser')}</p>
                            </div>
                        ) : (
                            <div className="flex gap-2 items-end relative" data-emoji-picker>
                            <div className="relative">
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className={`p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                                    title={t('chat.addEmoji')}
                                    aria-label={t('chat.addEmoji')}
                                >
                                    <Smile className="h-5 w-5" />
                                </button>
                            </div>
                            {showEmojiPicker && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-2 flex flex-wrap gap-1 z-50 w-[calc(100vw-2rem)] max-w-[320px] sm:max-w-[360px] overflow-y-auto max-h-[240px] sm:max-h-[280px]">
                                    {MESSAGE_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddEmojiToMessage(emoji);
                                        }}
                                            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-lg sm:text-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <textarea
                                ref={inputRef}
                                value={newMessage}
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    autoGrow(e.target);
                                }}
                                onClick={() => setShowEmojiPicker(false)}
                                placeholder={t('chat.privateMessagePlaceholder', { name: decodedUserName })}
                                className="flex-1 min-w-0 w-full resize-none overflow-y-auto max-h-[200px] p-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && !isSending && handleSendMessage()}
                                disabled={isSending}
                                rows={1}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isSending}
                                className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                title={t('chat.send')}
                                aria-label={t('chat.send')}
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                        )
                    ) : (
                        <div className="text-center py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <p className="text-gray-600 dark:text-gray-300 text-sm">{t('chat.loggedInRequired')}</p>
                            <button
                                onClick={() => navigate('/login')}
                                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                                {t('auth.login')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrivateChatPage;
