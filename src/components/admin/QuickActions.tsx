import React from 'react';
import { Plus, User } from 'lucide-react';

interface QuickActionsProps {
    onAddUniversity: () => void;
    onAddCollege: () => void;
    onAddMajor: () => void;
    onAddCourse: () => void;
    onAddUser: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
    onAddUniversity,
    onAddCollege,
    onAddMajor,
    onAddCourse,
    onAddUser,
}) => {
    const actions = [
        { label: 'إضافة جامعة', icon: <Plus className="h-6 w-6 text-primary-500 mx-auto mb-2" />, onClick: onAddUniversity, gradient: 'from-primary-500 to-primary-700', hoverGradient: 'hover:from-primary-600 hover:to-primary-800', iconBg: 'bg-primary-100 text-primary-700', shadowColor: 'shadow-primary-500/20' },
        { label: 'إضافة كلية', icon: <Plus className="h-6 w-6 text-secondary-500 mx-auto mb-2" />, onClick: onAddCollege, gradient: 'from-secondary-500 to-secondary-700', hoverGradient: 'hover:from-secondary-600 hover:to-secondary-800', iconBg: 'bg-secondary-100 text-secondary-700', shadowColor: 'shadow-secondary-500/20' },
        { label: 'إضافة تخصص', icon: <Plus className="h-6 w-6 text-accent-500 mx-auto mb-2" />, onClick: onAddMajor, gradient: 'from-accent-500 to-accent-700', hoverGradient: 'hover:from-accent-600 hover:to-accent-800', iconBg: 'bg-accent-100 text-accent-700', shadowColor: 'shadow-accent-500/20' },
        { label: 'إضافة مسار', icon: <Plus className="h-6 w-6 text-secondary-500 mx-auto mb-2" />, onClick: onAddCourse, gradient: 'from-secondary-500 to-secondary-700', hoverGradient: 'hover:from-secondary-600 hover:to-secondary-800', iconBg: 'bg-secondary-100 text-secondary-700', shadowColor: 'shadow-secondary-500/20' },
        { label: 'إدارة المستخدمين', icon: <User className="h-6 w-6 text-primary-600 mx-auto mb-2" />, onClick: onAddUser, gradient: 'from-primary-600 to-primary-800', hoverGradient: 'hover:from-primary-700 hover:to-primary-900', iconBg: 'bg-primary-100 text-primary-700', shadowColor: 'shadow-primary-500/20' },
    ];

    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-neutral-200/60 shadow-lg shadow-neutral-200/50 p-4 sm:p-6 lg:p-8 hover:shadow-xl hover:shadow-neutral-300/50 transition-all duration-300">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-800 flex items-center mb-4 sm:mb-6">
                <span className="inline-block w-1 h-6 sm:h-8 bg-gradient-to-b from-accent-500 to-secondary-600 rounded-full ml-3"></span>
                الإجراءات السريعة
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {actions.map((action) => (
                    <button
                        key={action.label}
                        onClick={action.onClick}
                        className={`group relative flex min-h-[110px] items-center justify-center w-full p-3 sm:p-4 border-2 border-dashed border-neutral-200 rounded-2xl bg-gradient-to-b ${action.gradient} ${action.hoverGradient} text-white transition-all duration-300 ${action.shadowColor} hover:shadow-xl hover:-translate-y-1 active:scale-[0.97] overflow-hidden`}
                        title={action.label}
                    >
                        {/* Shimmer overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        <div className="relative z-10 text-center">
                            <div className={`flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${action.iconBg} shadow-sm mb-2 transition-transform group-hover:scale-110`}>
                                {action.icon}
                            </div>
                            <p className="text-sm font-semibold">{action.label}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default QuickActions;
