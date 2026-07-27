import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ArrowRight } from 'lucide-react';

function ForbiddenPage() {
    const { t } = useTranslation();
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-100 mb-6">
                    <span className="text-5xl font-bold text-red-600">403</span>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    {t('forbidden.title')}
                </h1>

                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    {t('forbidden.description')}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                        <Home className="ml-2 h-5 w-5" />
                        {t('forbidden.backToHome')}
                    </Link>

                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {t('forbidden.loginLink')}
                        <ArrowRight className="mr-2 h-5 w-5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ForbiddenPage;
