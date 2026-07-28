import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

const TermsPage = () => {
    const { t } = useTranslation();

    // SEO meta tags
    useEffect(() => {
        document.title = `${t('terms.title')} - ${t('app.title')}`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', t('terms.description'));
        return () => {
            document.title = t('app.title');
        };
    }, [t]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">{t('terms.title')}</h1>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    {t('terms.description')}
                </p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">{t('terms.acceptTerms')}</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    {t('terms.acceptTermsContent')}
                </p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">{t('terms.acceptableUse')}</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    {t('terms.acceptableUseContent')}
                </p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">{t('terms.privacy')}</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    {t('terms.privacyContent')}
                </p>
            </div>
        </div>
    );
};

export default TermsPage;
