import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CategorySection from '../components/recommendations/CategorySection';
import RecommendationsCarousel from '../components/recommendations/RecommendationsCarousel';
import RecommendationCard from '../components/recommendations/RecommendationCard';
import { recommendationService } from '../services/recommendationService';
import { ContentCategory, RecommendationStats, RecommendationContent, RecommendationItemWithStatus } from '../types';
import { useAppStore } from '../stores/appStore';
import { Heart, Star, Lock, Search, Pin, Laptop, Brain, HeartPulse, Settings, BookOpen, FileText, GraduationCap, Briefcase, Trophy, Flame } from 'lucide-react';

interface CategoryInfo {
    key: ContentCategory;
    label: string;
    icon: React.ElementType;
    color: string;
}

const RecommendationsPage = () => {
    const { t, i18n } = useTranslation();
    const { currentUser } = useAppStore();
    const [activeCategory, setActiveCategory] = useState<ContentCategory>('recommended');
    const [stats, setStats] = useState<RecommendationStats | null>(null);
    const [carouselIds, setCarouselIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<(RecommendationContent & { isSaved?: boolean; isLiked?: boolean })[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    const userId = currentUser?.id || '';
    const isPublic = !currentUser;

    const CATEGORIES: CategoryInfo[] = [
        { key: 'recommended', label: t('recommendations.categoryRecommended'), icon: Star, color: 'text-yellow-500' },
        { key: 'tech', label: t('recommendations.categoryTech'), icon: Laptop, color: 'text-blue-500' },
        { key: 'ai', label: t('recommendations.categoryAi'), icon: Brain, color: 'text-violet-500' },
        { key: 'medical', label: t('recommendations.categoryMedical'), icon: HeartPulse, color: 'text-rose-500' },
        { key: 'engineering', label: t('recommendations.categoryEngineering'), icon: Settings, color: 'text-slate-500' },
        { key: 'free_courses', label: t('recommendations.categoryFreeCourses'), icon: BookOpen, color: 'text-emerald-500' },
        { key: 'news', label: t('recommendations.categoryNews'), icon: FileText, color: 'text-sky-500' },
        { key: 'research', label: t('recommendations.categoryResearch'), icon: FileText, color: 'text-amber-500' },
        { key: 'scholarships', label: t('recommendations.categoryScholarships'), icon: GraduationCap, color: 'text-indigo-500' },
        { key: 'training', label: t('recommendations.categoryTraining'), icon: Briefcase, color: 'text-teal-500' },
        { key: 'competitions', label: t('recommendations.categoryCompetitions'), icon: Trophy, color: 'text-orange-500' },
        { key: 'popular', label: t('recommendations.categoryPopular'), icon: Flame, color: 'text-red-500' },
        { key: 'saved', label: t('recommendations.categorySaved'), icon: Heart, color: 'text-pink-500' },
    ];

    // Onboarding fallback: when user signals are insufficient, switch to general-smart mode.
    // Rule: hasEnoughSignals if totalPoints >= 5 OR savedCount > 0 OR topInterests not empty.
    const signalsThreshold = 3; // IMPROVEMENT: Lower threshold to 3 points for better user segmentation
    const hasEnoughSignals =
        !!stats &&
        (stats.totalPoints >= signalsThreshold ||
            stats.savedCount > 0 ||
            (stats.topInterests?.length || 0) > 0);

    // IMPROVEMENT: Better user segmentation with more granular categories
    const userType =
        !currentUser ? 'guest' : // No authentication
            hasEnoughSignals ? 'active' : // Has sufficient activity signals
                stats?.totalPoints === 0 && stats?.savedCount === 0 && !(stats?.topInterests?.length) ? 'new' : // New user with zero activity
                    'casual'; // Has some activity but below threshold

    const showGeneralSmartForUser = userType === 'new';

    // IMPROVEMENT: Enhanced educational content for empty states
    const getEmptyStateContent = () => {
        if (!currentUser) {
            return {
                title: t('recommendations.joinNow'),
                description: t('recommendations.exploreInterests'),
                actionText: t('recommendations.joinNow'),
                actionPath: '/login'
            };
        }

        if (userType === 'new') {
            return {
                title: t('recommendations.exploreInterests'),
                description: t('recommendations.personalizedContentBasedOnInterests'),
                actionText: t('recommendations.startExploring'),
                actionPath: '/recommendations'
            };
        }

        return {
            title: t('recommendations.noNewRecommendations'),
            description: t('recommendations.hiddenAllRecommendations'),
            actionText: t('recommendations.browseCategories'),
            actionPath: '/recommendations'
        };
    };

    // Effective public mode: if user is in onboarding, use public/general content (without saved).
    const effectiveIsPublic = isPublic || showGeneralSmartForUser;

    useEffect(() => {
        // SEO meta tags for recommendations page - language aware
        if (isPublic) {
            document.title = t('recommendations.seoTitle');
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', t('recommendations.seoDescription'));
        }
        return () => {
            document.title = t('recommendations.seoDefaultTitle');
        };
    }, [isPublic, t]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        recommendationService.getStats(userId).then((stats) => {
            if (!cancelled) setStats(stats);
        });
        return () => { cancelled = true; };
    }, [userId]);

    // Search recommendations
    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        setIsSearching(true);
        try {
            const results = await recommendationService.getRecommendations(
                { category: activeCategory, limit: 20, requiredCount: 20, fallbackOnEmpty: true, searchQuery: searchQuery.trim(), preferredLanguage: i18n.language },
                userId || undefined
            );
            setSearchResults(results);
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults(null);
    };

    // Force experience into "recommended" when in general-smart onboarding mode.
    useEffect(() => {
        if (showGeneralSmartForUser) {
            setActiveCategory('recommended');
        }
    }, [showGeneralSmartForUser]);

    const handleViewAll = (category: ContentCategory) => {
        setActiveCategory(category);
        setSearchResults(null);
        setSearchQuery('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Filter categories for public view (hide saved)
    const publicCategories = CATEGORIES.filter(cat => cat.key !== 'saved');

    const activeCatInfo = CATEGORIES.find(c => c.key === activeCategory);

    return (
         <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-[#0F172A] dark:via-[#1E40AF]/10 dark:to-[#0F172A] p-4 sm:p-6 space-y-6" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-500 flex items-center justify-center shadow-lg shadow-primary-500/20 animate-fade-in">
                        <Pin className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-300 dark:to-blue-100 bg-clip-text text-transparent">
                            {isPublic ? t('recommendations.recommendedContent') : t('recommendations.suggestions')}
                        </h1>
                        <p className="text-slate-600 dark:text-blue-200/70 mt-0.5">
                            {isPublic
                                ? t('recommendations.publicDescription')
                                : t('recommendations.personalizedDescription')}
                        </p>
                    </div>
                </div>

                {/* Stats - only for logged-in users */}
                {stats && !isPublic && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-blue-200/80 bg-white/60 dark:bg-[#0F172A]/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-blue-400/20 transition-all duration-200 hover:shadow-md">
                            <Star className="h-4 w-4 text-yellow-500 animate-gentle-pulse" />
                             <span className="font-medium">{stats.totalPoints} {t('recommendations.points')}</span>
                         </div>
                         <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-blue-200/80 bg-white/60 dark:bg-[#0F172A]/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-blue-400/20 transition-all duration-200 hover:shadow-md">
                             <Heart className="h-4 w-4 text-red-500" />
                             <span className="font-medium">{stats.savedCount} {t('recommendations.saved')}</span>
                         </div>
                    </div>
                )}
                {isPublic && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-blue-200/60 bg-white/60 dark:bg-[#0F172A]/60 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-200 dark:border-blue-400/20">
                        <Lock className="h-4 w-4" />
                         <span>{t('recommendations.loginForPersonalized')}</span>
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-blue-300/50" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                         placeholder={t('recommendations.searchPlaceholder')}
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 dark:border-blue-400/20 bg-white/80 dark:bg-[#0F172A]/60 backdrop-blur-sm text-slate-900 dark:text-blue-100 placeholder-slate-400 dark:placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/50 focus:border-transparent transition-all duration-200"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-6 py-3 rounded-xl bg-gradient-to-l from-primary-700 via-primary-600 to-secondary-500 text-white font-semibold text-base hover:shadow-lg hover:shadow-primary-500/30 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                     {isSearching ? t('recommendations.searching') : '🔍 ' + t('recommendations.search')}
                </button>
                {searchQuery && (
                    <button
                        onClick={clearSearch}
                        className="px-5 py-3 rounded-xl border border-slate-200 dark:border-blue-400/20 text-slate-600 dark:text-blue-200/80 hover:bg-slate-100 dark:hover:bg-[#1E40AF]/20 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 font-medium text-sm"
                    >
                         {t('recommendations.clear')}
                    </button>
                )}
            </div>

            {/* Carousel for recommended */}
            <RecommendationsCarousel
                userId={userId}
                limit={5}
                autoAdvanceInterval={5000}
                onViewAll={() => handleViewAll('recommended')}
                isPublic={isPublic}
                onItemsChange={setCarouselIds}
                showAutoAdvanceToggle={!isPublic}
            />

            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2">
                {(effectiveIsPublic ? publicCategories : CATEGORIES).map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => setActiveCategory(cat.key as ContentCategory)}
                        className={`
                            px-5 py-3 rounded-xl font-semibold transition-all duration-200 text-sm sm:text-base flex items-center gap-2
                            ${activeCategory === cat.key
                                ? 'bg-gradient-to-l from-primary-700 via-primary-600 to-secondary-500 text-white shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.04] active:scale-[0.96]'
                                : 'bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-sm text-slate-700 dark:text-blue-200/80 border border-slate-200 dark:border-blue-400/20 hover:bg-slate-100 dark:hover:bg-[#1E40AF]/20 hover:shadow-md hover:scale-[1.03] active:scale-[0.97]'
                            }
                        `}
                    >
                        <cat.icon className={`h-5 w-5 ${activeCategory === cat.key ? 'text-white' : cat.color}`} />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Active Category Content */}
            {/* Search Results */}
            {searchResults !== null && (
                <div className="mb-6">
                     <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                         <Search className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                         {t('recommendations.searchResults', { query: searchQuery, count: searchResults.length })}
                     </h3>
                    {/* No empty state - backend guarantees results via fallback categories */}
                    {searchResults.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {searchResults.map((item, index) => (
                                <div key={item.id} className={`animate-card-stagger stagger-${Math.min(index + 1, 10)}`}>
                                    <RecommendationCard
                                        content={item}
                                        isSaved={!!('isSaved' in item && item.isSaved)}
                                        isLiked={!!('isLiked' in item && item.isLiked)}
                                        isPublic={effectiveIsPublic}
                                        onOpen={(content) => window.open(content.sourceUrl, '_blank', 'noopener,noreferrer')}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Category Content - only show when not searching */}
            {searchResults === null && (
                <>
                    {activeCategory === 'saved' && isPublic ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                             <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t('recommendations.saved')}</h3>
                             <p className="text-gray-600 dark:text-gray-300">{t('recommendations.loginToViewSaved')}</p>
                        </div>
                    ) : activeCategory === 'recommended' ? (
                        <CategorySection
                            userId={userId}
                            category="recommended"
                             title={t('recommendations.categoryRecommended')}
                            icon={Star}
                            limit={20}
                            requiredCount={20}
                            onViewAll={handleViewAll}
                            isPublic={effectiveIsPublic}
                            excludeIds={carouselIds}
                        />
                    ) : (
                        <CategorySection
                            userId={userId}
                            category={activeCategory}
                            title={activeCatInfo?.label || activeCategory}
                            icon={activeCatInfo?.icon}
                            limit={20}
                            requiredCount={20}
                            onViewAll={handleViewAll}
                            isPublic={effectiveIsPublic}
                            excludeIds={carouselIds}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default RecommendationsPage;
