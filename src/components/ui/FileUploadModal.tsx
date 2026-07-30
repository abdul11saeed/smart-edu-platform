import { useTranslation } from 'react-i18next';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import FileUploadForm from './FileUploadForm';

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FileUploadModal = ({ isOpen, onClose }: FileUploadModalProps) => {
    const { t } = useTranslation();
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[9999]" onClose={onClose}>
                {/* Backdrop with blur */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" />
                </Transition.Child>

                {/* Modal Container */}
                <div className="fixed inset-0 overflow-y-auto pt-16 sm:pt-20">
                    <div className="flex min-h-full items-start justify-center p-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95 translate-y-4"
                            enterTo="opacity-100 scale-100 translate-y-0"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100 translate-y-0"
                            leaveTo="opacity-0 scale-95 translate-y-4"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gradient-to-br from-white via-white/95 to-primary-50/30 dark:from-brown-900 dark:via-brown-900/95 dark:to-brown-800/30 shadow-2xl shadow-primary-500/10 dark:shadow-brown-950/50 border border-primary-100/40 dark:border-brown-700/30 transition-all">
                                {/* Gradient Header */}
                                <div className="relative bg-gradient-to-l from-primary-700 via-primary-600 to-secondary-600 px-8 py-5 sm:px-10 sm:py-6">
                                    <div className="absolute inset-0 bg-black/5" />
                                    <div className="relative flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                            </div>
                                            <Dialog.Title className="text-xl font-bold text-white">
                                                {t('fileUploadModal.title')}
                                            </Dialog.Title>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors focus:ring-2 focus:ring-white/50"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <p className="relative mt-2 text-sm text-white/80">
                                        {t('fileUploadModal.description')}
                                    </p>
                                </div>

                                {/* Modal Content */}
                                <div className="p-6 sm:p-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                    <FileUploadForm onUploadSuccess={() => {
                                        // Optionally close modal after successful upload
                                        // onClose();
                                    }} />
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default FileUploadModal;
