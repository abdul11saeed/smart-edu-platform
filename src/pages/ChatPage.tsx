import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    MessageCircle,
    Send,
    ArrowLeft,
    Users,
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
                    <p className="text-gray-600 dark:text-gray-300">جاري التحقق من تسجيل الدخول...</p>
                </div>
            </div>
        );
    }

    // Get courseId from query param or Zustand activeCourse
    const courseIdFromQuery = searchParams.get('courseId');
    const courseId = courseIdFromQuery || activeCourse?.id || 'global';
    const courseName = activeCourse?.name || (courseIdFromQuery ? `مقرر ${courseIdFromQuery}` : 'الدردشة العامة');

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

    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            setToastMessage('تم نسخ الرسالة');
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

        setToastMessage('تم إخفاء الرسالة');
    };

    const handleDeleteForEveryone = async (messageId: string) => {
        try {
            await deleteMessage(courseId, messageId, currentUser.id);

            if (isPrivateChat && targetUserId) {
                try {
                    await createNotification({
                        type: 'message_deleted',
                        title: 'تم حذف رسالة',
                        body: 'تم حذف رسالة من المحادثة',
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
            setError('حدث خطأ أثناء حذف الرسالة');
        }
        setContextMenu(null);
    };

    const renderMessageGroup = (date: string, dateMessages: ChatRoomMessage[]) => (
        <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                <span className="px-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(date).toLocaleDateString('ar-SA', {
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
                            const rect = messageEl.getBoundingClientRect();
                            const isOwn = message.senderId === currentUser?.id;

                            const menuWidth = 200;
                            let menuX: number, menuY: number;

                            if (window.innerWidth < 480) {
                                menuX = Math.max(10, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 10));
                                menuY = Math.min(rect.bottom + 8, window.innerHeight - 280);
                            } else {
                                const bubbleWidthPercent = window.innerWidth < 640 ? 0.85 : 0.70;
                                const bubbleWidth = rect.width * bubbleWidthPercent;

                                let bubbleLeft: number, bubbleRight: number;
                                if (isOwn) {
                                    bubbleRight = rect.right;
                                    bubbleLeft = rect.right - bubbleWidth;
                                } else {
                                    bubbleLeft = rect.left;
                                    bubbleRight = rect.left + bubbleWidth;
                                }

                                if (isOwn) {
                                    menuX = bubbleLeft - menuWidth - 8;
                                    menuY = rect.top;
                                } else {
                                    menuX = bubbleRight + 8;
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
                        {/* Mobile swipe action bar - appears when swiping left */}
                        {!isEditing && !message.isDeleted && isSwiped && (
                            <div className={`flex gap-2 items-center ml-2 sm:hidden ${isOwnMessage ? 'order-first' : ''}`}>
                                <button
                                    onClick={() => handleReply(message)}
                                    className="p-2 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full shadow-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                                    title="رد"
                                >
                                    <Reply className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleCopyMessage(message.text)}
                                    className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full shadow-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                                    title="نسخ"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                                {(isOwnMessage || isAdmin) && (
                                    <button
                                        onClick={() => handleDeleteForEveryone(message.id)}
                                        className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full shadow-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                                        title="حذف"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                {!isOwnMessage && isPrivateChat && (
                                    <button
                                        onClick={() => handleDeleteForMe(message.id)}
                                        className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                        title="إخفاء"
                                    >
                                        <ShieldOff className="h-4 w-4" />
                                    </button>
                                )}
                                {isAdmin && !isOwnMessage && (
                                    <button
                                        onClick={() => handleAdminDelete(message.id)}
                                        className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full shadow-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                        title="حذف كمدير"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <div
                            className={`max-w-[90%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl relative ${isOwnMessage
                                ? 'bg-gradient-to-br from-primary-700 to-primary-800 text-white rounded-br-md shadow-lg shadow-primary-500/20'
                                : 'bg-gradient-to-br from-white to-primary-50/30 dark:from-slate-700 dark:to-slate-800 border border-primary-100/50 dark:border-primary-700/30 text-gray-800 dark:text-gray-100 rounded-bl-md shadow-sm'
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
                                        placeholder="تعديل الرسالة"
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
                                            حفظ
                                        </button>
                                        <button onClick={() => { setEditingMessageId(null); setEditingText(''); }}
                                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400">
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed px-3 py-1.5">
                                    {message.isDeleted ? (
                                        <span className="italic opacity-60">تم حذف هذه الرسالة</span>
                                    ) : (
                                        <>
                                            {message.text}
                                            {message.editedAt && (
                                                <span className="text-xs opacity-60 mr-1">(معدل)</span>
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
            {/* Header */}
            <div className="flex items-center gap-3 sm:gap-4 mb-4">
                <button onClick={() => {
                    // Safely navigate back - if no history, go to home
                    if (window.history.length > 1) {
                        navigate(-1);
                    } else {
                        navigate('/');
                    }
                }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="العودة">
                    <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2 truncate">
                        <MessageCircle className="h-4 w-5 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                        <span className="truncate">{courseName}</span>
                        {isPrivateChat && <Lock className="h-4 w-4 text-green-600 flex-shrink-0" />}
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
                        {courseIdFromQuery ? (
                            <><BookOpen className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> دردشة المقرر</>
                        ) : targetUserId ? (
                            <><Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> محادثة خاصة</>
                        ) : (
                            <><Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" /> دردشة عامة</>
                        )}
                    </p>
                </div>

                {!courseIdFromQuery && !targetUserId && (
                    <button onClick={() => setShowUserList(!showUserList)}
                        className={`p-2 rounded-lg transition-colors flex-shrink-0 ${showUserList ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                        title="محادثة خاصة" aria-label="فتح قائمة المحادثات الخاصة">
                        <Users className="h-5 w-5" />
                    </button>
                )}

                {targetUserId && (
                    <button onClick={() => navigate('/chat')}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 flex-shrink-0" title="العودة للدردشة العامة">
                        <Lock className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* User List Panel */}
            {showUserList && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center pt-16 sm:pt-20 p-4 overflow-y-auto" onClick={() => setShowUserList(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-sm w-full max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100">المستخدمون في المحادثة العامة</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">اختر شخصاً لبدء محادثة خاصة</p>
                        </div>
                        {loadingUsers ? (
                            <div className="p-4 text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
                                <p className="text-gray-500 dark:text-gray-400 mt-2">جاري التحميل...</p>
                            </div>
                        ) : userList.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                لا يوجد مستخدمين أرسلوا رسائل بعد في المحادثة العامة
                            </div>
                        ) : (
                            <div>
                                {userList.filter(u => u.id !== currentUser?.id).map((user) => (
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
                    <span>{toastMessage || 'تم إرسال الرسالة'}</span>
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
                                            <span>تعديل</span>
                                        </button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-0.5 sm:my-1"></div>
                                        <button onClick={() => handleDeleteForEveryone(menuMessage.id)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                            <span>حذف للجميع</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleReply(menuMessage)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Reply className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>رد</span>
                                        </button>
                                        <button onClick={() => handleCopyMessage(menuMessage.text)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>نسخ</span>
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
                                                <span>إخفاء الرسالة</span>
                                            </button>
                                        )}
                                        {isAdmin && (
                                            <button onClick={() => handleAdminDelete(menuMessage.id)}
                                                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                <span>حذف كمدير</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Messages Container - elegant navy blue */}
            <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-lg shadow-primary-500/5 border border-primary-100/50 dark:border-primary-700/30 h-[400px] sm:h-[500px] md:h-[600px] flex flex-col">
                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gradient-to-b from-primary-50/30 to-white dark:from-slate-800/80 dark:to-slate-800/90"
                    onScroll={handleScroll}>
                    {messages.length > 0 && (
                        <div className="flex justify-center pb-2">
                            <button
                                onClick={loadOlderMessages}
                                className="text-xs text-green-600 dark:text-green-400 hover:underline"
                            >
                                تحميل الرسائل السابقة
                            </button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                <div className="text-gray-500 dark:text-gray-400 text-sm">جاري التحميل...</div>
                            </div>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
                            <p className="font-medium">لا توجد رسائل بعد</p>
                            <p className="text-sm">كن أول من يرسل رسالة!</p>
                            {courseIdFromQuery && (
                                <p className="text-xs mt-2 text-blue-500 dark:text-blue-400">
                                    هذه الدردشة خاصة بمقرر {activeCourse?.name || courseId}
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

                {replyTo && (
                    <div className="px-3 sm:px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <Reply className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-gray-500 dark:text-gray-400">رد على:</span>
                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[150px] sm:max-w-[200px]">
                                {replyTo.senderName}: {replyTo.text}
                            </span>
                        </div>
                        <button onClick={cancelReply} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title="إلغاء الرد">
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
                                    title="إضافة رمز تعبيري"
                                    aria-label="إضافة رمز تعبيري"
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

                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onClick={() => setShowEmojiPicker(false)}
                                placeholder={courseIdFromQuery ? `اكتب رسالتك في ${courseName}...` : "اكتب رسالتك..."}
                                className="flex-1 p-2 sm:p-3 text-sm sm:text-base border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                                onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                                disabled={isSending}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isSending}
                                className={`p-2 sm:p-2.5 rounded-full transition-all ${!newMessage.trim()
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-primary-700 to-primary-800 text-white hover:from-primary-800 hover:to-primary-900 hover:scale-105 shadow-lg shadow-primary-500/20'
                                }`}
                                title="إرسال الرسالة"
                                aria-label="إرسال الرسالة"
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
                            <span>يرجى تسجيل الدخول</span>
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
