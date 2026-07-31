import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '../components/navigation/Sidebar';
import UnifiedHeader from '../components/navigation/UnifiedHeader';
import Footer from '../components/layout/Footer';
import Breadcrumbs from '../components/layout/Breadcrumbs';
import PageTransition from '../components/ui/PageTransition';
import ScrollToTop from '../components/navigation/ScrollToTop';
import FileUploadModal from '../components/ui/FileUploadModal';
import { useAppStore } from '../stores/appStore';
import { isChatPage } from '../utils/chatPage';

function AppShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const { isDarkMode, isUploadModalOpen, setIsUploadModalOpen, currentUser, sidebarOpen, setSidebarOpen, toggleSidebar } = useAppStore();
    const { t, i18n } = useTranslation();

    const handleMenuClick = () => toggleSidebar();
    const handleUploadClick = () => setIsUploadModalOpen(true);

    const showBreadcrumbs = !['/', '/login', '/register', '/reset-password', '/upload'].includes(location.pathname);

    // Note: /upload route is handled by UploadRedirect component in App.tsx
    // which redirects to / and opens the upload modal

    // SEO: global structured data (Organization + WebSite) injected once for crawlers
    useEffect(() => {
        const organization = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: t('app.title'),
            url: 'https://eduai.yemen/',
            sameAs: [],
        };
        const orgScript = document.createElement('script');
        orgScript.type = 'application/ld+json';
        orgScript.id = 'jsonld-organization';
        orgScript.textContent = JSON.stringify(organization);
        document.head.appendChild(orgScript);

        const webSite = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: t('app.title'),
            url: 'https://eduai.yemen/',
            potentialAction: {
                '@type': 'SearchAction',
                target: 'https://eduai.yemen/?q={search_term_string}',
                'query-input': 'required name=search_term_string',
            },
        };
        const wsScript = document.createElement('script');
        wsScript.type = 'application/ld+json';
        wsScript.id = 'jsonld-website';
        wsScript.textContent = JSON.stringify(webSite);
        document.head.appendChild(wsScript);

        return () => {
            document.getElementById('jsonld-organization')?.remove();
            document.getElementById('jsonld-website')?.remove();
        };
    }, []);

    const direction = i18n.language === 'ar' ? 'rtl' : 'ltr';

    // For guests (not logged in), render simplified layout without sidebar
    if (!currentUser) {
        return (
            <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gradient-to-br from-brown-950 via-brown-900/30 to-brown-900' : 'bg-gradient-to-br from-[#FFFBEB] via-brown-50/40 to-[#FFFBEB]/60'}`} dir={direction}>
                <ScrollToTop />
                {/* Simplified public header */}
                <UnifiedHeader onMenuClick={handleMenuClick} sidebarOpen={sidebarOpen} isPublic={true} />
                {/* Main content */}
                <main className="flex-1 pt-16 lg:pt-16 xl:pt-16">
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </main>
                {/* Footer */}
                <Footer />
            </div>
        );
    }

    // Full layout for authenticated users
    return (
        <div className={`min-h-screen flex ${isDarkMode ? 'bg-gradient-to-br from-brown-950 via-brown-900/20 to-brown-900' : 'bg-gradient-to-br from-[#FFFBEB] via-brown-50/40 to-[#FFFBEB]/60'}`} dir={direction}>
            <ScrollToTop />

            {/* Sidebar */}
            <Sidebar
                collapsed={false}
                onToggle={handleMenuClick}
                onUploadClick={handleUploadClick}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Overlay (drawer on all screen sizes) */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 w-full">
                {/* Header */}
                <UnifiedHeader onMenuClick={handleMenuClick} sidebarOpen={sidebarOpen} />

                {/* Page Content */}
                <main className="flex-1 transition-all duration-300 overflow-x-hidden p-4 pt-16 lg:p-6 lg:pt-16 xl:p-8 xl:pt-16">
                    {showBreadcrumbs && <Breadcrumbs />}
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </main>

                {/* Footer — hidden on chat pages so the chat uses its own full-screen layout */}
                {!isChatPage(location.pathname) && <Footer />}
            </div>

            <FileUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
            />
        </div>
    );
}

export default AppShell;