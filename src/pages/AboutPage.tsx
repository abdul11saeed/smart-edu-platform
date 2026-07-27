import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const AboutPage = () => {
    const { t } = useTranslation();

    // SEO meta tags
    useEffect(() => {
        document.title = `${t('about.title')} - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', t('app.description'));
        return () => {
            document.title = 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        };
    }, [t]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-[#1E40AF]/5 border border-slate-200/80 dark:border-blue-400/20 p-6 lg:p-8">
                <h1 className="text-2xl font-bold bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-300 dark:to-blue-100 bg-clip-text text-transparent mb-4">{t('about.title')}</h1>
                <p className="text-slate-600 dark:text-blue-200/70 leading-relaxed mb-4">
                    {t('about.description')}
                </p>
            </div>
        </div>
    );
};

export default AboutPage;
