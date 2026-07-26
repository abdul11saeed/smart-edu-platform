import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, Suspense, lazy, useMemo } from 'react';
import {
    FileText,
    MessageSquare,
    Bot,
    MessageCircle,
    Upload,
    ChevronRight,
    BookOpen
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useCatalogStore } from '../stores/catalogStore';
import { University, College, Major, Course as CourseType } from '../types';
import { trackCourseEntered } from '../utils/analyticsTracker';

// Lazy load heavy components for performance
const CourseFilesTab = lazy(() => import('../components/workspace/CourseFilesTab'));
const AITab = lazy(() => import('../components/workspace/AITab'));
const ChatTab = lazy(() => import('../components/workspace/ChatTab'));
const UploadTab = lazy(() => import('../components/workspace/UploadTab'));

interface TabConfig {
    id: string;
    label: string;
    icon: React.ElementType;
}

const tabs: TabConfig[] = [
    { id: 'files', label: 'الملفات', icon: FileText },
    { id: 'upload', label: 'رفع ملفات', icon: Upload },
    { id: 'discussions', label: 'المناقشات', icon: MessageSquare },
    { id: 'chat', label: 'الدردشة', icon: MessageCircle },
    { id: 'ai', label: 'مساعد الذكاء', icon: Bot },
];

const DiscussionsTab = lazy(() => import('../components/workspace/DiscussionsTab'));

const CourseWorkspace = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { activeTab, setActiveTab, setActiveCourseId, setCurrentCourseFiles } = useAppStore();
    const { universities } = useCatalogStore();

    // Memoize course lookup to prevent recalculation
    const course: CourseType | undefined = useMemo(() => {
        if (!courseId) return undefined;
        return (universities || [])
            .flatMap((uni: University) => (uni?.colleges || []))
            .flatMap((col: College) => (col?.majors || []))
            .flatMap((maj: Major) => (maj?.courses || []))
            .find((c: CourseType) => c?.id === courseId);
    }, [courseId, universities]);

    // Memoize context lookup to prevent recalculation
    const context = useMemo(() => {
        if (!courseId || !universities) return null;
        for (const uni of (universities || [])) {
            for (const col of (uni?.colleges || [])) {
                for (const maj of (col?.majors || [])) {
                    const found = (maj?.courses || []).find(c => c?.id === courseId);
                    if (found) {
                        return { university: uni, college: col, major: maj, course: found };
                    }
                }
            }
        }
        return null;
    }, [courseId, universities]);

    // Root Fix: no sessionStorage/localStorage (single source of truth)
    useEffect(() => {
        if (courseId) {
            setActiveCourseId(courseId);
            if (course?.name) {
                // analytics call without persistence guard
                trackCourseEntered(courseId, course.name).catch(err =>
                    console.warn('Analytics tracking skipped:', err)
                );
            }
        }
    }, [courseId, setActiveCourseId, course]);

    // SEO meta tags for the public course workspace page
    useEffect(() => {
        if (course?.name) {
            document.title = `${course.name} - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية`;
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', `تصفح مادة ${course.name} على منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية: الملفات الأكاديمية، المناقشات، والدردشة. سجّل دخولك للتحميل والمشاركة.`);
            // Canonical URL for this public course route
            let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
            if (!canonical) {
                canonical = document.createElement('link');
                canonical.setAttribute('rel', 'canonical');
                document.head.appendChild(canonical);
            }
            canonical.setAttribute('href', window.location.href);
        }
        return () => {
            document.title = 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        };
    }, [course?.name]);

    // SEO: structured data (JSON-LD) for the course workspace page
    useEffect(() => {
        if (!course?.name) return;
        const data = {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: course.name,
            provider: {
                '@type': 'Organization',
                name: 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية',
                url: 'https://eduai.yemen/',
            },
        };
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'jsonld-course';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
        return () => {
            document.getElementById('jsonld-course')?.remove();
        };
    }, [course?.name]);

    // Clear course files on unmount
    useEffect(() => {
        return () => {
            setCurrentCourseFiles([]);
        };
    }, [setCurrentCourseFiles]);

    if (!course || !context) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">المقرر غير موجود</p>
                    <button
                        onClick={() => navigate('/')}
                        className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg"
                    >
                        العودة للرئيسية
                    </button>
                </div>
            </div>
        );
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'files':
                return (
                    <CourseFilesTab
                        courseId={courseId!}
                        course={course}
                        university={context.university}
                        college={context.college}
                        major={context.major}
                    />
                );
         case 'discussions':
                 return <DiscussionsTab courseId={courseId!} />;
            case 'ai':
                return <AITab courseId={courseId!} />;
            case 'chat':
                return <ChatTab courseId={courseId!} courseName={course.name} />;
            case 'upload':
                return <UploadTab courseId={courseId!} />;
            default:
                return (
                    <CourseFilesTab
                        courseId={courseId!}
                        course={course}
                        university={context.university}
                        college={context.college}
                        major={context.major}
                    />
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir="rtl">
            {/* Context Header */}
            <div className="bg-white dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary-50/60 to-transparent dark:from-primary-900/20 dark:to-transparent" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Breadcrumb Context */}
                    <div className="flex items-center py-3 text-sm">
                        <span className="text-gray-500">{context.university.name}</span>
                        <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
                        <span className="text-gray-500">{context.college.name}</span>
                        <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
                        <span className="text-gray-500">{context.major.name}</span>
                        <ChevronRight className="h-4 w-4 mx-2 text-gray-400" />
                        <span className="font-semibold text-primary-600">{course.name}</span>
                        <span className="mr-3 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                            نشط
                        </span>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-1 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`
                                        flex items-center px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap
                                        transition-all duration-200 flex-shrink-0
                                        ${isActive
                                            ? 'bg-primary-50 text-primary-700 shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                        }
                                        dark:${isActive ? 'bg-primary-900/40 text-primary-200' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
                                    `}
                                >
                                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1.5 sm:ml-2 ${isActive ? 'text-primary-600' : 'text-gray-500'}`} />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Suspense fallback={
                    <div className="flex items-center justify-center min-h-[400px]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    </div>
                }>
                    <div
                        key={activeTab}
                        className="transition-all duration-300 ease-smooth"
                    >
                        {renderTabContent()}
                    </div>
                </Suspense>
            </div>
        </div>
    );
};

export default CourseWorkspace;

