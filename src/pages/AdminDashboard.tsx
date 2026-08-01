import { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Plus, X, Edit2, Trash2, UserMinus, UserPlus, Activity, Check, Upload, UserPlus as UserRegister, School } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useCatalogStore } from '../stores/catalogStore';
import { useAppStore } from '../stores/appStore';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { getAllUsers, updateUserRole, banUser, unbanUser, ADMIN_EMAIL } from '../services/authService';
import {
    getStatistics,
    addUniversity,
    addCollege,
    addMajor,
    addCourse,
    deleteUniversity,
    deleteCollege,
    deleteMajor,
    deleteCourse,
    updateUniversityName,
    updateCollegeName,
    updateMajorName,
    updateCourseName,
    getRecentActivities,
    deleteRecentActivities,
    Activity as ActivityType
} from '../services/dataService';
import { getTotalFileCount } from '../services/courseFilesService';
import { UserRole, University } from '../types';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import StatsCards from '../components/admin/StatsCards';
import QuickActions from '../components/admin/QuickActions';
import ActivityFeed from '../components/admin/ActivityFeed';
import ContentManagementTable from '../components/admin/ContentManagementTable';
import UserManagementPanel from '../components/admin/UserManagementPanel';
import AddEditModal from '../components/admin/AddEditModal';
import type { ContentItem } from '../components/admin/types';
import { ROLE_CONFIG } from '../components/admin/constants';

// Debounce hook for search inputs
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}

