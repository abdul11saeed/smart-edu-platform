import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, FileText } from 'lucide-react';
import { File } from '../../types';
import { downloadFile } from '../../utils/downloadUtils';
import { downloadCourseFile } from '../../services/courseFilesService';
import { useAppStore } from '../../stores/appStore';

interface FilePreviewProps {
    isOpen: boolean;
    onClose: () => void;
    file: File | null;
    anchorRect?: { top: number; left: number; width: number; height: number } | null;
}

const FilePreview = ({ isOpen, onClose, file, anchorRect }: FilePreviewProps) => {
    const { t, i18n } = useTranslation();
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
                    <p className="text-brown-800 dark:text-neutral-100 font-medium mb-2">{t('filePreview.previewTitle')}</p>
                    {currentUser ? (
                        <>
                            <p className="text-sm text-brown-600 dark:text-neutral-300 mb-4">{t('filePreview.cannotPreview')}</p>
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                                {t('filePreview.openInNewWindow')}
                            </a>
                        </>
                    ) : (
                        <p className="text-sm text-brown-600 dark:text-neutral-300 mb-4">{t('filePreview.loginToPreview')}</p>
                    )}
                </div>
            );
        }

        if (isText && previewContent) {
            return (
                <div className="bg-brown-50 dark:bg-brown-800 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-brown-800 dark:text-neutral-200 font-mono leading-relaxed">
                        {previewContent}
                    </pre>
                </div>
            );
        }

        return (
            <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-brown-300 dark:text-brown-600" />
                <p className="text-brown-700 dark:text-neutral-200 font-medium">{t('filePreview.noPreviewAvailable')}</p>
                <p className="text-sm text-brown-500 dark:text-neutral-400 mt-1">
                    {currentUser ? t('filePreview.canDownload') : t('filePreview.loginToDownload')}
                </p>
            </div>
        );
    };

    // Compute modal positioning based on anchor rect
    const getModalPosition = () => {
        if (!anchorRect) return {};
        const modalWidth = Math.min(window.innerWidth - 32, 896); // max-w-4xl = 896px, with 16px padding each side
        const modalHeight = Math.min(window.innerHeight * 0.85, 700); // approximate max height
        const gap = 12; // gap between card and modal

        let top = anchorRect.top - modalHeight - gap;
        let left = anchorRect.left + anchorRect.width / 2 - modalWidth / 2;

        // If not enough space above, show below the card
        if (top < 16) {
            top = anchorRect.top + anchorRect.height + gap;
        }

        // Clamp horizontal position
        left = Math.max(16, Math.min(left, window.innerWidth - modalWidth - 16));

        // If still not enough vertical space, center vertically
        if (top + modalHeight > window.innerHeight - 16) {
            top = Math.max(16, (window.innerHeight - modalHeight) / 2);
        }

        return { top, left, width: modalWidth, position: 'fixed' as const };
    };

    const modalPosition = getModalPosition();

    return createPortal(
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center" onClick={onClose}>
            <div
                className="bg-gradient-to-br from-white to-[#F9F0E6] dark:from-brown-800 dark:to-brown-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto border border-[#E8C9A8]/50 dark:border-brown-700/50"
                style={anchorRect ? modalPosition : undefined}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-l from-[#5C3A1E] to-[#7B4D2A] p-4 sm:p-5 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg sm:text-xl font-bold truncate">{file.name}</h3>
                        <p className="text-[#F2E0CE] text-xs sm:text-sm mt-1">
                            {file.size ? Math.round(file.size / 1024) + ' KB' : '—'} • {file.fileExtension?.toUpperCase() || t('filePreview.fileExtension')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        title={t('common.close')}
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
                    <h4 className="text-sm font-semibold text-brown-500 uppercase tracking-wider mb-3">{t('filePreview.fileSpecs')}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        {file.universityName && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.university')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.universityName}</span>
                            </div>
                        )}
                        {file.collegeName && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.college')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.collegeName}</span>
                            </div>
                        )}
                        {file.majorName && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.major')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.majorName}</span>
                            </div>
                        )}
                        {file.courseName && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.course')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.courseName}</span>
                            </div>
                        )}
                        {file.professorName && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.doctor')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{t('filePreview.doctorPrefix')} {file.professorName}</span>
                            </div>
                        )}
                        {file.term && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.term')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.term === 'first' ? t('filePreview.firstTerm') : t('filePreview.secondTerm')}</span>
                            </div>
                        )}
                        {file.level && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.level')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.level}</span>
                            </div>
                        )}
                        {file.academicYear && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.academicYear')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.academicYear}</span>
                            </div>
                        )}
                        {file.owner?.name && (
                            <div>
                                <span className="text-brown-500">{t('filePreview.publisher')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.owner.name}</span>
                            </div>
                        )}
                        {file.description && (
                            <div className="sm:col-span-2">
                                <span className="text-brown-500">{t('filePreview.description')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.description}</span>
                            </div>
                        )}
                        {file.tags && file.tags.length > 0 && (
                            <div className="sm:col-span-2">
                                <span className="text-brown-500">{t('filePreview.tags')} </span>
                                <span className="text-brown-900 dark:text-neutral-100 font-medium">{file.tags.join('، ')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[#E8C9A8]/50 dark:border-brown-700/50 p-3 sm:p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-[#7B4D2A] dark:text-[#D4A77A]">
                        <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>{file.fileExtension?.toUpperCase() || t('filePreview.fileExtension')} • {file.size ? Math.round(file.size / 1024) + ' KB' : '—'}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {dlProgress && (
                            <div className="flex items-center gap-2 w-40" title={t('filePreview.downloading')}>
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
                                    downloadCourseFile(file.id).catch(() => { });
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
                            {dlProgress ? (dlProgress.indeterminate ? t('filePreview.downloading') : `${dlProgress.percent}%`) : t('filePreview.downloadFile')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FilePreview;
