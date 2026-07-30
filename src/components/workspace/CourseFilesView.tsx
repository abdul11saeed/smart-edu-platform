import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Eye, Sparkles, X, Search } from 'lucide-react';
import { aiService } from '../../utils/aiService';
import { extractTextPreview } from '../../services/localFileStorage';
import { MarkdownRenderer } from '../markdown';

interface CourseFilesViewProps {
    courseId?: string;
    courseName?: string;
    course?: { id: string; name: string };
    files: any[];
    onFileDeleted?: (fileId: string) => void;
    onClose?: () => void;
}

const CourseFilesView = ({ courseId: _courseId, courseName: _courseName, course: _course, files, onFileDeleted: _onFileDeleted, onClose: _onClose }: CourseFilesViewProps) => {
    const { t, i18n } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState<any>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiContent, setAiContent] = useState<string | null>(null);
    const [aiAction, setAiAction] = useState<string | null>(null);
    const [fileTextPreview, setFileTextPreview] = useState<Record<string, string>>({});
    const [isExtracting, setIsExtracting] = useState(false);

    const getUniversityName = (universityId: string | undefined) => {
        if (!universityId) return t('common.notSpecified');
        return universityId;
    };

    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return files;
        const q = searchQuery.toLowerCase();
        return files.filter((f: any) =>
            (f.name || '').toLowerCase().includes(q) ||
            getUniversityName(f.universityId).toLowerCase().includes(q) ||
            (f.collegeName || '').toLowerCase().includes(q) ||
            (f.majorName || '').toLowerCase().includes(q) ||
            (f.courseName || '').toLowerCase().includes(q) ||
            (f.professorName || '').toLowerCase().includes(q)
        );
    }, [files, searchQuery]);

    const handlePreview = async (file: any) => {
        setSelectedFile(file);
        setIsPreviewOpen(true);
        setAiContent(null);
        setAiAction(null);

        let textPreview = file.localTextPreview;
        if (!textPreview || ['[ملف', '[File'].some(prefix => textPreview.startsWith(prefix))) {
            setIsExtracting(true);
            try {
                const extractedText = await extractTextPreviewForFile(file);
                if (extractedText && !['[ملف', '[File'].some(prefix => extractedText.startsWith(prefix))) {
                    textPreview = extractedText;
                    setFileTextPreview(prev => ({ ...prev, [file.id]: extractedText }));
                }
            } catch {
                // ignore extraction errors
            } finally {
                setIsExtracting(false);
            }
        }
        setPreviewContent(textPreview || null);
    };

    const extractTextPreviewForFile = async (file: any): Promise<string> => {
        try {
            const fileUrl = file.downloadURL || file.url || '';
            if (!fileUrl) return t('courseFiles.noUrl');

            const proxyUrl = `${import.meta.env.VITE_API_BASE_URL || '/api'}/files/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(file.name || 'file')}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`File proxy responded ${response.status}`);

            const blob = await response.blob();
            const fileName = (file.name || 'file').toLowerCase();

            if (blob.type.startsWith('text/') || /\.(txt|md|markdown|csv|json|rtf|html|htm|xml|yaml|yml)$/i.test(fileName)) {
                return await blob.text();
            } else if (blob.type.startsWith('image/')) {
                return t('courseFiles.imageFile');
            } else {
                const fileFromBlob = new File([blob], file.name || 'file', { type: blob.type });
                const extractedText = await extractTextPreview(fileFromBlob);
                return extractedText || t('courseFiles.unsupportedFile');
            }
        } catch {
            return t('courseFiles.readError');
        }
    };

    const handleAIAction = async (action: string) => {
        if (!selectedFile) return;
        setAiAction(action);
        setAiLoading(true);
        setAiContent(null);

        try {
            const text = previewContent || selectedFile.content || '';
            switch (action) {
                case 'summarize': {
                    const result = await aiService.summarize({ text, fileName: selectedFile.name });
                    setAiContent(result.summary);
                    break;
                }
                case 'explain': {
                    const result = await aiService.explain({ concept: text, context: text });
                    setAiContent(result.explanation);
                    break;
                }
                case 'questions': {
                    const result = await aiService.generateQuestions({ text, questionType: 'both', numQuestions: 5 });
                    setAiContent(result.questions.map((q: any, i: number) => `${i + 1}. ${q.question}\n   ${q.type === 'true-false' ? t('ai.questions.trueFalse') : t('ai.questions.answer') + ': ' + q.answer}`).join('\n\n'));
                    break;
                }
                case 'translate': {
                    const result = await aiService.translate({ text, targetLanguage: i18n.language === 'ar' ? 'ar' : 'en', fileName: selectedFile.name });
                    setAiContent(result.translatedText);
                    break;
                }
                default:
                    break;
            }
        } catch (error) {
            console.error('Error executing AI action:', error);
            setAiContent(t('ai.errorProcessing'));
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
            <div className="flex items-center gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('studentHome.searchFilesPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-gray-100"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file: any) => (
                    <div key={file.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary-500" />
                                <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</h4>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${file.storageMode === 'local' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                {file.storageMode === 'local' ? t('studentHome.local') : t('studentHome.cloud')}
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            {t('courseFiles.loading')}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePreview(file)}
                                className="btn-modern-ghost p-1.5"
                                title={t('studentHome.preview')}
                            >
                                <Eye className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handleAIAction('summarize')}
                                className="btn-modern-ghost p-1.5 text-sage-600 hover:text-sage-700 hover:bg-sage-50 dark:text-sage-400 dark:hover:bg-sage-900/20"
                                title={t('ai.tools.summarize')}
                            >
                                <FileText className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handleAIAction('explain')}
                                className="btn-modern-ghost p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
                                title={t('ai.tools.explain')}
                            >
                                <Sparkles className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {isPreviewOpen && selectedFile && (
                <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setIsPreviewOpen(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedFile.name}</h3>
                            <button onClick={() => setIsPreviewOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                            {previewContent ? (
                                <div className="prose max-w-none">
                                    <MarkdownRenderer content={previewContent} />
                                </div>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">{t('studentHome.filePreview')}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CourseFilesView;
