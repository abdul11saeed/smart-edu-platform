import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    BarChart3,
    Download,
    MessageSquare,
    Users,
    TrendingUp,
    Activity,
    Flame,
    FileText,
    Clock,
    CalendarDays,
    PieChart,
    Award,
    ThumbsUp,
    MessageCircle,
    RefreshCw,
    AlertTriangle,
    Layers,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Card } from '../components/ui/Card';
import { SkeletonList, SkeletonCard } from '../components/ui/Skeleton';
import {
    HorizontalBarChart,
    VerticalBarsChart,
    AreaLineChart,
    DonutChart,
} from '../components/ui/charts';
import { getDashboardAnalytics, AdminAnalytics } from '../services/adminAnalyticsService';
import { formatNumberEn, formatFixedEn } from '../utils/formatNumbers';

// ---------- KPI Card ----------
interface KpiProps {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    bg: string;
    suffix?: string;
}
const KpiCard: React.FC<KpiProps> = ({ title, value, icon: Icon, color, bg, suffix }) => {
    return (
        <Card className="relative overflow-hidden">
            <div className={`absolute -left-4 -top-4 w-20 h-20 rounded-full ${bg} opacity-10`}></div>
            <div className="relative flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <p className={`text-2xl font-bold ${color}`}>{formatNumberEn(value)}{suffix}</p>
                </div>
                <div className={`p-3 rounded-lg ${bg}`}>
                    <Icon className="h-5 w-5 text-white" />
                </div>
            </div>
        </Card>
    );
};

// ---------- Section wrapper ----------
const Section: React.FC<{ title: string; icon: React.ElementType; subtitle?: string; children: React.ReactNode }> = ({
    title,
    icon: Icon,
    subtitle,
    children,
}) => (
    <Card>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="p-2 rounded-lg bg-primary-50 dark:bg-primary-900/30">
                <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                {subtitle ? <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p> : null}
            </div>
        </div>
        {children}
    </Card>
);

const initialData: AdminAnalytics = {
    kpis: {
        totalUsers: 0,
        totalFiles: 0,
        totalDownloads: 0,
        totalDiscussions: 0,
        totalComments: 0,
        totalLikes: 0,
        activeUsers: 0,
    },
    topCoursesByDownloads: [],
    topDiscussions: [],
    mostActiveUsers: [],
    fileTypeDistribution: [],
    peakHours: [],
    weekdayActivity: [],
    weeklyActivity: [],
    topColleges: [],
    generatedAt: 0,
};

