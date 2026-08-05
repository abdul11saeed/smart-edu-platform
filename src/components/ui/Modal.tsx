import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    title?: string;
    fullScreen?: boolean;
    size?: ModalSize;
}

const sizeClasses: Record<ModalSize, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

const Modal = ({ isOpen, onClose, children, fullScreen = false, size = 'xl' }: ModalProps) => {
    if (!isOpen) return null;

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const containerClasses = fullScreen
        ? 'min-h-screen w-full rounded-none sm:max-h-[calc(100vh-8rem)] sm:my-4'
         : `${sizeClasses[size] || sizeClasses.xl} w-[calc(100%-0.75rem)] max-w-full rounded-2xl my-2 sm:my-4 sm:max-h-[calc(100vh-8rem)] overflow-y-auto`;

return createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-gray-950/60 backdrop-blur-sm px-2 sm:px-3 pt-12 sm:pt-16">
            <div className="flex min-h-screen items-start justify-center px-1 py-2 text-center sm:px-2 sm:py-4">
                <div className="fixed inset-0" aria-hidden="true" onClick={onClose}></div>

                <div className={`relative w-full bg-white dark:bg-gray-800 text-right shadow-2xl transition-all modal-panel-mobile ${containerClasses}`}>
                    <div className="bg-white dark:bg-gray-800 px-4 py-4 sm:px-6 sm:py-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default Modal;