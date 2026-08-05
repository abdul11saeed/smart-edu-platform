import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    AlertCircle,
    ArrowUpDown,
    BookOpen,
    ChevronDown,
    Download,
    Eye,
    FileText,
    Languages,
    Search,
    Sparkles,
} from 'lucide-react';
import { Course as CourseType, File as FileType, University, College, Major } from '../../types';

import { useAppStore } from '../../stores/appStore';
import { listenToCourseFiles, listenToPublicCourseFiles, downloadCourseFile, FileFilters } from '../../services/courseFilesService';
import Modal from '../ui/Modal';
import FilePreview from '../ui/FilePreview';
import Summarizer from '../ai/Summarizer';
import { logAiToolUsage, logOpenFile } from '../../services/activityService';

import Explainer from '../ai/Explainer';
import QuestionGenerator from '../ai/QuestionGenerator';
import Translator from '../ai/Translator';
import { downloadFile, formatFileSize } from '../../utils/downloadUtils';
import { recommendationService } from '../../services/recommendationService';

interface CourseFilesTabProps {
    courseId: string;
    course: CourseType;
    university: University;
    college: College;
    major: Major;
}

type SortOption = 'newest' | 'largest' | 'ai';

type AutoTagType =
    | 'summary'
    | 'exam'
    | 'lecture'
    | 'exercises'
    | 'homework'
    | 'pdf'
    | 'document'
    | 'slides'
    | 'other';

