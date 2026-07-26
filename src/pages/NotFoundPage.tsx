import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

function NotFoundPage() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 mb-6 border border-[#1E40AF]/20 dark:border-blue-400/20">
                    <span className="text-5xl font-bold bg-gradient-to-br from-[#1E40AF] to-[#0F172A] dark:from-blue-400 dark:to-blue-600 bg-clip-text text-transparent">404</span>
                </div>

                <h1 className="text-3xl font-bold bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-300 dark:to-blue-100 bg-clip-text text-transparent mb-4">
                    الصفحة غير موجودة
                </h1>

                <p className="text-slate-600 dark:text-blue-200/70 mb-8 max-w-md mx-auto">
                    عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
                    يرجى التحقق من الرابط أو العودة للصفحة الرئيسية.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        to="/"
                        className="btn-ripple inline-flex items-center justify-center px-6 py-3 bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 text-white rounded-xl hover:shadow-lg hover:shadow-[#1E40AF]/25 transition-all"
                    >
                        <Home className="ml-2 h-5 w-5" />
                        العودة للرئيسية
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        className="btn-ripple inline-flex items-center justify-center px-6 py-3 border border-slate-200 dark:border-blue-400/20 text-slate-700 dark:text-blue-200/80 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1E40AF]/10 hover:shadow-md transition-all"
                    >
                        <Search className="ml-2 h-5 w-5" />
                        صفحة سابقة
                    </button>
                </div>
            </div>
        </div>
    );
}

export default NotFoundPage;
