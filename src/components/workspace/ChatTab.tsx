import { MessageCircle, Send, Smile, Reply, Copy, X, Edit3, Trash2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore';
import { useChat } from '../../hooks/useChat';

interface ChatTabProps {
    courseId: string;
    courseName: string;
}

const ChatTab = ({ courseId, courseName }: ChatTabProps) => {
    const { t, i18n } = useTranslation();
    const { currentUser } = useAppStore();

    // Use the shared chat hook (single source of truth for chat logic)
    const {
        messages,
        newMessage,
        setNewMessage,
        isLoading,
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
        handleDelete,
        handleTouchStart,
        handleTouchEnd,
        handleReply,
        setContextMenu,
        contextMenu,
        touchHandledRef,
        containerRef,
        handleScroll,
        loadOlderMessages,
        formatTime,
        getReactionSummary,
        cancelReply,
        REACTION_EMOJIS,
        messageSent,
        toastMessage,
        setToastMessage
    } = useChat({ roomId: courseId, courseName });

    const handleCopyMessage = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setToastMessage(t('chat.messageCopied'));
        } catch (err) {
            console.error('Failed to copy:', err);
        }
        setContextMenu(null);
    };

    return (
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="flex flex-col h-full min-h-[400px] max-h-[80vh] bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                <div className="flex items-center">
                    <div className="bg-green-100 dark:bg-green-900/40 p-1.5 sm:p-2 rounded-lg ml-2 sm:ml-3">
                        <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">{t('chat.courseChat', { courseName })}</h3>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('chat.coursePrivateChat', { courseName })}</p>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3" onScroll={handleScroll}>
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
                    <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-3"></div>
                        <p>{t('chat.loadingMessages')}</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                        <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
                        <p>{t('chat.noMessageYet')}</p>
                        <p className="text-xs sm:text-sm">{t('chat.beFirst')}</p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isCurrentUser = msg.senderId === currentUser?.id;
                        const reactions = msg.reactions || {};
                        const reactionSummary = getReactionSummary(reactions);
                        const isEditing = editingMessageId === msg.id;

                        return (
                            <div
                                key={msg.id}
                                className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                                onContextMenu={(e) => {
                                    if (touchHandledRef.current) {
                                        touchHandledRef.current = false;
                                        return;
                                    }
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const x = Math.min(e.clientX, window.innerWidth - 230);
                                    const y = Math.min(e.clientY, window.innerHeight - 300);
                                    setContextMenu({
                                        messageId: msg.id,
                                        x: x > 10 ? x : 10,
                                        y: y > 10 ? y : 10,
                                        isOwnMessage: isCurrentUser
                                    });
                                }}
                                onTouchStart={handleTouchStart}
                                onTouchEnd={(e) => handleTouchEnd(e, msg)}
                            >
                                <div
                                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl relative ${isCurrentUser
                                        ? 'bg-gradient-to-br from-green-500 to-green-600 text-white rounded-br-md'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-md'
                                        }`}
                                >
                                    {!isCurrentUser && (
                                        <p className="text-[10px] sm:text-xs font-semibold text-green-700 dark:text-green-400 mb-1 mr-2 sm:mr-3 mt-1.5 sm:mt-2">
                                            {msg.senderName}
                                        </p>
                                    )}

                                    {msg.replyTo && (
                                        <div className={`text-[10px] sm:text-xs mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b ${isCurrentUser ? 'border-green-400 text-green-100' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
                                            <div className="flex items-center gap-1">
                                                <Reply className="h-3 w-3" />
                                                <span className="font-medium">{msg.replyTo.senderName}</span>
                                            </div>
                                            <p className="truncate">{msg.replyTo.text}</p>
                                        </div>
                                    )}

                                    {isEditing ? (
                                        <div className="p-2">
                                            <textarea
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                placeholder={t('chat.replyTo')}
                                                className={`w-full p-2 rounded-lg text-sm resize-none ${isCurrentUser
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
                                                    {t('common.save')}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingMessageId(null);
                                                        setEditingText('');
                                                    }}
                                                    className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs hover:bg-gray-400 dark:hover:bg-gray-500"
                                                >
                                                    {t('common.cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm px-2.5 sm:px-3 py-1 sm:py-1.5">
                                            {msg.isDeleted ? (
                                                <span className="italic opacity-60">{t('chat.messageDeleted')}</span>
                                            ) : (
                                                <>
                                                    {msg.text}
                                                    {msg.editedAt && (
                                                        <span className="text-[10px] sm:text-xs opacity-60 mr-1">{t('chat.edited')}</span>
                                                    )}
                                                </>
                                            )}
                                        </p>
                                    )}

                                    {reactionSummary.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5 sm:gap-1 mt-0.5 sm:mt-1 px-2.5 sm:px-3 pb-1 sm:pb-1">
                                            {reactionSummary.map(({ emoji, count }, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleReaction(msg.id, emoji)}
                                                    className="flex items-center gap-0.5 bg-white/90 dark:bg-gray-600/90 text-gray-800 dark:text-gray-200 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs shadow-sm hover:bg-white dark:hover:bg-gray-500 transition-colors border border-gray-200 dark:border-gray-500"
                                                >
                                                    <span className="text-xs sm:text-sm">{emoji}</span>
                                                    <span className="text-gray-600 dark:text-gray-300">{count}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    <div className={`flex items-center justify-end gap-1 sm:gap-1.5 px-2.5 sm:px-3 pb-1.5 sm:pb-2 mt-0.5 sm:mt-1 ${isCurrentUser ? 'text-green-100' : 'text-gray-400 dark:text-gray-500'
                                        }`}>
                                        <span className="text-[8px] sm:text-[10px]">{formatTime(msg.createdAt)}</span>
                                        {isCurrentUser && !msg.isDeleted && (
                                            <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-200" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Reaction picker for selected message - responsive positioning */}
                                    {selectedMessage === msg.id && (
                                        <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-1.5 sm:p-2 flex flex-wrap gap-0.5 sm:gap-1 z-50 min-w-max max-w-[90vw] sm:max-w-max`}>
                                            {REACTION_EMOJIS.map(emoji => (
                                                <button key={emoji} onClick={() => handleReaction(msg.id, emoji)}
                                                    className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-base sm:text-xl transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center">
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Reply indicator */}
            {replyTo && (
                <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <Reply className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-gray-500 dark:text-gray-400">{t('chat.replyTo')}</span>
                        <span className="text-gray-700 dark:text-gray-200 truncate max-w-[150px] sm:max-w-[200px]">
                            {replyTo.senderName}: {replyTo.text}
                        </span>
                    </div>
                    <button onClick={cancelReply} className="p-0.5 sm:p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title={t('chat.cancelReply')} aria-label={t('chat.cancelReply')}>
                        <X className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                    </button>
                </div>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] sm:min-w-[220px]"
                    style={{
                        position: 'fixed',
                        left: `${Math.min(contextMenu.x, window.innerWidth - 230)}px`,
                        top: `${Math.min(contextMenu.y, window.innerHeight - 300)}px`,
                        maxWidth: 'calc(100vw - 20px)',
                        maxHeight: 'calc(100vh - 20px)',
                        overflow: 'auto'
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
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Edit3 className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>{t('common.edit')}</span>
                                        </button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-0.5 sm:my-1"></div>
                                        <button onClick={() => handleDelete(menuMessage.id)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                            <span>{t('chat.deleteForEveryone')}</span>
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => handleReply(menuMessage)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Reply className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>{t('chat.reply')}</span>
                                        </button>
                                        <button onClick={() => handleCopyMessage(menuMessage.text)}
                                            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                            <Copy className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-gray-400" />
                                            <span>{t('common.copy')}</span>
                                        </button>
                                        <div className="border-t border-gray-100 dark:border-gray-700 my-0.5 sm:my-1"></div>
                                        <div className="px-2.5 sm:px-4 py-1 sm:py-2 flex flex-wrap gap-0.5 sm:gap-1 max-h-[200px] overflow-y-auto">
                                            {REACTION_EMOJIS.map(emoji => (
                                                <button key={emoji} onClick={() => handleReaction(menuMessage.id, emoji)}
                                                    className="p-1 sm:p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-base sm:text-lg transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center">
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* Toast indicator */}
            {(messageSent || toastMessage) && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in z-50">
                    <Check className="h-4 w-4" />
                    <span>{toastMessage || t('chat.messageSent')}</span>
                </div>
            )}

            {/* Input */}
            <div className="p-3 sm:p-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
                <div className="flex gap-1.5 sm:gap-2 relative" data-emoji-picker>
                    <div className="relative">
                        <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className={`p-1.5 sm:p-2 rounded-lg transition-colors ${showEmojiPicker ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                                }`}
                            title={t('chat.addEmoji')}
                            aria-label={t('chat.addEmoji')}
                        >
                            <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                    </div>
                    {showEmojiPicker && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 p-1.5 sm:p-2 flex flex-wrap gap-0.5 sm:gap-1 z-50 w-[calc(100vw-2rem)] max-w-[320px] sm:max-w-[360px] overflow-y-auto max-h-[200px] sm:max-h-[240px]">
                            {REACTION_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        if (selectedMessage) {
                                            handleReaction(selectedMessage, emoji);
                                        }
                                    }}
                                    className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-lg sm:text-xl transition-colors min-w-[32px] min-h-[32px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center flex-shrink-0"
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
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={t('chat.typeMessage')}
                        className="flex-1 min-w-0 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400 text-sm"
                        disabled={!currentUser}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || !currentUser}
                        className="p-2 sm:p-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        title={t('chat.send')}
                        aria-label={t('chat.send')}
                    >
                        <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                </div>
                {!currentUser && (
                    <p className="text-[10px] sm:text-xs text-red-500 mt-1.5 sm:mt-2">{t('chat.errorSendingMessage')}</p>
                )}
            </div>
        </div>
    );
};

export default ChatTab;
