import React from 'react';
import { RecommendationContent, BadgeType } from '../../types';
import { BookOpen, Heart, Bookmark, Eye, Calendar, Clock, Lock } from 'lucide-react';

interface RecommendationCardProps {
    content: RecommendationContent;
    onOpen?: (content: RecommendationContent) => void;
    onSave?: (contentId: string) => void;
    onLike?: (contentId: string) => void;
    onHide?: (contentId: string) => void;
    isSaved?: boolean;
    isLiked?: boolean;
    compact?: boolean;
    isPublic?: boolean;
}

const BADGE_CONFIG: Record<BadgeType, { icon: string; label: string; color: string }> = {
    urgent: { icon: '🚨', label: 'عاجل', color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' },
    ending_soon: { icon: '⏳', label: 'ينتهي قريباً', color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
    new: { icon: '🆕', label: 'جديد', color: 'bg-sage-100 text-sage-700 border-sage-200 dark:bg-sage-900/40 dark:text-sage-300 dark:border-sage-800' },
    popular: { icon: '🔥', label: 'الأكثر شيوعاً', color: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800' },
    recommended: { icon: '⭐', label: 'موصى به', color: 'bg-[#F2E0CE] text-[#5C3A1E] border-[#D4A77A] dark:bg-[#5C3A1E]/40 dark:text-[#D4A77A] dark:border-[#7B4D2A]' },
    free_course: { icon: '🎓', label: 'دورة مجانية', color: 'bg-[#F9F0E6] text-[#7B4D2A] border-[#E8C9A8] dark:bg-[#3B2314]/40 dark:text-[#B8865E] dark:border-[#5C3A1E]' },
    trending: { icon: '📈', label: 'رائج', color: 'bg-sage-100 text-sage-700 border-sage-200 dark:bg-sage-900/40 dark:text-sage-300 dark:border-sage-800' },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
    article: 'مقال',
    news: 'خبر',
    course: 'دورة',
    research: 'بحث',
    pdf: 'ملف PDF',
    video: 'فيديو',
    workshop: 'ورشة عمل',
    conference: 'مؤتمر',
    scholarship: 'منحة',
    competition: 'مسابقة',
    training: 'تدريب',
};

const RecommendationCard: React.FC<RecommendationCardProps> = ({
    content,
    onOpen,
    onSave,
    onLike,
    onHide,
    isSaved = false,
    isLiked = false,
    compact = false,
    isPublic = false,
}) => {
    const badge = content.badge ? BADGE_CONFIG[content.badge] : null;
    const contentTypeLabel = CONTENT_TYPE_LABELS[content.contentType] || content.contentType;

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const handleOpen = () => {
        if (!content.sourceUrl || !content.sourceUrl.trim()) {
            console.warn('RecommendationCard: Cannot open item with empty sourceUrl', content.id, content.title);
            return;
        }
        if (onOpen) onOpen(content);
    };

    if (!content.title || !content.sourceUrl) {
        console.warn('RecommendationCard: Skipping item with missing data', content.id);
        return null;
    }

    const handleSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onSave) onSave(content.id);
    };

    const handleLike = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onLike) onLike(content.id);
    };

    const handleHide = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onHide) onHide(content.id);
    };

    return (
        <div
            onClick={handleOpen}
            className={
                "group relative bg-gradient-to-br from-white to-[#F9F0E6]/30 dark:from-brown-800 dark:to-brown-900 rounded-xl border border-[#E8C9A8]/60 dark:border-brown-700/60 shadow-sm hover:shadow-lg hover:shadow-[#7B4D2A]/10 dark:hover:shadow-[#7B4D2A]/20 transition-all duration-300 cursor-pointer flex flex-col h-full overflow-hidden hover:-translate-y-1 hover:border-[#D4A77A]/50 dark:hover:border-[#7B4D2A]/40 animate-card-appear" + (compact ? " w-full" : "")
            }
        >
            <div className="relative w-full h-40 sm:h-48 bg-gradient-to-br from-[#F2E0CE] to-[#E8C9A8] dark:from-[#5C3A1E]/50 dark:to-[#3B2314]/60 overflow-hidden">
                {content.imageUrl ? (
                    <img
                        src={content.imageUrl}
                        alt={content.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F2E0CE] to-[#E8C9A8] dark:from-[#5C3A1E]/40 dark:to-[#3B2314]/40">
                        <BookOpen className="h-12 w-12 text-[#7B4D2A] dark:text-[#D4A77A]" />
                    </div>
                )}
                {badge && (
                    <span className={"absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium border " + badge.color}>
                        {badge.icon} {badge.label}
                    </span>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-[#291A0A]/80 text-white">
                    {contentTypeLabel}
                </span>
            </div>
            <div className="flex-1 p-4 flex flex-col">
                <h3 className="text-base font-semibold text-brown-900 dark:text-neutral-100 line-clamp-2 mb-2 group-hover:text-[#7B4D2A] dark:group-hover:text-[#D4A77A] transition-colors">
                    {content.title}
                </h3>
                <p className="text-sm text-brown-600 dark:text-neutral-300 line-clamp-2 mb-3 flex-1">
                    {content.summary || content.description?.slice(0, 150)}
                </p>
                <div className="flex items-center gap-3 text-xs text-brown-500 dark:text-neutral-400 mb-3">
                    {content.publishedAt && (
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(content.publishedAt)}
                        </span>
                    )}
                    <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {content.viewsCount}
                    </span>
                    {content.registrationDeadline && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            ينتهي: {formatDate(content.registrationDeadline)}
                        </span>
                    )}
                </div>
                {content.tags && content.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {content.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-[#F9F0E6] dark:bg-[#5C3A1E]/30 text-[#7B4D2A] dark:text-[#D4A77A] rounded text-xs">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-[#E8C9A8]/50 dark:border-brown-700/50">
                    <button
                        onClick={handleOpen}
                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-[#5C3A1E] to-[#7B4D2A] text-white rounded-lg hover:from-[#3B2314] hover:to-[#5C3A1E] transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                    >
                        {isPublic ? 'عرض التفاصيل' : 'فتح'}
                    </button>
                    {!isPublic && (
                        <>
                            <button
                                onClick={handleSave}
                                className={"p-1.5 rounded-lg transition-all duration-200 " + (isSaved ? 'bg-[#F2E0CE] text-[#7B4D2A]' : 'bg-[#F9F0E6] dark:bg-brown-700 text-brown-500 hover:text-[#7B4D2A]')}
                                title={isSaved ? 'إزالة من المحفوظات' : 'حفظ'}
                            >
                                <Bookmark className={"h-4 w-4" + (isSaved ? ' fill-current' : '')} />
                            </button>
                            <button
                                onClick={handleLike}
                                className={"p-1.5 rounded-lg transition-all duration-200 " + (isLiked ? 'bg-[#F2E0CE] text-[#7B4D2A]' : 'bg-[#F9F0E6] dark:bg-brown-700 text-brown-500 hover:text-[#7B4D2A]')}
                                title={isLiked ? 'إزالة الإعجاب' : 'إعجاب'}
                            >
                                <Heart className={"h-4 w-4" + (isLiked ? ' fill-current' : '')} />
                            </button>
                            <button
                                onClick={handleHide}
                                className="p-1.5 rounded-lg bg-[#F9F0E6] dark:bg-brown-700 text-brown-400 hover:text-brown-600 dark:hover:text-neutral-200 transition-all duration-200"
                                title="إخفاء"
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                        </>
                    )}
                    {isPublic && (
                        <div className="flex items-center gap-1 text-brown-400 text-xs" title="سجّل دخولك للتفاعل">
                            <Lock className="h-3.5 w-3.5" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecommendationCard;
