import React from 'react';
import { RecommendationContent, BadgeType } from '../../types';
import { BookOpen, Heart, Bookmark, Eye, Calendar, Clock, Lock, AlertTriangle, Timer, Sparkles, Flame, Star, GraduationCap, TrendingUp } from 'lucide-react';

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

const BADGE_CONFIG: Record<BadgeType, { icon: React.ElementType; label: string; color: string }> = {
    urgent: { icon: AlertTriangle, label: 'عاجل', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800' },
    ending_soon: { icon: Timer, label: 'ينتهي قريباً', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
    new: { icon: Sparkles, label: 'جديد', color: 'bg-sage-50 text-sage-700 border-sage-200 dark:bg-sage-900/30 dark:text-sage-300 dark:border-sage-800' },
    popular: { icon: Flame, label: 'الأكثر شيوعاً', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800' },
    recommended: { icon: Star, label: 'موصى به', color: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' },
    free_course: { icon: GraduationCap, label: 'دورة مجانية', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' },
    trending: { icon: TrendingUp, label: 'رائج', color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800' },
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
    const BadgeIcon = badge?.icon;
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
                "group relative bg-white dark:bg-brown-900/80 rounded-2xl border border-brown-200/60 dark:border-brown-700/50 shadow-sm hover:shadow-xl hover:shadow-primary-500/10 dark:hover:shadow-primary-900/20 transition-all duration-300 cursor-pointer flex flex-col h-full overflow-hidden hover:-translate-y-1 hover:border-primary-200/50 dark:hover:border-primary-700/40 animate-card-appear " + (compact ? "w-full" : "")
            }
        >
            <div className="relative w-full h-44 sm:h-52 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/20 overflow-hidden">
                {content.imageUrl ? (
                    <img
                        src={content.imageUrl}
                        alt={content.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/20 dark:to-secondary-900/20">
                        <BookOpen className="h-14 w-14 text-primary-400 dark:text-primary-600 animate-float-icon" />
                    </div>
                )}
                {badge && BadgeIcon && (
                    <span className={"absolute top-2 right-2 px-2.5 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm " + badge.color}>
                        <BadgeIcon className="h-3 w-3 inline-block" /> {badge.label}
                    </span>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-800/80 text-white backdrop-blur-sm">
                    {contentTypeLabel}
                </span>
            </div>
            <div className="flex-1 p-4 flex flex-col">
                <h3 className="text-base font-semibold text-brown-900 dark:text-neutral-100 line-clamp-2 mb-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition-colors leading-relaxed">
                    {content.title}
                </h3>
                <p className="text-sm text-brown-600 dark:text-neutral-400 line-clamp-2 mb-3 flex-1 leading-relaxed">
                    {content.summary || content.description?.slice(0, 150)}
                </p>
                <div className="flex items-center gap-3 text-xs text-brown-500 dark:text-neutral-500 mb-3">
                    {content.publishedAt && (
                        <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {formatDate(content.publishedAt)}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <Eye className="h-3 w-3" />
                        {content.viewsCount}
                    </span>
                    {content.registrationDeadline && (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            ينتهي: {formatDate(content.registrationDeadline)}
                        </span>
                    )}
                </div>
                {content.tags && content.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {content.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-medium">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
                <div className="flex items-center gap-2 pt-3 border-t border-brown-200/40 dark:border-brown-700/40">
                    <button
                        onClick={handleOpen}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-primary-700 via-primary-600 to-secondary-500 text-white rounded-xl hover:from-primary-800 hover:to-secondary-600 transition-all duration-200 text-sm font-bold shadow-md hover:shadow-lg hover:shadow-primary-500/25 hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center gap-2"
                    >
                        {isPublic ? '📖 عرض التفاصيل' : '🔗 فتح'}
                    </button>
                    {!isPublic && (
                        <>
                            <button
                                onClick={handleSave}
                                className={`px-3 py-2 rounded-xl transition-all duration-200 text-sm font-semibold hover:scale-[1.05] active:scale-[0.95] ${
                                    isSaved
                                        ? 'bg-primary-100 text-primary-700 shadow-sm'
                                        : 'bg-brown-50 dark:bg-brown-800 text-brown-500 hover:text-primary-700 hover:bg-primary-50 hover:shadow-sm'
                                }`}
                                title={isSaved ? 'إزالة من المحفوظات' : 'حفظ'}
                            >
                                <Bookmark className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                onClick={handleLike}
                                className={`px-3 py-2 rounded-xl transition-all duration-200 text-sm font-semibold hover:scale-[1.05] active:scale-[0.95] ${
                                    isLiked
                                        ? 'bg-red-50 text-red-500 shadow-sm'
                                        : 'bg-brown-50 dark:bg-brown-800 text-brown-500 hover:text-red-500 hover:bg-red-50 hover:shadow-sm'
                                }`}
                                title={isLiked ? 'إزالة الإعجاب' : 'إعجاب'}
                            >
                                <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                onClick={handleHide}
                                className="px-3 py-2 rounded-xl bg-brown-50 dark:bg-brown-800 text-brown-400 hover:text-brown-600 dark:hover:text-neutral-200 transition-all duration-200 text-sm font-semibold hover:scale-[1.05] active:scale-[0.95]"
                                title="إخفاء"
                            >
                                <Eye className="h-5 w-5" />
                            </button>
                        </>
                    )}
                    {isPublic && (
                        <div className="flex items-center gap-1.5 text-brown-400 text-xs font-medium bg-brown-50 dark:bg-brown-800 px-2 py-1 rounded-lg" title="سجّل دخولك للتفاعل">
                            <Lock className="h-3.5 w-3.5" />
                            تسجيل الدخول
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecommendationCard;
