import { useEffect, useState, useRef } from 'react';
import {
    Users,
    FileText,
    MessageSquare,
    MessageCircle,
    BookOpen,
    Activity,
    TrendingUp,
    Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { onValue, ref, query, limitToLast, off } from 'firebase/database';
import { database } from '../firebase/config';
import { AnalyticsData, ActivityItem } from '../utils/analyticsTracker';
import { getStatistics } from '../services/dataService';
import { getTotalFileCount } from '../services/courseFilesService';

// Event type labels
const eventTypeLabels: Record<string, string> = {
    user_registered: 'analytics.userRegistered',
    file_uploaded: 'analytics.fileUploaded',
    discussion_created: 'analytics.discussionCreated',
    message_sent: 'analytics.messageSent',
    course_entered: 'analytics.courseEntered'
};

// Event type icons
const eventTypeIcons: Record<string, React.ElementType> = {
    user_registered: Users,
    file_uploaded: FileText,
    discussion_created: MessageSquare,
    message_sent: MessageCircle,
    course_entered: BookOpen
};

// Event type colors
const eventTypeColors: Record<string, string> = {
    user_registered: 'bg-blue-500',
    file_uploaded: 'bg-green-500',
    discussion_created: 'bg-purple-500',
    message_sent: 'bg-yellow-500',
    course_entered: 'bg-indigo-500'
};

// Animated number component
const AnimatedNumber: React.FC<{ value: number; pulse?: boolean }> = ({ value, pulse }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isPulsing, setIsPulsing] = useState(false);
    const prevValue = useRef(value);

    useEffect(() => {
        if (prevValue.current !== value) {
            // Animate the number change
            const diff = value - prevValue.current;
            const steps = Math.min(Math.abs(diff), 10);
            const increment = diff / steps;
            let current = prevValue.current;

            const interval = setInterval(() => {
                current += increment;
                if ((increment > 0 && current >= value) || (increment < 0 && current <= value)) {
                    setDisplayValue(value);
                    clearInterval(interval);
                } else {
                    setDisplayValue(Math.round(current));
                }
            }, 50);

            // Pulse effect
            if (pulse) {
                setIsPulsing(true);
                setTimeout(() => setIsPulsing(false), 600);
            }

            prevValue.current = value;
            return () => clearInterval(interval);
        }
    }, [value, pulse]);

    return (
        <span className={`${isPulsing ? 'animate-pulse' : ''} transition-all duration-300`}>
            {displayValue.toLocaleString('en-US')}
        </span>
    );
};

