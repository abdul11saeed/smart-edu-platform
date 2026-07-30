import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// Toast Types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// Toast Context
interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast Provider
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    addToast('success', message, duration);
  }, [addToast]);

  const error = useCallback((message: string, duration?: number) => {
    addToast('error', message, duration);
  }, [addToast]);

  const info = useCallback((message: string, duration?: number) => {
    addToast('info', message, duration);
  }, [addToast]);

  const warning = useCallback((message: string, duration?: number) => {
    addToast('warning', message, duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Hook to use Toast
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Icons
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-success-500" />,
  error: <AlertCircle className="h-5 w-5 text-error-500" />,
  info: <Info className="h-5 w-5 text-info-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning-500" />,
};

// Toast Colors - warm brown theme with glass morphism
const toastColors: Record<ToastType, string> = {
  success: 'bg-gradient-to-r from-sage-50 to-[#F9F0E6] border-sage-200 dark:from-sage-950/80 dark:to-brown-900/80 dark:border-sage-800/50',
  error: 'bg-gradient-to-r from-red-50 to-[#F9F0E6] border-red-200 dark:from-red-950/80 dark:to-brown-900/80 dark:border-red-800/50',
  info: 'bg-gradient-to-r from-primary-50 to-[#F9F0E6] border-primary-200 dark:from-primary-950/80 dark:to-brown-900/80 dark:border-primary-800/50',
  warning: 'bg-gradient-to-r from-amber-50 to-[#F9F0E6] border-amber-200 dark:from-amber-950/80 dark:to-brown-900/80 dark:border-amber-800/50',
};

// Toast Container
interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
   const { t } = useTranslation();
   return (
    <div className="fixed top-4 right-4 z-toast flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto
            flex items-start gap-3 p-4
            rounded-2xl border shadow-xl
            backdrop-blur-xl
            animate-slide-in
            ${toastColors[toast.type]}
          `}
        >
          <div className="shrink-0 mt-0.5">
            {toastIcons[toast.type]}
          </div>
          <p className="flex-1 text-sm font-medium text-brown-900 dark:text-neutral-100">
            {toast.message}
          </p>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 p-1 rounded-lg hover:bg-brown-200/50 dark:hover:bg-brown-700/50 text-brown-500 dark:text-brown-400 transition-colors"
            aria-label={t('toast.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

// Standalone Toast Component (for manual placement)
interface ToastProps {
  type: ToastType;
  message: string;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
   const { t } = useTranslation();
   return (
    <div
      className={`
        flex items-start gap-3 p-4
        rounded-2xl border shadow-xl
        backdrop-blur-xl
        ${toastColors[type]}
      `}
    >
      <div className="shrink-0 mt-0.5">
        {toastIcons[type]}
      </div>
      <p className="flex-1 text-sm font-medium text-brown-900 dark:text-neutral-100">
        {message}
      </p>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-lg hover:bg-brown-200/50 dark:hover:bg-brown-700/50 text-brown-500 dark:text-brown-400 transition-colors"
          aria-label={t('toast.close')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Toast;
