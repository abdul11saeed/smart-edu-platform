import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import Footer from '../components/layout/Footer';

function AuthLayout() {
    const { isDarkMode } = useAppStore();

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-gradient-to-br from-slate-950 via-primary-900/20 to-slate-900' : 'bg-gradient-to-br from-primary-50/60 via-white to-secondary-50/80'}`} dir="rtl">
            {/* Logo Header - elegant navy blue */}
            <header className="py-6 px-4">
                <div className="max-w-md mx-auto">
                    <Link to="/" className="flex items-center justify-center space-x-2 group">
                        <div className="bg-gradient-to-br from-primary-700 via-primary-600 to-secondary-600 p-2 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 border border-white/20">
                            <GraduationCap className="h-8 w-8 text-white" />
                        </div>
                        <span className="text-2xl font-bold bg-gradient-to-r from-primary-800 to-secondary-500 bg-clip-text text-transparent">
                            EduAI
                        </span>
                    </Link>
                </div>
            </header>

            {/* Auth Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-md">
                    <Outlet />
                </div>
            </main>

            {/* Footer */}
            <footer className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                <p>© {new Date().getFullYear()} منصة البرامج الاكاديميه للجامعات اليمنيه. جميع الحقوق محفوظة.</p>
            </footer>

            {/* Full Footer Component */}
            <Footer />
        </div>
    );
}

export default AuthLayout;
