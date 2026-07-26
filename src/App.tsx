import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { Bot, MessageSquare, MessageCircle } from 'lucide-react';
const StudentHome = lazy(() => import('./pages/StudentHome'));
const CourseWorkspace = lazy(() => import('./pages/CourseWorkspace'));
const CourseFilesPage = lazy(() => import('./pages/CourseFilesPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
import Login from './pages/Login';
import Register from './pages/Register';
import AboutPage from './pages/AboutPage';
import TermsPage from './pages/TermsPage';
import ContactPage from './pages/ContactPage';
import AIChat from './components/ai/AIChat';
const DiscussionsPage = lazy(() => import('./pages/DiscussionsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const PrivateChatPage = lazy(() => import('./pages/PrivateChatPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
    </div>
  );
}
import { useAppStore } from './stores/appStore';
import { useCatalogStore } from './stores/catalogStore';
import { onAuthChange } from './services/authService';
import ProtectedRoute from './components/navigation/ProtectedRoute';
import AdminRoute from './components/navigation/AdminRoute';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';
import ResetPassword from './pages/ResetPassword';
import NotificationsPage from './pages/NotificationsPage';
import BannedPage from './pages/BannedPage';
import { ToastProvider } from './components/ui/Toast';
import { initializeAnalytics } from './utils/analyticsTracker';

// Layouts
import AppShell from './layouts/AppShell';
import AuthLayout from './layouts/AuthLayout';

// Upload redirect component - redirects /upload to / and opens upload modal
// Uses useLayoutEffect to avoid flash before redirect
const UploadRedirect = () => {
  const navigate = useNavigate();
  const { setIsUploadModalOpen } = useAppStore();

  useLayoutEffect(() => {
    // Redirect to home and open upload modal
    navigate('/', { replace: true });
    // Small delay to ensure navigation completes before opening modal
    setTimeout(() => setIsUploadModalOpen(true), 100);
  }, [navigate, setIsUploadModalOpen]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
};

// Full-page AI Chat wrapper — opens in a new browser tab/window
// when the user clicks "مساعد الذكاء الاصطناعي" from the sidebar.
const AIChatFullPage = () => {
    const navigate = useNavigate();
    return (
        <AIChat
            isOpen={true}
            onClose={() => navigate(-1)}
            currentUser={useAppStore.getState().currentUser}
        />
    );
};

// Course redirect component - redirects /course/:id to /workspace/:courseId
// Uses useLayoutEffect to avoid flash before redirect
const CourseRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveCourseId } = useAppStore();

  useLayoutEffect(() => {
    if (id) {
      // Save courseId as activeCourse
      setActiveCourseId(id);
      sessionStorage.setItem('lastActiveCourse', id);
      // Redirect to workspace
      navigate(`/workspace/${id}`, { replace: true });
    }
  }, [id, setActiveCourseId, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
};

function App() {
  const navigate = useNavigate();
  const { setCurrentUser, currentUser, currentCourseFiles, allUserFiles, reset, isAIChatOpen, setIsAIChatOpen, isDarkMode, setIsDarkMode, aiChatInitialFile, setAiChatInitialFile, setIsOffline } = useAppStore();
  const { subscribeToUniversities } = useCatalogStore();

  // Initialize dark mode from localStorage on mount
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('isDarkMode');
    if (savedDarkMode !== null) {
      const isDark = JSON.parse(savedDarkMode);
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [setIsDarkMode]);

  // Subscribe to real-time universities data from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToUniversities();
    return () => unsubscribe();
  }, [subscribeToUniversities]);

  // Initialize analytics in Firebase only when a user is authenticated
  // We depend on currentUser which is set by the onAuthChange listener below
  useEffect(() => {
    if (currentUser) {
      initializeAnalytics().catch(err =>
        console.warn('Analytics initialization skipped:', err)
      );
    }
  }, [currentUser]);

  // Listen for auth state changes - Single Source of Truth for Auth
  // Flow: Firebase Auth → Realtime DB → Zustand → UI
  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        // User logged out or account deleted/banned - reset state
        reset();
      }
    });

    return () => unsubscribe();
  }, [setCurrentUser, reset]);

  // Redirect banned users to /banned page
  useEffect(() => {
    if (currentUser?.isBanned && currentUser?.banExpiresAt && Date.now() < currentUser.banExpiresAt) {
      navigate('/banned');
    }
  }, [currentUser?.isBanned, currentUser?.banExpiresAt, navigate]);

  // Track network connectivity state
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    // Set initial state
    setIsOffline(!navigator.onLine);

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [setIsOffline]);

  // Smart Redirect - redirect to last active course on first load
  // Uses useLayoutEffect to avoid flash on home page
  useLayoutEffect(() => {
    const lastCourse = sessionStorage.getItem('lastActiveCourse');
    // Auto-redirect to last course if user is on home page
    if (lastCourse && window.location.pathname === '/') {
      navigate(`/workspace/${lastCourse}`, { replace: true });
    }
  }, [navigate]);

  // Clear initial file selection after AIChat picks it up
  useEffect(() => {
    if (aiChatInitialFile && isAIChatOpen) {
      // Let AIChat read it via initialSelectedFile, then clear
      const timer = setTimeout(() => setAiChatInitialFile(null), 100);
      return () => clearTimeout(timer);
    }
  }, [aiChatInitialFile, isAIChatOpen, setAiChatInitialFile]);

  return (
    <ToastProvider>
      <div className={`min-h-screen ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-50'}`}>
        <Routes>
          {/* Auth Routes - No Sidebar/Topbar */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* App Routes - With Sidebar/Topbar */}
          <Route element={<AppShell />}>
            {/* Public Routes */}
            <Route path="/" element={<Suspense fallback={<PageLoader />}><StudentHome /></Suspense>} />
            <Route path="/course/:id" element={<CourseRedirect />} />
            <Route path="/workspace/:courseId" element={<Suspense fallback={<PageLoader />}><CourseWorkspace /></Suspense>} />
            <Route path="/course-files/:courseId" element={<Suspense fallback={<PageLoader />}><CourseFilesPage /></Suspense>} />
            <Route path="/discussions" element={<Suspense fallback={<PageLoader />}><DiscussionsPage /></Suspense>} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/banned" element={<BannedPage />} />

            {/* Recommendations - Publicly accessible but with limited features for guests */}
            <Route path="/recommendations" element={<Suspense fallback={<PageLoader />}><RecommendationsPage /></Suspense>} />

             {/* AI Chat Full Page — opens in new tab from sidebar */}
             <Route path="/ai-chat" element={<Suspense fallback={<PageLoader />}><AIChatFullPage /></Suspense>} />

             {/* Protected Chat Routes - Require Authentication */}
             <Route element={<ProtectedRoute />}>
               <Route path="/chat" element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
               <Route path="/chat/private" element={<Suspense fallback={<PageLoader />}><PrivateChatPage /></Suspense>} />
               <Route path="/notifications" element={<Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense>} />
               <Route path="/profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
             </Route>

            {/* Error Pages */}
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />

            {/* Protected Routes - Require Authentication */}
            <Route element={<ProtectedRoute />}>
              {/* Upload is handled via modal in AppShell - redirect to home and open modal */}
              <Route path="/upload" element={<UploadRedirect />} />
            </Route>

            {/* Admin Routes - Require Admin Role */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
              <Route path="/admin/analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsPage /></Suspense>} />
              <Route path="/admin/reports" element={<Suspense fallback={<PageLoader />}><AdminReports /></Suspense>} />
            </Route>
          </Route>
        </Routes>

        {/* Global AI Chat (floating) */}
        <AIChat
          isOpen={isAIChatOpen}
          onClose={() => { setIsAIChatOpen(false); setAiChatInitialFile(null); }}
          currentUser={currentUser}
          initialSelectedFile={aiChatInitialFile}
          courseFiles={currentCourseFiles.map(f => ({
            id: f.id,
            name: f.name || f.displayName || f.originalFileName || 'ملف بدون اسم',
            content: f.localTextPreview || f.downloadURL || f.url || undefined,
            readable: !!(f.localTextPreview && !f.localTextPreview.startsWith('[ملف'))
          }))}
          allFiles={allUserFiles.map(f => ({
            id: f.id,
            name: f.name || f.displayName || f.originalFileName || 'ملف بدون اسم',
            content: f.localTextPreview || f.downloadURL || f.url || undefined,
            readable: !!(f.localTextPreview && !f.localTextPreview.startsWith('[ملف'))
          }))}
        />

        {/* Floating Action Buttons */}
        <div className={`fixed bottom-4 left-6 flex flex-col space-y-3 z-40 md:bottom-6 transition-all duration-300 ease-out ${isAIChatOpen ? 'opacity-0 pointer-events-none scale-95 translate-y-2' : 'opacity-100 pointer-events-auto scale-100 translate-y-0'
          }`}>
          <button
            onClick={() => navigate('/chat')}
            className="bg-gradient-to-r from-secondary-500 to-secondary-600 text-white p-4 rounded-full shadow-lg shadow-secondary-500/30 hover:shadow-xl hover:shadow-secondary-500/40 transition-all duration-200 ease-smooth hover:scale-105 active:scale-95 animate-card-glow"
            title="الدردشة العامة - تواصل فوري"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
          <button
            onClick={() => navigate('/discussions')}
            className="bg-gradient-to-r from-primary-700 to-primary-800 text-white p-4 rounded-full shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 transition-all duration-200 ease-smooth hover:scale-105 active:scale-95 animate-card-glow"
            title="المناقشات والحوار"
          >
            <MessageSquare className="h-6 w-6" />
          </button>
          <button
            onClick={() => {
              if (!currentUser) {
                // Guests must not open the AI assistant — that would let
                // anonymous visitors drain the shared (paid) API quota.
                // Redirect them to the login screen, which surfaces the
                // "please register" notice. The chat itself never opens.
                navigate('/login', { state: { aiLoginRequired: true } });
                return;
              }
              setIsAIChatOpen(true);
            }}
            className="bg-gradient-to-r from-primary-700 via-secondary-600 to-primary-500 text-white p-4 rounded-full shadow-lg shadow-primary-600/30 hover:shadow-xl transition-all duration-300 ease-spring hover:scale-105 active:scale-95 animate-glow-wave"
            title="مساعد الذكاء الاصطناعي"
          >
            <Bot className="h-6 w-6" />
          </button>
        </div>
      </div>
    </ToastProvider>
  );
}

export default App;
