import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import RecommendationCard from './RecommendationCard';
import { ContentCategory, RecommendationContent, RecommendationItemWithStatus } from '../../types';
import { recommendationService } from '../../services/recommendationService';
import { useRecommendationActions } from '../../hooks/useRecommendationActions';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface CategorySectionProps {
    userId?: string;
    category: ContentCategory;
    title: string;
    icon?: React.ElementType;
    limit?: number;
    requiredCount?: number;  // Guarantee at least this many cards
    onViewAll?: (category: ContentCategory) => void;
    isPublic?: boolean;
    excludeIds?: string[];
}

const CategorySection: React.FC<CategorySectionProps> = ({
    userId,
    category,
    title,
    icon: IconComponent,
    limit = 6,
    requiredCount,
    onViewAll,
    isPublic = false,
    excludeIds,
}) => {
    const [items, setItems] = useState<RecommendationItemWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const { t, i18n } = useTranslation();

    // Page size used for both the initial load and "Load more" (capped at 50).
    const PAGE_SIZE = Math.max(1, Math.min(limit || 20, 50));

    const { handleSave, handleLike, handleHide, canInteract } = useRecommendationActions({
        userId: isPublic ? undefined : userId,
        onInvalidate: () => {
            // Invalidate cache for this user/category when interactions happen
            if (userId) {
                recommendationService.getRecommendations({ category, limit: 1, page: 1 }, userId);
            }
        }
    });

    const loadCategoryContent = useCallback(async (pageNum: number, append: boolean) => {
        if (append) setLoadingMore(true);
        else {
            setLoading(true);
            setError(false);
        }
        try {
            let data: RecommendationContent[] = [];
            const fetchCategory = isPublic ? category : category;
            data = await recommendationService.getRecommendations(
                {
                    category: fetchCategory,
                    limit: PAGE_SIZE,
                    page: pageNum,
                    requiredCount: requiredCount || limit || PAGE_SIZE,
                    fallbackOnEmpty: true,
                    preferredLanguage: i18n.language,
                },
                isPublic ? undefined : userId
            );
            const validData = (data as RecommendationItemWithStatus[]).filter(
                item => item.title && item.sourceUrl && item.title.trim() && item.sourceUrl.trim()
            );
            const mapped = validData.map(item => ({
                ...item,
                isSaved: !!item.isSaved,
                isLiked: !!item.isLiked,
            }));
            // Skip items already shown elsewhere (e.g. the top carousel) to avoid
            // showing the same recommendation twice on the same page.
            const excludeSet = new Set(excludeIds || []);
            const filtered = mapped.filter(i => !excludeSet.has(i.id));
            if (append) {
                // Append the next page, skipping any duplicates by id.
                setItems(prev => {
                    const seen = new Set(prev.map(i => i.id));
                    return [...prev, ...filtered.filter(i => !seen.has(i.id))];
                });
            } else {
                setItems(filtered);
            }
            // More pages exist as long as we got a full page back.
            setHasMore(filtered.length >= PAGE_SIZE);
        } catch (err) {
            if (!append) {
                console.error(`Error fetching ${category} recommendations:`, err);
                setError(true);
            }
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, [userId, category, limit, isPublic, PAGE_SIZE, excludeIds, i18n.language]);

    useEffect(() => {
        if (isPublic || userId) {
            setPage(1);
            loadCategoryContent(1, false);
        }
    }, [userId, category, isPublic, loadCategoryContent, reloadKey]);

    const handleLoadMore = useCallback(() => {
        const next = page + 1;
        setPage(next);
        loadCategoryContent(next, true);
    }, [page, loadCategoryContent]);

    const handleOpen = async (content: RecommendationContent) => {
        // Track activity non-blocking with category/keywords for better personalization
        if (!isPublic && userId) {
            recommendationService.trackActivity(
                {
                    activityType: 'open_file',
                    metadata: {
                        contentType: 'recommendation',
                        contentId: content.id,
                        category: content.category,
                        keywords: content.keywords,
                        source: content.source,
                    },
                },
                userId
            ).catch(() => {
                // Silently ignore tracking failures
            });
        }
        window.open(content.sourceUrl, '_blank', 'noopener,noreferrer');
    };

    const handleSaveWrapper = async (contentId: string) => {
        await handleSave(contentId, items, setItems);
    };

    const handleLikeWrapper = async (contentId: string) => {
        await handleLike(contentId, items, setItems);
    };

    const handleHideWrapper = async (contentId: string) => {
        await handleHide(contentId, items, setItems, () => loadCategoryContent(1, false));
    };

    if (loading) {
        return (
            <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    {IconComponent && <IconComponent className="h-5 w-5 text-primary-600 dark:text-primary-400" />}
                    {title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    {IconComponent && <IconComponent className="h-5 w-5 text-primary-600 dark:text-primary-400" />}
                    {title}
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-700 dark:text-red-300">
                            {t('recommendations.section.errorLoading')}
                        </span>
                    </div>
                    <button
                        onClick={() => setReloadKey(k => k + 1)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
                    >
                        {t('recommendations.section.retry')}
                    </button>
                </div>
            </div>
        );
    }

    // Show skeleton while loading more content.
    // The backend guarantees filled cards, but we show a loading state
    // instead of hiding the entire section so users see feedback.
    if (items.length === 0 && !error) {
        return (
            <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    {IconComponent && <IconComponent className="h-5 w-5 text-primary-600 dark:text-primary-400" />}
                    {title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4"></div>
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    {IconComponent && <IconComponent className="h-5 w-5 text-primary-600 dark:text-primary-400" />}
                    {title}
                </h3>
                {onViewAll && items.length > 0 && (
                    <button
                        onClick={() => onViewAll(category)}
                        className="text-sm font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 flex items-center gap-1.5 transition-all duration-200 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:shadow-md hover:scale-[1.03] active:scale-[0.97]"
                    >
                        {t('recommendations.section.viewAll')}
                        {i18n.language === 'ar' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, index) => (
                    <div key={item.id} className={`animate-card-stagger stagger-${Math.min(index + 1, 10)}`}>
                        <RecommendationCard
                            content={item}
                            isSaved={item.isSaved}
                            isLiked={item.isLiked}
                            isPublic={isPublic}
                            onOpen={handleOpen}
                            onSave={canInteract ? handleSaveWrapper : undefined}
                            onLike={canInteract ? handleLikeWrapper : undefined}
                            onHide={canInteract ? handleHideWrapper : undefined}
                        />
                    </div>
                ))}
            </div>

            {hasMore && !loading && (
                <div className="flex justify-center mt-8">
                    <button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        className="btn-modern-primary px-8 py-3.5 rounded-xl text-base font-bold shadow-lg hover:shadow-xl hover:shadow-primary-500/25"
                    >
                        {loadingMore ? t('recommendations.carousel.loading') : t('recommendations.carousel.showMore')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CategorySection;
