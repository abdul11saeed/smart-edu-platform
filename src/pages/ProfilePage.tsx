import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Shield, Calendar, Plus, Pencil, Check, X, Clock } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { getUserFromRealtimeDB, uploadProfilePicture, updateUserProfile } from '../services/authService';

const ProfilePage = () => {
    const navigate = useNavigate();
    const { currentUser, setCurrentUser } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editContainerRef = useRef<HTMLDivElement>(null);
    const [userDetails, setUserDetails] = useState<{
        createdAt?: number;
        lastLogin?: number;
    }>({});
    const [editing, setEditing] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [nameValue, setNameValue] = useState(currentUser?.name || '');
    const [bioValue, setBioValue] = useState(currentUser?.bio || '');

    const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // reset so the same file can be selected again
        if (!file || !currentUser?.id) return;
        setUploading(true);
        try {
            const url = await uploadProfilePicture(file, currentUser.id);
            setCurrentUser({ ...currentUser, photoURL: url });
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'فشل رفع صورة الملف الشخصي');
        } finally {
            setUploading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!currentUser?.id) return;
        setSavingProfile(true);
        try {
            await updateUserProfile(currentUser.id, { name: nameValue, bio: bioValue });
            setCurrentUser({
                ...currentUser,
                name: nameValue.trim() || currentUser.name,
                bio: bioValue,
            });
            setEditing(false);
        } catch (err) {
            window.alert(err instanceof Error ? err.message : 'فشل حفظ التغييرات');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCancelEdit = () => {
        setNameValue(currentUser?.name || '');
        setBioValue(currentUser?.bio || '');
        setEditing(false);
    };

    // Click outside the name/bio fields (while editing) reverts to normal view.
    useEffect(() => {
        if (!editing) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (
                editContainerRef.current &&
                !editContainerRef.current.contains(event.target as Node)
            ) {
                handleCancelEdit();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [editing]);

    useEffect(() => {
        const fetchUserDetails = async () => {
            if (!currentUser?.id) return;
            try {
                const user = await getUserFromRealtimeDB(currentUser.id);
                if (user) {
                    setUserDetails({
                        createdAt: user.createdAt,
                        lastLogin: user.lastLogin,
                    });
                }
            } catch {
                // Silently fail - we'll still show basic info
            } finally {
                setLoading(false);
            }
        };
        fetchUserDetails();
    }, [currentUser?.id]);

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'غير متوفر';
        return new Date(timestamp).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    const getRoleLabel = (role: string) => {
        return role === 'admin' ? 'مدير' : 'طالب';
    };

    const getRoleBadgeColor = (role: string) => {
        return role === 'admin'
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    };

    const formatDateTime = (timestamp?: number) => {
        if (!timestamp) return 'غير متوفر';
        return new Date(timestamp).toLocaleDateString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getMembershipDuration = (timestamp?: number) => {
        if (!timestamp) return '';
        const days = Math.floor((Date.now() - timestamp) / 86400000);
        const years = Math.floor(days / 365);
        const months = Math.floor((days % 365) / 30);
        if (years > 0) {
            return `عضو منذ ${years} ${years === 1 ? 'سنة' : 'سنوات'}${months > 0 ? ` و ${months} ${months === 1 ? 'شهر' : 'أشهر'}` : ''}`;
        }
        if (months > 0) return `عضو منذ ${months} ${months === 1 ? 'شهر' : 'أشهر'}`;
        return `عضو منذ ${days} ${days === 1 ? 'يوم' : 'أيام'}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-[#1E40AF] border-t-transparent"></div>
                    <p className="mt-4 text-slate-600 dark:text-blue-200/70">جاري تحميل البيانات...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]" dir="rtl">
                <div className="text-center">
                    <p className="text-slate-600 dark:text-blue-200/70 mb-4">يجب تسجيل الدخول لعرض الملف الشخصي</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="btn-ripple px-6 py-3 bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 text-white rounded-xl hover:shadow-lg hover:shadow-[#1E40AF]/25 transition-all font-medium"
                    >
                        تسجيل الدخول
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
            <div ref={editContainerRef}>
            {/* Profile Header Card */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white dark:bg-[#0F172A] shadow-lg shadow-primary-500/5 overflow-hidden">
                <div className="h-24 bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                </div>
                <div className="px-6 pb-6">
                    <div className="-mt-12 mb-4 relative w-fit">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 text-white flex items-center justify-center text-3xl font-bold shadow-xl border-4 border-white dark:border-[#0F172A] overflow-hidden">
                            {currentUser.photoURL ? (
                                <img
                                    src={currentUser.photoURL}
                                    alt={currentUser.name || 'الملف الشخصي'}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                (currentUser.name?.charAt(0)?.toUpperCase() || currentUser.email?.charAt(0)?.toUpperCase() || 'U')
                            )}
                        </div>

                        {/* Plus button above the profile picture to add/change photo */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            title="إضافة صورة الملف الشخصي"
                            className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-gradient-to-br from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:shadow-[#1E40AF]/30 hover:scale-110 active:scale-90 transition-all border-2 border-white dark:border-[#0F172A] disabled:opacity-70"
                        >
                            {uploading ? (
                                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                        </button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhotoChange}
                        />
                    </div>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                        <div className="flex-1 min-w-0">
                            {editing ? (
                                <input
                                    value={nameValue}
                                    onChange={(e) => setNameValue(e.target.value)}
                                    className="text-2xl font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-blue-400/20 rounded-xl px-3 py-1 w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/40"
                                    placeholder="الاسم"
                                />
                            ) : (
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {currentUser.name || 'المستخدم'}
                                </h1>
                            )}
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(currentUser.role || 'student')}`}>
                                    {getRoleLabel(currentUser.role || 'student')}
                                </span>
                                {currentUser.isBanned ? (
                                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/30">
                                        محظور
                                    </span>
                                ) : (
                                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30">
                                        نشط
                                    </span>
                                )}
                                {getMembershipDuration(userDetails.createdAt) && (
                                    <span className="text-sm text-slate-500 dark:text-slate-400">
                                        {getMembershipDuration(userDetails.createdAt)}
                                    </span>
                                )}
                            </div>
                        </div>

                        {editing ? (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile}
                                    className="p-2 rounded-lg bg-gradient-to-br from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 text-white hover:shadow-lg hover:shadow-[#1E40AF]/25 hover:scale-105 active:scale-90 transition-all disabled:opacity-70"
                                    title="حفظ"
                                >
                                    {savingProfile ? (
                                        <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                    title="إلغاء"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-110 active:scale-90 transition-all"
                                title="تعديل الاسم والنبذة"
                            >
                                <Pencil className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Bio */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white dark:bg-[#0F172A] p-5 shadow-lg shadow-primary-500/5">
                <p className="text-sm font-medium text-slate-700 dark:text-blue-200/80 mb-2">النبذة الشخصية</p>
                {editing ? (
                    <textarea
                        value={bioValue}
                        onChange={(e) => setBioValue(e.target.value)}
                        rows={3}
                        className="w-full text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 border border-slate-300 dark:border-blue-400/20 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/40 resize-none"
                        placeholder="اكتب نبذة قصيرة عنك..."
                    />
                ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
                        {currentUser.bio || 'لا توجد نبذة شخصية.'}
                    </p>
                )}
            </div>
            </div>

            {/* Info Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                {/* Email */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white dark:bg-[#0F172A] p-5 shadow-lg shadow-primary-500/5 hover:shadow-xl hover:shadow-[#1E40AF]/10 hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 text-[#1E40AF] dark:text-blue-400">
                            <Mail className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-500 dark:text-slate-400">البريد الإلكتروني</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                                {currentUser.email || 'غير متوفر'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Role */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white dark:bg-[#0F172A] p-5 shadow-lg shadow-primary-500/5 hover:shadow-xl hover:shadow-[#1E40AF]/10 hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 text-[#1E40AF] dark:text-blue-400">
                            <Shield className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-500 dark:text-slate-400">نوع الحساب</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {getRoleLabel(currentUser.role || 'student')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Member Since */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white dark:bg-[#0F172A] p-5 shadow-lg shadow-primary-500/5 hover:shadow-xl hover:shadow-[#1E40AF]/10 hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 text-[#1E40AF] dark:text-blue-400">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-500 dark:text-slate-400">تاريخ التسجيل</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {formatDate(userDetails.createdAt)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Last Login */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-blue-400/20 bg-white dark:bg-[#0F172A] p-5 shadow-lg shadow-primary-500/5 hover:shadow-xl hover:shadow-[#1E40AF]/10 hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 text-[#1E40AF] dark:text-blue-400">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-500 dark:text-slate-400">آخر تسجيل دخول</p>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                                {formatDateTime(userDetails.lastLogin)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
