import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Download, Eye, File as FileIcon, FileText, HelpCircle, Languages, MessageSquare, Search, Sparkles, X } from 'lucide-react';
import type { File } from '../../types';
import Modal from '../ui/Modal';
import FilePreview from '../ui/FilePreview';
import AIChat from '../ai/AIChat';
import { aiService } from '../../utils/aiService';
import { MarkdownRenderer } from '../markdown';
import { useCatalogStore } from '../../stores/catalogStore';
import { useAppStore } from '../../stores/appStore';
import { downloadFile } from '../../utils/downloadUtils';
import { extractTextPreview, getScannedFileImageAttachments, type ScannedFileAttachment } from '../../services/localFileStorage';
import { downloadCourseFile } from '../../services/courseFilesService';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

interface Course {
    id: string;
    name: string;
}

interface CourseFilesViewProps {
    course: Course;
    files: File[];
    onClose: () => void;
}

type ChatFile = {
    id: string;
    name: string;
    content?: string;
    readable?: boolean;
};

type AIAction = 'summarize' | 'explain' | 'questions' | 'translate' | null;

const CourseFilesView = ({ course, files, onClose }: CourseFilesViewProps) => {
    const { universities } = useCatalogStore();
    const { currentUser } = useAppStore();
    const navigate = useNavigate();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [aiChatOpen, setAiChatOpen] = useState(false);
    const [aiChatFile, setAiChatFile] = useState<ChatFile | null>(null);
    const [aiAction, setAiAction] = useState<AIAction>(null);
    const [aiContent, setAiContent] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [fileSearchQuery, setFileSearchQuery] = useState('');

    // Helper to get university name from catalog
    const getUniversityName = (universityId: string | undefined) => {
        if (!universityId) return 'غير محدد';
        const uni = universities.find((u) => String(u.id) === String(universityId));
        return uni?.name || 'غير محدد';
    };

    const filteredFiles = files.filter(f => {
        const query = fileSearchQuery.toLowerCase();
        return !query || f.name.toLowerCase().includes(query) || f.owner?.name?.toLowerCase().includes(query) || f.professorName?.toLowerCase().includes(query);
    });

    const convertToChatFile = (file: File): ChatFile => {
        const textPreview = file.localTextPreview || '';
        const fileUrl = file.downloadURL || file.url || '';
        const hasValidPreview = textPreview && !textPreview.startsWith('[ملف');
        return {
            id: file.id,
            name: file.name,
            content: hasValidPreview ? textPreview : (fileUrl || undefined),
            readable: hasValidPreview ? true : (textPreview.startsWith('[ملف') ? false : undefined),
        };
    };

    const handleAIAction = async (action: AIAction, file: File) => {
        if (!currentUser) {
            navigate('/login', { state: { from: 'ai' } });
            return;
        }
        setSelectedFile(file);
        setAiAction(action);
        setAiLoading(true);
        setAiContent('');

        let fileText = file.localTextPreview || '';
        const fileUrl = file.downloadURL || file.url || '';
        let fetchedBlob: Blob | null = null;

        const isPlaceholder = !fileText || fileText.startsWith('[ملف');

        if (isPlaceholder && fileUrl) {
            try {
                const proxyUrl = `${API_BASE}/files/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(file.name)}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) {
                    throw new Error(`File proxy responded ${response.status}`);
                }
                const blob = await response.blob();
                fetchedBlob = blob;
                if (blob.type.startsWith('text/') || /\.(txt|md|csv|json|rtf|html|htm|xml|yaml|yml)$/i.test(file.name)) {
                    fileText = await blob.text();
                } else {
                    // For PDF, DOC, PPT and other binary types, try to extract text
                    try {
                        const fileFromBlob = new File([blob], file.name, { type: blob.type });
                        const extractedText = await extractTextPreview(fileFromBlob);
                        if (extractedText && !extractedText.startsWith('[ملف')) {
                            fileText = extractedText;
                        }
                    } catch (e) {
                        console.warn('Failed to extract text from blob:', e);
                    }
                }
            } catch (e) {
                console.warn('Failed to fetch file content for quick action:', e);
            }
        }

        // If we still have no readable text, try to read scanned/image-based
        // files (scanned PDF / image-only PPTX / plain images) via vision/OCR.
        let attachments: ScannedFileAttachment[] | undefined;
        const stillNoText = !fileText || fileText.startsWith('[ملف');
        if (stillNoText) {
            try {
                const scanned = await getScannedFileImageAttachments(file, API_BASE, fetchedBlob);
                if (scanned && scanned.length) {
                    attachments = scanned;
                }
            } catch (e) {
                console.warn('Scanned file image extraction failed:', e);
            }
        }

        if (stillNoText && !attachments) {
            setAiContent('عذراً، لا يمكن قراءة محتوى هذا الملف حالياً. جرّب رفع ملف TXT أو RTF أو MD أو CSV أو JSON، أو صورة واضحة لصفحات المستند.');
            setAiLoading(false);
            return;
        }

        // When text is unavailable, the images carry the content; use a short
        // instruction so the vision/OCR model knows what to do.
        const instructionFor = (verb: string): string =>
            stillNoText ? `الرجاء ${verb} محتوى الملف المرفق (الذي عبارة عن صور ممسوحة للمستند).` : (fileText || '');

        try {
            switch (action) {
                case 'summarize': {
                    const result = await aiService.summarize({ text: instructionFor('تلخيص'), fileName: file.name }, attachments);
                    setAiContent(result.summary);
                    break;
                }
                case 'explain': {
                    const result = await aiService.explain({ concept: file.name, context: stillNoText ? undefined : fileText }, attachments);
                    setAiContent(result.explanation);
                    break;
                }
                case 'questions': {
                    const result = await aiService.generateQuestions({ text: instructionFor('إنشاء أسئلة من'), numQuestions: 5, questionType: 'both' }, attachments);
                    setAiContent(result.questions.map((q, i) => `${i + 1}. ${q.question}\n   ${q.type === 'true-false' ? 'صواب / خطأ' : 'الإجابة: ' + q.answer}`).join('\n\n'));
                    break;
                }
                case 'translate': {
                    const result = await aiService.translate({ text: instructionFor('ترجمة'), targetLanguage: 'الإنجليزية', fileName: file.name }, attachments);
                    setAiContent(result.translatedText);
                    break;
                }
            }
        } catch (error) {
            setAiContent('حدث خطأ في تنفيذ الطلب. يرجى المحاولة مرة أخرى.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleDownload = async (file: File) => {
        if (!currentUser) {
            navigate('/login', { state: { from: 'download' } });
            return;
        }
        // Increment the download counter (best effort).
        if (file.id) {
            downloadCourseFile(file.id).catch(() => { });
        }
        await downloadFile(file.downloadURL || file.url || '', {
            filename: file.name,
        });
    };

    const handlePreview = (file: File) => {
        setSelectedFile(file);
        setPreviewOpen(true);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-start justify-center pt-16 sm:pt-20 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-gradient-to-br from-white to-[#F9F0E6]/30 dark:from-slate-800 dark:to-slate-900 backdrop-blur-xl rounded-2xl shadow-2xl shadow-[#7B4D2A]/10 max-w-5xl w-full max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto border border-[#E8C9A8]/50 dark:border-[#5C3A1E]/30" onClick={e => e.stopPropagation()}>
                {/* Header - warm brown */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#F9F0E6] via-[#F2E0CE]/50 to-[#FFFBEB] dark:from-slate-700 dark:via-[#3B2314]/50 dark:to-[#5C3A1E]/50 p-4 sm:p-6">
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#F2E0CE] to-[#E8C9A8] text-[#7B4D2A] dark:from-white/20 dark:to-white/10 dark:text-white backdrop-blur-sm animate-float-icon">
                                <FileIcon className="h-5 w-5" />
                            </span>
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">{course.name}</h2>
                                <p className="text-primary-100 text-xs sm:text-sm mt-0.5">
                                    {filteredFiles.length} ملف
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 hover:scale-110"
                            title="إغلاق"
                            aria-label="إغلاق"
                        >
                            <X className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>
                    <div className="relative z-10 mt-4">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="البحث في ملفات المادة..."
                                value={fileSearchQuery}
                                onChange={(e) => setFileSearchQuery(e.target.value)}
                                className="w-full pr-10 pl-4 py-2.5 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-white/50 dark:focus:ring-slate-500/50 bg-white/90 dark:bg-slate-700/90 backdrop-blur-sm border border-white/20"
                            />
                        </div>
                    </div>
                </div>

                {/* Files List */}
                <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
                    {filteredFiles.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/30 flex items-center justify-center animate-bounce-in">
                                <FileText className="h-8 w-8 text-primary-400 dark:text-primary-300" />
                            </div>
                            <p className="text-lg font-medium text-slate-600 dark:text-slate-300">لا توجد ملفات</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">لم يتم رفع أي ملفات لهذه المادة بعد</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" style={{ display: 'grid' }}>
                            {filteredFiles.map((file, index) => (
                                <div
                                    key={file.id}
                                    className={`animate-card-appear rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-gradient-to-br from-white to-primary-50/30 dark:from-slate-800 dark:to-slate-900 shadow-sm hover:shadow-lg hover:shadow-primary-500/10 dark:hover:shadow-primary-900/30 hover:-translate-y-1 hover:border-primary-200/60 dark:hover:border-primary-700/40 transition-all duration-300 ease-spring p-4 w-full ${file.storageMode === 'local' ? 'card-accent-doc' : 'card-accent-other'}`}
                                    style={{ animationDelay: `${index * 80}ms` }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${file.storageMode === 'local'
                                            ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 dark:from-amber-900/50 dark:to-amber-800/50 dark:text-amber-300'
                                            : 'bg-gradient-to-br from-primary-100 to-primary-200 text-primary-700 dark:from-primary-900/50 dark:to-primary-800/50 dark:text-primary-300'
                                            }`}>
                                            <FileIcon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">{file.name}</p>
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 animate-tag-pop ${file.storageMode === 'local'
                                                    ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800'
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                                    }`}>
                                                    {file.storageMode === 'local' ? 'محلي' : 'سحابة'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                <span className="font-medium text-primary-600 dark:text-primary-400">{(file.courseName && file.courseName !== file.courseId) ? file.courseName : course.name}</span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span>{(file.universityName && file.universityName !== file.universityId) ? file.universityName : getUniversityName(file.universityId)}</span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span>{file.size ? Math.round(file.size / 1024) + ' KB' : '—'}</span>
                                                {file.professorName && (
                                                    <>
                                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                                        <span className="text-primary-500 dark:text-primary-400">{file.professorName}</span>
                                                    </>
                                                )}
                                            </div>
                                            {file.owner?.name && (
                                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                                    👤 {file.owner.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-brown-100/80 dark:border-brown-700/30">
                                        <button
                                            onClick={() => handlePreview(file)}
                                            className="btn-modern-ghost p-1.5"
                                            title="معاينة"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleAIAction('translate', file)}
                                            className="btn-modern-ghost p-1.5 text-secondary-600 hover:text-secondary-700 hover:bg-secondary-50 dark:text-secondary-400 dark:hover:bg-secondary-900/20"
                                            title="ترجمة"
                                        >
                                            <Languages className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleAIAction('summarize', file)}
                                            className="btn-modern-ghost p-1.5 text-sage-600 hover:text-sage-700 hover:bg-sage-50 dark:text-sage-400 dark:hover:bg-sage-900/20"
                                            title="تلخيص"
                                        >
                                            <FileText className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleAIAction('explain', file)}
                                            className="btn-modern-ghost p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                                            title="شرح"
                                        >
                                            <Sparkles className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleAIAction('questions', file)}
                                            className="btn-modern-ghost p-1.5 text-secondary-600 hover:text-secondary-700 hover:bg-secondary-50 dark:text-secondary-400 dark:hover:bg-secondary-900/20"
                                            title="أسئلة"
                                        >
                                            <HelpCircle className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!currentUser) {
                                                    navigate('/login', { state: { from: 'ai' } });
                                                    return;
                                                }
                                                const { setAiChatOpenMode } = useAppStore.getState();
                                                const chatFile = convertToChatFile(file);
                                                setAiChatFile(chatFile);
                                                setAiChatOpenMode('resume-if-recent');
                                                setAiChatOpen(true);
                                            }}
                                            className="btn-modern-ai p-1.5"
                                            title="اسأل الذكاء الاصطناعي"
                                            aria-label="اسأل الذكاء الاصطناعي"
                                        >
                                            <Bot className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDownload(file)}
                                            className="btn-modern-primary p-1.5"
                                            title="تحميل"
                                        >
                                            <Download className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* File Preview Modal */}
            <FilePreview
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
                file={selectedFile}
            />

            {/* AI Chat Modal */}
            {aiChatOpen && aiChatFile && (
                <AIChat
                    isOpen={aiChatOpen}
                    onClose={() => { setAiChatOpen(false); setAiChatFile(null); }}
                    courseFiles={[aiChatFile]}
                    allFiles={[]}
                    currentUser={currentUser}
                    initialSelectedFile={aiChatFile}
                />
            )}

            {/* AI Result Modal */}
            <Modal
                fullScreen
                isOpen={aiAction !== null}
                onClose={() => { setAiAction(null); setAiContent(''); setSelectedFile(null); }}
            >
                <div className="p-6">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                        {aiAction === 'summarize' && <span className="inline-flex items-center gap-2"><FileText className="h-6 w-6 text-emerald-500" /> تلخيص الملف</span>}
                        {aiAction === 'explain' && <span className="inline-flex items-center gap-2"><Sparkles className="h-6 w-6 text-violet-500" /> شرح المحتوى</span>}
                        {aiAction === 'questions' && <span className="inline-flex items-center gap-2"><HelpCircle className="h-6 w-6 text-amber-500" /> أسئلة الاختبار</span>}
                        {aiAction === 'translate' && <span className="inline-flex items-center gap-2"><Languages className="h-6 w-6 text-sky-500" /> ترجمة الملف</span>}
                    </h3>
                    {aiLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                            <p className="mr-4 text-slate-600 dark:text-slate-300">جاري المعالجة...</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 max-h-[60vh] overflow-y-auto">
                            <div className="prose max-w-none text-slate-800 dark:text-slate-200 leading-relaxed">
                                <MarkdownRenderer content={aiContent} />
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default CourseFilesView;
