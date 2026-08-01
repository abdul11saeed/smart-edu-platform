import { Users, FileText, Building, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Stats {
    totalUsers: number;
    totalFiles: number;
    totalUniversities: number;
    totalColleges: number;
    totalMajors: number;
    totalCourses: number;
}

interface StatsCardsProps {
    stats: Stats;
    universityCount: number;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, universityCount }) => {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
    return (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <StatCard
                icon={<Users className="h-8 w-8 shrink-0" />}
                label={t('admin.totalUsers')}
                value={stats.totalUsers > 0 ? stats.totalUsers.toLocaleString(locale) : '-'}
                gradientFrom="from-primary-500"
                gradientTo="to-primary-700"
                iconBg="bg-primary-100 text-primary-700"
            />
            <StatCard
                icon={<FileText className="h-8 w-8 shrink-0" />}
                label={t('admin.totalFiles')}
                value={stats.totalFiles > 0 ? stats.totalFiles.toLocaleString(locale) : '-'}
                gradientFrom="from-secondary-500"
                gradientTo="to-secondary-700"
                iconBg="bg-secondary-100 text-secondary-700"
            />
            <StatCard
                icon={<Building className="h-8 w-8 shrink-0" />}
                label={t('admin.totalUniversities')}
                value={stats.totalUniversities || universityCount}
                gradientFrom="from-accent-500"
                gradientTo="to-accent-700"
                iconBg="bg-accent-100 text-accent-700"
            />
            <StatCard
                icon={<GraduationCap className="h-8 w-8 shrink-0" />}
                label={t('admin.totalCourses')}
                value={stats.totalCourses}
                gradientFrom="from-primary-500"
                gradientTo="to-primary-700"
                iconBg="bg-primary-100 text-primary-700"
            />
        </div>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    gradientFrom: string;
    gradientTo: string;
    iconBg: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, gradientFrom, gradientTo, iconBg }) => (
    <div className={`bg-gradient-to-l ${gradientFrom} ${gradientTo} rounded-2xl shadow-lg shadow-primary-500/10 border border-primary-100/50 p-5 sm:p-6 flex flex-col items-center justify-center text-center min-h-[120px] hover:shadow-xl hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all duration-300 ease-smooth`}>
        <div className={`flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl ${iconBg} shadow-sm mb-3 shrink-0`}>
            {icon}
        </div>
        <p className="text-sm font-medium text-white/80 truncate w-full">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-white truncate w-full">{value}</p>
    </div>
);

export default StatsCards;