const CourseFilesTab = ({ courseId, course, university, college, major }: CourseFilesTabProps) => {
    // keep props for suggested resources logic
    void college;
    void major;
    const { t, i18n } = useTranslation();

    const { currentCourseFiles, setCurrentCourseFiles, currentUser } = useAppStore();
    const navigate = useNavigate();

    const [isDownloading, setIsDownloading] = useState<{ filename: string; percent: number; indeterminate: boolean } | null>(null);
    const [activeModal, setActiveModal] = useState<'summarizer' | 'explainer' | 'questions' | 'translator' | null>(null);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [selectedFileContent, setSelectedFileContent] = useState<string>('');
    const [selectedFileObj, setSelectedFileObj] = useState<FileType | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('newest');
    const [filesToShow, setFilesToShow] = useState<number>(5);
    const [previewFile, setPreviewFile] = useState<FileType | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewAnchorRect, setPreviewAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

    // Initialize filesToShow to 5 only on first load
    const hasInitialized = useRef(false);

    useEffect(() => {
        if (!hasInitialized.current && currentCourseFiles.length > 0) {
            setFilesToShow(5);
            hasInitialized.current = true;
        }
    }, [currentCourseFiles.length]);

    useEffect(() => {
        const filters: FileFilters = {
            courseId: courseId,
        };
        // Guests read the public metadata collection so files are visible without login.
        const listener = currentUser ? listenToCourseFiles : listenToPublicCourseFiles;
        const unsubscribe = listener(filters, (files) => {
            setCurrentCourseFiles(files);
        });

        return () => {
            unsubscribe();
        };
    }, [courseId, setCurrentCourseFiles]);

    const canUseAIWithFile = (file: FileType) => {
        const preview = file.localTextPreview;
        return Boolean(preview && !['[ملف', '[File'].some(prefix => preview.startsWith(prefix)));
    };

    const getFileContent = (file: FileType) => {
        return file.localTextPreview || '';
    };

    const getAutoTag = (file: FileType): AutoTagType => {
        const name = (file.name || '').toLowerCase();
        const preview = (file.localTextPreview || '').toLowerCase();
        const haystack = `${name} ${preview}`;

        const includesAny = (arr: string[]) => arr.some((k) => haystack.includes(k));

        if (includesAny(['ملخص', 'summary', 'ملخّص', 'key points', 'points'])) return 'summary';
        if (includesAny(['امتحان', 'سابق', 'midterm', 'final exam', 'exam', 'questions'])) return 'exam';
        if (includesAny(['محاضرة', 'lecture'])) return 'lecture';
        if (includesAny(['تدريبات', 'training', 'practice', 'exercises'])) return 'exercises';
        if (includesAny(['واجب', 'assignment', 'homework'])) return 'homework';

        if (file.type === 'pdf') return 'pdf';
        if (file.type === 'doc') return 'document';
        if (file.type === 'ppt') return 'slides';

        return 'other';
    };

    const getTagLabel = (tag: AutoTagType): string => {
        const labelMap: Record<AutoTagType, string> = {
            summary: t('courseFiles.autoTags.summary'),
            exam: t('courseFiles.autoTags.exam'),
            lecture: t('courseFiles.autoTags.lecture'),
            exercises: t('courseFiles.autoTags.exercises'),
            homework: t('courseFiles.autoTags.homework'),
            pdf: t('courseFiles.autoTags.pdf'),
            document: t('courseFiles.autoTags.document'),
            slides: t('courseFiles.autoTags.slides'),
            other: t('courseFiles.autoTags.other'),
        };
        return labelMap[tag] || tag;
    };

    const getTagStyle = (tag: AutoTagType) => {
        switch (tag) {
            case 'summary':
                return { bg: 'bg-sage-50', text: 'text-sage-700', border: 'border-sage-200', darkBg: 'dark:bg-sage-950', darkText: 'dark:text-sage-300', darkBorder: 'dark:border-sage-800' };
            case 'exam':
                return { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200', darkBg: 'dark:bg-primary-950', darkText: 'dark:text-primary-300', darkBorder: 'dark:border-primary-800' };
            case 'lecture':
                return { bg: 'bg-secondary-50', text: 'text-secondary-700', border: 'border-secondary-200', darkBg: 'dark:bg-secondary-950', darkText: 'dark:text-secondary-300', darkBorder: 'dark:border-secondary-800' };
            case 'exercises':
                return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', darkBg: 'dark:bg-amber-950', darkText: 'dark:text-amber-300', darkBorder: 'dark:border-amber-800' };
            case 'homework':
                return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', darkBg: 'dark:bg-rose-950', darkText: 'dark:text-rose-300', darkBorder: 'dark:border-rose-800' };
            case 'pdf':
                return { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-200', darkBg: 'dark:bg-primary-950', darkText: 'dark:text-primary-300', darkBorder: 'dark:border-primary-800' };
            case 'document':
                return { bg: 'bg-secondary-50', text: 'text-secondary-700', border: 'border-secondary-200', darkBg: 'dark:bg-secondary-950', darkText: 'dark:text-secondary-300', darkBorder: 'dark:border-secondary-800' };
            case 'slides':
                return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', darkBg: 'dark:bg-amber-950', darkText: 'dark:text-amber-300', darkBorder: 'dark:border-amber-800' };
            default:
                return { bg: 'bg-brown-50', text: 'text-brown-700', border: 'border-brown-200', darkBg: 'dark:bg-brown-900', darkText: 'dark:text-brown-300', darkBorder: 'dark:border-brown-700' };
        }
    };

    // Proxy score: "الأكثر استخداماً للـ AI" بناءً على قابلية الاستخدام + طول النص المستخلص
    const aiUsageScore = (file: FileType) => {
        if (!canUseAIWithFile(file)) return 0;
        const len = (file.localTextPreview || '').length;
        return Math.min(len, 200000);
    };

    const filteredAndSortedFiles = useMemo(() => {
        const query = searchQuery.toLowerCase();

        const filtered = currentCourseFiles.filter((file: FileType) => {
            return (
                file.name.toLowerCase().includes(query) ||
                file.courseName?.toLowerCase().includes(query) ||
                file.owner?.name?.toLowerCase().includes(query) ||
                file.professorName?.toLowerCase().includes(query) ||
                file.localTextPreview?.toLowerCase().includes(query)
            );
        });

        const sorted = [...filtered].sort((a: FileType, b: FileType) => {
            if (sortOption === 'newest') {
                const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return bT - aT;
            }
            if (sortOption === 'largest') {
                return (b.size || 0) - (a.size || 0);
            }
            return aiUsageScore(b) - aiUsageScore(a);
        });

        return sorted;
    }, [currentCourseFiles, searchQuery, sortOption]);

    // Reset filesToShow when filtering changes or initial load
    useEffect(() => {
        // Reset to 5 when search query changes or sorting changes
        // Only when we have initial data (not on first mount)
        if (currentCourseFiles.length > 0) {
            setFilesToShow(5);
        }
    }, [searchQuery, sortOption]);

    // Feed file-search queries into the recommendation engine (interest signal).
    // Debounced and fire-and-forget so it never blocks the UI or the search.
    useEffect(() => {
        const q = searchQuery.trim();
        if (!q || !currentUser?.id) return;
        const t = setTimeout(() => {
            recommendationService.trackSearch(q, currentUser.id).catch(() => { });
        }, 800);
        return () => clearTimeout(t);
    }, [searchQuery, currentUser?.id]);

    const handlePreview = (file: FileType, anchor?: HTMLElement) => {
        setPreviewFile(file);
        if (anchor) {
            const rect = anchor.getBoundingClientRect();
            setPreviewAnchorRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        } else {
            setPreviewAnchorRect(null);
        }
        setPreviewOpen(true);
    };

    const handleDownload = async (file: FileType, filename: string) => {
        if (!currentUser) {
            navigate('/login', { state: { from: 'download' } });
            return;
        }
        // Increment the download counter (best effort — never blocks the actual download).
        if (file.id) {
            downloadCourseFile(file.id).catch(() => { });
        }
        setIsDownloading({ filename, percent: 0, indeterminate: true });
        await downloadFile(file.downloadURL || file.url || '', {
            filename,
            onProgress: (percent, _loaded, total) => setIsDownloading({ filename, percent, indeterminate: !total }),
            onComplete: () => setIsDownloading(null),
            onError: () => setIsDownloading(null),
        });
    };

    const openFileTool = async (
        file: FileType,
        tool: 'summarizer' | 'explainer' | 'questions' | 'translator'
    ) => {
        if (!currentUser) {
            navigate('/login', { state: { from: 'ai' } });
            return;
        }
        const content = getFileContent(file);
        setSelectedFile(file.name);
        setSelectedFileContent(content);
        setSelectedFileObj(file);
        setActiveModal(tool);

        // Track: open file + AI tool usage
        try {
            if (currentUser?.id) {
                await logOpenFile(currentUser.id, {
                    fileId: file.id,
                    fileName: file.name,
                    courseId: file.courseId,
                    courseName: file.courseName,
                    openedAt: Date.now(),
                });

                await logAiToolUsage(currentUser.id, {
                    toolType: tool,
                    fileId: file.id,
                    fileName: file.name,
                    courseId: file.courseId,
                    courseName: file.courseName,
                    usedAt: Date.now(),
                });
            }
        } catch (e) {
            console.warn('Failed to log activity:', e);
        }
    };

    return (
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="space-y-6">
            {/* Search, Sort - Vibrant Gradient Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <Search className="h-5 w-5 text-primary-400" />
                    </div>
                    <input
                        type="text"
                        placeholder={t('courseFiles.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 border border-brown-200 dark:border-brown-600 rounded-xl bg-white dark:bg-brown-800 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-600"
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="text-sm text-brown-700 dark:text-neutral-200 whitespace-nowrap bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-950/50 dark:to-secondary-950/50 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-primary-200/60 dark:border-primary-700/40 font-semibold shadow-sm shadow-primary-500/5">
                        {t('courseFiles.filesCount', { count: filteredAndSortedFiles.length })}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-brown-500 dark:text-neutral-400 whitespace-nowrap">{t('courseFiles.sortLabel')}</span>
                        <div className="relative">
                            <select
                                aria-label={t('courseFiles.sortFiles')}
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as SortOption)}
                                className="appearance-none py-2 pl-8 pr-3 border border-brown-200 dark:border-brown-600 rounded-xl bg-white dark:bg-brown-800 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm transition-all duration-200 hover:border-primary-300 dark:hover:border-primary-600"
                            >
                                <option value="newest">{t('courseFiles.sortNewest')}</option>
                                <option value="largest">{t('courseFiles.sortLargest')}</option>
                                <option value="ai">{t('courseFiles.sortAI')}</option>
                            </select>
                            <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Files Grid */}
            {filteredAndSortedFiles.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-br from-primary-50/50 to-secondary-50/50 dark:from-primary-950/30 dark:to-secondary-950/30 backdrop-blur-sm rounded-2xl border border-dashed border-primary-200 dark:border-primary-700">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-600 to-secondary-500 text-white flex items-center justify-center animate-bounce-in shadow-lg shadow-primary-500/25">
                        <FileText className="h-8 w-8" />
                    </div>
                    <p className="text-lg font-medium text-brown-700 dark:text-neutral-200">{t('courseFiles.noFilesYet')}</p>
                    <p className="text-sm text-brown-500 dark:text-neutral-400 mt-1">{t('courseFiles.beFirstToUpload')}</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" style={{ display: 'grid' }}>
                        {filteredAndSortedFiles.slice(0, filesToShow).map((file: FileType, index: number) => {
                            const tag = getAutoTag(file);
                            const tagStyle = getTagStyle(tag);

                            return (
                                <div
                                    key={file.id}
                                    className={`animate-card-appear rounded-2xl border border-brown-200/80 dark:border-brown-700/60 bg-gradient-to-br from-white to-primary-50/30 dark:from-brown-900 dark:to-brown-950 shadow-sm hover:shadow-xl hover:shadow-primary-500/10 dark:hover:shadow-primary-900/30 hover:-translate-y-1 hover:border-primary-200/60 dark:hover:border-primary-700/40 transition-all duration-300 ease-spring p-4 w-full ${file.type === 'pdf' ? 'card-accent-pdf' : file.type === 'doc' ? 'card-accent-doc' : file.type === 'ppt' ? 'card-accent-ppt' : 'card-accent-other'}`}
                                    style={{ animationDelay: `${index * 60}ms` }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${file.type === 'pdf'
                                                ? 'bg-gradient-to-br from-primary-800 to-primary-900 text-white shadow-primary-500/20'
                                                : file.type === 'doc'
                                                    ? 'bg-gradient-to-br from-secondary-600 to-secondary-700 text-white shadow-secondary-500/20'
                                                    : file.type === 'ppt'
                                                        ? 'bg-gradient-to-br from-primary-700 to-secondary-700 text-white shadow-primary-500/20'
                                                        : 'bg-gradient-to-br from-primary-700 to-secondary-600 text-white shadow-primary-500/20'
                                            }`}>
                                            <FileText className="h-5 w-5" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-semibold text-brown-900 dark:text-neutral-100 truncate text-sm">{file.name}</p>

                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border animate-tag-pop ${tagStyle.bg} ${tagStyle.text} ${tagStyle.border} ${tagStyle.darkBg} ${tagStyle.darkText} ${tagStyle.darkBorder}`}
                                                    title={t('courseFiles.autoTag')}
                                                >
                                                    {getTagLabel(tag)}
                                                </span>
                                            </div>

                                            <p className="text-xs text-brown-500 dark:text-neutral-400 mt-1">
                                                <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-500 dark:from-primary-300 dark:to-secondary-400">{(file.courseName && file.courseName !== file.courseId) ? file.courseName : course.name}</span>
                                                <span className="text-brown-300 dark:text-brown-600 mx-1">•</span>
                                                <span>{file.universityName || university.name}</span>
                                                <span className="text-brown-300 dark:text-brown-600 mx-1">•</span>
                                                <span>{formatFileSize(file.size || 0)}</span>
                                                {file.professorName && (
                                                    <>
                                                        <span className="text-brown-300 dark:text-brown-600 mx-1">•</span>
                                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-secondary-500 dark:from-primary-300 dark:to-secondary-400">{file.professorName}</span>
                                                    </>
                                                )}
                                            </p>

                                            {file.owner?.name && (
                                                <p className="text-xs text-brown-400 dark:text-neutral-500 mt-0.5">
                                                    <svg className="h-3 w-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                                    {file.owner.name}
                                                </p>
                                            )}

                                            {file.storageMode === 'local' && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 px-2 py-0.5 rounded-full w-fit border border-amber-200 dark:border-amber-800/40">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {t('courseFiles.storedLocally')}
                                                </p>
                                            )}

                                            {canUseAIWithFile(file) && (
                                                <p className="text-xs text-brown-400 dark:text-neutral-500 mt-1 max-w-md truncate italic">{file.localTextPreview?.slice(0, 120)}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-brown-100/80 dark:border-brown-700/30">
                                        <button
                                            onClick={(e) => handlePreview(file, e.currentTarget)}
                                            className="btn-modern-ghost p-1.5"
                                            title={t('courseFiles.preview')}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => openFileTool(file, 'summarizer')}
                                            className="btn-modern-ghost p-1.5 text-sage-600 hover:text-sage-700 hover:bg-sage-50 dark:text-sage-400 dark:hover:bg-sage-900/20"
                                            title={t('courseFiles.summarize')}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </button>

                                        <button
                                            onClick={() => openFileTool(file, 'explainer')}
                                            className="btn-modern-ghost p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                                            title={t('courseFiles.explain')}
                                        >
                                            <BookOpen className="h-3.5 w-3.5" />
                                        </button>

                                        <button
                                            onClick={() => openFileTool(file, 'translator')}
                                            className="btn-modern-ghost p-1.5 text-secondary-600 hover:text-secondary-700 hover:bg-secondary-50 dark:text-secondary-400 dark:hover:bg-secondary-900/20"
                                            title={t('courseFiles.translate')}
                                        >
                                            <Languages className="h-3.5 w-3.5" />
                                        </button>

                                        <button
                                            onClick={() => openFileTool(file, 'questions')}
                                            className="btn-modern-ghost p-1.5 text-secondary-600 hover:text-secondary-700 hover:bg-secondary-50 dark:text-secondary-400 dark:hover:bg-secondary-900/20"
                                            title={t('courseFiles.generateQuestions')}
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </button>

                                        {isDownloading && isDownloading.filename === file.name ? (
                                            <div className="flex items-center gap-2 w-32" title={t('filePreview.downloading')}>
                                                <div className="flex-1 h-1.5 rounded-full bg-brown-200 dark:bg-brown-600 overflow-hidden">
                                                    <div
                                                        className={`h-full bg-primary-600 dark:bg-primary-400 transition-all duration-150 ${isDownloading.indeterminate ? 'w-2/5 animate-pulse' : ''}`}
                                                        style={isDownloading.indeterminate ? undefined : { width: `${isDownloading.percent}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs text-primary-600 dark:text-primary-400 whitespace-nowrap font-medium">
                                                    {isDownloading.indeterminate ? '…' : `${isDownloading.percent}%`}
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleDownload(file, file.name)}
                                                className="btn-modern-primary p-1.5"
                                                title={t('courseFiles.download')}
                                                disabled={!!isDownloading}
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Load More Button */}
                    {filteredAndSortedFiles.length > filesToShow && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={() => setFilesToShow(prev => Math.min(prev + 5, filteredAndSortedFiles.length))}
                                className="btn-modern-primary"
                            >
                                {t('courseFiles.showMore', { count: Math.max(0, filteredAndSortedFiles.length - filesToShow) })}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* AI Modals */}
            <Modal fullScreen isOpen={activeModal === 'summarizer'} onClose={() => setActiveModal(null)}>
                <Summarizer fileName={selectedFile} fileContent={selectedFileContent} file={selectedFileObj || undefined} onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal fullScreen isOpen={activeModal === 'explainer'} onClose={() => setActiveModal(null)}>
                <Explainer topic={selectedFileContent || course.name} file={selectedFileObj || undefined} onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal fullScreen isOpen={activeModal === 'questions'} onClose={() => setActiveModal(null)}>
                <QuestionGenerator fileName={selectedFile} fileContent={selectedFileContent} onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal fullScreen isOpen={activeModal === 'translator'} onClose={() => setActiveModal(null)}>
                <Translator fileName={selectedFile} fileContent={selectedFileContent} file={selectedFileObj || undefined} onClose={() => setActiveModal(null)} />
            </Modal>

            <FilePreview
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
                file={previewFile}
                anchorRect={previewAnchorRect}
            />
        </div>
    );
};

export default CourseFilesTab;
