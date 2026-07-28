import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

const ContactPage = () => {
    const { t } = useTranslation();

    // SEO meta tags
    useEffect(() => {
        document.title = `${t('contact.title')} - ${t('app.title')}`;
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', t('contact.metaDescription'));
        return () => {
            document.title = t('app.title');
        };
    }, [t]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-[#1E40AF]/5 border border-slate-200/80 dark:border-blue-400/20 p-6 lg:p-8">
                <h1 className="text-2xl font-bold bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-300 dark:to-blue-100 bg-clip-text text-transparent mb-6">{t('contact.title')}</h1>
                <p className="text-slate-600 dark:text-blue-200/70 leading-relaxed mb-8">
                    {t('contact.description')}
                </p>
                <div className="space-y-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 flex items-center justify-center flex-shrink-0 border border-[#1E40AF]/20 dark:border-blue-400/20">
                            <svg className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('contact.phone')}</p>
                            <p className="text-lg font-medium text-slate-900 dark:text-slate-100" dir="ltr">+967 736 856 463</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#DBEAFE] to-[#1E40AF]/10 dark:from-blue-400/10 dark:to-blue-900/20 flex items-center justify-center flex-shrink-0 border border-[#1E40AF]/20 dark:border-blue-400/20">
                            <svg className="w-5 h-5 text-[#1E40AF] dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{t('contact.email')}</p>
                            <p className="text-lg font-medium text-slate-900 dark:text-slate-100" dir="ltr">alhmyrybdalhfyz39@gmail.com</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