const AdminDashboard = () => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language.startsWith('ar');
    const { universities, fetchUniversities, isLoading: catalogLoading, subscribeToUniversities } = useCatalogStore();
    const { success: toastSuccess, error: toastError } = useToast();
    const currentUser = useAppStore((s) => s.currentUser);

    // Content management state
    const [contentItems, setContentItems] = useState<ContentItem[]>([]);
    const [activeModal, setActiveModal] = useState<'university' | 'college' | 'major' | 'course' | 'users' | null>(null);
    const [newItemName, setNewItemName] = useState('');
    const [selectedUniversityForCollege, setSelectedUniversityForCollege] = useState('');
    const [selectedCollegeId, setSelectedCollegeId] = useState('');
    const [selectedMajorId, setSelectedMajorId] = useState('');
    const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
    const [isAddingItem, setIsAddingItem] = useState(false);

    // Separate loading states for independent user operations
    const [isRoleChanging, setIsRoleChanging] = useState(false);
    const [isBanning, setIsBanning] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUsersLoading, setIsUsersLoading] = useState(false);

    const [registeredUsers, setRegisteredUsers] = useState<Array<{ id: string; email: string; role: UserRole; name: string; isBanned?: boolean }>>([]);

    // Search and filter with debounce
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [userFilter, setUserFilter] = useState<'all' | 'active' | 'banned'>('all');

    // User pagination
    const [userPage, setUserPage] = useState(1);
    const USERS_PER_PAGE = 20;

    // Banning state
    const [banningUserId, setBanningUserId] = useState<string | null>(null);
    const [banDurationInput, setBanDurationInput] = useState('0');

    // Stats state
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalFiles: 0,
        totalUniversities: 0,
        totalColleges: 0,
        totalMajors: 0,
        totalCourses: 0
    });

    // Activities state
    const [activities, setActivities] = useState<ActivityType[]>([]);
    const [activitiesCount, setActivitiesCount] = useState(10);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    // Inline editing state for content management table (split from delete/create)
    const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
    const [editName, setEditName] = useState('');

    // Debounced user filter counts (prevents recomputing on every keystroke)
    const userFilterCounts = useMemo(() => ({
        all: registeredUsers.length,
        active: registeredUsers.filter(u => !u.isBanned).length,
        banned: registeredUsers.filter(u => u.isBanned).length,
    }), [registeredUsers]);

    // Filtered users with debounced search
    const filteredUsers = useMemo(() => {
        return registeredUsers.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                user.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
            const matchesFilter = userFilter === 'all' ||
                (userFilter === 'banned' && user.isBanned) ||
                (userFilter === 'active' && !user.isBanned);
            return matchesSearch && matchesFilter;
        });
    }, [registeredUsers, debouncedSearchQuery, userFilter]);

    // Paginated users
    const paginatedUsers = useMemo(() => {
        const start = (userPage - 1) * USERS_PER_PAGE;
        return filteredUsers.slice(start, start + USERS_PER_PAGE);
    }, [filteredUsers, userPage]);

    const hasMoreUsers = filteredUsers.length > userPage * USERS_PER_PAGE;

    // Protected user check — memoized with stable dependencies
    const protectedUserIds = useMemo(() => {
        const ids = new Set<string>();
        if (currentUser?.id) ids.add(currentUser.id);
        if (ADMIN_EMAIL) ids.add(ADMIN_EMAIL.toLowerCase());
        return ids;
    }, [currentUser?.id]);

    const isProtectedUser = useCallback((user: { id: string; email: string }) => {
        return protectedUserIds.has(user.id) ||
            user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    }, [protectedUserIds]);

    // Load universities data — only fetch if empty (onSnapshot handles live updates)
    useEffect(() => {
        if (universities.length === 0) {
            fetchUniversities();
        }
    }, [universities.length, fetchUniversities]);

    // Subscribe to real-time university updates
    useEffect(() => {
        const unsubscribe = subscribeToUniversities();
        return () => unsubscribe();
    }, [subscribeToUniversities]);

    // Load registered users and statistics together, reusing getAllUsers() as the
    // single source for both the user list and the total-user count.
    useEffect(() => {
        const loadUsersAndStats = async () => {
            setIsUsersLoading(true);
            try {
                const users = await getAllUsers(500);
                setRegisteredUsers(users);
                const fileCount = await getTotalFileCount();
                const data = await getStatistics(fileCount, users.length, universities);
                setStats(data);
            } catch (error) {
                console.error('Error loading users/stats:', error);
                toastError(t('admin.dataLoadError'));
            } finally {
                setIsUsersLoading(false);
            }
        };

        loadUsersAndStats();
    }, []);

    // Load activities
    useEffect(() => {
        const init = async () => {
            setIsLoadingMore(true);
            try {
                const data = await getRecentActivities(activitiesCount);
                setActivities(data);
            } catch (error) {
                console.error('Error loading activities:', error);
            } finally {
                setIsLoadingMore(false);
            }
        };
        init();
    }, [activitiesCount]);

    // Initialize content items from universities data
    useEffect(() => {
        if (!universities || !Array.isArray(universities) || universities.length === 0) {
            setContentItems([]);
            return;
        }

        const items: ContentItem[] = [];
        universities.forEach(uni => {
            if (!uni || !Array.isArray(uni.colleges)) return;
            const uniHasChildren = uni.colleges.length > 0;
            items.push({ id: uni.id, name: uni.name, type: 'university', status: uniHasChildren ? 'active' : 'inactive' });
            uni.colleges.forEach(col => {
                if (!col || !Array.isArray(col.majors)) return;
                const colHasChildren = col.majors.length > 0;
                items.push({ id: col.id, name: col.name, type: 'college', status: colHasChildren ? 'active' : 'inactive', parentId: uni.id });
                col.majors.forEach(maj => {
                    const majHasChildren = Array.isArray(maj.courses) && maj.courses.length > 0;
                    items.push({ id: maj.id, name: maj.name, type: 'major', status: majHasChildren ? 'active' : 'inactive', parentId: col.id });
                    if (Array.isArray(maj.courses)) {
                        maj.courses.forEach(course => {
                            items.push({ id: course.id, name: course.name, type: 'course', status: 'active', parentId: maj.id });
                        });
                    }
                });
            });
        });
        setContentItems(items);
    }, [universities]);

    // Reset user page when filter/search changes
    useEffect(() => {
        setUserPage(1);
    }, [debouncedSearchQuery, userFilter]);

    // Catalog hierarchy helpers
    const findCollegeById = useCallback((collegeId: string) =>
        universities?.flatMap(u => Array.isArray(u.colleges) ? u.colleges : [])
            .find(c => c.id === collegeId),
        [universities]
    );

    // Resolve the catalog path for an item
    const resolveCatalogPath = useCallback((item: ContentItem) => {
        switch (item.type) {
            case 'university':
                return { universityId: item.id };
            case 'college':
                return { universityId: item.parentId || '', collegeId: item.id };
            case 'major': {
                const college = findCollegeById(item.parentId || '');
                const university = college ? universities?.find(u => u.colleges?.includes(college)) : undefined;
                return { universityId: university?.id || '', collegeId: item.parentId || '', majorId: item.id };
            }
            default: {
                // item.parentId is the major's id, need to find the parent college and university
                let universityId = '';
                let collegeId = '';
                const majorId = item.parentId || '';
                for (const uni of universities || []) {
                    for (const col of uni.colleges || []) {
                        for (const maj of col.majors || []) {
                            if (maj.id === majorId) {
                                universityId = uni.id;
                                collegeId = col.id;
                                break;
                            }
                        }
                        if (universityId) break;
                    }
                    if (universityId) break;
                }
                return { universityId, collegeId, majorId, courseId: item.id };
            }
        }
    }, [findCollegeById, universities]);

    // Generate a detailed warning message for cascade deletes
    const getDeleteWarning = useCallback((item: ContentItem): string => {
        if (item.type === 'university') {
            const uni = universities.find(u => u.id === item.id);
            if (!uni) return t('admin.confirmDelete', { name: item.name });
            const collegeCount = uni.colleges?.length || 0;
            const majorCount = uni.colleges?.reduce((sum, col) => sum + (col.majors?.length || 0), 0) || 0;
            const courseCount = uni.colleges?.reduce((sum, col) =>
                sum + (col.majors?.reduce((s, maj) => s + (maj.courses?.length || 0), 0) || 0), 0) || 0;
            return t('admin.confirmDeleteUniversity', { name: item.name, colleges: collegeCount, majors: majorCount, courses: courseCount });
        }
        if (item.type === 'college') {
            const uni = universities.find(u => Array.isArray(u.colleges) && u.colleges.some(c => c.id === item.id));
            if (!uni) return t('admin.confirmDelete', { name: item.name });
            const college = uni.colleges.find(c => c.id === item.id);
            if (!college) return t('admin.confirmDelete', { name: item.name });
            const majorCount = college.majors?.length || 0;
            const courseCount = college.majors?.reduce((sum, maj) => sum + (maj.courses?.length || 0), 0) || 0;
            return t('admin.confirmDeleteCollege', { name: item.name, majors: majorCount, courses: courseCount });
        }
        if (item.type === 'major') {
            const uni = universities.find(u =>
                Array.isArray(u.colleges) && u.colleges.some(c =>
                    Array.isArray(c.majors) && c.majors.some(m => m.id === item.id)
                )
            );
            if (!uni) return t('admin.confirmDelete', { name: item.name });
            const college = uni.colleges.find(c =>
                Array.isArray(c.majors) && c.majors.some(m => m.id === item.id)
            );
            if (!college) return t('admin.confirmDelete', { name: item.name });
            const major = college.majors.find(m => m.id === item.id);
            if (!major) return t('admin.confirmDelete', { name: item.name });
            const courseCount = major.courses?.length || 0;
            return t('admin.confirmDeleteMajor', { name: item.name, courses: courseCount });
        }
        return t('admin.confirmDelete', { name: item.name });
    }, [universities]);

    // Persisted delete of a catalog item
    const handleDeleteItem = async (id: string) => {
        const item = contentItems.find(i => i.id === id);
        if (!item) return;
        if (!confirm(getDeleteWarning(item))) return;

        setIsDeleting(true);
        try {
            const path = resolveCatalogPath(item);
            if (item.type === 'university') {
                await deleteUniversity(path.universityId);
            } else if (item.type === 'college') {
                await deleteCollege(path.universityId, path.collegeId ?? '');
            } else if (item.type === 'major') {
                await deleteMajor(path.universityId, path.collegeId ?? '', path.majorId ?? '');
            } else if (item.type === 'course') {
                await deleteCourse(path.universityId, path.collegeId ?? '', path.majorId ?? '', path.courseId ?? '');
            }
            toastSuccess(t('admin.deleteSuccess'));
        } catch (error: any) {
            console.error('Error deleting item:', error);
            toastError(error?.message || t('admin.deleteError'));
        } finally {
            setIsDeleting(false);
        }
    };

    // Inline edit handlers
    const handleStartEdit = (item: ContentItem) => {
        setEditingItem(item);
        setEditName(item.name);
    };

    const handleCancelEdit = () => {
        setEditingItem(null);
        setEditName('');
    };

    const handleSaveEdit = async () => {
        if (!editingItem || !editName.trim()) return;
        setIsEditingName(true);
        try {
            const path = resolveCatalogPath(editingItem);
            if (editingItem.type === 'university') {
                await updateUniversityName(path.universityId, editName.trim());
            } else if (editingItem.type === 'college') {
                await updateCollegeName(path.universityId, path.collegeId ?? '', editName.trim());
            } else if (editingItem.type === 'major') {
                await updateMajorName(path.universityId, path.collegeId ?? '', path.majorId ?? '', editName.trim());
            } else if (editingItem.type === 'course') {
                await updateCourseName(path.universityId, path.collegeId ?? '', path.majorId ?? '', path.courseId ?? '', editName.trim());
            }
            toastSuccess(t('admin.updateSuccess'));
            setEditingItem(null);
            setEditName('');
        } catch (error: any) {
            console.error('Error updating item:', error);
            toastError(error?.message || t('admin.updateError'));
        } finally {
            setIsEditingName(false);
        }
    };

    // Add new catalog item
    const handleAddItem = async () => {
        if (!newItemName.trim()) return;
        setIsAddingItem(true);

        try {
            switch (activeModal) {
                case 'university':
                    await addUniversity(newItemName);
                    break;
                case 'college':
                    if (!selectedUniversityForCollege) {
                        throw new Error(t('admin.selectParentUniversity'));
                    }
                    await addCollege(selectedUniversityForCollege, newItemName);
                    break;
                case 'major':
                    if (!selectedCollegeId) {
                        throw new Error(t('admin.selectParentCollege'));
                    }
                    const collegeForMajor = findCollegeById(selectedCollegeId);
                    const universityForMajor = collegeForMajor ? universities?.find(u => u.colleges?.includes(collegeForMajor)) : undefined;
                    if (!universityForMajor) {
                        throw new Error(t('admin.selectParentUniversity'));
                    }
                    await addMajor(universityForMajor.id, selectedCollegeId, newItemName);
                    break;
                case 'course':
                    if (!selectedCollegeId) {
                        throw new Error(t('admin.selectParentCollege'));
                    }
                    if (!selectedMajorId) {
                        throw new Error(t('admin.selectParentMajor'));
                    }
                    const collegeForCourse = findCollegeById(selectedCollegeId);
                    const universityForCourse = collegeForCourse ? universities?.find(u => u.colleges?.includes(collegeForCourse)) : undefined;
                    if (!universityForCourse || !collegeForCourse) {
                        throw new Error(t('admin.selectParentUniversity'));
                    }
                    const majorForCourse = collegeForCourse.majors?.find(m => m.id === selectedMajorId);
                    if (!majorForCourse) {
                        throw new Error(t('admin.selectParentMajor'));
                    }
                    await addCourse(universityForCourse.id, collegeForCourse.id, selectedMajorId, newItemName);
                    break;
            }

            setNewItemName('');
            setSelectedUniversityForCollege('');
            setSelectedCollegeId('');
            setSelectedMajorId('');
            setSelectedUniversity(null);
            setActiveModal(null);
            toastSuccess(t('admin.addSuccess', { name: newItemName }));
        } catch (error: any) {
            console.error('Error adding item:', error);
            toastError(error?.message || t('admin.addError'));
        } finally {
            setIsAddingItem(false);
        }
    };

    // User operations
    const handlePromoteToAdmin = async (user: { id: string; email: string }) => {
        if (isProtectedUser(user)) {
        toastError(t('admin.cannotPromote'));
        return;
    }
    if (!confirm(t('admin.confirmPromote'))) return;
        setIsRoleChanging(true);
        try {
            await updateUserRole(user.id, 'admin');
            setRegisteredUsers(prev => prev.map(u =>
                u.id === user.id ? { ...u, role: 'admin' } : u
            ));
            toastSuccess(t('admin.promotedSuccess'));
        } catch (error: any) {
            console.error('Error promoting user:', error);
            toastError(error?.message || t('admin.roleChangedError'));
        } finally {
            setIsRoleChanging(false);
        }
    };

    const handleDemoteToStudent = async (user: { id: string; email: string }) => {
        if (isProtectedUser(user)) {
            toastError(t('admin.cannotDemote'));
            return;
        }
        if (!confirm(t('admin.confirmDemote'))) return;
        setIsRoleChanging(true);
        try {
            await updateUserRole(user.id, 'student');
            setRegisteredUsers(prev => prev.map(u =>
                u.id === user.id ? { ...u, role: 'student' } : u
            ));
            toastSuccess(t('admin.demotedSuccess'));
        } catch (error: any) {
            console.error('Error demoting user:', error);
            toastError(error?.message || t('admin.roleChangedError'));
        } finally {
            setIsRoleChanging(false);
        }
    };

    const handleBanUser = (user: { id: string; email: string }) => {
        if (isProtectedUser(user)) {
            toastError(t('admin.cannotBan'));
            return;
        }
        setBanningUserId(user.id);
        setBanDurationInput('0');
    };

    const confirmBanUser = async (user: { id: string; email: string }) => {
        if (isProtectedUser(user)) {
            toastError(t('admin.cannotBan'));
            setBanningUserId(null);
            return;
        }
        const days = parseInt(banDurationInput, 10);
        if (isNaN(days) || days < 0) {
            toastError(t('admin.enterValidDays'));
            return;
        }
        const banDurationMs = days === 0 ? 0 : days * 24 * 60 * 60 * 1000;
        const banExpiresAt = days === 0 ? 0 : Date.now() + banDurationMs;
        const confirmMsg = days === 0
            ? t('admin.confirmBanPermanent')
            : t('admin.confirmBanDays', { days });
        if (!confirm(confirmMsg)) {
            setBanningUserId(null);
            return;
        }
        setIsBanning(true);
        try {
            await banUser(user.id, banExpiresAt);
            setRegisteredUsers(prev => prev.map(u =>
                u.id === user.id ? { ...u, role: 'student', isBanned: true } : u
            ));
            toastSuccess(days === 0 ? t('admin.banPermanently') : t('admin.bannedForDays', { days }));
        } catch (error: any) {
            console.error('Error banning user:', error);
            toastError(error?.message || t('admin.banError'));
        } finally {
            setIsBanning(false);
            setBanningUserId(null);
        }
    };

    const handleUnbanUser = async (user: { id: string; email: string }) => {
        if (!confirm(t('admin.confirmUnban'))) return;
        setIsBanning(true);
        try {
            await unbanUser(user.id);
            setRegisteredUsers(prev => prev.map(u =>
                u.id === user.id ? { ...u, isBanned: false } : u
            ));
            toastSuccess(t('admin.unbannedSuccess'));
        } catch (error: any) {
            console.error('Error unbanning user:', error);
            toastError(error?.message || t('admin.unbanError'));
        } finally {
            setIsBanning(false);
        }
    };

    // Modal close handler
    const closeModal = useCallback(() => {
        setActiveModal(null);
        setNewItemName('');
        setSelectedUniversityForCollege('');
        setSelectedCollegeId('');
        setSelectedMajorId('');
        setSelectedUniversity(null);
        setBanningUserId(null);
        setBanDurationInput('0');
        setEditingItem(null);
        setEditName('');
    }, []);

    const isProcessing = isEditingName || isDeleting;

    return (
        <ErrorBoundary>
            <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
                {/* Page Header */}
                <div className="relative bg-gradient-to-l from-primary-700 via-primary-600 to-secondary-600 rounded-2xl p-4 sm:p-6 lg:p-8 shadow-lg shadow-primary-500/20 overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-48 h-48 bg-white rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
                    </div>
                    <div className="relative z-10">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                            {t('admin.dashboardTitle')}
                        </h1>
                        <p className="text-primary-100 mt-2 text-sm sm:text-base font-medium">
                            {t('admin.welcomeMessage', { name: currentUser?.name || '' })}
                        </p>
                    </div>
                </div>

                {/* Stats Overview */}
                <StatsCards stats={stats} universityCount={universities.length} />

                {/* Quick Actions & Activity Feed */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                    <QuickActions
                        onAddUniversity={() => setActiveModal('university')}
                        onAddCollege={() => setActiveModal('college')}
                        onAddMajor={() => setActiveModal('major')}
                        onAddCourse={() => setActiveModal('course')}
                        onAddUser={() => setActiveModal('users')}
                    />

                    <ActivityFeed
                        activities={activities}
                        isLoadingMore={isLoadingMore}
                        onLoadMore={() => {
                            setIsLoadingMore(true);
                            setActivitiesCount(prev => prev + 10);
                        }}
                        onClearActivities={async () => {
                            if (!confirm(t('admin.confirmClearActivities'))) return;
                            try {
                                setIsLoadingMore(true);
                                await deleteRecentActivities();
                                setActivities([]);
                                setActivitiesCount(10);
                            } catch (error) {
                                console.error('Error clearing activities:', error);
                            } finally {
                                setIsLoadingMore(false);
                            }
                        }}
                        hasMore={activities.length >= activitiesCount}
                    />
                </div>

                {/* Content Management */}
                <ContentManagementTable
                    items={contentItems}
                    editingItem={editingItem}
                    editName={editName}
                    isEditingContent={isProcessing}
                    isDeleting={isDeleting}
                    onStartEdit={handleStartEdit}
                    onCancelEdit={handleCancelEdit}
                    onSaveEdit={handleSaveEdit}
                    onDeleteItem={handleDeleteItem}
                    onEditNameChange={setEditName}
                />

                {/* Add Modal */}
                <AddEditModal
                    activeModal={activeModal}
                    newItemName={newItemName}
                    selectedUniversityId={selectedUniversity?.id || ''}
                    selectedUniversityForCollege={selectedUniversityForCollege}
                    selectedCollegeId={selectedCollegeId}
                    selectedMajorId={selectedMajorId}
                    universities={universities}
                    isAddingItem={isAddingItem}
                    onClose={closeModal}
                    onNameChange={setNewItemName}
                    onUniversityIdChange={(value) => {
                        const uni = universities.find(u => u.id === value);
                        setSelectedUniversity(uni || null);
                        setSelectedCollegeId('');
                    }}
                    onUniversityForCollegeChange={setSelectedUniversityForCollege}
                    onCollegeChange={setSelectedCollegeId}
                    onMajorChange={setSelectedMajorId}
                    onAddItem={handleAddItem}
                />

                {/* Users Modal */}
                <Modal
                    isOpen={activeModal === 'users'}
                    size="xl"
                    onClose={closeModal}
                >
                    <div className="p-3 sm:p-4 lg:p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-neutral-200">
                            <h3 className="text-lg font-bold text-neutral-800 flex items-center">
                                <span className="inline-block w-1 h-6 bg-gradient-to-b from-primary-600 to-secondary-600 rounded-full ml-2"></span>
                                {t('admin.manageUsers')}
                            </h3>
                            <button onClick={closeModal} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors" title={t('common.close')}>
                                <X className="h-5 w-5 sm:h-6 sm:w-6" />
                            </button>
                        </div>

                        <UserManagementPanel
                            users={registeredUsers}
                            filteredUsers={paginatedUsers}
                            searchQuery={searchQuery}
                            userFilter={userFilter}
                            isUsersLoading={isUsersLoading}
                            banningUserId={banningUserId}
                            banDurationInput={banDurationInput}
                            isRoleChanging={isRoleChanging}
                            isBanning={isBanning}
                            currentUser={currentUser}
                            totalUsers={userFilterCounts.all}
                            activeCount={userFilterCounts.active}
                            bannedCount={userFilterCounts.banned}
                            onSearchChange={setSearchQuery}
                            onFilterChange={setUserFilter}
                            onBanUser={handleBanUser}
                            onConfirmBanUser={confirmBanUser}
                            onCancelBan={() => { setBanningUserId(null); setBanDurationInput('0'); }}
                            onBanDurationChange={setBanDurationInput}
                            onPromoteToAdmin={handlePromoteToAdmin}
                            onDemoteToStudent={handleDemoteToStudent}
                            onUnbanUser={handleUnbanUser}
                        />

                        {/* Pagination */}
                        {hasMoreUsers && (
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100">
                                <span className="text-xs text-neutral-500">
                                    {t('admin.showingUsers', { count: paginatedUsers.length, total: filteredUsers.length })}
                                </span>
                                <button
                                    onClick={() => setUserPage(prev => prev + 1)}
                                    disabled={isUsersLoading}
                                    className="px-4 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('admin.loadMore')}
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>
            </div>
        </ErrorBoundary>
    );
};

export default AdminDashboard;