const AdminReports: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [data, setData] = useState<AdminAnalytics>(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Use English locale for date formatting only
    const dateLocale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getDashboardAnalytics();
            setData(result);
        } catch (err) {
            console.error('[AdminReports] Failed to load analytics:', err);
            setError(t('adminReports.errorLoading'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        load();
    }, [load]);

    const peakHoursData = data.peakHours.map((v, i) => ({
        label: String(i),
        value: v,
    }));

    const busiestDay = [...data.weekdayActivity].sort((a, b) => b.count - a.count)[0];
    const topCourse = data.topCoursesByDownloads[0];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={i18n.language.startsWith('ar') ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
                                <BarChart3 className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {t('adminReports.title')}
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {t('adminReports.subtitle')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {data.generatedAt > 0 && !loading && (
                                <span className="text-xs text-gray-400 hidden sm:block">
                                    {t('adminReports.lastUpdated', { date: new Date(data.generatedAt).toLocaleString(dateLocale) })}
                                </span>
                            )}
                            <button
                                onClick={load}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {t('adminReports.refresh')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {error && (
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {loading ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <SkeletonCard key={i} showContent={false} showFooter={false} />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <SkeletonCard />
                            <SkeletonCard />
                        </div>
                        <SkeletonList items={5} />
                    </>
                ) : (
                    <>
                        {/* KPI ROW */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            <KpiCard title={t('adminReports.totalUsers')} value={data.kpis.totalUsers} icon={Users} color="text-blue-600" bg="bg-blue-500" />
                            <KpiCard title={t('adminReports.totalFiles')} value={data.kpis.totalFiles} icon={FileText} color="text-green-600" bg="bg-green-500" />
                            <KpiCard title={t('adminReports.totalDownloads')} value={data.kpis.totalDownloads} icon={Download} color="text-indigo-600" bg="bg-indigo-500" />
                            <KpiCard title={t('adminReports.totalDiscussions')} value={data.kpis.totalDiscussions} icon={MessageSquare} color="text-purple-600" bg="bg-purple-500" />
                            <KpiCard title={t('adminReports.totalComments')} value={data.kpis.totalComments} icon={MessageCircle} color="text-teal-600" bg="bg-teal-500" />
                            <KpiCard title={t('adminReports.totalLikes')} value={data.kpis.totalLikes} icon={ThumbsUp} color="text-pink-600" bg="bg-pink-500" />
                            <KpiCard title={t('adminReports.activeUsers')} value={data.kpis.activeUsers} icon={Activity} color="text-orange-600" bg="bg-orange-500" />
                            <KpiCard title={t('adminReports.engagementRate')} value={data.kpis.totalUsers ? Math.min(100, Math.round((data.kpis.activeUsers / data.kpis.totalUsers) * 100)) : 0} icon={TrendingUp} color="text-cyan-600" bg="bg-cyan-500" suffix="%" />
                        </div>

                        {/* INSIGHT BANNER */}
                        {(busiestDay || topCourse) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                                    <CalendarDays className="h-6 w-6 opacity-80" />
                                    <div>
                                        <p className="text-sm opacity-90">{t('adminReports.busiestDay')}</p>
                                        <p className="text-lg font-bold">
                                            {busiestDay && busiestDay.count > 0 ? busiestDay.name : t('adminReports.noDataDay')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                                    <Flame className="h-6 w-6 opacity-80" />
                                    <div>
                                        <p className="text-sm opacity-90">{t('adminReports.topCourse')}</p>
                                        <p className="text-lg font-bold truncate">
                                            {topCourse && topCourse.downloads > 0 ? topCourse.courseName : t('adminReports.noDataCourse')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ROW: Top courses + Top discussions */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section title={t('adminReports.topCoursesByDownloads')} icon={Download} subtitle={t('adminReports.byTotalDownloads')}>
                                {data.topCoursesByDownloads.length > 0 ? (
                                    <HorizontalBarChart
                                        color="#6366f1"
                                        data={data.topCoursesByDownloads.map((c) => ({
                                            label: c.courseName,
                                            value: c.downloads,
                                            sublabel: `${formatNumberEn(c.filesCount)} ${t('adminReports.filesUploaded', { count: c.filesCount })}`,
                                        }))}
                                    />
                                ) : (
                                    <p className="text-sm text-gray-400">{t('adminReports.noDownloadsYet')}</p>
                                )}
                            </Section>

                            <Section title={t('adminReports.mostActiveUsers')} icon={Award} subtitle={t('adminReports.byFilesDiscussionsActivity')}>
                                {data.mostActiveUsers.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.mostActiveUsers.map((u, i) => (
                                            <div key={u.userId || i} className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                        {u.name}
                                                    </p>
                                                    <p className="text-xs text-gray-400 truncate">
                                                        {[u.filesUploaded > 0 ? `${formatNumberEn(u.filesUploaded)} ${t('adminReports.filesUploaded', { count: u.filesUploaded })}` : '', u.discussionsCreated > 0 ? `${formatNumberEn(u.discussionsCreated)} ${t('adminReports.discussionsCreated', { count: u.discussionsCreated })}` : '', u.commentsMade > 0 ? `${formatNumberEn(u.commentsMade)} ${t('adminReports.commentsMade', { count: u.commentsMade })}` : '', u.activeDays > 0 ? `${formatNumberEn(u.activeDays)} ${t('adminReports.activeDays', { count: u.activeDays })}` : ''].filter(Boolean).join(' · ') || t('adminReports.noDetails')}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                                    {formatNumberEn(u.score)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400">{t('adminReports.noActivityYet')}</p>
                                )}
                            </Section>
                        </div>

                        {/* ROW: Top discussions */}
                        <Section title={t('adminReports.topDiscussions')} icon={MessageSquare} subtitle={t('adminReports.byRepliesLikes')}>
                            {data.topDiscussions.length > 0 ? (
                                <div className="space-y-2">
                                    {data.topDiscussions.map((d, i) => (
                                        <div
                                            key={d.id || i}
                                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                                        >
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    to="/discussions"
                                                    className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block hover:text-primary-600"
                                                >
                                                    {d.title}
                                                </Link>
                                                <p className="text-xs text-gray-400 truncate">
                                                    {t('adminReports.by')} {d.authorName}
                                                    {d.courseName ? ` · ${d.courseName}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs shrink-0">
                                                <span className="flex items-center gap-1 text-teal-600" title={t('adminReports.replies')}>
                                                    <MessageCircle className="h-4 w-4" />
                                                    {formatNumberEn(d.commentsCount)}
                                                </span>
                                                <span className="flex items-center gap-1 text-pink-600" title={t('adminReports.likes')}>
                                                    <ThumbsUp className="h-4 w-4" />
                                                    {formatNumberEn(d.likesCount)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">{t('adminReports.noDiscussionsYet')}</p>
                            )}
                        </Section>

                        {/* ROW: charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section title={t('adminReports.weeklyActivity')} icon={Activity} subtitle={t('adminReports.dailyEvents')}>
                                <AreaLineChart
                                    data={data.weeklyActivity.map((d) => ({ label: d.name, value: d.count }))}
                                    color="#10b981"
                                />
                            </Section>

                            <Section title={t('adminReports.peakHours')} icon={Clock} subtitle={t('adminReports.activityDistribution')}>
                                <AreaLineChart
                                    data={peakHoursData}
                                    color="#6366f1"
                                />
                            </Section>

                            <Section title={t('adminReports.weekdayActivity')} icon={CalendarDays} subtitle={t('adminReports.siteUsageDays')}>
                                <VerticalBarsChart data={data.weekdayActivity.map((d) => ({ label: d.name, value: d.count }))} color="#f59e0b" heightClass="h-44" />
                            </Section>

                            <Section title={t('adminReports.fileTypeDistribution')} icon={PieChart} subtitle={t('adminReports.relativeShare')}>
                                <DonutChart
                                    data={data.fileTypeDistribution.map((d) => ({ label: d.name, value: d.count }))}
                                />
                            </Section>
                        </div>

                        {/* ROW: Top colleges */}
                        <Section title={t('adminReports.topColleges')} icon={Layers} subtitle={t('adminReports.byUploadedFiles')}>
                            {data.topColleges.length > 0 ? (
                                <HorizontalBarChart
                                    color="#14b8a6"
                                    data={data.topColleges.map((c) => ({ label: c.name, value: c.count }))}
                                />
                            ) : (
                                <p className="text-sm text-gray-400">{t('adminReports.notEnoughData')}</p>
                            )}
                        </Section>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminReports;
