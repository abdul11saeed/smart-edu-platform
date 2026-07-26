import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCatalogStore } from '../stores/catalogStore';
import { useAppStore } from '../stores/appStore';
import HierarchicalSelector from '../components/navigation/HierarchicalSelector';
import CourseFilesView from '../components/workspace/CourseFilesView';
import { listenToCourseFiles, listenToPublicCourseFiles, FileFilters } from '../services/courseFilesService';
import { File } from '../types';

const CourseFilesPage = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const { universities, fetchUniversities } = useCatalogStore();
    const { currentUser } = useAppStore();
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [courseName, setCourseName] = useState('');


    useEffect(() => {
        if (universities.length === 0) {
            fetchUniversities();
        }
    }, [universities.length, fetchUniversities]);

    // SEO meta tags for the public course-files page
    useEffect(() => {
        if (courseName) {
            document.title = `ملفات ${courseName} - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية`;
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', `تصفح ملفات مادة ${courseName} على منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية - معاينة المحتوى الأكاديمي وتحميله بعد التسجيل.`);
            // Canonical URL for this public course-files route
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
    }, [courseName]);

    // SEO: structured data (JSON-LD) for the course files page
    useEffect(() => {
        if (!courseName) return;
        const data = {
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: courseName,
            provider: {
                '@type': 'Organization',
                name: 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية',
                url: 'https://eduai.yemen/',
            },
            hasCourseInstance: files.slice(0, 20).map((f, i) => ({
                '@type': 'MediaObject',
                position: i + 1,
                name: f.name || 'ملف',
                description: f.description || undefined,
            })),
        };
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'jsonld-course-files';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
        return () => {
            document.getElementById('jsonld-course-files')?.remove();
        };
    }, [courseName, files]);

    useEffect(() => {
        if (!courseId) return;

        setLoading(true);

        const loadFiles = async () => {
            try {
                // Load files from Cloud Firestore (single source of truth)
                const filters: FileFilters = {
                    courseId: courseId,
                };

                // Logged-in users read the full collection; guests read the
                // public metadata collection so files are visible without login.
                const listener = currentUser ? listenToCourseFiles : listenToPublicCourseFiles;
                const unsubscribe = listener(filters, (loadedFiles) => {
                    console.log('Loaded files:', loadedFiles);
                    setFiles(loadedFiles);
                    setLoading(false);
                });

                // Find course info from catalog
                let found = false;
                for (const uni of universities) {
                    for (const col of uni.colleges) {
                        for (const maj of col.majors) {
                            const course = maj.courses.find(c => c.id === courseId);
                            if (course) {
                                setCourseName(course.name);
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    if (found) break;
                }

                return unsubscribe;
            } catch (error) {
                console.error('Error loading course files:', error);
                setFiles([]);
                setLoading(false);
            }
        };

        const unsubscribePromise = loadFiles();
        return () => {
            unsubscribePromise.then(unsub => unsub && unsub()).catch(() => { });
        };
    }, [courseId, universities]);

    const course = {
        id: courseId || '',
        name: courseName,

    };

    return (
        <div className="min-h-screen" dir="rtl">
            <HierarchicalSelector universities={universities} courseId={courseId} />

            <div className="mb-6">
                <Link
                    to="/"
                    className="inline-flex items-center text-primary-600 hover:text-primary-700 font-medium"
                >
                    <ArrowRight className="h-4 w-4 ml-1" />
                    العودة للرئيسية
                </Link>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    <p className="mr-4 text-gray-600">جاري تحميل الملفات...</p>
                </div>
            ) : (
                <CourseFilesView
                    course={course}
                    files={files}
                    onClose={() => { }}
                />
            )}
        </div>
    );
};

export default CourseFilesPage;
