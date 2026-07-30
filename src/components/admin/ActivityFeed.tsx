import React, { useMemo } from 'react';
import {
    Activity,
    Upload,
    UserPlus as UserRegister,
    School,
    Building,
    GraduationCap,
    FileText,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Activity as ActivityType } from '../../services/dataService';

interface ActivityFeedProps {
    activities: ActivityType[];
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onClearActivities: () => void;
    hasMore: boolean;
}

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; dot: string; bgGradient: string }> = {
    file_upload: { icon: Upload, color: 'text-blue-600', dot: 'bg-blue-500', bgGradient: 'from-blue-50 to-blue-100/60' },
    user_register: { icon: UserRegister, color: 'text-green-600', dot: 'bg-green-500', bgGradient: 'from-green-50 to-green-100/60' },
    university_add: { icon: School, color: 'text-purple-600', dot: 'bg-purple-500', bgGradient: 'from-purple-50 to-purple-100/60' },
    college_add: { icon: Building, color: 'text-orange-600', dot: 'bg-orange-500', bgGradient: 'from-orange-50 to-orange-100/60' },
    major_add: { icon: GraduationCap, color: 'text-teal-600', dot: 'bg-teal-500', bgGradient: 'from-teal-50 to-teal-100/60' },
    course_add: { icon: FileText, color: 'text-pink-600', dot: 'bg-pink-500', bgGradient: 'from-pink-50 to-pink-100/60' },
};

const DEFAULT_ACTIVITY_ICON = { icon: Activity, color: 'text-neutral-600', dot: 'bg-neutral-500', bgGradient: 'from-neutral-50 to-neutral-100/60' };

const ActivityFeed: React.FC<ActivityFeedProps> = ({
    activities,
    isLoadingMore,
    onLoadMore,
    onClearActivities,
    hasMore,
}) => {
    const { t } = useTranslation();
    const iconConfig = useMemo(() => ACTIVITY_ICONS, []);

    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-neutral-200/60 shadow-lg shadow-neutral-200/50 p-4 sm:p-6 lg:p-8 hover:shadow-xl hover:shadow-neutral-300/50 transition-all duration-300">
            <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center text-neutral-800">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-l from-primary-600 to-primary-700 text-white ml-2 shadow-md shadow-primary-500/20">
                    <Activity className="h-4 w-4" />
                </div>
                {t('admin.latestActivities')}
                <span className="mr-auto text-xs font-medium text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                    {activities.length} {t('admin.activityCount')}
                </span>
            </h2>
            <div className="space-y-2">
                {activities.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                            <Activity className="h-8 w-8 text-neutral-300" />
                        </div>
                        <p className="text-neutral-500 font-medium">{t('admin.noActivities')}</p>
                        <p className="text-xs text-neutral-400 mt-1">{t('admin.activitiesAppearHere')}</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Vertical line connector */}
                        <div className="absolute right-4 top-3 bottom-3 w-0.5 bg-gradient-to-b from-neutral-200 via-neutral-100 to-transparent hidden sm:block"></div>
                        {activities.map((activity, index) => {
                            const config = iconConfig[activity.type] || DEFAULT_ACTIVITY_ICON;
                            const IconComponent = config.icon;
                            const isRecent = Date.now() - activity.timestamp < 24 * 60 * 60 * 1000;

                            return (
                                <div
                                    key={activity.id}
                                    className={`relative flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl hover:bg-gradient-to-l ${config.bgGradient} transition-all duration-200 group ${index === 0 ? 'animate-fade-in-up' : ''}`}
                                >
                                    {/* Icon circle with dot indicator */}
                                    <div className="relative z-10 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border-2 border-neutral-200 shadow-sm group-hover:shadow-md transition-shadow shrink-0">
                                        <IconComponent className={`h-4 w-4 sm:h-5 sm:w-5 ${config.color}`} />
                                        <div className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 ${config.dot} rounded-full border-2 border-white`}></div>
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-neutral-800 truncate">
                                                {activity.title}
                                                {activity.userName && (
                                                    <span className="text-neutral-500 font-normal"> — {activity.userName}</span>
                                                )}
                                            </p>
                                            {isRecent && (
                                                <span className="shrink-0 px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full animate-pulse">
                                                    {t('activity.new')}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-1 truncate">{activity.description}</p>
                                        <span className="text-[10px] text-neutral-400 mt-1.5 block font-medium">
                                            {new Date(activity.timestamp).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Load More & Clear Buttons */}
            {activities.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100">
                    <button
                        onClick={onClearActivities}
                        className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 rounded-xl transition-all duration-200 shadow-sm shadow-red-500/20 hover:shadow-md hover:shadow-red-500/30 hover:-translate-y-0.5 active:scale-[0.97]"
                    >
                        {t('admin.clearAllActivities')}
                    </button>
                    {hasMore && (
                        <button
                            onClick={onLoadMore}
                            disabled={isLoadingMore}
                            className="px-4 py-2 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-sm"
                        >
                            {isLoadingMore ? t('common.loading') : t('admin.loadMore')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ActivityFeed;
