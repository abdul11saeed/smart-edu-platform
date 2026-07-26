import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';

/**
 * AdminRoute - Protects admin-only routes
 * 
 * If currentUser is not an admin (role !== 'admin'):
 * - Redirects to /403
 * 
 * Handles loading state to prevent crashes during auth initialization.
 */
function AdminRoute() {
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
                        {isOffline ? 'لا يوجد اتصال بالإنترنت - جاري المحاولة...' : 'جاري التحقق من الصلاحيات...'}
                    </p>
                </div>
            </div>
        );
    }

    // If not authenticated, redirect to login
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // If authenticated but not admin, redirect to 403
    if (currentUser.role !== 'admin') {
        return <Navigate to="/403" replace />;
    }

    // Render child routes (user is admin)
    return <Outlet />;
}

export default AdminRoute;
