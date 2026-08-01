import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { MessageCircle, Send, ThumbsUp, User, Clock, Reply, Search, BookOpen, Edit, Trash2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Discussion, Comment, University, College, Major, Course as CourseType } from '../types';
import { useAppStore } from '../stores/appStore';
import { useCatalogStore } from '../stores/catalogStore';
import {
  createDiscussion,
  getAllDiscussions,
  addComment,
  updateComment,
  deleteComment,
  toggleLike,
  toggleCommentLike,
  subscribeToLikes,
  subscribeToCommentLikes,
  subscribeToAllDiscussions,
  deleteDiscussion,
  updateDiscussion,
  DiscussionLikes,
  getPublicDiscussions,
  subscribeToPublicDiscussions,
  convertPublicToDiscussion,
  formatDate,
} from '../services/discussionService';
import { recommendationService } from '../services/recommendationService';
import { normalizeArabic } from '../utils/searchNormalizer';

interface Course {
  id: string;
  name: string;
}

const DiscussionsPage = () => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();
  const { universities } = useCatalogStore();
  const navigate = useNavigate();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [newDiscussion, setNewDiscussion] = useState({ title: '', content: '', courseId: '' });
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  // Derive the selected discussion from the live `discussions` list so real-time
  // updates (new comments, edits) are reflected immediately without a refresh.
  const selectedDiscussion = selectedDiscussionId
    ? discussions.find(d => d.id === selectedDiscussionId) || null
    : null;
  const [newComment, setNewComment] = useState('');
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
   const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
   // State for real-time likes: discussionId -> DiscussionLikes
  const [likesMap, setLikesMap] = useState<Record<string, DiscussionLikes>>({});
  // State for editing discussions
  const [editingDiscussion, setEditingDiscussion] = useState<Discussion | null>(null);
  const [editDiscussionData, setEditDiscussionData] = useState({ title: '', content: '', courseId: '' });
  // State for editing comments
  const [editingComment, setEditingComment] = useState<{ id: string; content: string } | null>(null);
  // State for comment likes: discussionId-commentId -> { likeCount, likedByCurrentUser }
  const [commentLikesMap, setCommentLikesMap] = useState<Record<string, { likeCount: number; likedByCurrentUser: boolean }>>({});

  // Extract all courses from catalog store with safety checks — memoized to avoid recalculation every render
  const allCourses: Course[] = useMemo(() => (Array.isArray(universities) ? universities : [])
    .flatMap((uni: University) => (Array.isArray(uni?.colleges) ? uni.colleges : []))
    .flatMap((col: College) => (Array.isArray(col?.majors) ? col.majors : []))
    .flatMap((maj: Major) => (Array.isArray(maj?.courses) ? maj.courses : []))
    .map((course: CourseType) => ({
      id: course.id,
      name: course.name
    })), [universities]);

  // Get course name by ID — memoized to avoid recalculation every render
  const getCourseName = useCallback((courseId: string): string => {
    const course = allCourses.find(c => c.id === courseId);
    return course?.name || t('common.noData');
  }, [allCourses]);

  // Shared dropdown renderer for course selection — eliminates three duplicate dropdown patterns
  const renderCourseDropdown = (
    dropdownKey: string,
    value: string,
    onChange: (courseId: string) => void,
    placeholder: string,
    label: string,
    showLabel: boolean = true,
  ) => (
    <div className="relative mb-3 sm:flex-1 sm:min-w-[200px]">
      {showLabel && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 sm:mb-2">{label}</label>}
      <button
        type="button"
        onClick={() => setOpenDropdown(openDropdown === dropdownKey ? null : dropdownKey)}
        className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors duration-200 text-base text-gray-900 dark:text-gray-100 flex items-center justify-between"
      >
        <span className="truncate">{value ? allCourses.find(c => c.id === value)?.name || placeholder : placeholder}</span>
        <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {openDropdown === dropdownKey && (
        <ul className="absolute z-20 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
          <li onClick={() => { onChange(''); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-right truncate">{placeholder}</li>
          {allCourses.map(course => (
            <li key={course.id} onClick={() => { onChange(course.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-right truncate">{course.name}</li>
          ))}
        </ul>
      )}
    </div>
  );

  // Load initial discussions - guests read from publicDiscussions
  useEffect(() => {
    const loadDiscussions = async () => {
      setIsLoading(true);
      try {
        if (currentUser) {
          const allDiscussions = await getAllDiscussions();
          setDiscussions(allDiscussions);
        } else {
          const publicDiscussions = await getPublicDiscussions();
          // Convert PublicDiscussion[] to Discussion[] for compatibility
          const converted: Discussion[] = publicDiscussions.map(convertPublicToDiscussion);
          setDiscussions(converted);
        }
      } catch (error) {
        console.error('Error loading discussions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDiscussions();
  }, [currentUser]);

  // Subscribe to real-time updates for ALL discussions
  useEffect(() => {
    if (currentUser) {
      const unsubscribe = subscribeToAllDiscussions((updatedDiscussions) => {
        setDiscussions(updatedDiscussions);
      });
      return () => unsubscribe();
    } else {
      // Guests: subscribe to public discussions
      const unsubscribe = subscribeToPublicDiscussions((publicDiscussions) => {
            const converted: Discussion[] = publicDiscussions.map(convertPublicToDiscussion);
        setDiscussions(converted);
      });
      return () => unsubscribe();
    }
  }, [currentUser]);

  // Subscribe to real-time likes for discussions (only for logged-in users)
  // LIMIT: Subscribe to max 20 discussions to prevent too many open listeners
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribes: (() => void)[] = [];
    const MAX_LIKE_SUBSCRIPTIONS = 20;

    const discussionsToSubscribe = discussions.slice(0, MAX_LIKE_SUBSCRIPTIONS);

    discussionsToSubscribe.forEach((discussion) => {
      if (discussion.id) {
        const unsubscribe = subscribeToLikes(
          discussion.id,
          currentUser.id,
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

  // Subscribe to real-time likes for comments (only for logged-in users)
  // LIMIT: Subscribe to max 10 discussions and max 5 comments per discussion
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribes: (() => void)[] = [];
    const MAX_DISCUSSION_SUBSCRIPTIONS = 10;
    const MAX_COMMENT_SUBSCRIPTIONS_PER_DISCUSSION = 5;

    const discussionsToSubscribe = discussions.slice(0, MAX_DISCUSSION_SUBSCRIPTIONS);

    discussionsToSubscribe.forEach((discussion) => {
      if (discussion.id && Array.isArray(discussion.comments)) {
        const commentsToSubscribe = discussion.comments.slice(0, MAX_COMMENT_SUBSCRIPTIONS_PER_DISCUSSION);
        commentsToSubscribe.forEach((comment) => {
          if (comment.id) {
            const key = `${discussion.id}-${comment.id}`;
            const unsubscribe = subscribeToCommentLikes(
              discussion.id,
              comment.id,
              currentUser.id,
              (likes) => {
                setCommentLikesMap((prev) => ({
                  ...prev,
                  [key]: likes
                }));
              }
            );
            unsubscribes.push(unsubscribe);
          }
        });
      }
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [discussions, currentUser?.id]);

  // Scroll to top when a discussion is opened so the view doesn't stay
  // pinned to the (now much shorter) footer after scrolling the long list.
  useEffect(() => {
    if (selectedDiscussionId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedDiscussionId]);

  // SEO meta tags
  useEffect(() => {
      if (!currentUser) {
          document.title = t('discussions.seoTitle');
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
              metaDesc = document.createElement('meta');
              metaDesc.setAttribute('name', 'description');
              document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', t('discussions.seoDescription'));
          // Canonical URL for this public discussions route
          let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
          if (!canonical) {
              canonical = document.createElement('link');
              canonical.setAttribute('rel', 'canonical');
              document.head.appendChild(canonical);
          }
          canonical.setAttribute('href', window.location.href);
      }
      return () => {
          document.title = t('app.title');
      };
  }, [currentUser, t]);

  // SEO: structured data (JSON-LD) for the discussions page
  useEffect(() => {
      if (currentUser) return; // only enrich the guest-facing (crawlable) view
      const data = {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: t('discussions.seoStructuredName'),
          itemListElement: discussions.slice(0, 20).map((d, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: d.title || t('discussions.seoFallbackName'),
              description: d.content ? d.content.slice(0, 200) : undefined,
          })),
      };
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'jsonld-discussions';
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
      return () => {
          document.getElementById('jsonld-discussions')?.remove();
      };
  }, [currentUser, discussions, t]);

  // Feed discussion-search queries into the recommendation engine (interest
  // signal). Debounced and fire-and-forget so it never blocks the UI/search.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || !currentUser?.id) return;
    const t = setTimeout(() => {
      recommendationService.trackSearch(q, currentUser.id).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [searchQuery, currentUser?.id]);

  // Filter discussions based on search and course filter — memoized to avoid recalculation every render
  const filteredDiscussions = useMemo(() => discussions.filter(discussion => {
    const normalizedQuery = normalizeArabic(searchQuery.toLowerCase());
    const matchesSearch = searchQuery === '' ||
      (typeof discussion.title === 'string' && normalizeArabic(discussion.title.toLowerCase()).includes(normalizedQuery)) ||
      (typeof discussion.content === 'string' && normalizeArabic(discussion.content.toLowerCase()).includes(normalizedQuery)) ||
      (typeof discussion.authorName === 'string' && normalizeArabic(discussion.authorName.toLowerCase()).includes(normalizedQuery));

    const matchesCourse = selectedCourseFilter === '' || discussion.courseId === selectedCourseFilter;

    return matchesSearch && matchesCourse;
  }), [discussions, searchQuery, selectedCourseFilter]);

   const handleCreateDiscussion = async () => {
    if (!newDiscussion.title.trim() || !newDiscussion.content.trim()) {
      alert(t('discussions.enterTitleAndContent'));
      return;
    }
    if (!currentUser) {
      alert(t('discussions.logInParticipate'));
      return;
    }

    const userRole = currentUser.role;

    const discussion: Omit<Discussion, 'id'> = {
      courseId: newDiscussion.courseId || 'general',
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
      setNewDiscussion({ title: '', content: '', courseId: '' });
      setShowNewDiscussion(false);
    } catch (error) {
      console.error('Error creating discussion:', error);
      alert(t('discussions.discussionCreateError'));
    }
  };

  const handleAddComment = async (discussionId: string) => {
    if (!newComment.trim()) return;
    if (!currentUser) {
      alert(t('discussions.loginToComment'));
      return;
    }

    const userRole = currentUser.role;

    const comment: Comment = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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
      alert(t('discussions.commentAddError'));
    }
  };

  const handleLike = async (discussionId: string) => {
    if (!currentUser) {
      alert(t('discussions.likeLogin'));
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

  // Helper function to get like info for a discussion
  const getLikeInfo = (discussionId: string): DiscussionLikes => {
    return likesMap[discussionId] || { likeCount: 0, likedByCurrentUser: false, userIds: {} };
  };

  // Check if user can modify a discussion (author or admin)
  const canModifyDiscussion = (discussion: Discussion): boolean => {
    if (!currentUser) return false;
    // Admin can modify any discussion
    if (currentUser.role === 'admin') return true;
    // Author can modify their own discussion
    return discussion.authorId === currentUser.id;
  };

  // Delete discussion (with all its comments)
  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!window.confirm(t('discussions.deleteDiscussionConfirm'))) return;

    try {
      await deleteDiscussion(discussionId);
      setSelectedDiscussionId(null);
    } catch (error) {
      console.error('Error deleting discussion:', error);
      alert(t('discussions.discussionUpdateError'));
    }
  };

  // Start editing a discussion
  const handleStartEdit = (discussion: Discussion) => {
    setEditingDiscussion(discussion);
    setEditDiscussionData({
      title: discussion.title,
      content: discussion.content,
      courseId: discussion.courseId
    });
  };

  // Save edited discussion
  const handleUpdateDiscussion = async () => {
    if (!editingDiscussion) return;
    if (!editDiscussionData.title.trim() || !editDiscussionData.content.trim()) {
      alert(t('discussions.enterTitleAndContent'));
      return;
    }

    try {
      await updateDiscussion(editingDiscussion.id, {
        title: editDiscussionData.title,
        content: editDiscussionData.content,
        courseId: editDiscussionData.courseId
      });
      setEditingDiscussion(null);
      setEditDiscussionData({ title: '', content: '', courseId: '' });
    } catch (error) {
      console.error('Error updating discussion:', error);
      alert(t('discussions.discussionUpdateError'));
    }
  };

  // Delete a comment from a discussion
  const handleDeleteComment = async (discussionId: string, commentId: string) => {
    if (!window.confirm(t('discussions.deleteReplyConfirm'))) return;

    try {
      await deleteComment(discussionId, commentId);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert(t('discussions.discussionUpdateError'));
    }
  };

  // Start editing a comment
  const handleStartEditComment = (comment: Comment) => {
    setEditingComment({ id: comment.id, content: comment.content });
  };

  // Save edited comment
  const handleUpdateComment = async () => {
    if (!editingComment || !selectedDiscussion) return;

    if (!editingComment.content.trim()) {
      alert(t('discussions.enterTitleAndContent'));
      return;
    }

    try {
      await updateComment(selectedDiscussion.id, editingComment.id, editingComment.content);
      setEditingComment(null);
    } catch (error) {
      console.error('Error updating comment:', error);
      alert(t('discussions.commentEditError'));
    }
  };

  // Like a comment
  const handleLikeComment = async (discussionId: string, commentId: string) => {
    if (!currentUser) {
      alert(t('discussions.likeLogin'));
      return;
    }

    try {
      await toggleCommentLike(discussionId, commentId, currentUser.id);
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  // Check if user can modify a comment (author or admin)
  const canModifyComment = (comment: Comment): boolean => {
    if (!currentUser) return false;
    // Admin can modify any comment
    if (currentUser.role === 'admin') return true;
    // Author of the comment can modify their own comment
    return comment.authorId === currentUser.id;
  };

  // Get like info for a comment
  const getCommentLikeInfo = (discussionId: string, commentId: string) => {
    const key = `${discussionId}-${commentId}`;
    return commentLikesMap[key] || { likeCount: 0, likedByCurrentUser: false };
  };

  // If viewing a single discussion
  if (selectedDiscussion) {
    if (!selectedDiscussion.id || !selectedDiscussion.title) {
      return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <button
            onClick={() => setSelectedDiscussionId(null)}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline mb-4 flex items-center transition-colors duration-200"
          >
            {t('discussions.backToDiscussions')}
          </button>
          <div className="bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-gray-800 rounded-xl border border-primary-100 dark:border-primary-800 p-6 animate-fade-in">
            <p className="text-gray-500 dark:text-gray-400">{t('discussions.discussionsError')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <button
          onClick={() => setSelectedDiscussionId(null)}
          className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:underline mb-4 flex items-center transition-colors duration-200"
        >
          {t('discussions.backToDiscussions')}
        </button>

        {/* Edit Discussion Overlay */}
        {editingDiscussion && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in mx-auto">
              {/* Header */}
              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">{t('discussions.editDiscussion')}</h3>
                  <button
                    onClick={() => setEditingDiscussion(null)}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
                    aria-label={t('common.close')}
                    title={t('common.close')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <div className="md:col-span-1">
                     {renderCourseDropdown('editCourse', editDiscussionData.courseId, (id) => setEditDiscussionData({ ...editDiscussionData, courseId: id }), t('discussions.selectCourseOptional'), t('discussions.courseTool'))}
                   </div>

                 <div className="md:col-span-1">
                   <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 sm:mb-2">{t('discussions.discussionTitle')}</label>
                   <input
                     type="text"
                     value={editDiscussionData.title}
                     onChange={(e) => setEditDiscussionData({ ...editDiscussionData, title: e.target.value })}
                     placeholder={t('discussions.discussionTitle') + '...'}
                      className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors duration-200 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                    />
                  </div>
                </div>

                <div className="mt-4 sm:mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">{t('discussions.discussionContent')}</label>
                  <textarea
                    value={editDiscussionData.content}
                    onChange={(e) => setEditDiscussionData({ ...editDiscussionData, content: e.target.value })}
                    placeholder={t('discussions.discussionContent') + '...'}
                    rows={7}
                    className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors duration-200 text-base resize-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5 sm:mt-6">
                  <button
                    onClick={handleUpdateDiscussion}
                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-medium text-sm sm:text-base"
                  >
                    {t('discussions.saveEdit')}
                  </button>
                  <button
                    onClick={() => setEditingDiscussion(null)}
                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 active:scale-[0.98] transition-all duration-200 font-medium text-sm sm:text-base text-gray-700 dark:text-gray-200"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-primary-50/80 to-white dark:from-primary-900/20 dark:to-slate-800 rounded-2xl border border-primary-100/60 dark:border-primary-800/50 p-6 animate-fade-in shadow-lg shadow-primary-500/5">
          <div className="border-b border-primary-200 dark:border-primary-800 pb-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                <span className="text-sm text-primary-600 dark:text-primary-300 font-medium">{getCourseName(selectedDiscussion.courseId)}</span>
              </div>
              {canModifyDiscussion(selectedDiscussion) && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEdit(selectedDiscussion)}
                    title={t('discussions.editDiscussion')}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-all duration-200"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteDiscussion(selectedDiscussion.id)}
                    title={t('discussions.deleteDiscussion')}
                    className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{selectedDiscussion.title}</h3>
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-300 mb-3">
              <User className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
              <span className="ml-1">{selectedDiscussion.authorName}</span>
              {selectedDiscussion.authorRole === 'admin' && (
                <span className="ml-2 px-2 py-0.5 bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300 text-xs rounded-md font-medium">
                  {t('discussions.siteAdmin')}
                </span>
              )}
              <Clock className="h-4 w-4 mr-3 ml-3 text-gray-400 dark:text-gray-500" />
              <span>{formatDate(selectedDiscussion.createdAt)}</span>
            </div>
            <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{selectedDiscussion.content}</p>
          </div>

          <div className="mb-6">
            <h4 className="font-semibold mb-4 text-lg">{t('discussions.comments', { count: Array.isArray(selectedDiscussion.comments) ? selectedDiscussion.comments.length : 0 })}</h4>

            {!Array.isArray(selectedDiscussion.comments) || selectedDiscussion.comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                 {t('discussions.noCommentsYetShort')}
              </div>
            ) : (
              <div className="space-y-3">
              {selectedDiscussion.comments.map(comment => (
                <div key={comment.id} className="bg-gradient-to-br from-white to-primary-50/30 dark:from-slate-700 dark:to-slate-800 border border-primary-100/60 dark:border-primary-700/30 rounded-xl p-4 shadow-sm hover:shadow-md hover:shadow-primary-500/5 hover:border-primary-200/60 dark:hover:border-primary-600/40 transition-all duration-200">
                    {editingComment && editingComment.id === comment.id ? (
                      // Editing mode for comment
                      <div>
                        <textarea
                          value={editingComment.content}
                          onChange={(e) => setEditingComment({ ...editingComment, content: e.target.value })}
                          rows={2}
                          placeholder={t('chat.edit') + '...'}
                          className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg mb-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-600 hover:border-gray-300 transition-colors duration-200 text-gray-900 dark:text-gray-100"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdateComment}
                            className="px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all duration-200 text-sm font-medium"
                          >
                            {t('chat.saveEdit')}
                          </button>
                          <button
                            onClick={() => setEditingComment(null)}
                            className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 text-sm font-medium text-gray-700 dark:text-gray-200"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal view mode for comment
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center text-sm mb-2">
                            <User className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" />
                            <span className="font-medium ml-1 text-gray-900 dark:text-gray-100">{comment.authorName}</span>
                            {comment.authorRole === 'admin' && (
                              <span className="ml-2 px-2 py-0.5 bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300 text-xs rounded-md font-medium">
                                {t('discussions.siteAdmin')}
                              </span>
                            )}
                            <Clock className="h-4 w-4 mr-3 ml-3 text-gray-400 dark:text-gray-500" />
                            <span className="text-gray-500 dark:text-gray-400">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-200 leading-relaxed">{comment.content}</p>

                          {/* Like button for comments - hidden for guests */}
                          {currentUser && (
                            <div className="mt-3 flex items-center">
                              <button
                                onClick={() => handleLikeComment(selectedDiscussion.id, comment.id)}
                                className={`flex items-center gap-1 text-xs transition-all duration-200 ${getCommentLikeInfo(selectedDiscussion.id, comment.id).likedByCurrentUser
                                  ? 'text-primary-600 dark:text-primary-400'
                                  : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400'
                                  }`}
                              >
                                <ThumbsUp className={`h-3 w-3 ${getCommentLikeInfo(selectedDiscussion.id, comment.id).likedByCurrentUser ? 'fill-current' : ''}`} />
                                <span>{getCommentLikeInfo(selectedDiscussion.id, comment.id).likeCount}</span>
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Action buttons: Edit and Delete */}
                        {canModifyComment(comment) && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleStartEditComment(comment)}
                              title={t('chat.edit')}
                              className="p-1 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-all duration-200"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteComment(selectedDiscussion.id, comment.id)}
                              title={t('discussions.deleteComment')}
                              className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                           </div>
                         )}
                       </div>
                     )}
                   </div>
                 ))}
              </div>
            )}
          </div>

          {currentUser ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('discussions.replyPlaceholder')}
                className="flex-1 p-2.5 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 hover:border-gray-300 transition-colors duration-200 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(selectedDiscussion.id)}
              />
              <button
                onClick={() => handleAddComment(selectedDiscussion.id)}
                title={t('chat.send')}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
              <p>{t('discussions.loginToComment')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        {/* Navigation buttons - unified interface */}
        <div className="flex gap-2 mb-6 bg-brown-100 dark:bg-brown-800 p-1 rounded-xl w-fit">
          <button
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 active:scale-[0.98] ${'bg-white dark:bg-brown-700 text-primary-700 dark:text-primary-300 shadow-sm'
              }`}
          >
            <MessageCircle className="inline-block h-5 w-5 ml-2 text-primary-500 dark:text-primary-400" />
            {t('discussions.discussionsTitle')}
          </button>
          <button
            onClick={() => navigate('/chat')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 active:scale-[0.98] text-brown-600 dark:text-brown-300 hover:text-brown-800 dark:hover:text-brown-100 hover:bg-brown-200/50 dark:hover:bg-brown-700/50`}
          >
            <MessageCircle className="inline-block h-5 w-5 ml-2 text-brown-500 dark:text-brown-400" />
            {t('chat.publicChat')}
          </button>
        </div>

        {/* Discussions View */}
        <div className="bg-[#FFFBEB]/90 dark:bg-brown-900/90 backdrop-blur-md rounded-2xl border border-brown-200/50 dark:border-brown-700/30 p-6 shadow-lg shadow-primary-500/5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center text-brown-800 dark:text-neutral-100">
              <MessageCircle className="h-5 w-5 text-primary-500 ml-2" />
              {t('discussions.discussionsTitle')}
            </h2>
            {currentUser && (
                <button
                    onClick={() => setShowNewDiscussion(!showNewDiscussion)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-medium"
                >
                    {t('discussions.newDiscussion')}
                </button>
            )}
            {!currentUser && (
                <div className="flex items-center gap-2 text-sm text-brown-500 dark:text-neutral-400 bg-brown-50 dark:bg-brown-800/50 px-4 py-2 rounded-lg">
                    <Lock className="h-4 w-4" />
                    <span>{t('discussions.logInParticipate')}</span>
                </div>
            )}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
            <div className="flex-1 relative sm:self-center">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-brown-400 dark:text-brown-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('discussions.searchPlaceholder')}
                className="w-full p-2.5 pr-10 border border-brown-200 dark:border-brown-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
              />
            </div>
            {renderCourseDropdown('courseFilter', selectedCourseFilter, setSelectedCourseFilter, t('discussions.allCourses'), t('discussions.courseTool'), false)}
          </div>

          {showNewDiscussion && (
            <div className="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-xl p-4 mb-6 bg-primary-50 dark:bg-primary-900/20 animate-fade-in-up">
              {renderCourseDropdown('newCourse', newDiscussion.courseId, (id) => setNewDiscussion({ ...newDiscussion, courseId: id }), t('discussions.selectCourseOptional'), t('discussions.courseTool'))}
              <input
                type="text"
                value={newDiscussion.title}
                onChange={(e) => setNewDiscussion({ ...newDiscussion, title: e.target.value })}
                placeholder={t('discussions.discussionTitle') + '...'}
                className="w-full p-2.5 border border-brown-200 dark:border-brown-600 rounded-lg mb-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
              />
              <textarea
                value={newDiscussion.content}
                onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
                placeholder={t('discussions.discussionContent') + '...'}
                rows={3}
                className="w-full p-2.5 border border-brown-200 dark:border-brown-600 rounded-lg mb-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-brown-800 hover:border-brown-300 transition-colors duration-200 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateDiscussion}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-medium"
                >
                  {t('discussions.publishDiscussion')}
                </button>
                <button
                  onClick={() => setShowNewDiscussion(false)}
                  className="px-4 py-2 border border-brown-200 dark:border-brown-600 rounded-lg hover:bg-brown-50 dark:hover:bg-brown-700 hover:border-brown-300 dark:hover:border-brown-500 active:scale-[0.98] transition-all duration-200 font-medium text-brown-700 dark:text-neutral-200"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-brown-500 dark:text-neutral-400">{t('common.loading')}</div>
          ) : filteredDiscussions.length === 0 ? (
            <div className="text-center py-14 bg-brown-50 dark:bg-brown-800/50 rounded-xl border-2 border-dashed border-primary-200 dark:border-primary-800">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-primary-400 dark:text-primary-500" />
              <p className="text-lg sm:text-xl font-bold text-brown-700 dark:text-neutral-200 leading-relaxed px-4">
                  {searchQuery || selectedCourseFilter
                      ? t('discussions.noDiscussionsMatch')
                      : currentUser
                          ? t('discussions.noDiscussionsYetBeFirst')
                          : t('discussions.noDiscussionsShow')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
               {filteredDiscussions.map(discussion => (
                 <div
                   key={discussion.id}
                   className="card card-hover card-interactive p-4 bg-gradient-to-br from-white to-primary-50/20 dark:from-brown-900 dark:to-brown-950 border border-brown-100/50 dark:border-brown-700/30 hover:border-primary-200/60 dark:hover:border-primary-600/40 hover:shadow-lg hover:shadow-primary-500/5"
                   onClick={() => setSelectedDiscussionId(discussion.id)}
                 >
                   <div className="flex items-start justify-between">
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                         <BookOpen className="h-3.5 w-3.5 text-primary-500 dark:text-primary-400" />
                         <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">{getCourseName(discussion.courseId)}</span>
                       </div>
                       <h3 className="font-semibold text-lg mb-1 text-brown-800 dark:text-neutral-100 transition-colors duration-200">{discussion.title}</h3>
                       <p className="text-brown-600 dark:text-neutral-300 text-sm mb-2 line-clamp-2 leading-relaxed">{discussion.content}</p>
                       <div className="flex items-center text-xs text-brown-500 dark:text-neutral-400">
                         <User className="h-3 w-3 mr-1 text-brown-400 dark:text-brown-500" />
                         <span className="ml-1">{discussion.authorName}</span>
                         {discussion.authorRole === 'admin' && (
                           <span className="ml-2 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs rounded-md font-medium">
                             {t('discussions.siteAdmin')}
                           </span>
                         )}
                         <Clock className="h-3 w-3 mr-3 ml-3 text-brown-400 dark:text-brown-500" />
                         <span>{formatDate(discussion.createdAt)}</span>
                       </div>
                     </div>
                     <div className="flex flex-col items-end ml-4 gap-3">
                       {currentUser && (
                         <button
                           onClick={(e) => { e.stopPropagation(); handleLike(discussion.id); }}
                           className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 active:scale-[0.95] ${getLikeInfo(discussion.id).likedByCurrentUser
                             ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                             : 'text-brown-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                             }`}
                           aria-label={getLikeInfo(discussion.id).likedByCurrentUser ? t('common.like') : t('common.like')}
                         >
                           <ThumbsUp className={`h-4 w-4 ${getLikeInfo(discussion.id).likedByCurrentUser ? 'fill-current' : ''}`} />
                           <span className="text-sm font-medium">{getLikeInfo(discussion.id).likeCount}</span>
                         </button>
                       )}
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
                 {t('discussions.logInParticipate')}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 hover:shadow-md active:scale-[0.98] transition-all duration-200 font-semibold text-base"
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

export default DiscussionsPage;
