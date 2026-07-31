import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAppStore } from '../stores/appStore';
import Footer from '../components/layout/Footer';

function AuthLayout() {
    const { t } = useTranslation();
    const { isDarkMode } = useAppStore();

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gradient-to-br from-slate-950 via-primary-900/20 to-slate-900' : 'bg-gradient-to-br from-primary-50/60 via-white to-secondary-50/80'}`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Auth Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md">
                    <Outlet />
                </div>
            </main>

            {/* Footer */}
            <footer className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>© {new Date().getFullYear()} {t('auth.copyright')}</p>
            </footer>

            {/* Full Footer Component */}
            <Footer />
        </div>
    );
}

export default AuthLayout;
