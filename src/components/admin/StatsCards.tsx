import { Users, FileText, Building, GraduationCap } from 'lucide-react';

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
    return (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <StatCard
                icon={<Users className="h-8 w-8 shrink-0" />}
                label="إجمالي المستخدمين"
                value={stats.totalUsers > 0 ? stats.totalUsers.toLocaleString() : '-'}
                gradientFrom="from-primary-500"
                gradientTo="to-primary-700"
                iconBg="bg-primary-100 text-primary-700"
            />
            <StatCard
                icon={<FileText className="h-8 w-8 shrink-0" />}
                label="إجمالي الملفات"
                value={stats.totalFiles > 0 ? stats.totalFiles.toLocaleString() : '-'}
                gradientFrom="from-secondary-500"
                gradientTo="to-secondary-700"
                iconBg="bg-secondary-100 text-secondary-700"
            />
            <StatCard
                icon={<Building className="h-8 w-8 shrink-0" />}
                label="إجمالي الجامعات"
                value={stats.totalUniversities || universityCount}
                gradientFrom="from-accent-500"
                gradientTo="to-accent-700"
                iconBg="bg-accent-100 text-accent-700"
            />
            <StatCard
                icon={<GraduationCap className="h-8 w-8 shrink-0" />}
                label="إجمالي المسارات"
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
    <div className={`bg-gradient-to-l ${gradientFrom} ${gradientTo} rounded-2xl shadow-lg shadow-primary-500/10 border border-primary-100/50 p-4 sm:p-6 hover:shadow-xl hover:shadow-primary-500/20 hover:-translate-y-0.5 transition-all duration-300 ease-smooth`}>
        <div className="flex items-center">
            <div className={`flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${iconBg} shadow-sm mr-3 sm:mr-4 shrink-0`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white/80 truncate">{label}</p>
                <p className="text-xl sm:text-2xl font-bold text-white truncate">{value}</p>
            </div>
        </div>
    </div>
);

export default StatsCards;
