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
import { Card } from '../components/ui/Card';
import { SkeletonList, SkeletonCard } from '../components/ui/Skeleton';
import {
    HorizontalBarChart,
    VerticalBarsChart,
    AreaLineChart,
    DonutChart,
} from '../components/ui/charts';
import { getDashboardAnalytics, AdminAnalytics } from '../services/adminAnalyticsService';

// ---------- KPI Card ----------
interface KpiProps {
    title: string;
    value: number;
    icon: React.ElementType;
    color: string;
    bg: string;
    suffix?: string;
}
const KpiCard: React.FC<KpiProps> = ({ title, value, icon: Icon, color, bg, suffix }) => (
    <Card className="relative overflow-hidden">
        <div className={`absolute -left-4 -top-4 w-20 h-20 rounded-full ${bg} opacity-10`}></div>
        <div className="relative flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString('en-US')}{suffix}</p>
            </div>
            <div className={`p-3 rounded-lg ${bg}`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
        </div>
    </Card>
);

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
    const [data, setData] = useState<AdminAnalytics>(initialData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getDashboardAnalytics();
            setData(result);
        } catch (err) {
            console.error('[AdminReports] Failed to load analytics:', err);
            setError('تعذّر تحميل بيانات التقارير. حاول مرة أخرى.');
        } finally {
            setLoading(false);
        }
    }, []);

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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
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
                                    التقارير والتحليلات
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    لوحة تقارير شاملة لمدراء المنصة فقط
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {data.generatedAt > 0 && !loading && (
                                <span className="text-xs text-gray-400 hidden sm:block">
                                    آخر تحديث: {new Date(data.generatedAt).toLocaleString('ar-SA')}
                                </span>
                            )}
                            <button
                                onClick={load}
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                تحديث
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
                            <KpiCard title="إجمالي المستخدمين" value={data.kpis.totalUsers} icon={Users} color="text-blue-600" bg="bg-blue-500" />
                            <KpiCard title="الملفات المرفوعة" value={data.kpis.totalFiles} icon={FileText} color="text-green-600" bg="bg-green-500" />
                            <KpiCard title="إجمالي التنزيلات" value={data.kpis.totalDownloads} icon={Download} color="text-indigo-600" bg="bg-indigo-500" />
                            <KpiCard title="المناقشات" value={data.kpis.totalDiscussions} icon={MessageSquare} color="text-purple-600" bg="bg-purple-500" />
                            <KpiCard title="الردود" value={data.kpis.totalComments} icon={MessageCircle} color="text-teal-600" bg="bg-teal-500" />
                            <KpiCard title="الإعجابات" value={data.kpis.totalLikes} icon={ThumbsUp} color="text-pink-600" bg="bg-pink-500" />
                            <KpiCard title="المستخدمون النشطون" value={data.kpis.activeUsers} icon={Activity} color="text-orange-600" bg="bg-orange-500" />
                            <KpiCard title="معدل التفاعل" value={data.kpis.totalUsers ? Math.min(100, Math.round((data.kpis.activeUsers / data.kpis.totalUsers) * 100)) : 0} icon={TrendingUp} color="text-cyan-600" bg="bg-cyan-500" suffix="%" />
                        </div>

                        {/* INSIGHT BANNER */}
                        {(busiestDay || topCourse) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white">
                                    <CalendarDays className="h-6 w-6 opacity-80" />
                                    <div>
                                        <p className="text-sm opacity-90">أكثر أيام الموقع استخداماً</p>
                                        <p className="text-lg font-bold">
                                            {busiestDay && busiestDay.count > 0 ? busiestDay.name : 'لا توجد بيانات'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                                    <Flame className="h-6 w-6 opacity-80" />
                                    <div>
                                        <p className="text-sm opacity-90">المقرر الأكثر تنزيلاً</p>
                                        <p className="text-lg font-bold truncate">
                                            {topCourse && topCourse.downloads > 0 ? topCourse.courseName : 'لا توجد بيانات'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ROW: Top courses + Top discussions */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section title="المقررات الأكثر تنزيلاً" icon={Download} subtitle="حسب إجمالي مرات التنزيل">
                                {data.topCoursesByDownloads.length > 0 ? (
                                    <HorizontalBarChart
                                        color="#6366f1"
                                        data={data.topCoursesByDownloads.map((c) => ({
                                            label: c.courseName,
                                            value: c.downloads,
                                            sublabel: `${c.filesCount} ملف`,
                                        }))}
                                    />
                                ) : (
                                    <p className="text-sm text-gray-400">لا توجد عمليات تنزيل مسجّلة بعد.</p>
                                )}
                            </Section>

                            <Section title="المستخدمون الأكثر نشاطاً" icon={Award} subtitle="حسب الملفات والمناقشات والردود والنشاط">
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
                                                        {[u.filesUploaded > 0 ? `${u.filesUploaded} ملف` : '', u.discussionsCreated > 0 ? `${u.discussionsCreated} مناقشة` : '', u.commentsMade > 0 ? `${u.commentsMade} رد` : '', u.activeDays > 0 ? `${u.activeDays} يوم نشاط` : ''].filter(Boolean).join(' · ') || 'لا تفاصيل'}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                                    {u.score.toLocaleString('en-US')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400">لا يوجد نشاط مستخدمين مسجّل بعد.</p>
                                )}
                            </Section>
                        </div>

                        {/* ROW: Top discussions */}
                        <Section title="المناقشات الأكثر تفاعلاً" icon={MessageSquare} subtitle="الأكثر رداً واحتفاءً بالإعجابات">
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
                                                    بواسطة {d.authorName}
                                                    {d.courseName ? ` · ${d.courseName}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs shrink-0">
                                                <span className="flex items-center gap-1 text-teal-600" title="الردود">
                                                    <MessageCircle className="h-4 w-4" />
                                                    {d.commentsCount}
                                                </span>
                                                <span className="flex items-center gap-1 text-pink-600" title="الإعجابات">
                                                    <ThumbsUp className="h-4 w-4" />
                                                    {d.likesCount}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">لا توجد مناقشات بعد.</p>
                            )}
                        </Section>

                        {/* ROW: charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Section title="نشاط آخر 7 أيام" icon={Activity} subtitle="عدد الأحداث اليومية">
                                <AreaLineChart
                                    data={data.weeklyActivity.map((d) => ({ label: d.name, value: d.count }))}
                                    color="#10b981"
                                />
                            </Section>

                            <Section title="ساعات النشاط الذروة" icon={Clock} subtitle="توزيع النشاط على مدار اليوم">
                                <AreaLineChart
                                    data={peakHoursData}
                                    color="#6366f1"
                                />
                            </Section>

                            <Section title="أيام الأسبوع الأكثر نشاطاً" icon={CalendarDays} subtitle="أيام استخدام الموقع">
                                <VerticalBarsChart data={data.weekdayActivity.map((d) => ({ label: d.name, value: d.count }))} color="#f59e0b" heightClass="h-44" />
                            </Section>

                            <Section title="توزيع أنواع الملفات" icon={PieChart} subtitle="الحصة النسبية لكل نوع">
                                <DonutChart
                                    data={data.fileTypeDistribution.map((d) => ({ label: d.name, value: d.count }))}
                                />
                            </Section>
                        </div>

                        {/* ROW: Top colleges */}
                        <Section title="الكليات الأكثر محتوى" icon={Layers} subtitle="حسب عدد الملفات المرفوعة">
                            {data.topColleges.length > 0 ? (
                                <HorizontalBarChart
                                    color="#14b8a6"
                                    data={data.topColleges.map((c) => ({ label: c.name, value: c.count }))}
                                />
                            ) : (
                                <p className="text-sm text-gray-400">لا توجد بيانات كافية.</p>
                            )}
                        </Section>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminReports;
