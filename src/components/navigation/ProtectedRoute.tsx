import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';

/**
 * ProtectedRoute - Protects routes that require authentication
 * 
 * If currentUser is not present:
 * - Redirects to /login
 * 
 * Handles loading state to prevent crashes during auth initialization.
 */
function ProtectedRoute() {
  const { t } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const isLoading = useAppStore((state) => state.isLoading);

  // Show loading spinner while checking authentication
  if (isLoading) {
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">
            {isOffline ? t('protectedRoute.offline') : t('protectedRoute.checkingSession')}
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Render child routes
  return <Outlet />;
}

export default ProtectedRoute;
