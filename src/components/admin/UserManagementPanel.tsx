import React from 'react';
import { Users, UserPlus, UserMinus, Trash2, Check } from 'lucide-react';
import { UserRole } from '../../types';
import { ROLE_CONFIG } from './constants';

interface User {
    id: string;
    email: string;
    role: UserRole;
    name: string;
    isBanned?: boolean;
}

interface UserManagementPanelProps {
    users: User[];
    filteredUsers: User[];
    searchQuery: string;
    userFilter: 'all' | 'active' | 'banned';
    isUsersLoading: boolean;
    banningUserId: string | null;
    banDurationInput: string;
    isRoleChanging: boolean;
    isBanning: boolean;
    currentUser: { id: string; email: string } | null;
    totalUsers: number;
    activeCount: number;
    bannedCount: number;
    onSearchChange: (value: string) => void;
    onFilterChange: (filter: 'all' | 'active' | 'banned') => void;
    onBanUser: (user: User) => void;
    onConfirmBanUser: (user: User) => void;
    onCancelBan: () => void;
    onBanDurationChange: (value: string) => void;
    onPromoteToAdmin: (user: User) => void;
    onDemoteToStudent: (user: User) => void;
    onUnbanUser: (user: User) => void;
}

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({
    users,
    filteredUsers,
    searchQuery,
    userFilter,
    isUsersLoading,
    banningUserId,
    banDurationInput,
    isRoleChanging,
    isBanning,
    currentUser,
    totalUsers,
    activeCount,
    bannedCount,
    onSearchChange,
    onFilterChange,
    onBanUser,
    onConfirmBanUser,
    onCancelBan,
    onBanDurationChange,
    onPromoteToAdmin,
    onDemoteToStudent,
    onUnbanUser,
}) => {
    const isProtectedUser = (user: User) =>
        user.id === currentUser?.id ||
        user.email?.toLowerCase() === 'admin@university.edu.sa';

    if (isUsersLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="relative">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-200 border-t-primary-600"></div>
                </div>
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                    <Users className="h-8 w-8 text-neutral-400" />
                </div>
                <p className="text-neutral-600 font-medium">لا يوجد مستخدمون مسجلون</p>
                <p className="text-sm text-neutral-400 mt-1">سيظهر المستخدمون المسجلون هنا</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search and filter */}
            <div className="mb-4 space-y-3">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="بحث بالاسم أو البريد الإلكتروني..."
                        className="w-full p-2.5 pl-10 pr-4 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 bg-white/80 transition-all"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <div className="flex gap-2">
                    <FilterButton label={`الكل (${totalUsers})`} isActive={userFilter === 'all'} onClick={() => onFilterChange('all')} variant="dark" />
                    <FilterButton label={`نشط (${activeCount})`} isActive={userFilter === 'active'} onClick={() => onFilterChange('active')} variant="secondary" />
                    <FilterButton label={`محظور (${bannedCount})`} isActive={userFilter === 'banned'} onClick={() => onFilterChange('banned')} variant="danger" />
                </div>
            </div>

            {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-neutral-100 flex items-center justify-center">
                        <Users className="h-8 w-8 text-neutral-400" />
                    </div>
                    <p className="text-neutral-600 font-medium">لا يوجد مستخدمون مطابقون للبحث</p>
                    <p className="text-sm text-neutral-400 mt-1">جرب تعديل معايير البحث أو الفلترة</p>
                </div>
            ) : (
                <div className="max-h-[70vh] sm:max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                    <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
                        <table className="min-w-[320px] w-full divide-y divide-neutral-100">
                            <thead>
                                <tr className="bg-gradient-to-l from-neutral-50 to-neutral-100/50">
                                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider">الاسم</th>
                                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider">البريد</th>
                                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider">الدور</th>
                                    <th className="px-3 sm:px-4 py-3 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-100">
                                {filteredUsers.map((user, index) => {
                                    const protectedCheck = isProtectedUser(user);
                                    const isBanningThisUser = banningUserId === user.id;
                                    return (
                                        <tr
                                            key={user.id}
                                            className={`transition-colors duration-150 ${user.isBanned ? 'bg-red-50/50' : index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'} hover:bg-primary-50/40`}
                                        >
                                            <td className="px-3 sm:px-4 py-3 text-sm text-neutral-800 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${user.isBanned ? 'bg-red-400' : 'bg-success-400'}`}></div>
                                                    {user.name}
                                                </div>
                                                {user.isBanned && (
                                                    <span className="mr-2 px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded-full">محظور</span>
                                                )}
                                            </td>
                                            <td className="px-3 sm:px-4 py-3 text-sm text-neutral-500">{user.email}</td>
                                            <td className="px-3 sm:px-4 py-3">
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${ROLE_CONFIG[user.role]?.badgeClass || 'bg-blue-100 text-blue-800'}`}>
                                                    {ROLE_CONFIG[user.role]?.label || 'غير معروف'}
                                                </span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-3">
                                                {isBanningThisUser ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            value={banDurationInput}
                                                            onChange={(e) => onBanDurationChange(e.target.value)}
                                                            placeholder="أيام (0=دائم)"
                                                            min="0"
                                                            className="w-24 p-1.5 border border-primary-200 rounded-lg text-xs focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={() => onConfirmBanUser(user)}
                                                            disabled={isBanning}
                                                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                                            title="تأكيد الحظر"
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={onCancelBan}
                                                            className="p-1.5 text-neutral-600 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
                                                            title="إلغاء"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        {user.role === 'student' ? (
                                                            <button
                                                                onClick={() => onPromoteToAdmin(user)}
                                                                disabled={isRoleChanging || protectedCheck}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
                                                                title={protectedCheck ? 'لا يمكن ترقية هذا المستخدم' : 'ترقية إلى مدير'}
                                                            >
                                                                <UserPlus className="h-3.5 w-3.5" />
                                                                ترقية
                                                            </button>
                                                        ) : !protectedCheck ? (
                                                            <button
                                                                onClick={() => onDemoteToStudent(user)}
                                                                disabled={isRoleChanging}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                                title="تنزيل إلى طالب"
                                                            >
                                                                <UserMinus className="h-3.5 w-3.5" />
                                                                تنزيل
                                                            </button>
                                                        ) : null}
                                                        {!protectedCheck && !user.isBanned && (
                                                            <button
                                                                onClick={() => onBanUser(user)}
                                                                disabled={isBanning}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                                title="حظر مؤقت"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                حظر
                                                            </button>
                                                        )}
                                                        {user.isBanned && !protectedCheck && (
                                                            <button
                                                                onClick={() => onUnbanUser(user)}
                                                                disabled={isBanning}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                                                                title="إلغاء الحظر"
                                                            >
                                                                <Check className="h-3.5 w-3.5" />
                                                                إلغاء
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

interface FilterButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
    variant: 'dark' | 'secondary' | 'danger';
}

const variantClasses = {
    dark: 'bg-gradient-to-l from-[#1E40AF] to-[#0F172A] text-white shadow-md shadow-[#1E40AF]/20 hover:shadow-lg hover:shadow-[#1E40AF]/30',
    secondary: 'bg-secondary-600 text-white shadow-sm shadow-secondary-500/20 hover:bg-secondary-700 hover:shadow-secondary-500/30',
    danger: 'bg-red-600 text-white shadow-sm shadow-red-500/20 hover:bg-red-700 hover:shadow-red-500/30',
    inactive: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
};

const FilterButton: React.FC<FilterButtonProps> = ({ label, isActive, onClick, variant }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${isActive ? variantClasses[variant] : variantClasses.inactive}`}
    >
        {label}
    </button>
);

export default UserManagementPanel;
