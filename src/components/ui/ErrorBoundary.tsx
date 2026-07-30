import React, { Component, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component to catch JavaScript errors anywhere in the child component tree.
 * Logs errors and displays a fallback UI instead of crashing the entire app.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <ErrorBoundaryFallback error={this.state.error} onReset={this.handleReset} />
            );
        }

        return this.props.children;
    }
}

const ErrorBoundaryFallback = ({ error, onReset }: { error: Error | null; onReset: () => void }) => {
    const { t } = useTranslation();
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('errors.unexpected')}
                </h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {t('errors.sorry')}
                </p>
                <details className="text-right mb-4">
                    <summary className="text-sm text-gray-500 cursor-pointer">
                        {t('errors.details')}
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-40">
                        {error?.message}
                        {'\n\n'}
                        {error?.stack}
                    </pre>
                </details>
                <button
                    onClick={onReset}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    {t('errors.tryAgain')}
                </button>
            </div>
        </div>
    );
};

export default ErrorBoundary;
