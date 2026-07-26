import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText } from 'lucide-react';
import { File } from '../../types';
import { downloadFile } from '../../utils/downloadUtils';
import { downloadCourseFile } from '../../services/courseFilesService';
import { useAppStore } from '../../stores/appStore';

interface FilePreviewProps {
    isOpen: boolean;
    onClose: () => void;
    file: File | null;
}

const FilePreview = ({ isOpen, onClose, file }: FilePreviewProps) => {
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [dlProgress, setDlProgress] = useState<{ percent: number; indeterminate: boolean } | null>(null);
    const { currentUser } = useAppStore();
    const navigate = useNavigate();

    useEffect(() => {
        if (isOpen && file) {
            setPreviewContent(null);

            if (file.localTextPreview) {
                setPreviewContent(file.localTextPreview);
            } else if (file.localDataUrl) {
                setPreviewContent(file.localDataUrl);
            } else if (file.url && file.url.startsWith('data:')) {
                setPreviewContent(file.url);
            } else {
                setPreviewContent(null);
            }
        }
    }, [isOpen, file]);

    if (!isOpen || !file) return null;

    const isImage = file.mimeType?.startsWith('image/') || file.fileExtension?.match(/^(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
    const isPDF = file.type === 'pdf' || file.fileExtension === 'pdf';
    const isText = !isImage && !isPDF && file.localTextPreview;

    const renderPreview = () => {
        if (isImage && previewContent) {
            return (
                <div className="flex items-center justify-center">
                    <img
                        src={previewContent}
                        alt={file.name}
                        className="max-w-full max-h-[60vh] rounded-lg shadow-lg"
                    />
                </div>
            );
        }

        if (isPDF) {
            return (
                <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto mb-4 text-[#7B4D2A]" />
                    <p className="text-brown-800 dark:text-neutral-100 font-medium mb-2">معاينة PDF</p>
                    {currentUser ? (
                        <>
                            <p className="text-sm text-brown-600 dark:text-neutral-300 mb-4">لا يمكن عرض PDF مباشرة. يمكنك تحميل الملف للاطلاع عليه.</p>
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                فتح في نافذة جديدة
                            </a>
                        </>
                    ) : (
                        <p className="text-sm text-brown-600 dark:text-neutral-300 mb-4">سجّل دخولك لتحميل ملف PDF والمعاينة الكاملة.</p>
                    )}
                </div>
            );
        }

        if (isText && previewContent) {
            return (
                <div className="bg-brown-50 dark:bg-brown-800/50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-brown-800 dark:text-neutral-200 font-mono leading-relaxed">
                        {previewContent}
                    </pre>
                </div>
            );
        }

        return (
            <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-brown-300 dark:text-brown-600" />
                <p className="text-brown-700 dark:text-neutral-200 font-medium">لا توجد معاينة متاحة</p>
                <p className="text-sm text-brown-500 dark:text-neutral-400 mt-1">
                    {currentUser ? 'يمكنك تحميل الملف للاطلاع عليه' : 'سجّل دخولك لتحميل الملف والمعاينة الكاملة'}
                </p>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-start justify-center pt-16 sm:pt-20 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-gradient-to-br from-white to-[#F9F0E6]/30 dark:from-brown-800 dark:to-brown-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto border border-[#E8C9A8]/50 dark:border-brown-700/50" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-l from-[#5C3A1E] to-[#7B4D2A] p-4 sm:p-5 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold truncate">{file.name}</h3>
                        <p className="text-[#F2E0CE] text-xs sm:text-sm mt-1">
                            {file.size ? Math.round(file.size / 1024) + ' KB' : '—'} • {file.fileExtension?.toUpperCase() || 'ملف'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        title="إغلاق"
                    >
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 12rem)' }}>
                    {renderPreview()}
                </div>

                {/* File Details */}
                <div className="border-t border-[#E8C9A8]/50 p-4 sm:p-6">
                    <h4 className="text-sm font-semibold text-brown-500 uppercase tracking-wider mb-3">مواصفات الملف</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {file.universityName && (
                            <div>
                                <span className="text-brown-500">الجامعة: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.universityName}</span>
                            </div>
                        )}
                        {file.collegeName && (
                            <div>
                                <span className="text-brown-500">الكلية: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.collegeName}</span>
                            </div>
                        )}
                        {file.majorName && (
                            <div>
                                <span className="text-brown-500">التخصص: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.majorName}</span>
                            </div>
                        )}
                        {file.courseName && (
                            <div>
                                <span className="text-brown-500">المقرر: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.courseName}</span>
                            </div>
                        )}
                        {file.professorName && (
                            <div>
                                <span className="text-brown-500">الدكتور: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">د. {file.professorName}</span>
                            </div>
                        )}
                        {file.term && (
                            <div>
                                <span className="text-brown-500">الترم: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.term === 'first' ? 'الترم الأول' : 'الترم الثاني'}</span>
                            </div>
                        )}
                        {file.level && (
                            <div>
                                <span className="text-brown-500">المستوى: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.level}</span>
                            </div>
                        )}
                        {file.academicYear && (
                            <div>
                                <span className="text-brown-500">العام الدراسي: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.academicYear}</span>
                            </div>
                        )}
                        {file.owner?.name && (
                            <div>
                                <span className="text-brown-500">الناشر: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.owner.name}</span>
                            </div>
                        )}
                        {file.description && (
                            <div className="sm:col-span-2">
                                <span className="text-brown-500">الوصف: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.description}</span>
                            </div>
                        )}
                        {file.tags && file.tags.length > 0 && (
                            <div className="sm:col-span-2">
                                <span className="text-brown-500">الوسوم: </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.tags.join('، ')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[#E8C9A8]/50 dark:border-brown-700/50 p-3 sm:p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#7B4D2A] dark:text-[#D4A77A]">
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>{file.fileExtension?.toUpperCase() || 'ملف'} • {file.size ? Math.round(file.size / 1024) + ' KB' : '—'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {dlProgress && (
                            <div className="flex items-center gap-2 w-40" title="جاري التحميل">
                                <div className="flex-1 h-1.5 rounded-full bg-[#E8C9A8] dark:bg-brown-600 overflow-hidden">
                                    <div
                                        className={`h-full bg-[#7B4D2A] dark:bg-[#D97706] transition-all duration-150 ${dlProgress.indeterminate ? 'w-2/5 animate-pulse' : ''}`}
                                        style={dlProgress.indeterminate ? undefined : { width: `${dlProgress.percent}%` }}
                                    />
                                </div>
                                <span className="text-xs text-[#7B4D2A] dark:text-[#D97706] whitespace-nowrap">
                                    {dlProgress.indeterminate ? '…' : `${dlProgress.percent}%`}
                                </span>
                            </div>
                        )}
                        <button
                            onClick={() => {
                                if (!currentUser) {
                                    navigate('/login', { state: { from: 'download' } });
                                    return;
                                }
                                // Increment the download counter (best effort).
                                if (file.id) {
                                    downloadCourseFile(file.id).catch(() => {});
                                }
                                setDlProgress({ percent: 0, indeterminate: true });
                                downloadFile(file.downloadURL || file.url || '', {
                                    filename: file.name,
                                    onProgress: (percent, _loaded, total) => setDlProgress({ percent, indeterminate: !total }),
                                    onComplete: () => setDlProgress(null),
                                    onError: () => setDlProgress(null),
                                });
                            }}
                            disabled={!!dlProgress}
                            className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#5C3A1E] to-[#7B4D2A] text-white rounded-lg hover:from-[#3B2314] hover:to-[#5C3A1E] transition-all duration-200 text-xs sm:text-sm disabled:opacity-70 shadow-md hover:shadow-lg"
                        >
                            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
                            {dlProgress ? (dlProgress.indeterminate ? 'جاري التحميل…' : `${dlProgress.percent}%`) : 'تحميل الملف'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilePreview;