// Stat card component
interface StatCardProps {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    pulse?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, color, bgColor, pulse }) => {
    return (
        <div className={`
            relative overflow-hidden rounded-xl p-6
            bg-white border border-gray-100 shadow-sm
            hover:shadow-md transition-shadow duration-300
            ${pulse ? 'ring-2 ring-primary-400 ring-opacity-50' : ''}
        `}>
            {/* Background decoration */}
            <div className={`absolute -left-4 -top-4 w-24 h-24 rounded-full ${bgColor} opacity-10`}></div>

            <div className="relative flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
                    <p className={`text-3xl font-bold ${color}`}>
                        <AnimatedNumber value={value} pulse={pulse} />
                    </p>
                </div>
                <div className={`p-3 rounded-lg ${bgColor}`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </div>
    );
};

// Activity item component
const ActivityFeedItem: React.FC<{ activity: ActivityItem }> = ({ activity }) => {
    const { t } = useTranslation();
    const Icon = eventTypeIcons[activity.type] || Activity;
    const colorClass = eventTypeColors[activity.type] || 'bg-gray-500';

    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return t('analytics.now');
        if (seconds < 3600) return `${Math.floor(seconds / 60)} ${t('analytics.minutesAgo', { minutes: Math.floor(seconds / 60) })}`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ${t('analytics.hoursAgo', { hours: Math.floor(seconds / 3600) })}`;
        return `${Math.floor(seconds / 86400)} ${t('analytics.daysAgo', { days: Math.floor(seconds / 86400) })}`;
    };

    const getPayloadText = () => {
        const payload = activity.payload;
        if (!payload) return '';

        switch (activity.type) {
            case 'user_registered':
                return payload.userName || t('analytics.userRegistered');
            case 'file_uploaded':
                return payload.fileName || t('analytics.fileUploaded');
            case 'discussion_created':
                return payload.discussionTitle || t('analytics.discussionCreated');
            case 'message_sent':
                return payload.userName || t('analytics.messageSent');
            case 'course_entered':
                return payload.courseName || t('analytics.courseEntered');
            default:
                return '';
        }
    };

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className={`p-2 rounded-full ${colorClass}`}>
                <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                    {t(eventTypeLabels[activity.type] || activity.type)}
                </p>
                <p className="text-xs text-gray-500 truncate">
                    {getPayloadText()}
                </p>
            </div>
            <div className="flex items-center text-xs text-gray-400">
                <Clock className="h-3 w-3 ml-1" />
                {timeAgo(activity.timestamp)}
            </div>
        </div>
    );
};

// Main Analytics Page
const AnalyticsPage: React.FC = () => {
    const { t } = useTranslation();
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalUsers: 0,
        totalFiles: 0,
        totalDiscussions: 0,
        totalMessages: 0,
        activeCourses: 0,
        lastActivityTimestamp: 0
    });
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newDataPulse, setNewDataPulse] = useState(false);
    const prevAnalyticsRef = useRef<AnalyticsData | null>(null);
    // Authoritative headline stats from Firestore (consistent with the Admin Dashboard)
    const [fsStats, setFsStats] = useState({ totalUsers: 0, totalFiles: 0, activeCourses: 0 });
    // Live counts from Realtime DB - these are more reliable than the /analytics counters
    // because they are calculated directly from the data nodes and updated for all users.
    const [discussionsCount, setDiscussionsCount] = useState(0);
    const [messagesCount, setMessagesCount] = useState(0);

    useEffect(() => {
        // Subscribe to analytics data (admin-only counters in Realtime DB)
        const analyticsRef = ref(database, 'analytics');
        const unsubscribeAnalytics = onValue(analyticsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val() as AnalyticsData;

                // Check if data changed (for pulse effect)
                if (prevAnalyticsRef.current) {
                    const hasChanged = Object.keys(data).some(
                        key => data[key as keyof AnalyticsData] !== prevAnalyticsRef.current?.[key as keyof AnalyticsData]
                    );
                    if (hasChanged) {
                        setNewDataPulse(true);
                        setTimeout(() => setNewDataPulse(false), 600);
                    }
                }

                prevAnalyticsRef.current = data;
                setAnalytics(data);
            }
            setIsLoading(false);
        });

        // Subscribe to activity feed (last 20 items)
        const activityRef = ref(database, 'activityFeed');
        const activityQuery = query(activityRef, limitToLast(20));

        const unsubscribeActivity = onValue(activityQuery, (snapshot) => {
            if (snapshot.exists()) {
                const activitiesList: ActivityItem[] = [];
                snapshot.forEach((childSnapshot) => {
                    activitiesList.push(childSnapshot.val() as ActivityItem);
                });
                // Sort by timestamp descending (newest first)
                setActivities(activitiesList.reverse());
            }
        });

        // Subscribe to live discussion count directly from the discussions node
        // This is more reliable than the /analytics counter which is only updated by admins.
        const discussionsRef = ref(database, 'discussions');
        const unsubscribeDiscussions = onValue(discussionsRef, (snapshot) => {
            let count = 0;
            if (snapshot.exists()) {
                snapshot.forEach(() => { count++; });
            }
            setDiscussionsCount(count);
        });

        // Subscribe to live message count directly from the chat node
        // Count messages across all course chat rooms.
        const chatRef = ref(database, 'chat');
        const unsubscribeChat = onValue(chatRef, (snapshot) => {
            let count = 0;
            if (snapshot.exists()) {
                snapshot.forEach((courseSnap) => {
                    if (courseSnap.exists()) {
                        courseSnap.forEach(() => { count++; });
                    }
                });
            }
            setMessagesCount(count);
        });

        return () => {
            off(analyticsRef);
            off(activityRef);
            off(discussionsRef);
            off(chatRef);
            unsubscribeAnalytics();
            unsubscribeActivity();
            unsubscribeDiscussions();
            unsubscribeChat();
        };
    }, []);

    // Load authoritative headline stats (users / files / active courses) from Firestore so they
    // match the Admin Dashboard and reflect real totals instead of the admin-only counters.
    useEffect(() => {
        const loadFirestoreStats = async () => {
            try {
                const fileCount = await getTotalFileCount();
                const stats = await getStatistics(fileCount);
                setFsStats({
                    totalUsers: stats.totalUsers,
                    totalFiles: stats.totalFiles,
                    activeCourses: stats.totalCourses,
                });
            } catch (error) {
                console.warn('Could not load Firestore stats:', error);
            }
        };
        loadFirestoreStats();
    }, []);

    // Calculate total activity using live counts from real data sources
    const totalActivity = fsStats.totalUsers + fsStats.totalFiles +
        discussionsCount + messagesCount;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">{t('analytics.loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary-100 rounded-lg">
                                <Activity className="h-8 w-8 text-primary-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{t('analytics.title')}</h1>
                                <p className="text-sm text-gray-500">{t('analytics.subtitle')}</p>
                            </div>
                        </div>

                        {/* Live indicator */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-full">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium text-green-700">{t('analytics.live')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                    <StatCard
                        title={t('analytics.totalUsers')}
                        value={fsStats.totalUsers}
                        icon={Users}
                        color="text-blue-600"
                        bgColor="bg-blue-500"
                        pulse={newDataPulse}
                    />
                    <StatCard
                        title={t('analytics.totalFiles')}
                        value={fsStats.totalFiles}
                        icon={FileText}
                        color="text-green-600"
                        bgColor="bg-green-500"
                        pulse={newDataPulse}
                    />
                    <StatCard
                        title={t('analytics.totalDiscussions')}
                        value={discussionsCount}
                        icon={MessageSquare}
                        color="text-purple-600"
                        bgColor="bg-purple-500"
                        pulse={newDataPulse}
                    />
                    <StatCard
                        title={t('analytics.totalMessages')}
                        value={messagesCount}
                        icon={MessageCircle}
                        color="text-yellow-600"
                        bgColor="bg-yellow-500"
                        pulse={newDataPulse}
                    />
                    <StatCard
                        title={t('analytics.activeCourses')}
                        value={fsStats.activeCourses}
                        icon={BookOpen}
                        color="text-indigo-600"
                        bgColor="bg-indigo-500"
                        pulse={newDataPulse}
                    />
                </div>

                {/* Activity Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-primary-600" />
                                <h2 className="text-lg font-semibold text-gray-900">{t('analytics.recentActivity')}</h2>
                            </div>
                            <span className="text-sm text-gray-500">
                                {t('analytics.lastEvents', { count: activities.length })}
                            </span>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            {activities.length > 0 ? (
                                <div className="space-y-2">
                                    {activities.map((activity, index) => (
                                        <div
                                            key={activity.id || index}
                                            className={`
                                                animate-fade-in-up
                                            `}
                                            style={{
                                                animationDelay: `${index * 50}ms`,
                                                animationFillMode: 'both'
                                            }}
                                        >
                                            <ActivityFeedItem activity={activity} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-400">
                                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>{t('analytics.noActivityYet')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Panel */}
                    <div className="space-y-6">
                        {/* Total Activity */}
                        <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">{t('analytics.totalActivity')}</h3>
                                <Activity className="h-6 w-6 opacity-80" />
                            </div>
                            <p className="text-4xl font-bold">
                                <AnimatedNumber value={totalActivity} />
                            </p>
                            <p className="text-primary-100 text-sm mt-2">{t('analytics.eventsOnPlatform')}</p>
                        </div>

                        {/* Last Activity Time */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="h-5 w-5 text-gray-400" />
                                <h3 className="text-sm font-medium text-gray-700">{t('analytics.lastActivity')}</h3>
                            </div>
                            {analytics.lastActivityTimestamp ? (
                                <p className="text-gray-900 font-medium">
                                    {new Date(analytics.lastActivityTimestamp).toLocaleString(i18n.language === 'ar' ? 'ar-SA' : 'en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            ) : (
                                <p className="text-gray-400">{t('analytics.noActivity')}</p>
                            )}
                        </div>

                        {/* Quick Stats */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-sm font-medium text-gray-700 mb-4">{t('analytics.quickStats')}</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">{t('analytics.filesPerUser')}</span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {fsStats.totalUsers > 0
                                            ? (fsStats.totalFiles / fsStats.totalUsers).toFixed(1)
                                            : 0}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-500">{t('analytics.avgMessages')}</span>
                                    <span className="text-sm font-medium text-gray-900">
                                        {fsStats.totalUsers > 0
                                            ? (messagesCount / fsStats.totalUsers).toFixed(1)
                                            : 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS Animation */}
            <style>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default AnalyticsPage;
