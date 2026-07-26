import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Send, ThumbsUp, User, Clock, Reply } from 'lucide-react';
import { Discussion, Comment } from '../../types';
import { useAppStore } from '../../stores/appStore';
import {
    createDiscussion,
    convertPublicToDiscussion,
    formatDate,
    getCourseDiscussions,
    getPublicDiscussions,
    addComment,
    toggleLike,
    subscribeToLikes,
    subscribeToDiscussions,
    subscribeToPublicDiscussions,
    ChatMessage,
    sendChatMessage,
    subscribeToChat,
    DiscussionLikes,
    PublicDiscussion
} from '../../services/discussionService';

interface DiscussionForumProps {
    courseId: string;
}

const DiscussionForum = ({ courseId }: DiscussionForumProps) => {
    const { currentUser } = useAppStore();
    const navigate = useNavigate();
    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newDiscussion, setNewDiscussion] = useState({ title: '', content: '' });
    const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
    // Derive the selected discussion from the live `discussions` list so real-time
    // updates (new comments, likes) are reflected immediately without a refresh.
    const selectedDiscussion = selectedDiscussionId
        ? discussions.find(d => d.id === selectedDiscussionId) || null
        : null;
    const [newComment, setNewComment] = useState('');
    const [showNewDiscussion, setShowNewDiscussion] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    // State for real-time likes: discussionId -> DiscussionLikes
    const [likesMap, setLikesMap] = useState<Record<string, DiscussionLikes>>({});
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Map a public (guest-safe) discussion into the full Discussion shape.
    // Uses the shared helper from discussionService so the workspace forum
    // and the global discussions page stay consistent.
    const filterByCourse = (list: PublicDiscussion[]) =>
        list.filter((d) => d.courseId === courseId).map(convertPublicToDiscussion);

    // Load initial discussions
    useEffect(() => {
        const loadDiscussions = async () => {
            try {
                if (currentUser) {
                    const courseDiscussions = await getCourseDiscussions(courseId);
                    setDiscussions(courseDiscussions);
                } else {
                    // Guests read the public discussion collection (with comments).
                    const all = await getPublicDiscussions();
                    setDiscussions(filterByCourse(all));
                }
            } catch (error) {
                console.error('Error loading discussions:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadDiscussions();
    }, [courseId, currentUser]);

    // Subscribe to real-time updates
    useEffect(() => {
        if (currentUser) {
            const unsubscribe = subscribeToDiscussions(courseId, (updatedDiscussions) => {
                setDiscussions(updatedDiscussions);
            });
            return () => unsubscribe();
        }

        // Guests subscribe to public discussions for this course.
        const unsubscribe = subscribeToPublicDiscussions((all) => {
            setDiscussions(filterByCourse(all));
        });
        return () => unsubscribe();
    }, [courseId, currentUser]);

    // Subscribe to real-time likes for all discussions
    useEffect(() => {
        const unsubscribes: (() => void)[] = [];

        // Guests cannot like, and the likes node requires auth — skip for them.
        if (!currentUser) return;

        discussions.forEach((discussion) => {
            if (discussion.id) {
                const unsubscribe = subscribeToLikes(
                    discussion.id,
                    currentUser?.id || null,
                    (likes) => {
                        setLikesMap((prev) => ({
                            ...prev,
                            [discussion.id!]: likes
                        }));
                    }
                );
                unsubscribes.push(unsubscribe);
            }
        });

        return () => {
            unsubscribes.forEach((unsub) => unsub());
        };
    }, [discussions, currentUser?.id]);

     // Subscribe to chat if showing
    useEffect(() => {
        if (showChat) {
            const unsubscribe = subscribeToChat(courseId, (messages) => {
                setChatMessages(messages);
            });

            return () => unsubscribe();
        }
    }, [courseId, showChat]);

    // Auto-scroll to bottom when new chat messages arrive
    useEffect(() => {
        if (showChat && chatContainerRef.current && chatMessages.length > 0) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [chatMessages.length, showChat]);

    // Scroll to top when a discussion is opened so the view doesn't stay
    // pinned to the (now much shorter) footer after scrolling the long list.
    useEffect(() => {
        if (selectedDiscussionId) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [selectedDiscussionId]);

    const handleCreateDiscussion = async () => {
        if (!newDiscussion.title.trim() || !newDiscussion.content.trim()) return;
        if (!currentUser) {
            alert('الرجاء تسجيل الدخول للمشاركة');
            return;
        }

        const userRole = currentUser.role;

        const discussion: Omit<Discussion, 'id'> = {
            courseId,
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorRole: userRole,
            title: newDiscussion.title,
            content: newDiscussion.content,
            createdAt: new Date().toISOString(),
            comments: [],
            likes: 0
        };

        try {
            await createDiscussion(discussion);
            setNewDiscussion({ title: '', content: '' });
            setShowNewDiscussion(false);
        } catch (error) {
            console.error('Error creating discussion:', error);
            alert('حدث خطأ أثناء إنشاء المناقشة');
        }
    };

    const handleAddComment = async (discussionId: string) => {
        if (!newComment.trim()) return;
        if (!currentUser) {
            alert('الرجاء تسجيل الدخول للتعليق');
            return;
        }

        const userRole = currentUser.role;

        const comment: Comment = {
          id: '',
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorRole: userRole,
          content: newComment,
          createdAt: new Date().toISOString()
        };

        try {
            await addComment(discussionId, comment);
            setNewComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            alert('حدث خطأ أثناء إضافة التعليق');
        }
    };

    const handleLike = async (discussionId: string) => {
        if (!currentUser) {
            alert('الرجاء تسجيل الدخول للإعجاب');
            return;
        }

        if (!discussionId || typeof discussionId !== 'string') {
            console.error('Invalid discussionId:', discussionId);
            return;
        }

        try {
            await toggleLike(discussionId, currentUser.id);
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        if (!currentUser) {
            alert('الرجاء تسجيل الدخول لإرسال رسالة');
            return;
        }

        const userRole = currentUser.role;

        const message: Omit<ChatMessage, 'id'> = {
            courseId,
            authorId: currentUser.id,
            authorName: currentUser.name,
            authorRole: userRole,
            content: newMessage,
            createdAt: new Date().toISOString()
        };

        try {
            await sendChatMessage(message);
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('حدث خطأ أثناء إرسال الرسالة');
        }
    };

    // Helper function to get like info for a discussion
    const getLikeInfo = (discussionId: string): DiscussionLikes => {
        return likesMap[discussionId] || { likeCount: 0, likedByCurrentUser: false, userIds: {} };
    };

    if (selectedDiscussion) {
        if (!selectedDiscussion.id || !selectedDiscussion.title) {
            return (
                <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-brown-900 rounded-xl border border-primary-100 dark:border-primary-800 p-6 animate-fade-in">
                    <button
                        onClick={() => setSelectedDiscussionId(null)}
                        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline mb-4 flex items-center transition-colors duration-200"
                    >
                        ← العودة للمناقشات
                    </button>
                    <p className="text-brown-500 dark:text-neutral-400">حدث خطأ في تحميل المناقشة</p>
                </div>
            );
        }

        return (
            <div className="bg-gradient-to-br from-primary-50 to-[#FFFBEB] dark:from-primary-900/20 dark:to-brown-900 rounded-xl border border-primary-100 dark:border-primary-800 p-6 animate-fade-in">
                <button
                        onClick={() => setSelectedDiscussionId(null)}
                    className="text-primary-600 hover:text-primary-700 hover:underline mb-4 flex items-center transition-colors duration-200"
                >
                    ← العودة للمناقشات
                </button>

                <div className="border-b border-primary-200 dark:border-primary-800 pb-4 mb-4">
                    <h3 className="text-xl font-semibold mb-2 text-brown-900 dark:text-neutral-100">{selectedDiscussion.title}</h3>
                    <div className="flex items-center text-sm text-brown-600 dark:text-neutral-300 mb-3">
                        <User className="h-4 w-4 mr-1 text-brown-500 dark:text-brown-400" />
                        <span className="ml-1">{selectedDiscussion.authorName}</span>
                        {selectedDiscussion.authorRole === 'admin' && (
                            <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs rounded-md font-medium">
                                مدير الموقع
                            </span>
                        )}
                        <Clock className="h-4 w-4 mr-3 ml-3 text-brown-400 dark:text-brown-500" />
                        <span>{formatDate(selectedDiscussion.createdAt)}</span>
                    </div>
                    <p className="text-brown-700 dark:text-neutral-200 leading-relaxed">{selectedDiscussion.content}</p>
                </div>

                <div className="mb-6">
                    <h4 className="font-semibold mb-4 text-lg text-brown-900 dark:text-neutral-100">التعليقات ({Array.isArray(selectedDiscussion.comments) ? selectedDiscussion.comments.length : 0})</h4>

                    {(!Array.isArray(selectedDiscussion.comments) || selectedDiscussion.comments.length === 0) ? (
                        <div className="text-center py-8 text-brown-500 dark:text-neutral-400 bg-brown-50 dark:bg-brown-800/50 rounded-xl border border-dashed border-brown-200 dark:border-brown-700">
                            لا توجد تعليقات بعد
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {selectedDiscussion.comments.map(comment => (
                                <div key={comment.id} className="bg-white dark:bg-brown-800 border border-brown-200 dark:border-brown-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                                    <div className="flex items-center text-sm mb-2">
                                        <User className="h-4 w-4 mr-1 text-brown-500 dark:text-brown-400" />
                                        <span className="font-medium ml-1 text-brown-900 dark:text-neutral-100">{comment.authorName}</span>
                                        {comment.authorRole === 'admin' && (
                                            <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs rounded-md font-medium">
                                                مدير الموقع
                                            </span>
                                        )}
                                        <Clock className="h-4 w-4 mr-3 ml-3 text-brown-400 dark:text-brown-500" />
                                        <span className="text-brown-500 dark:text-neutral-400">{formatDate(comment.createdAt)}</span>
                                    </div>
                                    <p className="text-brown-700 dark:text-neutral-200 leading-relaxed">{comment.content}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {currentUser && (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="اكتب تعليقك..."
                            className="flex-1 p-2.5 border border-brown-200 dark:border-brown-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
                            onKeyPress={(e) => e.key === 'Enter' && handleAddComment(selectedDiscussion.id)}
                        />
                        <button
                            onClick={() => handleAddComment(selectedDiscussion.id)}
                            title="إرسال التعليق"
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Toggle between Discussions and Chat */}
            <div className="flex gap-2 mb-4 bg-brown-100 dark:bg-brown-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setShowChat(false)}
                    className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 active:scale-[0.98] ${
                        !showChat
                            ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                    }`}
                >
                    المناقشات
                </button>
                <button
                    onClick={() => setShowChat(true)}
                    className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 active:scale-[0.98] ${
                        showChat
                            ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                            : 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'
                    }`}
                >
                    الدردشة
                </button>
            </div>

            {!showChat ? (
                // Discussions View
                <div className="bg-[#FFFBEB] dark:bg-brown-900 rounded-xl border border-brown-200 dark:border-brown-700 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold flex items-center text-brown-800 dark:text-neutral-100">
                            <MessageCircle className="h-5 w-5 mr-2 text-primary-500" />
                            منصة النقاشات والمناقشات
                        </h2>
                        {currentUser && (
                            <button
                                onClick={() => setShowNewDiscussion(!showNewDiscussion)}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-medium"
                            >
                                مناقشة جديدة
                            </button>
                        )}
                    </div>

                    {showNewDiscussion && (
                        <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 mb-6 bg-primary-50 dark:bg-primary-900/20 animate-fade-in-up">
                            <input
                                type="text"
                                value={newDiscussion.title}
                                onChange={(e) => setNewDiscussion({ ...newDiscussion, title: e.target.value })}
                                placeholder="عنوان المناقشة..."
                                className="w-full p-2.5 border border-brown-200 dark:border-brown-600 rounded-lg mb-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
                            />
                            <textarea
                                value={newDiscussion.content}
                                onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
                                placeholder="محتوى المناقشة..."
                                rows={3}
                                className="w-full p-2.5 border border-brown-200 dark:border-brown-600 rounded-lg mb-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreateDiscussion}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-medium"
                                >
                                    نشر المناقشة
                                </button>
                                <button
                                    onClick={() => setShowNewDiscussion(false)}
                                    className="px-4 py-2 border border-brown-200 dark:border-brown-600 rounded-lg hover:bg-brown-50 dark:hover:bg-brown-700 hover:border-brown-300 active:scale-[0.98] transition-all duration-200 font-medium text-brown-700 dark:text-neutral-200"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-8 text-brown-500 dark:text-neutral-400">جاري التحميل...</div>
                    ) : discussions.length === 0 ? (
                        <div className="text-center py-14 bg-brown-50 dark:bg-brown-800/50 rounded-xl border-2 border-dashed border-primary-200 dark:border-primary-800">
                            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-primary-400 dark:text-primary-500" />
                            <p className="text-lg sm:text-xl font-bold text-brown-700 dark:text-neutral-200 leading-relaxed px-4">
                                {currentUser
                                    ? 'لا توجد مناقشات بعد. كن أول من يبدأ مناقشة!'
                                    : 'لا توجد مناقشات لعرضها لهذه المادة بعد'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {discussions.map(discussion => (
                                <div
                                    key={discussion.id}
                                    className="card card-hover card-interactive p-4"
                                    onClick={() => setSelectedDiscussionId(discussion.id)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-lg mb-1 text-brown-800 dark:text-neutral-100 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors duration-200">{discussion.title}</h3>
                                            <p className="text-brown-600 dark:text-neutral-300 text-sm mb-2 line-clamp-2 leading-relaxed">{discussion.content}</p>
                                            <div className="flex items-center text-xs text-brown-500 dark:text-neutral-400">
                                                <User className="h-3 w-3 mr-1 text-brown-400 dark:text-brown-500" />
                                                <span className="ml-1">{discussion.authorName}</span>
                                                {discussion.authorRole === 'admin' && (
                                                    <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs rounded-md font-medium">
                                                        مدير الموقع
                                                    </span>
                                                )}
                                                <Clock className="h-3 w-3 mr-3 ml-3 text-brown-400 dark:text-brown-500" />
                                                <span>{formatDate(discussion.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end ml-4 gap-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleLike(discussion.id); }}
                                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 active:scale-[0.95] ${
                                                    getLikeInfo(discussion.id).likedByCurrentUser
                                                        ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                                                        : 'text-brown-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                                                }`}
                                                aria-label={getLikeInfo(discussion.id).likedByCurrentUser ? 'إلغاء الإعجاب' : 'إعجاب'}
                                            >
                                                <ThumbsUp className={`h-4 w-4 ${getLikeInfo(discussion.id).likedByCurrentUser ? 'fill-current' : ''}`} />
                                                <span className="text-sm font-medium">{getLikeInfo(discussion.id).likeCount}</span>
                                            </button>
                                            <div className="flex items-center text-brown-500 dark:text-neutral-400 text-sm">
                                                <Reply className="h-4 w-4 mr-1 text-brown-400 dark:text-brown-500" />
                                                <span>{Array.isArray(discussion.comments) ? discussion.comments.length : 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {!currentUser && (
                        <div className="text-center py-8 bg-gradient-to-br from-primary-50 to-[#FFFBEB] dark:from-primary-900/20 dark:to-brown-900 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700 mt-4">
                            <User className="h-12 w-12 mx-auto mb-3 text-primary-500 dark:text-primary-400" />
                            <p className="text-lg sm:text-xl font-bold text-brown-700 dark:text-neutral-200 mb-5 leading-relaxed px-4">
                                الرجاء تسجيل الدخول للمشاركة في المناقشات
                            </p>
                            <button
                                onClick={() => navigate('/login')}
                                className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-semibold text-base"
                            >
                                تسجيل الدخول
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                // Chat View
                <div className="bg-[#FFFBEB] dark:bg-brown-900 rounded-xl border border-brown-200 dark:border-brown-700 p-6 shadow-sm">
                    <h2 className="text-xl font-semibold mb-4 flex items-center text-brown-800 dark:text-neutral-100">
                        <MessageCircle className="h-5 w-5 mr-2 text-primary-500" />
                        الدردشة العامة
                    </h2>

                    <div ref={chatContainerRef} className="h-64 sm:h-80 md:h-96 overflow-y-auto border border-brown-200 dark:border-brown-700 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 bg-brown-50 dark:bg-brown-800/50 custom-scrollbar">
                        {chatMessages.length === 0 ? (
                            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                                لا توجد رسائل بعد. ابدأ المحادثة!
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {chatMessages.map(message => (
                                    <div
                                        key={message.id}
                                        className={`p-3.5 rounded-xl transition-all duration-200 ${
                                            message.authorId === currentUser?.id
                                                ? 'bg-primary-100 dark:bg-primary-900/30 ml-8 border border-primary-200 dark:border-primary-700'
                                                : 'bg-white dark:bg-brown-800 mr-8 border border-brown-200 dark:border-brown-600 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center text-xs mb-1.5">
                                            <User className="h-3 w-3 mr-1 text-brown-500 dark:text-brown-400" />
                                            <span className="font-medium text-brown-900 dark:text-neutral-100">{message.authorName}</span>
                                            {message.authorRole === 'admin' && (
                                                <span className="ml-2 px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs rounded-md font-medium">
                                                    مدير الموقع
                                                </span>
                                            )}
                                            <Clock className="h-3 w-3 mr-2 ml-2 text-brown-400 dark:text-brown-500" />
                                            <span className="text-brown-500 dark:text-neutral-400">{formatDate(message.createdAt)}</span>
                                        </div>
                                        <p className="text-brown-700 dark:text-neutral-200 leading-relaxed">{message.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {currentUser ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="اكتب رسالتك..."
                                className="flex-1 p-2.5 border border-brown-200 dark:border-brown-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
                                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                            />
                            <button
                                onClick={handleSendMessage}
                                title="إرسال الرسالة"
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200"
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center text-brown-500 dark:text-neutral-400 bg-brown-50 dark:bg-brown-800/50 rounded-xl p-4 border border-dashed border-brown-200 dark:border-brown-700">
                            <p>الرجاء تسجيل الدخول للدردشة</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DiscussionForum;
