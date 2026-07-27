import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, AlertTriangle } from 'lucide-react';
import RecommendationCard from './RecommendationCard';
import { RecommendationContent, RecommendationItemWithStatus } from '../../types';
import { recommendationService } from '../../services/recommendationService';
import { useRecommendationActions } from '../../hooks/useRecommendationActions';

interface RecommendationsCarouselProps {
    userId?: string;
    limit?: number;
    autoAdvanceInterval?: number;
    onViewAll?: () => void;
    isPublic?: boolean;
    onItemsChange?: (ids: string[]) => void;
    showAutoAdvanceToggle?: boolean;
}

const RecommendationsCarousel: React.FC<RecommendationsCarouselProps> = ({
    userId,
    limit = 5,
    autoAdvanceInterval = 5000,
    onViewAll,
    isPublic = false,
    onItemsChange,
    showAutoAdvanceToggle = false,
}) => {
    // enforce UI requirement: display between 3 and 5 suggestions only
    const safeLimit = Math.max(3, Math.min(limit, 5));
    const [items, setItems] = useState<RecommendationItemWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [error, setError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartX, setDragStartX] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [isAutoAdvancePaused, setIsAutoAdvancePaused] = useState(false);
    const carouselRef = useRef<HTMLDivElement>(null);
    const autoAdvanceRef = useRef<number | null>(null);
    const didDragRef = useRef(false);
    const reloadAttemptsRef = useRef(0);
    const MAX_RELOAD_ATTEMPTS = 10; // Increased to ensure cards are always filled

    const { handleSave, handleLike, handleHide, canInteract } = useRecommendationActions({
        userId: isPublic ? undefined : userId,
        onInvalidate: () => {
            if (userId) {
                setReloadKey(k => k + 1);
            }
        }
    });

    // Auto-reload when too few items are available so freshly aggregated
    // content is picked up. Retry with increasing delay until we have enough
    // cards or exhaust all attempts.
    useEffect(() => {
        if (loading || error) return;
        if (items.length < safeLimit && reloadAttemptsRef.current < MAX_RELOAD_ATTEMPTS) {
            reloadAttemptsRef.current += 1;
            const delay = 1500 * reloadAttemptsRef.current;
            const t = setTimeout(() => setReloadKey(k => k + 1), delay);
            return () => clearTimeout(t);
        }
    }, [items.length, loading, error, safeLimit]);

    // Fetch recommendations
    useEffect(() => {
        const fetchRecommendations = async () => {
            setLoading(true);
            setError(false);
            try {
                let data: RecommendationContent[] = [];
                if (isPublic) {
                    data = await recommendationService.getPublicRecommendations(safeLimit);
                } else if (userId) {
                    data = await recommendationService.getRecommendations(
                        { category: 'recommended', limit: safeLimit, requiredCount: safeLimit, fallbackOnEmpty: true },
                        userId,
                    );
                }
                const validItems = (data as RecommendationItemWithStatus[]).filter(
                    item => item.title && item.sourceUrl && item.title.trim() && item.sourceUrl.trim()
                );
                const initialItems = validItems.slice(0, safeLimit).map(item => ({
                    ...item,
                    isSaved: !!item.isSaved,
                    isLiked: !!item.isLiked,
                }));
                setItems(initialItems);
                if (onItemsChange) onItemsChange(initialItems.map(i => i.id));
            } catch (error) {
                console.error('Error fetching carousel recommendations:', error);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (isPublic || userId) {
            fetchRecommendations();
        } else {
            setLoading(false);
        }
    }, [userId, limit, isPublic, reloadKey]);

    // Keep currentIndex within bounds when items shrink (e.g., after hiding an item)
    // without this, the carousel could point to a blank slide.
    useEffect(() => {
        setCurrentIndex(prev => (items.length === 0 ? 0 : Math.min(prev, items.length - 1)));
    }, [items.length]);

    // Reset didDragRef when drag state changes to prevent stale state
    useEffect(() => {
        if (!isDragging) {
            didDragRef.current = false;
        }
    }, [isDragging]);

    // Auto advance
    const resetAutoAdvance = useCallback(() => {
        if (autoAdvanceRef.current) {
            clearInterval(autoAdvanceRef.current);
            autoAdvanceRef.current = null;
        }
        if (items.length > 1 && !isDragging && !isAutoAdvancePaused) {
            autoAdvanceRef.current = window.setInterval(() => {
                setCurrentIndex(prev => (prev + 1) % items.length);
            }, autoAdvanceInterval);
        }
    }, [items.length, isDragging, autoAdvanceInterval, isAutoAdvancePaused]);

    useEffect(() => {
        resetAutoAdvance();
        return () => {
            if (autoAdvanceRef.current) {
                clearInterval(autoAdvanceRef.current);
            }
        };
    }, [resetAutoAdvance]);

    // Navigation handlers
    const goToPrevious = useCallback(() => {
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
        resetAutoAdvance();
    }, [items.length, resetAutoAdvance]);

    const goToNext = useCallback(() => {
        setCurrentIndex(prev => (prev + 1) % items.length);
        resetAutoAdvance();
    }, [items.length, resetAutoAdvance]);

    const goToIndex = useCallback((index: number) => {
        setCurrentIndex(index);
        resetAutoAdvance();
    }, [resetAutoAdvance]);

    // Drag handlers for touch and mouse
    const handleDragStart = useCallback((clientX: number) => {
        didDragRef.current = false;
        setIsDragging(true);
        setDragStartX(clientX);
        setDragOffset(0);
        if (autoAdvanceRef.current) {
            clearInterval(autoAdvanceRef.current);
            autoAdvanceRef.current = null;
        }
    }, []);

    const handleDragMove = useCallback((clientX: number) => {
        if (!isDragging) return;
        const offset = clientX - dragStartX;
        if (Math.abs(offset) > 5) didDragRef.current = true;
        setDragOffset(offset);
    }, [isDragging, dragStartX]);

    const handleDragEnd = useCallback(() => {
        if (!isDragging) return;
        setIsDragging(false);

        const threshold = 50;
        if (dragOffset > threshold) {
            goToPrevious();
        } else if (dragOffset < -threshold) {
            goToNext();
        }

        setDragOffset(0);
        resetAutoAdvance();
    }, [isDragging, dragOffset, goToPrevious, goToNext, resetAutoAdvance]);

    // Ensure drag-end is detected even if mouse/touch ends outside the element
    useEffect(() => {
        const onUp = () => {
            if (isDragging) handleDragEnd();
        };
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchend', onUp);
        return () => {
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchend', onUp);
        };
    }, [isDragging, handleDragEnd]);

    const onTouchStart = (e: React.TouchEvent) => {
        handleDragStart(e.touches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        handleDragMove(e.touches[0].clientX);
    };

    const onTouchEnd = () => {
        handleDragEnd();
    };

    const onMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        handleDragMove(e.clientX);
    };

    const onMouseUp = () => {
        handleDragEnd();
    };

    const onMouseLeave = () => {
        if (isDragging) {
            handleDragEnd();
        }
    };

    // Requirement: this section must NOT remain as a fixed/empty frame on the
    // page. It stays hidden while loading, on error, or when there is no
    // content, and only appears once real recommendations are available.
    // The fetch/auto-reload effects still run (they don't depend on render),
    // so content will pop in automatically as soon as it is fetched.
    if (loading) return null;

    if (error) {
        return (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        <span className="text-sm text-red-700 dark:text-red-300">تعذر تحميل الاقتراحات. يرجى التحقق من الاتصال والمحاولة مرة أخرى.</span>
                    </div>
                    <button
                        onClick={() => setReloadKey(k => k + 1)}
                        className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md hover:scale-[1.03] active:scale-[0.97]"
                    >
                        🔄 إعادة المحاولة
                    </button>
                </div>
            </div>
        );
    }

    // Show skeleton while auto-reloading to fill cards.
    // The backend guarantees filled cards, but we show a loading state
    // instead of hiding the entire section so users see feedback.
    if (items.length === 0 && reloadAttemptsRef.current < MAX_RELOAD_ATTEMPTS) {
        return (
            <div className="bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 sm:p-6 shadow-sm">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary-500" />
                    {isPublic ? 'محتوى موصى به' : 'مقترحات لك'}
                </h2>
                <div className="flex gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
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
        <div className="bg-gradient-to-l from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-4 sm:p-6 shadow-sm border border-blue-100/50 dark:border-blue-800/30">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary-500" />
                    {isPublic ? 'محتوى موصى به' : 'مقترحات لك'}
                </h2>
                {onViewAll && (
                    <button
                        onClick={onViewAll}
                        className="text-sm font-semibold text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 flex items-center gap-1.5 transition-all duration-200 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:shadow-md hover:scale-[1.03] active:scale-[0.97]"
                    >
                        عرض جميع الاقتراحات
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="relative">
                {/* Carousel Container */}
                <div
                    ref={carouselRef}
                    className="relative overflow-hidden rounded-lg"
                    tabIndex={0}
                    role="group"
                    aria-roledescription="carousel"
                    aria-label={isPublic ? 'محتوى موصى به' : 'مقترحات لك'}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowRight') {
                            e.preventDefault();
                            goToNext();
                        } else if (e.key === 'ArrowLeft') {
                            e.preventDefault();
                            goToPrevious();
                        }
                    }}
                    onClickCapture={(e) => {
                        if (didDragRef.current) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseLeave}
                >
                    <div
                        className="flex transition-transform duration-500 ease-out"
                        style={{
                            direction: 'ltr',
                            transform: `translateX(calc(${currentIndex * 100}% - ${dragOffset}px))`,
                            cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                    >
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="w-full flex-shrink-0 min-w-full px-1"
                            >
                                <RecommendationCard
                                    content={item}
                                    compact
                                    isPublic={isPublic}
                                    isSaved={item.isSaved}
                                    isLiked={item.isLiked}
                                    onOpen={(content) => {
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
                                            ).catch(() => { });
                                        }
                                        window.open(content.sourceUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    onSave={canInteract ? async (contentId) => {
                                        await handleSave(contentId, items, setItems);
                                    } : undefined}
                                    onLike={canInteract ? async (contentId) => {
                                        await handleLike(contentId, items, setItems);
                                    } : undefined}
                                    onHide={canInteract ? async (contentId) => {
                                        await handleHide(contentId, items, setItems, () => setReloadKey(k => k + 1));
                                    } : undefined}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation Arrows */}
                {items.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all duration-200 hover:scale-110 active:scale-90 hover:shadow-xl"
                            aria-label="السابق"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToNext(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all duration-200 hover:scale-110 active:scale-90 hover:shadow-xl"
                            aria-label="التالي"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </button>
                        {showAutoAdvanceToggle && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsAutoAdvancePaused(prev => !prev);
                                }}
                                className="absolute top-2 right-2 z-10 p-2.5 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-lg hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-all duration-200 hover:scale-110 active:scale-90"
                                aria-label={isAutoAdvancePaused ? 'تشغيل التقدم التلقائي' : 'إيقاف التقدم التلقائي'}
                                title={isAutoAdvancePaused ? 'تشغيل التقدم التلقائي' : 'إيقاف التقدم التلقائي'}
                            >
                                {isAutoAdvancePaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                            </button>
                        )}
                    </>
                )}

                {/* Dots Indicator */}
                {items.length > 1 && (
                    <div className="flex items-center justify-center gap-2.5 mt-5">
                        {items.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => goToIndex(index)}
                                className={`
                                    w-3 h-3 rounded-full transition-all duration-300 hover:scale-125
                                    ${index === currentIndex
                                        ? 'bg-primary-600 w-8 shadow-md shadow-primary-500/30'
                                        : 'bg-brown-300 dark:bg-brown-600 hover:bg-brown-400 dark:hover:bg-brown-500'
                                    }
                                `}
                                aria-label={`الذهاب إلى الاقتراح ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecommendationsCarousel;
