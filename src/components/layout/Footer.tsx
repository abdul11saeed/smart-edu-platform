import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores/appStore';

const Footer = () => {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();
    const currentUser = useAppStore(state => state.currentUser);

    // For guests, show only public links
    const services = currentUser ? [
        { name: t('nav.discussions'), path: '/discussions', icon: '💬' },
        { name: t('nav.chat'), path: '/chat', icon: '🤖' }
    ] : [];

    const publicLinks = [
        { name: t('footer.about'), path: '/about', key: 'about-link' },
        { name: t('footer.categories'), path: '/categories', key: 'categories-link' },
        { name: t('footer.articles'), path: '/articles', key: 'articles-link' },
        { name: t('footer.news'), path: '/news', key: 'news-link' },
        { name: t('footer.courses'), path: '/courses', key: 'courses-link' },
        { name: t('footer.terms'), path: '/terms', key: 'terms-link' },
        { name: t('footer.contact'), path: '/contact', key: 'contact-link' }
    ];

    const quickLinks = [
        { name: t('footer.about'), path: '/about', key: 'quick-about' },
        { name: t('footer.terms'), path: '/terms', key: 'quick-terms' },
        { name: t('footer.contact'), path: '/contact', key: 'quick-contact' }
    ];

    return (
        <footer className="relative bg-gradient-to-br from-[#291A0A] via-[#3B2314]/30 to-[#1a0f05] text-[#F9F0E6] overflow-hidden">
            {/* Background decoration with animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#7B4D2A]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-float"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D97706]/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 animate-float" style={{ animationDelay: '1.5s' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#5C3A1E]/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
                {/* Main Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12 mb-12">
                    {/* Brand Section - Spans 4 columns */}
                    <div className="col-span-2 xs:col-span-1 lg:col-span-4 flex flex-col items-center text-center xs:block xs:text-right">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 bg-gradient-to-br from-[#7B4D2A] via-[#5C3A1E] to-[#8B5E34] rounded-xl flex items-center justify-center shadow-lg shadow-[#7B4D2A]/30 hover:shadow-xl hover:shadow-[#7B4D2A]/40 transition-all duration-300 hover:scale-105 border border-white/10">
                                <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold bg-gradient-to-r from-white via-[#D4A77A] to-[#B8865E] bg-clip-text text-transparent">
                                {t('app.title')}
                            </span>
                        </div>
                        <p className="text-[#F0D9B5] text-base font-bold leading-relaxed mb-6 max-w-sm">
                            {t('app.description')}
                        </p>
                        {/* Social Icons - elegant warm brown */}
                        <div className="flex items-center gap-3">
                            <a href="#" className="w-9 h-9 rounded-xl bg-brown-800/80 hover:bg-gradient-to-br hover:from-[#7B4D2A] hover:to-[#5C3A1E] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 group border border-brown-700/50 hover:border-[#7B4D2A]/50">
                                <svg className="w-4 h-4 text-[#B8865E] group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </a>
                            <a href="#" className="w-9 h-9 rounded-xl bg-brown-800/80 hover:bg-gradient-to-br hover:from-[#D97706] hover:to-[#7B4D2A] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 group border border-brown-700/50 hover:border-[#D97706]/50">
                                <svg className="w-4 h-4 text-[#B8865E] group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                                </svg>
                            </a>
                            <a href="#" className="w-9 h-9 rounded-xl bg-brown-800/80 hover:bg-gradient-to-br hover:from-[#B8865E] hover:to-[#7B4D2A] flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-0.5 group border border-brown-700/50 hover:border-[#B8865E]/50">
                                <svg className="w-4 h-4 text-[#B8865E] group-hover:text-white transition-colors" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                                </svg>
                            </a>
                        </div>
                    </div>

                    {/* Services - Spans 3 columns */}
                    <div className="lg:col-span-3">
                        {currentUser ? (
                            <>
                                <h4 className="text-base font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1 h-5 bg-gradient-to-b from-[#7B4D2A] to-[#D97706] rounded-full"></span>
                                    {t('footer.servicesTitle')}
                                </h4>
                                <ul className="space-y-3">
                                    {services.map((service) => (
                                        <li key={service.path}>
                                            <Link
                                                to={service.path}
                                                className="group flex items-center gap-3 text-base font-bold text-[#E8C9A0] hover:text-white transition-all duration-200"
                                            >
                                                <span className="w-8 h-8 rounded-lg bg-brown-800/50 group-hover:bg-[#7B4D2A]/20 flex items-center justify-center text-xs transition-all duration-200 group-hover:scale-110">
                                                    {service.icon}
                                                </span>
                                                <span className="group-hover:translate-x-0.5 transition-transform duration-200">{service.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <>
                                <h4 className="text-base font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1 h-5 bg-gradient-to-b from-[#7B4D2A] to-[#D97706] rounded-full"></span>
                                    {t('footer.publicLinks')}
                                </h4>
                                <ul className="space-y-3">
                                    {publicLinks.slice(0, 4).map((link) => (
                                        <li key={link.path}>
                                            <Link
                                                to={link.path}
                                                className="group flex items-center gap-3 text-base font-bold text-[#E8C9A0] hover:text-white transition-all duration-200"
                                            >
                                                <svg className="w-4 h-4 text-brown-500 group-hover:text-[#D4A77A] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                                <span className="group-hover:translate-x-0.5 transition-transform duration-200">{link.name}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    {/* Quick Links - Spans 2 columns */}
                    <div className="lg:col-span-2">
                        <h4 className="text-base font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-[#7B4D2A] rounded-full"></span>
                            {t('footer.quickLinksTitle')}
                        </h4>
                        <ul className="space-y-3">
                            {currentUser ? (
                                quickLinks.map((link) => (
                                    <li key={link.path}>
                                        <Link
                                            to={link.path}
                                            className="group flex items-center gap-3 text-base font-bold text-[#E8C9A0] hover:text-white transition-all duration-200"
                                        >
                                            <svg className="w-4 h-4 text-brown-500 group-hover:text-[#D4A77A] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="group-hover:translate-x-0.5 transition-transform duration-200">{link.name}</span>
                                        </Link>
                                    </li>
                                ))
                            ) : (
                                publicLinks.slice(1, 4).map((link) => (
                                    <li key={link.path}>
                                        <Link
                                            to={link.path}
                                            className="group flex items-center gap-3 text-base font-bold text-[#E8C9A0] hover:text-white transition-all duration-200"
                                        >
                                            <svg className="w-4 h-4 text-brown-500 group-hover:text-[#D4A77A] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className="group-hover:translate-x-0.5 transition-transform duration-200">{link.name}</span>
                                        </Link>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>

                    {/* Contact - Spans 3 columns */}
                    <div className="col-span-2 xs:col-span-1 lg:col-span-3 text-center xs:text-right">
                        <h4 className="text-base font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2 justify-center xs:justify-start">
                            <span className="w-1 h-5 bg-gradient-to-b from-[#D97706] to-[#D4A77A] rounded-full"></span>
                            {t('footer.contactTitle')}
                        </h4>
                        <ul className="space-y-4 flex flex-col xs:block">
                            <li className="flex items-start gap-3 text-base font-bold text-[#E8C9A0] group justify-center xs:justify-start">
                                <div className="w-8 h-8 rounded-lg bg-brown-800/50 group-hover:bg-[#7B4D2A]/20 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200">
                                    <svg className="h-4 w-4 text-[#D4A77A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                </div>
                                <a href="tel:+967736856463" className="hover:text-white transition-colors duration-200" dir="ltr">
                                    +967 736 856 463
                                </a>
                            </li>
                            <li className="flex items-start gap-3 text-base font-bold text-[#E8C9A0] group justify-center xs:justify-start">
                                <div className="w-8 h-8 rounded-lg bg-brown-800/50 group-hover:bg-[#D97706]/20 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200">
                                    <svg className="h-4 w-4 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <a href="mailto:alhmyrybdalhfyz39@gmail.com" className="hover:text-white transition-colors duration-200 break-all">
                                    alhmyrybdalhfyz39@gmail.com
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Newsletter Section - elegant warm brown */}
                {currentUser ? (
                    <div className="bg-gradient-to-r from-[#7B4D2A]/20 via-[#D97706]/10 to-[#7B4D2A]/20 rounded-2xl p-6 sm:p-8 mb-12 border border-[#7B4D2A]/30">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                            <div className="text-center lg:text-right">
                                <h3 className="text-lg font-bold text-white mb-1">{t('footer.stayUpdated')}</h3>
                                <p className="text-base text-[#F0D9B5]">{t('footer.getUpdates')}</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                                <input
                                    type="email"
                                    placeholder={t('footer.enterEmail')}
                                    className="px-4 py-2.5 bg-brown-800/50 border border-brown-600/50 rounded-xl text-sm text-white placeholder-[#B8865E] focus:outline-none focus:ring-2 focus:ring-[#7B4D2A] focus:border-transparent w-full sm:w-64 transition-all"
                                />
                                <button className="px-6 py-2.5 bg-gradient-to-r from-[#5C3A1E] to-[#7B4D2A] text-white text-sm font-medium rounded-xl hover:from-[#3B2314] hover:to-[#5C3A1E] transition-all duration-200 hover:shadow-lg hover:shadow-[#7B4D2A]/25 whitespace-nowrap btn-glow">
                                    {t('footer.subscribe')}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-[#7B4D2A]/10 via-[#D97706]/10 to-[#7B4D2A]/10 rounded-2xl p-6 sm:p-8 mb-12 border border-[#7B4D2A]/20">
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-white mb-1">{t('footer.joinPlatform')}</h3>
                            <p className="text-base text-[#F0D9B5] mb-4">{t('footer.loginAccess')}</p>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#5C3A1E] to-[#7B4D2A] text-white text-sm font-medium rounded-xl hover:from-[#3B2314] hover:to-[#5C3A1E] transition-all duration-200 hover:shadow-lg hover:shadow-[#7B4D2A]/25"
                            >
                                {t('footer.login')}
                            </Link>
                        </div>
                    </div>
                )}

                {/* Bottom Bar */}
                <div className="border-t border-brown-800/50 pt-8">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-[#E8C9A0] text-base font-bold">
                            © {currentYear} {t('app.title')} {t('footer.allRightsReserved')}.
                        </p>
                        <div className="flex items-center gap-6">
                            <Link to="/terms" className="text-[#E8C9A0] hover:text-white text-base font-bold transition-colors">
                                {t('footer.terms')}
                            </Link>
                        </div>
                        <p className="text-[#E8C9A0] text-sm flex items-center gap-1">
                            {t('footer.madeForStudents')} {' '}
                            <span className="inline-block animate-pulse">❤️</span>
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
