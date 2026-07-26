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
    ShieldOff
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useChat } from '../hooks/useChat';
import { createNotification, markNotificationAsRead, getUserNotifications } from '../services/notificationService';
import { deleteMessage, ChatRoomMessage } from '../services/chatService';
import { getUserFromRealtimeDB } from '../services/authService';

const PrivateChatPage = () => {
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
                    <p className="text-gray-600 dark:text-gray-300">جاري التحقق من تسجيل الدخول...</p>
                </div>
            </div>
        );
    }

    // Get private chat info from URL params
    const targetUserId = searchParams.get('userId');
    const targetUserName = searchParams.get('userName') || 'مستخدم';
    const decodedUserName = decodeURIComponent(targetUserName);

    // Target user profile data
    const [targetUser, setTargetUser] = useState<{ photoURL?: string; bio?: string }>({});

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
        setSwipedMessageId,
        contextMenu,
        setContextMenu,
        touchHandledRef,
        isAdmin,
        containerRef,
        handleScroll,
        loadOlderMessages
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

        localStorage.setItem(`deletedForMe_${roomId}_${currentUser?.id}`, JSON.stringify([...newDeletedForMe]));
        setDeletedForMe(newDeletedForMe);
        setContextMenu(null);

        setToastMessage('تم إخفاء الرسالة');
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

    const renderMessageGroup = (date: string, dateMessages: ChatRoomMessage[]) => (
        <div key={date}>
            <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
                <span className="px-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(date).toLocaleDateString('ar-SA', {
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
                            const rect = messageEl.getBoundingClientRect();
                            const isOwn = message.senderId === currentUser?.id;

                            const menuWidth = 200;
                            let menuX: number, menuY: number;

                            if (window.innerWidth < 480) {
                                menuX = Math.max(10, Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 10));
                                menuY = Math.min(rect.bottom + 8, window.innerHeight - 280);
                            } else {
                                const bubbleWidthPercent = 0.75;
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
                        {/* Mobile swipe action bar - appears when swiping left */}
                        {!isEditing && !message.isDeleted && swipedMessageId === message.id && (
                            <div className={`flex gap-2 items-center ml-2 sm:hidden ${isOwnMessage ? 'order-first' : ''}`}>
                                <button
                                    onClick={() => {
                                        handleReply(message);
                                        setSwipedMessageId(null);
                                    }}
                                    className="p-2 bg-green-100 text-green-600 rounded-full shadow-md hover:bg-green-200 transition-colors"
                                    title="رد"
                                >
                                    <Reply className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        handleCopyMessage(message.text);
                                        setSwipedMessageId(null);
                                    }}
                                    className="p-2 bg-blue-100 text-blue-600 rounded-full shadow-md hover:bg-blue-200 transition-colors"
                                    title="نسخ"
                                >
                                    <Copy className="h-4 w-4" />
                                </button>
                                {(isOwnMessage || isAdmin) && (
                                    <button
                                        onClick={() => {
                                            handleDeleteForEveryone(message.id);
                                            setSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-red-100 text-red-600 rounded-full shadow-md hover:bg-red-200 transition-colors"
                                        title="حذف"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                                {!isOwnMessage && (
                                    <button
                                        onClick={() => {
                                            handleDeleteForMe(message.id);
                                            setSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-gray-200 text-gray-600 rounded-full shadow-md hover:bg-gray-300 transition-colors"
                                        title="إخفاء"
                                    >
                                        <ShieldOff className="h-4 w-4" />
                                    </button>
                                )}
                                {isAdmin && !isOwnMessage && (
                                    <button
                                        onClick={() => {
                                            handleAdminDelete(message.id);
                                            setSwipedMessageId(null);
                                        }}
                                        className="p-2 bg-red-50 text-red-600 rounded-full shadow-md hover:bg-red-100 transition-colors"
                                        title="حذف كمدير"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                        <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl relative ${isOwnMessage
                                ? 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-md'
                                : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-bl-md shadow-sm'
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
                                        placeholder="تعديل الرسالة"
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
                                            حفظ
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingMessageId(null);
                                                setEditingText('');
                                            }}
                                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-xs hover:bg-gray-400"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm leading-relaxed px-3 py-1">
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

                            {/* Reaction picker for selected message */}
                            {selectedMessage === message.id && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-2 flex flex-wrap gap-1 z-50 min-w-max max-w-[90vw] sm:max-w-max">
                                    {REACTION_EMOJIS.map(emoji => (
                                        <button key={emoji} onClick={() => handleReaction(message.id, emoji)}
                                            className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg text-base sm:text-lg sm:text-xl transition-colors min-w-[30px] min-h-[30px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center">
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
                                            <span>تعديل</span>
                                        </button>
                                        <div className="border-t border-gray-100 my-0.5 sm:my-1"></div>
                                        <button onClick={() => handleDeleteForEveryone(menuMessage.id)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>حذف للجميع</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleReply(menuMessage)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Reply className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                                            <span>رد</span>
                                        </button>
                                        <button onClick={() => handleCopyMessage(menuMessage.text)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                                            <Copy className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                                            <span>نسخ</span>
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
                                            <span>إخفاء الرسالة</span>
                                        </button>
                                    </>
                                )}
                                {isAdmin && (
                                    <>
                                        {!isOwn && <div className="border-t border-gray-100 my-0.5 sm:my-1"></div>}
                                        <button onClick={() => handleAdminDelete(menuMessage.id)}
                                            className="w-full flex items-center gap-1.5 sm:gap-3 px-2.5 sm:px-4 py-1.5 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 transition-colors">
                                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>حذف كمدير</span>
                                        </button>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={() => {
                        // Safely navigate back - if no history, go to home
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/');
                        }
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="العودة"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>

                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
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
                    </div>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Lock className="h-5 w-5 text-green-600" />
                            {decodedUserName}
                        </h1>
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            محادثة خاصة
                        </p>
                        {targetUser.bio && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate max-w-[200px] sm:max-w-[300px]">
                                {targetUser.bio}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Toast indicator */}
            {(messageSent || toastMessage) && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
                    <Check className="h-4 w-4" />
                    <span>{toastMessage || 'تم إرسال الرسالة'}</span>
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

            {/* Messages Container */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-[400px] sm:h-[500px] flex flex-col">
                <div
                    ref={containerRef}
                    className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800"
                    onScroll={handleScroll}
                >
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
                                <div className="text-gray-500 text-sm">جاري التحميل...</div>
                            </div>
                        </div>
                    ) : Object.keys(groupedMessages).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <Lock className="h-12 w-12 mb-2 opacity-30" />
                            <p>لا توجد رسائل خاصة بعد</p>
                            <p className="text-sm">ابدأ المحادثة الآن!</p>
                        </div>
                    ) : (
                        Object.entries(groupedMessages).map(([date, dateMessages]) =>
                            renderMessageGroup(date, dateMessages)
                        )
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply indicator */}
                {replyTo && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <Reply className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-gray-500 dark:text-gray-400">رد على:</span>
                            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                                {replyTo.senderName}: {replyTo.text}
                            </span>
                        </div>
                        <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title="إلغاء الرد">
                            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                )}

                {/* Message Input */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800 rounded-b-xl">
                    {currentUser ? (
                        <div className="flex gap-2 items-end relative" data-emoji-picker>
                            <div className="relative">
                                <button
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className={`p-2.5 rounded-full transition-colors ${showEmojiPicker ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'}`}
                                    title="إضافة رمز تعبيري"
                                    aria-label="إضافة رمز تعبيري"
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

                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onClick={() => setShowEmojiPicker(false)}
                                placeholder={`اكتب رسالة خاصة لـ ${decodedUserName}...`}
                                className="flex-1 p-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                                onKeyPress={(e) => e.key === 'Enter' && !isSending && handleSendMessage()}
                                disabled={isSending}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || isSending}
                                className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                title="إرسال"
                                aria-label="إرسال"
                            >
                                {isSending ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Send className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                            <p className="text-gray-600 dark:text-gray-300 text-sm">الرجاء تسجيل الدخول للمحادثة</p>
                            <button
                                onClick={() => navigate('/login')}
                                className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                            >
                                تسجيل الدخول
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrivateChatPage;
