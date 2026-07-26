import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    listenToCourseFiles,
    listenToPublicCourseFiles,
    deleteCourseFile,
    updateCourseFile,
    downloadCourseFile,
    getFileType,
} from '../services/courseFilesService';
import { File as AppFile } from '../types';
import { useCatalogStore } from '../stores/catalogStore';
import { useAppStore } from '../stores/appStore';
import FilePreview from '../components/ui/FilePreview';
import Modal from '../components/ui/Modal';
import { downloadFile, formatFileSize } from '../utils/downloadUtils';
import { Bot, Lock, Search, RotateCcw, Upload, FileText, Eye, Pencil, Trash2, GraduationCap, Download } from 'lucide-react';
import RecommendationsCarousel from '../components/recommendations/RecommendationsCarousel';

type TabType = 'all' | 'mine';

const StudentHome: React.FC = () => {
    const navigate = useNavigate();
    const { universities, fetchUniversities } = useCatalogStore();
    const { setIsUploadModalOpen, currentUser, isLoading: authLoading } = useAppStore();

    // Course dropdown visibility state
    const [showCourseDropdown, setShowCourseDropdown] = useState(false);
    const courseDropdownRef = useRef<HTMLDivElement>(null);

    // Files
    const [files, setFiles] = useState<AppFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(true);

    // Filters
    const [selectedUniversity, setSelectedUniversity] = useState('');
    const [selectedCollege, setSelectedCollege] = useState('');
    const [selectedMajor, setSelectedMajor] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [courseSearch, setCourseSearch] = useState(''); // Auto-complete search
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('all');

    // Derived data
    const selectedUniversityData = universities.find((u) => u.id === selectedUniversity);
    const selectedCollegeData = selectedUniversityData?.colleges.find((c) => c.id === selectedCollege);
    const selectedMajorData = selectedCollegeData?.majors.find((m) => m.id === selectedMajor);

    // Get all courses for autocomplete (filtered by current hierarchy)
    const allCourses = useMemo(() => {
        const courses: Array<{ id: string; name: string }> = [];
        const coursesList = Array.isArray(selectedMajorData?.courses) ? selectedMajorData.courses : [];
        coursesList.forEach(course => {
            if (course?.id && course?.name) {
                courses.push({ id: course.id, name: course.name });
            }
        });
        return courses;
    }, [selectedMajorData?.courses]);

    // Filtered courses for autocomplete
    const filteredCourses = useMemo(() => {
        if (!courseSearch.trim()) return allCourses;
        return allCourses.filter(c =>
            c.name.toLowerCase().includes(courseSearch.toLowerCase())
        );
    }, [allCourses, courseSearch]);

    // When currentUser is available (after auth is restored), fetch files
    // Guests read from publicCourseFiles, logged-in users read from courseFiles
    useEffect(() => {
        if (authLoading) return;

        if (currentUser) {
            // Logged-in user: read from courseFiles (full access)
            const unsubscribe = listenToCourseFiles({}, (loaded) => {
                setFiles(loaded);
                setLoadingFiles(false);
            });
            return () => unsubscribe();
        } else {
            // Guest: read from publicCourseFiles (metadata only)
            const unsubscribe = listenToPublicCourseFiles({}, (loaded) => {
                setFiles(loaded);
                setLoadingFiles(false);
            });
            return () => unsubscribe();
        }
    }, [currentUser, authLoading]);

    // SEO meta tags for public pages
    useEffect(() => {
        if (!currentUser) {
            document.title = 'الرئيسية - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية | ملفات ومقررات جامعية';
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية - تصفح الملفات الأكاديمية والمقررات الجامعية والمناقشات العامة. منصة تعليمية ذكية للطلاب الجامعيين في اليمن.');
            // Canonical URL for the current public route (dedupes in search engines)
            let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                document.head.appendChild(canonical);
            }
            canonical.setAttribute('href', window.location.href);
        } else {
            document.title = 'الرئيسية - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية - ارفع الملفات وشاركها مع زملائك. منصة تعليمية ذكية للطلاب الجامعيين.');
        }
        return () => {
            document.title = 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        };
    }, [currentUser]);

    // SEO: structured data (JSON-LD) for the public homepage — helps crawlers index content
    useEffect(() => {
        if (currentUser) return; // only enrich the guest-facing (crawlable) view
        const data = {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'ملفات أكاديمية',
            itemListElement: files.slice(0, 20).map((f, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: f.name || 'ملف',
                description: f.description || undefined,
            })),
        };
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'jsonld-home-files';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
        return () => {
            document.getElementById('jsonld-home-files')?.remove();
        };
    }, [currentUser, files]);

    // Click outside handler to close course dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target as Node)) {
                setShowCourseDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to get course name from catalog - memoized for performance
    const getCourseName = useCallback((courseId: string | undefined) => {
        if (!courseId) return 'غير محدد';

        // Search through all universities, colleges, majors to find the course
        for (const uni of universities) {
            const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
            for (const col of colleges) {
                const majors = Array.isArray(col.majors) ? col.majors : [];
                for (const maj of majors) {
                    const courses = Array.isArray(maj.courses) ? maj.courses : [];
                    const course = courses.find(c => String(c.id) === String(courseId));
                    if (course) return course.name;
                }
            }
        }
        return 'غير محدد';
    }, [universities]);

    // Helper to get university name from catalog - memoized for performance
    const getUniversityName = useCallback((universityId: string | undefined) => {
        if (!universityId) return 'غير محدد';

        const uni = universities.find((u) => String(u.id) === String(universityId));
        return uni?.name || 'غير محدد';
    }, [universities]);

    // Pagination - show only first 5 files initially
    const [showCount, setShowCount] = useState(5);

    // Reset showCount when filters change
    useEffect(() => {
        setShowCount(5);
    }, [activeTab, selectedUniversity, selectedCollege, selectedMajor, selectedCourse, search]);

    // Smart helpers for display: fall back to catalog when stored value looks like an ID
    const getFileCourseName = useCallback((file: AppFile): string => {
        if (!file.courseId) return 'غير محدد';
        if (file.courseName && file.courseName !== file.courseId) {
            return file.courseName;
        }
        return getCourseName(file.courseId);
    }, [getCourseName]);

    const getFileUniversityName = useCallback((file: AppFile): string => {
        if (!file.universityId) return 'غير محدد';
        if (file.universityName && file.universityName !== file.universityId) {
            return file.universityName;
        }
        return getUniversityName(file.universityId);
    }, [getUniversityName]);

    const getFileCollegeName = useCallback((file: AppFile): string => {
        if (!file.collegeId) return 'غير محدد';
        if (file.collegeName && file.collegeName !== file.collegeId) {
            return file.collegeName;
        }
        for (const uni of universities) {
            const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
            const col = colleges.find(c => String(c.id) === String(file.collegeId));
            if (col) return col.name;
        }
        return 'غير محدد';
    }, [universities]);

    const getFileMajorName = useCallback((file: AppFile): string => {
        if (!file.majorId) return 'غير محدد';
        if (file.majorName && file.majorName !== file.majorId) {
            return file.majorName;
        }
        for (const uni of universities) {
            const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
            for (const col of colleges) {
                const majors = Array.isArray(col.majors) ? col.majors : [];
                const maj = majors.find(m => String(m.id) === String(file.majorId));
                if (maj) return maj.name;
            }
        }
        return 'غير محدد';
    }, [universities]);

    // Filtered files
    const filteredFiles = useMemo(() => {
        return files.filter((file) => {
            const matchesTab = activeTab === 'mine' ? file.uploadedBy === currentUser?.id : true;
            const matchesUniversity = !selectedUniversity || file.universityId === selectedUniversity;
            const matchesCollege = !selectedCollege || file.collegeId === selectedCollege;
            const matchesMajor = !selectedMajor || file.majorId === selectedMajor;
            const matchesCourse = !selectedCourse || file.courseId === selectedCourse;
            const matchesDeleted = !file.isDeleted;
            const haystack = [
                file.name, file.courseName, file.universityId, file.collegeId,
                file.majorId, file.courseId, file.description, file.owner?.name,
                file.professorName, file.tags?.join(' ')
            ].filter(Boolean).join(' ').toLowerCase();
            const matchesSearch = !search || haystack.includes(search.toLowerCase());
            return matchesTab && matchesUniversity && matchesCollege && matchesMajor && matchesCourse && matchesDeleted && matchesSearch;
        });
    }, [files, currentUser, activeTab, selectedUniversity, selectedCollege, selectedMajor, selectedCourse, search]);

    // Handle download
    const [deleting, setDeleting] = useState(false);
    const [downloadingFileName, setDownloadingFileName] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<{ name: string; percent: number; indeterminate: boolean } | null>(null);
    const handleDownload = async (file: AppFile) => {
        setDownloadingFileName(file.name);
        setDownloadProgress({ name: file.name, percent: 0, indeterminate: true });
        // Increment the download counter (best effort).
        if (file.id) {
            downloadCourseFile(file.id).catch(() => { });
        }
        await downloadFile(file.downloadURL || file.url || '', {
            filename: file.name,
            onProgress: (percent, _loaded, total) => {
                setDownloadProgress({ name: file.name, percent, indeterminate: !total });
            },
            onComplete: () => {
                setDownloadingFileName(null);
                setDownloadProgress(null);
            },
            onError: () => {
                setDownloadingFileName(null);
                setDownloadProgress(null);
            },
        });
    };

    // Handle delete
    const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
    const handleDeleteConfirm = async () => {
        if (!deleteFileId || !currentUser) return;
        setDeleting(true);
        try {
            await deleteCourseFile(deleteFileId, currentUser.id, currentUser.role);
            setDeleteFileId(null);
            alert('تم حذف الملف بنجاح');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'فشل الحذف');
        } finally {
            setDeleting(false);
        }
    };

    // Handle edit open
    const [editingFile, setEditingFile] = useState<AppFile | null>(null);
    const [editDescription, setEditDescription] = useState('');
    const [editTags, setEditTags] = useState('');
    const [editProfessorName, setEditProfessorName] = useState('');
    const [editSubjectName, setEditSubjectName] = useState('');
    const [editTerm, setEditTerm] = useState<'first' | 'second'>('first');
    const [editLevel, setEditLevel] = useState('');
    const [editAcademicYear, setEditAcademicYear] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);

    const handleEditOpen = async (file: AppFile) => {
        setEditingFile(file);
        setEditDescription(file.description || '');
        setEditTags(file.tags?.join(', ') || '');
        setEditProfessorName(file.professorName || '');
        setEditSubjectName(file.courseName || '');
        setEditTerm((file.term as 'first' | 'second') || 'first');
        setEditLevel(file.level || '');
        setEditAcademicYear(file.academicYear || '');
    };

    const handleEditSave = async () => {
        if (!editingFile || !currentUser) return;
        setSavingEdit(true);
        try {
            const updates: Partial<AppFile> = {
                description: editDescription,
                tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
                professorName: editProfessorName,
                courseName: editSubjectName,
                term: editTerm,
                level: editLevel,
                academicYear: editAcademicYear,
            };
            await updateCourseFile(editingFile.id, updates, currentUser.id, currentUser.role);
            setEditingFile(null);
            alert('تم تحديث الملف بنجاح');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'فشل التحديث');
        } finally {
            setSavingEdit(false);
        }
    };

    // Handle preview
    const [previewFile, setPreviewFile] = useState<AppFile | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const handlePreview = (file: AppFile) => {
        setPreviewFile(file);
        setPreviewOpen(true);
    };

    // Check if user can edit/delete a file
    const canModifyFile = useCallback((file: AppFile) => {
        return file.uploadedBy === currentUser?.id || currentUser?.role === 'admin';
    }, [currentUser?.id, currentUser?.role]);

    // Get file icon based on type
    const getFileIcon = (file: AppFile) => {
        const type = file.type || getFileType(file.extension || '');
        switch (type) {
            case 'pdf': return <FileText className="h-5 w-5" />;
            case 'doc': return <FileText className="h-5 w-5" />;
            case 'ppt': return <FileText className="h-5 w-5" />;
            default: return <FileText className="h-5 w-5" />;
        }
    };

    // Pick a random motivational message once (does not change on every render)
    const [motivationalMessage] = useState(() => {
        const messages = [
            'أتمنى أن تكون بأفضل حال، نحن هنا لمساعدتك على تحقيق أهدافك الأكاديمية 🌟',
            'يوم جديد مليء بالإمكانيات، استمر في سعيك التعليمي بِلا خوف ولا استقال 🚀',
            'في انتظار مشاركاتك الرائعة بكل فخر وانتظار ✨',
            'كل خطوة نحو التعلم تقربك من حلمك، ونحن فخورون بك 🎓',
            'أنت في المكان الصحيح للنجاح، استمر على هذا المنوال 💪',
            'في خدمتك دائماً لأن تعليك أولويتنا، مرحباً بك في عالم التعلم 📚',
            'ابدأ رحلتك اليوم مع مواردنا المميزة وتألق بين المقررات 🌈',
            'نسأل الله أن يوفقك ويرزقك بالعلم النافع، مرحباً بك مرة أخرى 🤲',
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    });

    // Fetch universities on mount
    useEffect(() => {
        fetchUniversities();
    }, [fetchUniversities]);

    // Show loading while Firebase Auth is restoring session
    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900" dir="rtl">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
                    <p className="mt-4 text-slate-600 dark:text-slate-300">جاري استعادة الجلسة...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" dir="rtl">
            {/* Header Modern - Elegant Navy Blue Gradient */}
            {currentUser ? (
                <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#291A0A] via-[#3B2314] to-[#7B4D2A] p-6 sm:p-8 shadow-2xl shadow-[#7B4D2A]/20 border border-white/10 animate-card-appear`}>
                    {/* Animated background patterns */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-float"></div>
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary-400/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-xl shadow-primary-900/30 animate-float-icon">
                                <GraduationCap className="h-7 w-7" />
                            </span>
                            <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg animate-fade-in-up tracking-tight">منصة البرامج الاكاديميه للجامعات اليمنيه ترحب بكم</h1>
                        </div>
                        <div className="text-lg sm:text-xl font-semibold text-white/90 mt-4 animate-fade-in-up animate-delay-100">
                            {currentUser.role === 'admin' ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="animate-wave inline-block text-yellow-300"><GraduationCap className="h-5 w-5" /></span>
                                    <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30 text-white font-bold shadow-lg">مرحباً بك مديري {currentUser?.name || currentUser?.email || 'المدير'}</span>، أتمنى أن تكون بخير ونشاط، نحن هنا لخدمتك دائماً
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-2">
                                    <span className="animate-wave inline-block text-yellow-300"><GraduationCap className="h-5 w-5" /></span>
                                    <span className="bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/30 text-white font-bold shadow-lg">مرحباً {currentUser?.name || currentUser?.email || 'طالب'}</span> في منصة البرامج الاكاديميه للجامعات اليمنيه، {motivationalMessage}
                                </span>
                            )}
                        </div>
                        <p className="mt-4 text-sm text-white/80 font-medium max-w-2xl animate-fade-in-up animate-delay-200 leading-relaxed">
                            {currentUser.role === 'admin'
                                ? 'يمكنك إدارة الملفات والمستخدمين والوصول إلى كل ما تحتاجه كمدير على المنصة.'
                                : 'يمكنك رفع الملفات والبحث عنها حسب الجامعة أو الكلية أو المقرر، مع إمكانية إدارة ملفاتك الخاصة.'
                            }
                        </p>
                    </div>
                </div>
            ) : (
                <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-900 via-primary-800 to-secondary-700 p-6 sm:p-8 shadow-2xl shadow-primary-500/20 border border-white/10 animate-card-appear`}>
                    {/* Animated background patterns */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-float"></div>
                        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary-400/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 text-white backdrop-blur-md border border-white/30 shadow-xl shadow-primary-900/30 animate-float-icon">
                                <GraduationCap className="h-7 w-7" />
                            </span>
                            <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg animate-fade-in-up tracking-tight">منصة البرامج الاكاديميه للجامعات اليمنيه ترحب بكم</h1>
                        </div>
                        <p className="text-lg sm:text-xl text-white/90 mt-3 max-w-3xl animate-fade-in-up animate-delay-100 leading-relaxed">
                            منصة تعليمية ذكية تساعد الطلاب على التعلم بشكل أفضل. يمكنك تصفح الملفات والموارد الأكاديمية بشكل عام.
                        </p>
                        <p className="mt-3 text-sm text-white/80 font-medium animate-fade-in-up animate-delay-200">
                            سجل دخولك للاستفادة من جميع الخدمات: التحميل، المشاركة، الدردشة، والمساعد الذكي.
                        </p>
                        {/* Guest CTA button */}
                        <div className="mt-5 animate-fade-in-up animate-delay-300">
                            <Link to="/login" className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white font-medium rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-white/10">
                                <GraduationCap className="h-5 w-5" />
                                سجّل دخولك الآن
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Recommendations Carousel - personalized for logged-in, public for guests */}
            <RecommendationsCarousel
                userId={currentUser?.id}
                limit={5}
                autoAdvanceInterval={5000}
                onViewAll={() => navigate('/recommendations')}
                isPublic={!currentUser}
                showAutoAdvanceToggle={!!currentUser}
            />

            {/* Filters & Actions - Modern Gradient Card */}
            <div className="filter-card-modern">
                {/* Tabs - Gradient Pills with turquoise/navy theme */}
                <div className="flex flex-wrap gap-2">
                    <button
                        className={`rounded-full px-5 py-2 font-medium transition-all duration-300 ${activeTab === 'all' ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white shadow-lg shadow-primary-500/25 hover:from-primary-700 hover:to-secondary-600 hover:shadow-xl hover:shadow-primary-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-300'}`}
                        onClick={() => setActiveTab('all')}
                    >
                        جميع الملفات
                    </button>
                    {currentUser && (
                        <button
                            className={`rounded-full px-5 py-2 font-medium transition-all duration-300 ${activeTab === 'mine' ? 'bg-gradient-to-r from-primary-600 to-secondary-500 text-white shadow-lg shadow-primary-500/25 hover:from-primary-700 hover:to-secondary-600 hover:shadow-xl hover:shadow-primary-500/30' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 dark:hover:text-primary-300'}`}
                            onClick={() => setActiveTab('mine')}
                        >
                            ملفاتي
                        </button>
                    )}
                </div>

                {/* Hierarchy Filters - Gradient Inputs */}
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    <select
                        aria-label="الجامعة"
                        className="rounded-xl border border-brown-200 dark:border-brown-600 p-2.5 bg-white dark:bg-brown-800 text-brown-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all hover:border-primary-300 dark:hover:border-primary-600"
                        value={selectedUniversity}
                        onChange={(e) => { setSelectedUniversity(e.target.value); setSelectedCollege(''); setSelectedMajor(''); setSelectedCourse(''); setCourseSearch(''); }}
                    >
                        <option value="">الجامعة</option>
                        {universities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <select
                        aria-label="الكلية"
                        className="rounded-xl border border-brown-200 dark:border-brown-600 p-2.5 bg-white dark:bg-brown-800 text-brown-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all hover:border-primary-300 dark:hover:border-primary-600"
                        value={selectedCollege}
                        onChange={(e) => { setSelectedCollege(e.target.value); setSelectedMajor(''); setSelectedCourse(''); setCourseSearch(''); }}
                        disabled={!selectedUniversity || !selectedUniversityData?.colleges?.length}
                    >
                        <option value="">الكلية</option>
                        {Array.isArray(selectedUniversityData?.colleges)
                            ? selectedUniversityData.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                            : null
                        }
                    </select>
                    <select
                        aria-label="التخصص"
                        className="rounded-xl border border-brown-200 dark:border-brown-600 p-2.5 bg-white dark:bg-brown-800 text-brown-900 dark:text-neutral-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all hover:border-primary-300 dark:hover:border-primary-600"
                        value={selectedMajor}
                        onChange={(e) => { setSelectedMajor(e.target.value); setSelectedCourse(''); setCourseSearch(''); }}
                        disabled={!selectedCollege || !selectedCollegeData?.majors?.length}
                    >
                        <option value="">التخصص</option>
                        {Array.isArray(selectedCollegeData?.majors)
                            ? selectedCollegeData.majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)
                            : null
                        }
                    </select>

                    {/* Course - with autocomplete search */}
                    {selectedMajor && (
                        <div className="relative" ref={courseDropdownRef}>
                            <input
                                type="text"
                                aria-label="المقرر"
                                className="rounded-xl border border-brown-200 dark:border-brown-600 p-2.5 w-full bg-white dark:bg-brown-800 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all hover:border-primary-300 dark:hover:border-primary-600"
                                placeholder="اكتب اسم المقرر أو اختره..."
                                value={courseSearch}
                                onChange={(e) => {
                                    setCourseSearch(e.target.value);
                                    // If user clears the search, also clear selectedCourse
                                    if (!e.target.value) setSelectedCourse('');
                                }}
                                onFocus={() => {
                                    setShowCourseDropdown(true);
                                }}
                            />
                            {/* Dropdown for autocomplete */}
                            {showCourseDropdown && (
                                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-brown-900 border border-brown-300 dark:border-brown-600 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {filteredCourses.length > 0 ? (
                                        filteredCourses.map((course) => (
                                            <div
                                                key={course.id}
                                                className="p-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 cursor-pointer text-brown-900 dark:text-neutral-100 transition-colors"
                                                onClick={() => {
                                                    setSelectedCourse(course.id);
                                                    setCourseSearch(course.name);
                                                    setShowCourseDropdown(false);
                                                }}
                                                onMouseDown={(e) => e.preventDefault()}
                                            >
                                                {course.name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-2 text-brown-500 dark:text-neutral-400">لا توجد مقررات مطابقة</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Search & Actions */}
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary-400" />
                        <input
                            aria-label="بحث الملفات"
                            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-brown-200 dark:border-brown-600 bg-white dark:bg-brown-800 text-brown-900 dark:text-neutral-100 placeholder-brown-400 dark:placeholder-neutral-500 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all hover:border-primary-300 dark:hover:border-primary-600"
                            placeholder="ابحث عن الملف أو الجامعة أو الكلية أو المقرر أو الدكتور..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                }
                            }}
                        />
                    </div>
                    <button
                        className="btn-modern-primary w-full sm:w-auto"
                        onClick={() => {
                            // Search is handled by the input's onChange - this button
                            // triggers a re-filter by focusing the search input
                            const searchInput = document.querySelector('input[aria-label="بحث الملفات"]') as HTMLInputElement;
                            searchInput?.focus();
                        }}
                    >
                        <Search className="h-4 w-4" />
                        بحث
                    </button>
                    <button
                        className="btn-modern-ghost w-full sm:w-auto"
                        onClick={() => {
                            setSelectedUniversity('');
                            setSelectedCollege('');
                            setSelectedMajor('');
                            setSelectedCourse('');
                            setCourseSearch('');
                            setSearch('');
                            setActiveTab('all');
                        }}
                    >
                        <RotateCcw className="h-4 w-4" />
                        إعادة تعيين
                    </button>
                    {currentUser && (
                        <button
                            className="btn-modern-ai w-full sm:w-auto"
                            onClick={() => setIsUploadModalOpen(true)}
                        >
                            <Upload className="h-4 w-4" />
                            رفع ملف جديد
                        </button>
                    )}
                </div>
            </div>

            {/* Files List - elegant warm brown container */}
            <div className="rounded-2xl border border-brown-200/80 dark:border-brown-700/60 bg-gradient-to-br from-white to-primary-50/20 dark:from-brown-900 dark:to-brown-950 p-4 sm:p-6 shadow-lg shadow-primary-500/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-gradient-to-b from-primary-700 to-secondary-500 rounded-full"></div>
                        <h2 className="text-lg font-semibold text-brown-900 dark:text-neutral-100">
                            {activeTab === 'all' ? 'جميع الملفات' : 'ملفاتي'}
                            <span className="text-sm text-brown-500 dark:text-neutral-400 mr-2">({filteredFiles.length})</span>
                        </h2>
                    </div>
                </div>

                {loadingFiles ? (
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                        <p className="text-slate-600 dark:text-slate-300 mt-2">جاري تحميل الملفات...</p>
                    </div>
                ) : filteredFiles.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <p className="text-lg">لا توجد ملفات تطابق الفلتر الحالي</p>
                        <p className="text-sm mt-1">جرب تغيير الفلاتر أو ارفع ملفاً جديداً</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredFiles.slice(0, showCount).map((file, index) => (
                            <div
                                key={file.id}
                                className={`animate-card-appear rounded-2xl border border-brown-200/80 dark:border-brown-700/60 bg-gradient-to-br from-white to-primary-50/30 dark:from-brown-900 dark:to-brown-950 backdrop-blur-sm shadow-sm hover:shadow-xl hover:shadow-primary-500/10 dark:hover:shadow-primary-900/30 hover:-translate-y-1 hover:border-primary-200/60 dark:hover:border-primary-700/40 transition-all duration-300 ease-spring ${file.type === 'pdf' || getFileType(file.extension || '') === 'pdf' ? 'card-accent-pdf' : file.type === 'doc' || getFileType(file.extension || '') === 'doc' ? 'card-accent-doc' : file.type === 'ppt' || getFileType(file.extension || '') === 'ppt' ? 'card-accent-ppt' : 'card-accent-other'}`}
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div className="p-4 sm:p-5">
                                    <div className="flex items-start gap-4">
                                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                                            file.type === 'pdf' || getFileType(file.extension || '') === 'pdf' ? 'bg-gradient-to-br from-primary-800 to-primary-900 text-white shadow-primary-500/20' :
                                            file.type === 'doc' || getFileType(file.extension || '') === 'doc' ? 'bg-gradient-to-br from-secondary-600 to-secondary-700 text-white shadow-secondary-500/20' :
                                            file.type === 'ppt' || getFileType(file.extension || '') === 'ppt' ? 'bg-gradient-to-br from-primary-700 to-secondary-700 text-white shadow-primary-500/20' :
                                            'bg-gradient-to-br from-primary-700 to-secondary-600 text-white shadow-primary-500/20'
                                        }`}>
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-semibold text-brown-900 dark:text-neutral-100 truncate text-base">{file.name}</h3>
                                                </div>
                                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 animate-tag-pop ${
                                                    file.storageMode === 'local'
                                                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200 dark:from-amber-950 dark:to-amber-900 dark:text-amber-300 dark:border-amber-800'
                                                        : 'bg-gradient-to-r from-sage-100 to-sage-200 text-sage-700 border-sage-200 dark:from-sage-950 dark:to-sage-900 dark:text-sage-300 dark:border-sage-800'
                                                }`}>
                                                    {file.storageMode === 'local' ? 'محلي' : 'سحابة'}
                                                </span>
                                            </div>
                                            
                                            {/* Academic path */}
                                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                                <span className="text-brown-500 dark:text-neutral-400">{getFileUniversityName(file)}</span>
                                                <span className="text-brown-300 dark:text-brown-600">/</span>
                                                <span className="text-brown-500 dark:text-neutral-400">{getFileCollegeName(file)}</span>
                                                <span className="text-brown-300 dark:text-brown-600">/</span>
                                                <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-500 dark:from-primary-300 dark:to-secondary-400">{getFileCourseName(file)}</span>
                                            </div>

                                            {/* Meta row */}
                                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-brown-500 dark:text-neutral-400">
                                                {file.professorName && (
                                                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/30 text-primary-600 dark:text-primary-300 px-2.5 py-0.5 rounded-full border border-primary-100 dark:border-primary-800/40">
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m12.728 0l-.707.707M12 21a9 9 0 100-18 9 9 0 000 18z" /></svg>
                                                        د. {file.professorName}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center gap-1">
                                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h8" /></svg>
                                                    {formatFileSize(file.size)}
                                                </span>
                                                {file.owner?.name && (
                                                    <span className="inline-flex items-center gap-1 text-brown-400 dark:text-neutral-500">
                                                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                        {file.owner.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Actions - warm brown theme */}
                                <div className="border-t border-brown-100/50 dark:border-brown-800/30 bg-gradient-to-r from-transparent via-primary-50/30 to-transparent dark:via-primary-900/10 px-4 py-3 flex flex-wrap items-center gap-2">
                                    {currentUser ? (
                                        <>
                                            <button
                                                className="btn-modern-ghost px-2.5 py-1.5 text-xs"
                                                onClick={() => handlePreview(file)}
                                                title="معاينة"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                معاينة
                                            </button>
                                            {downloadingFileName === file.name ? (
                                                <div className="flex items-center gap-2 min-w-[120px]" title="جاري التحميل">
                                                    <div className="progress-bar-modern indeterminate flex-1">
                                                        <div className="progress-bar-modern-fill" />
                                                    </div>
                                                    <span className="text-xs text-primary-600 dark:text-primary-400 font-medium whitespace-nowrap">
                                                        جاري...
                                                    </span>
                                                </div>
                                            ) : (
                                                <button
                                                    className="btn-modern-primary px-2.5 py-1.5 text-xs"
                                                    onClick={() => handleDownload(file)}
                                                    title="تحميل"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    تحميل
                                                </button>
                                            )}
                                            <button
                                                className="btn-modern-ai px-2.5 py-1.5 text-xs"
                                                onClick={() => {
                                                    const { setIsAIChatOpen, setAiChatInitialFile, setAiChatOpenMode } = useAppStore.getState();
                                                    const hasValidPreview = file.localTextPreview && !file.localTextPreview.startsWith('[ملف');
                                                    setAiChatInitialFile({
                                                        id: file.id,
                                                        name: file.name,
                                                        content: hasValidPreview ? file.localTextPreview : (file.downloadURL || file.url || undefined),
                                                        readable: hasValidPreview ? true : (file.localTextPreview?.startsWith('[ملف') ? false : undefined),
                                                    });
                                                    setAiChatOpenMode('resume-if-recent');
                                                    setIsAIChatOpen(true);
                                                }}
                                                title="اسأل الذكاء الاصطناعي"
                                            >
                                                <Bot className="h-3.5 w-3.5" />
                                                اسأل AI
                                            </button>
                                            {canModifyFile(file) && (
                                                <>
                                                    <button
                                                        className="btn-modern-ghost px-2.5 py-1.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                                                        onClick={() => handleEditOpen(file)}
                                                        title="تعديل"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                        تعديل
                                                    </button>
                                                    <button
                                                        className="btn-modern-ghost px-2.5 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                                        onClick={() => setDeleteFileId(file.id)}
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        حذف
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                className="btn-modern-ghost px-2.5 py-1.5 text-xs"
                                                onClick={() => handlePreview(file)}
                                                title="معاينة"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                                معاينة
                                            </button>
                                            <button
                                                className="btn-modern-outline px-2.5 py-1.5 text-xs flex items-center gap-1"
                                                onClick={() => navigate('/login', { state: { from: 'download' } })}
                                                title="تحميل"
                                            >
                                                <Lock className="h-3 w-3" />
                                                سجّل للتحميل
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {/* Show More Button */}
                        {filteredFiles.length > showCount && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={() => setShowCount(prev => Math.min(prev + 5, filteredFiles.length))}
                                    className="btn-modern-primary"
                                >
                                    عرض المزيد ({Math.min(showCount + 5, filteredFiles.length)}/{filteredFiles.length})
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* File Preview Modal */}
            <FilePreview
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
                file={previewFile}
            />

            {/* Edit Modal */}
            <Modal isOpen={!!editingFile} onClose={() => setEditingFile(null)} title="تعديل الملف">
                {editingFile && (
                    <div className="space-y-4 p-4">
                        <div>
                            <label htmlFor="edit-subject" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">اسم المقرر</label>
                            <input
                                id="edit-subject"
                                type="text"
                                value={editSubjectName}
                                onChange={(e) => setEditSubjectName(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-professor" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">اسم الدكتور</label>
                            <input
                                id="edit-professor"
                                type="text"
                                value={editProfessorName}
                                onChange={(e) => setEditProfessorName(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="edit-term" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">الترم</label>
                                <select id="edit-term" value={editTerm} onChange={(e) => setEditTerm(e.target.value as 'first' | 'second')} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all">
                                    <option value="first">الترم الأول</option>
                                    <option value="second">الترم الثاني</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="edit-level" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">المستوى</label>
                                <select id="edit-level" value={editLevel} onChange={(e) => setEditLevel(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all">
                                    <option value="">اختر المستوى</option>
                                    <option value="1">المستوى الأول</option>
                                    <option value="2">المستوى الثاني</option>
                                    <option value="3">المستوى الثالث</option>
                                    <option value="4">المستوى الرابع</option>
                                    <option value="5">المستوى الخامس</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="edit-year" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">العام الدراسي</label>
                            <input
                                id="edit-year"
                                type="text"
                                value={editAcademicYear}
                                onChange={(e) => setEditAcademicYear(e.target.value)}
                                placeholder="مثال: 2025"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-desc" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">الوصف</label>
                            <textarea
                                id="edit-desc"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                                rows={3}
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-tags" className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">الوسوم (مفصولة بفاصلة)</label>
                            <input
                                id="edit-tags"
                                type="text"
                                value={editTags}
                                onChange={(e) => setEditTags(e.target.value)}
                                placeholder="محاضرة، تدريبات، امتحان"
                                className="w-full rounded-xl border border-slate-200 dark:border-slate-600 p-2.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleEditSave}
                                disabled={savingEdit}
                                className="btn-modern-primary flex-1"
                            >
                                {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                            </button>
                            <button
                                onClick={() => setEditingFile(null)}
                                className="btn-modern-ghost flex-1"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deleteFileId} onClose={() => setDeleteFileId(null)} title="تأكيد الحذف">
                <div className="p-4 space-y-4">
                    <p className="text-slate-700 dark:text-slate-200">هل أنت متأكد من حذف هذا الملف؟ لا يمكن التراجع عن هذا الإجراء.</p>
                    <div className="flex gap-3">
                        <button
                            onClick={handleDeleteConfirm}
                            disabled={deleting}
                            className="btn-danger flex-1"
                        >
                            {deleting ? 'جاري الحذف...' : 'نعم، حذف'}
                        </button>
                        <button
                            onClick={() => setDeleteFileId(null)}
                            className="btn-modern-ghost flex-1"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default StudentHome;
