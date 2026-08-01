import { Outlet } from 'react-router-dom';
import i18n from '../i18n';
import { useAppStore } from '../stores/appStore';

function AuthLayout() {
    const { isDarkMode } = useAppStore();

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gradient-to-br from-slate-950 via-primary-900/20 to-slate-900' : 'bg-gradient-to-br from-primary-50/60 via-white to-secondary-50/80'}`} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Auth Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md">
                    <Outlet />
                </div>
            </main>

        </div>
    );
}

export default AuthLayout;
