import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import {
    MessageCircle,
    Send,
    ArrowLeft,
    Users,
    Search,
    BookOpen,
    Check,
    CheckCheck,
    Smile,
    Reply,
    X,
    Lock,
    Trash2,
    Edit3,
    Shield,
    ShieldOff,
    Copy,
    AlertCircle
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useChat } from '../hooks/useChat';
import { deleteMessage, ChatRoomMessage } from '../services/chatService';
import { createNotification, getUserNotifications, markNotificationAsRead } from '../services/notificationService';
import { getUserFromRealtimeDB } from '../services/authService';

const ChatPage = () => {
    const { t } = useTranslation();
    const { currentUser, activeCourse } = useAppStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Authentication check - redirect to login if not authenticated
    useEffect(() => {
        if (!currentUser) {
            navigate('/login', { replace: true });
        }
    }, [currentUser, navigate]);

    // Render nothing while checking authentication or if no user
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

    // Get courseId from query param or Zustand activeCourse
    const courseIdFromQuery = searchParams.get('courseId');
    const courseId = courseIdFromQuery || activeCourse?.id || 'global';
    const courseName = activeCourse?.name || (courseIdFromQuery ? t('chat.courseChat') + ' ' + courseIdFromQuery : t('chat.generalChat'));

    // Get private chat info from URL params
    const targetUserId = searchParams.get('userId');

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
        showEmojiPicker,
        setShowEmojiPicker,
        selectedMessage,
        editingMessageId,
        editingText,
        setEditingText,
        setEditingMessageId,
        handleSendMessage,
        handleReaction,
        handleEdit,
        handleSaveEdit,
        handleAdminDelete,
        handleAddEmojiToMessage,
        handleTouchStart,
        handleTouchEnd,
        handleReply,
        cancelReply,
        swipedMessageId,
        rightSwipedMessageId,
        setRightSwipedMessageId,
        contextMenu,
        setContextMenu,
        touchHandledRef,
        isAdmin,
        isPrivateChat,
        formatTime,
        getReactionSummary,
        MESSAGE_EMOJIS,
        REACTION_EMOJIS,
        containerRef,
        handleScroll,
        loadOlderMessages,
        groupedMessages
    } = useChat({ roomId: courseId, courseName, targetUserId });

    // User list panel state
    const [showUserList, setShowUserList] = useState(false);
    const [userList, setUserList] = useState<Array<{ id: string; name: string; photoURL?: string; bio?: string }>>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

     const messagesEndRef = useRef<HTMLDivElement>(null);
     const inputRef = useRef<HTMLTextAreaElement>(null);
  
     // Track whether user has scrolled up (for scroll-to-bottom button)
     const [scrolledUp, setScrolledUp] = useState(false);

     const autoGrow = useCallback((el: HTMLTextAreaElement | null) => {
         if (!el) return;
         el.style.height = 'auto';
         el.style.height = Math.min(el.scrollHeight, 140) + 'px';
     }, []);
 
     // Scroll page to top when the chat opens
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // "Delete for me" messages (private chat only - UI only)
    const [deletedForMe, setDeletedForMe] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem(`deletedForMe_${courseId}_${currentUser?.id}`);
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    // Update deletedForMe when courseId changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`deletedForMe_${courseId}_${currentUser?.id}`);
            setDeletedForMe(saved ? new Set(JSON.parse(saved)) : new Set());
        } catch {
            setDeletedForMe(new Set());
        }
    }, [courseId, currentUser?.id]);

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

    // Load users for private chat when user list button is clicked
    useEffect(() => {
        if (showUserList && userList.length === 0 && !loadingUsers) {
            loadUsers();
        }
    }, [showUserList]);

    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            // Extract unique users from messages in the current chat room
            const uniqueSenders = messages.reduce((acc, message) => {
                if (!acc.find(u => u.id === message.senderId)) {
                    acc.push({
                        id: message.senderId,
                        name: message.senderName
                    });
                }
                return acc;
            }, [] as Array<{ id: string; name: string }>);

            // Fetch profile data (photoURL, bio) for each user
            const usersWithProfile = await Promise.all(
                uniqueSenders.map(async (user) => {
                    try {
                        const fullUser = await getUserFromRealtimeDB(user.id);
                        return {
                            ...user,
                            photoURL: fullUser?.photoURL,
                            bio: fullUser?.bio
                        };
                    } catch {
                        return user;
                    }
                })
            );

            setUserList(usersWithProfile);
        } catch (err) {
            console.error('Failed to load users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const startPrivateChat = (userId: string, userName: string) => {
        navigate(`/chat/private?userId=${userId}&userName=${encodeURIComponent(userName)}`);
        setShowUserList(false);
    };

    const handleCopyMessage = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setToastMessage(t('chat.copyMessage'));
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        setContextMenu(null);
    };

    const handleDeleteForMe = (messageId: string) => {
        const newDeletedForMe = new Set(deletedForMe);
        newDeletedForMe.add(messageId);

        localStorage.setItem(`deletedForMe_${courseId}_${currentUser?.id}`, JSON.stringify(Array.from(newDeletedForMe)));
        setDeletedForMe(newDeletedForMe);
        setContextMenu(null);

        setToastMessage(t('chat.deleteForMe'));
    };

    const handleDeleteForEveryone = async (messageId: string) => {
        try {
            await deleteMessage(courseId, messageId, currentUser.id);

            if (isPrivateChat && targetUserId) {
                try {
                    await createNotification({
                        type: 'message_deleted',
                        title: t('notifications.messageDeletedTitle'),
                        body: t('notifications.messageDeletedBody'),
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
        setContextMenu(null);
    };

    const renderMessageGroup = (date: string, dateMessages: ChatRoomMessage[]) => (
        <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                <span className="px-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(date).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ar-SA', {
                        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                </span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
            </div>

            {dateMessages.map((message) => {
                if (deletedForMe.has(message.id)) return null;

                const reactionSummary = getReactionSummary(message.reactions);
                const isOwnMessage = message.senderId === currentUser?.id;
                const isEditing = editingMessageId === message.id;
                const isSwiped = swipedMessageId === message.id;

                return (
                    <div
                        key={message.id}
                        className={`mb-3 flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group`}
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

                            const menuWidth = 200;
                            let menuX: number, menuY: number;

                            if (window.innerWidth < 480) {
                                menuX = Math.max(10, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 10));
                                menuY = Math.min(rect.bottom + 8, window.innerHeight - 280);
                            } else {
                                if (isOwn) {
                                    menuX = rect.left - menuWidth - 8;
                                    menuY = rect.top;
                                } else {
                                    menuX = rect.right + 8;
                                    menuY = rect.top;
                                }

                                menuX = Math.max(10, Math.min(menuX, window.innerWidth - menuWidth - 10));
                                menuY = Math.max(10, Math.min(menuY, window.innerHeight - 280));
                            }

                            setContextMenu({ messageId: message.id, x: menuX, y: menuY, isOwnMessage: isOwn });
                        }}
                        onTouchStart={handleTouchStart}
                        onTouchEnd={(e) => handleTouchEnd(e, message)}
                    >
                        {/* Mobile swipe action bar - appears when swiping LEFT (Reply) */}
                        {!isEditing && !message.isDeleted && isSwiped && (
                            <div className={`flex gap-2 items-center ml-2 sm:hidden ${isOwnMessage ? 'order-first' : ''}`}>
                                <button
                                    onClick={() => handleReply(message)}
                                    className="p-2 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full shadow-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
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
                                    className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full shadow-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
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
                                        className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full shadow-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                        title={t('chat.deleteForEveryone')}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                {!isOwnMessage && isPrivateChat && (
                                    <button
                                        onClick={() => {
                                            handleDeleteForMe(message.id);
                                            setRightSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
                                        className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                        title={t('chat.deleteAsAdmin')}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <div
                            data-bubble
                            className={`max-w-[90%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl relative ${isOwnMessage
                                ? 'bg-gradient-to-br from-primary-700 to-primary-800 text-white rounded-br-md shadow-lg shadow-primary-500/20'
                                : 'bg-gradient-to-br from-white to-primary-50/30 dark:from-brown-800/60 dark:to-brown-900/60 border border-primary-100/50 dark:border-primary-700/30 text-gray-800 dark:text-gray-100 rounded-bl-md shadow-sm'
                            }`}
                        >
                            {message.replyTo && (
                                <div className={`text-xs mb-2 pb-2 border-b ${isOwnMessage ? 'border-green-400 text-green-100' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}
                                >
                                    <div className="flex items-center gap-1">
                                        <Reply className="h-3 w-3" />
                                        <span className="font-medium">{message.replyTo.senderName}</span>
                                    </div>
                                    <p className="truncate">{message.replyTo.text}</p>
                                </div>
                            )}

                            {!isOwnMessage && (
                                <div className="flex items-center gap-1 mb-1 text-xs text-primary-700 dark:text-primary-300 font-medium">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/40 dark:to-secondary-900/40 flex items-center justify-center border border-primary-200/50 dark:border-primary-700/30">
                                        <span className="text-xs text-primary-700 dark:text-primary-300">{message.senderName.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">{message.senderName}</span>
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
                                        <button onClick={handleSaveEdit}
                                            className="px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700">
                                            {t('chat.saveEdit')}
                                        </button>
                                        <button onClick={() => { setEditingMessageId(null); setEditingText(''); }}
                                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400">
                                            {t('chat.cancel')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed px-3 py-1.5">
                                    {message.isDeleted ? (
                                        <span className="italic opacity-60">{t('chat.messageDeleted')}</span>
                                    ) : (
                                        <>
                                            {message.text}
                                            {message.editedAt && (
                                                <span className="text-xs opacity-60 mr-1">({t('chat.edited')})</span>
                                            )}
                                        </>
                                    )}
                                </p>
                            )}

                            {reactionSummary.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 px-3 pb-1">
                                    {reactionSummary.map(({ emoji, count }, idx) => (
                                        <button key={idx} onClick={() => handleReaction(message.id, emoji)}
                                            className="flex items-center gap-0.5 bg-white/90 dark:bg-gray-600/90 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-full text-xs shadow-sm hover:bg-white dark:hover:bg-gray-500 transition-colors border border-gray-200 dark:border-gray-500"
                                        >
                                            <span>{emoji}</span>
                                            <span className="text-gray-600 dark:text-gray-300">{count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {!isEditing && (
                                <div className={`flex items-center justify-end gap-1.5 mt-1 px-3 pb-2 ${isOwnMessage ? 'text-green-100' : 'text-gray-400 dark:text-gray-500'}`}
                                >
                                    <span className="text-[10px] sm:text-xs">{formatTime(message.createdAt)}</span>
                                    {isOwnMessage && !message.isDeleted && (
                                        <CheckCheck className="h-3 w-3 text-green-200" />
                                    )}
                                </div>
                            )}

                            {/* Reaction picker for selected message - responsive positioning */}
                            {selectedMessage === message.id && (
                                <div className={`absolute ${isOwnMessage
                                    ? 'bottom-full left-1/2 -translate-x-1/2 mb-2'
                                    : 'bottom-full left-1/2 -translate-x-1/2 mb-2'
                                } bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-2 flex flex-wrap gap-1 z-50 min-w-max max-w-[90vw] sm:max-w-max`}>
                                    {REACTION_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={() => handleReaction(message.id, emoji)}
                                            className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-base sm:text-lg sm:text-xl transition-colors min-w-[30px] min-h-[30px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    return (
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6 max-w-4xl">
            {/* Header - General Chat */}
            <div className="bg-gradient-to-r from-primary-700 via-primary-800 to-primary-900 dark:from-brown-800 dark:via-brown-900 dark:to-brown-950 rounded-2xl p-3 sm:p-4 mb-4 shadow-lg shadow-primary-500/20 border border-white/10">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button onClick={() => {
                        // Safely navigate back - if no history, go to home
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/');
                        }
                    }}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors" title={t('common.back')}>
                        <ArrowLeft className="h-5 w-5 text-primary-100" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate text-white">
                            <MessageCircle className="h-4 w-5 sm:h-5 sm:w-5 text-secondary-300 flex-shrink-0" />
                            <span className="truncate">{courseName}</span>
                            {isPrivateChat && <Lock className="h-4 w-4 text-secondary-300 flex-shrink-0" />}
                        </h1>
                        <p className="text-xs sm:text-sm text-primary-200 dark:text-primary-300 flex items-center gap-1 truncate">
                            {courseIdFromQuery ? (
                                <><BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> {t('chat.courseChat')}</>
                            ) : targetUserId ? (
                                <><Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> {t('chat.privateChatLabel')}</>
                            ) : (
                                <><Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> {t('chat.generalChat')}</>
                            )}
                        </p>
                    </div>

                {!courseIdFromQuery && !targetUserId && (
                    <button onClick={() => setShowUserList(!showUserList)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors flex-shrink-0 ${showUserList ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-primary-100'}`}
                        title={t('chat.openPrivateChats')} aria-label={t('chat.openPrivateChats')}>
                        <Users className="h-5 w-5" />
                        <span className="text-sm font-medium">{t('chat.users')}</span>
                    </button>
                )}

                {targetUserId && (
                    <button onClick={() => navigate('/chat')}
                        className="p-2 rounded-lg hover:bg-white/10 text-primary-100 flex-shrink-0" title={t('chat.backToGeneralChat')}>
                        <Lock className="h-5 w-5" />
                    </button>
                )}
            </div>
            </div>

            {/* User List Panel */}
            {showUserList && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center pt-16 sm:pt-20 p-4 overflow-y-auto" onClick={() => setShowUserList(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-sm w-full max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>{t('chat.users')}</span>
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('chat.selectUserForPrivateChat')}</p>

                            <div className="relative mt-3">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    placeholder={t('chat.searchUsers')}
                                    className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500"
                                />
                            </div>
                        </div>
                        {loadingUsers ? (
                            <div className="p-4 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">{t('chat.loadingUsers')}</p>
                            </div>
                        ) : userList.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                {t('chat.noUsersYet')}
                            </div>
                        ) : (
                            <div>
                                {userList
                                    .filter(u => u.id !== currentUser?.id)
                                    .filter(u => !userSearchQuery || u.name.toLowerCase().includes(userSearchQuery.toLowerCase()))
                                    .map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => startPrivateChat(user.id, user.name)}
                                        className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                                    >
                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                                            {user.photoURL ? (
                                                <img
                                                    src={user.photoURL}
                                                    alt={user.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-green-100 dark:bg-green-900/40">
                                                    <span className="font-semibold text-green-700 dark:text-green-300">{user.name.charAt(0).toUpperCase()}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 text-right">
                                            <span className="font-medium text-gray-900 dark:text-gray-100 block truncate">{user.name}</span>
                                            {user.bio && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">{user.bio}</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
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

            {/* Context Menu */}
            {contextMenu && (
                <div className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[180px] max-w-[calc(100vw-20px)]"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}>
                    {(() => {
                        const menuMessage = messages.find(m => m.id === contextMenu?.messageId);
                        if (!menuMessage) return null;
                        const isOwn = menuMessage.senderId === currentUser?.id;

                        return (
                            <>
                                {isOwn ? (
                                    <>
                                        <button onClick={() => handleEdit(menuMessage)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Edit3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>{t('chat.edit')}</span>
                                        </button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-0.5 sm:my-1"></div>
                                        <button onClick={() => handleDeleteForEveryone(menuMessage.id)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            <span>{t('chat.deleteForEveryone')}</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleReply(menuMessage)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Reply className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>{t('chat.reply')}</span>
                                        </button>
                                        <button onClick={() => handleCopyMessage(menuMessage.text)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>{t('chat.copy')}</span>
                                        </button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-0.5 sm:my-1"></div>
                                        <div className="px-2.5 sm:px-4 py-1.5 sm:py-2 flex flex-wrap gap-0.5 sm:gap-1 max-h-[180px] overflow-y-auto">
                                            {REACTION_EMOJIS.map(emoji => (
                                                <button key={emoji} onClick={() => handleReaction(menuMessage.id, emoji)}
                                                    className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-base sm:text-lg transition-colors min-w-[30px] min-h-[30px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center">
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-0.5 sm:my-1"></div>
                                        {isPrivateChat && (
                                            <button onClick={() => handleDeleteForMe(menuMessage.id)}
                                                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                <span>{t('chat.hideMessage')}</span>
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button onClick={() => handleAdminDelete(menuMessage.id)}
                                                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                <span>{t('chat.deleteAsAdmin')}</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

             {/* Messages Container - responsive height using viewport units for mobile compatibility */}
             <div className="bg-gradient-to-br from-primary-50/80 to-white dark:from-brown-900/60 dark:to-brown-900/80 backdrop-blur-md rounded-2xl shadow-lg shadow-primary-500/10 border border-primary-100/50 dark:border-primary-700/30 h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)] md:h-[calc(100vh-220px)] flex flex-col">
                 <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-primary-50/40 to-primary-100/20 dark:from-brown-800/40 dark:to-brown-900/30"
                     onScroll={() => {
                         handleScroll();
                         const el = containerRef.current;
                         if (el) {
                             const { scrollTop, scrollHeight, clientHeight } = el;
                             setScrolledUp(scrollHeight - scrollTop - clientHeight > 100);
                         }
                     }}>
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

                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-gray-500 dark:text-gray-400 text-sm">{t('chat.loadingMessages')}</div>
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                            <p className="font-medium">{t('chat.noMessages')}</p>
                            <p className="text-sm">{t('chat.beFirst')}</p>
                            {courseIdFromQuery && (
                                <p className="text-xs mt-2 text-blue-500 dark:text-blue-400">
                                    {t('chat.coursePrivateChat', { courseName: activeCourse?.name || courseId })}
                                </p>
                            )}
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

                 {replyTo && (
                    <div className="px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <Reply className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-gray-500 dark:text-gray-400">{t('chat.replyTo')}</span>
                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[150px] sm:max-w-[200px]">
                                {replyTo.senderName}: {replyTo.text}
                            </span>
                        </div>
                        <button onClick={cancelReply} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title={t('chat.cancelReply')}>
                            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                )}

                <div className="border-t p-2 sm:p-3 bg-white rounded-b-xl">
                    {currentUser ? (
                        <div className="flex gap-2 items-end relative" data-emoji-picker>
                            <div className="relative">
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className={`p-2 sm:p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                                    title={t('chat.addEmoji')}
                                    aria-label={t('chat.addEmoji')}
                                >
                                    <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                                </button>
                            </div>
                            {showEmojiPicker && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-2 flex flex-wrap gap-1 z-50 w-[calc(100vw-2rem)] max-w-[320px] sm:max-w-[360px] overflow-y-auto max-h-[240px] sm:max-h-[280px]">
                                    {MESSAGE_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={(e) => {
                                            e.stopPropagation();
                                            handleAddEmojiToMessage(emoji);
                                        }}
                                            className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-lg sm:text-xl transition-colors"
                                        >
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
                                placeholder={courseIdFromQuery ? t('chat.typeMessage') + ' ' + t('chat.courseChat', { courseName }) : t('chat.typeMessage')}
                                className="flex-1 min-w-0 w-full resize-none overflow-y-auto p-2 sm:p-3 text-sm sm:text-base border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && !isSending && handleSendMessage()}
                                disabled={isSending}
                                rows={1}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isSending}
                                className={`p-2 sm:p-2.5 rounded-full transition-all ${!newMessage.trim()
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-primary-700 to-primary-800 text-white hover:from-primary-800 hover:to-primary-900 hover:scale-105 shadow-lg shadow-primary-500/20'
                                }`}
                                title={t('chat.sendMessage')}
                                aria-label={t('chat.sendMessage')}
                            >
                                {isSending ? (
                                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <AlertCircle className="h-4 w-4" />
                            <span>{t('chat.pleaseLogin')}</span>
                        </div>
                    )}

                    {error && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-2 rounded-lg flex items-center gap-2">
                            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
