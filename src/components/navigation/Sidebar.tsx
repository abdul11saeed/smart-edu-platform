import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import {
    GraduationCap, Home, MessageSquare, MessageCircle, Upload,
    Bot, X, Menu, BarChart3, Sparkles
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useState, useEffect, useRef } from 'react';

interface SidebarProps {
    collapsed?: boolean;
    onToggle?: () => void;
    onUploadClick: () => void;
    isOpen?: boolean;
    onClose?: () => void;
    className?: string;
}

const Sidebar = ({ onUploadClick, isOpen, onClose, className }: SidebarProps) => {
    const { t } = useTranslation();
    const { currentUser } = useAppStore();
    const navigate = useNavigate();
    const location = useLocation();
    const sidebarRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen !== undefined) {
            // handled by parent
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                const toggleBtn = document.querySelector('[data-sidebar-toggle]');
                if (toggleBtn && toggleBtn.contains(event.target as Node)) return;
                onClose?.();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const navItems = [
        { path: '/', icon: Home, label: t('nav.home'), roles: ['student', 'admin'] },
        { path: '/discussions', icon: MessageSquare, label: t('nav.discussions'), roles: ['student', 'admin'] },
        { path: '/chat', icon: MessageCircle, label: t('nav.chat'), roles: ['student', 'admin'] },
        { path: '/recommendations', icon: Sparkles, label: t('nav.recommendations'), roles: ['student', 'admin'] },
        {
            action: 'upload',
            icon: Upload,
            label: t('nav.upload'),
            roles: ['student', 'admin'],
            onClick: () => { onUploadClick(); onClose?.(); }
        },
    ];

    if (currentUser?.role === 'admin') {
        navItems.push({ path: '/admin', icon: MessageSquare, label: t('nav.admin'), roles: ['admin'] });
        navItems.push({ path: '/admin/reports', icon: BarChart3, label: t('nav.adminReports'), roles: ['admin'] });
    }

navItems.push({
        action: 'aiChat',
        icon: Bot,
        label: t('nav.aiAssistant'),
        roles: ['student', 'admin'],
        onClick: () => {
            navigate('/ai-chat');
            onClose?.();
        }
    });

    // For guests, show no navigation items (only login link in bottom section)
    const visibleItems = currentUser
        ? navItems.filter(item => item.roles.includes(currentUser?.role || 'student'))
        : [];

    const isRTL = i18n.language === 'ar';
    const sideStart = isRTL ? 'right' : 'left';
    const sideEnd = isRTL ? 'left' : 'right';
    const translateClosed = isRTL ? 'translate-x-full' : '-translate-x-full';
    const borderStart = isRTL ? 'border-l' : 'border-r';

    return (
        <aside
            ref={sidebarRef}
            className={`
                bg-[#FFFBEB]/95 dark:bg-brown-900/95 backdrop-blur-xl shadow-2xl shadow-primary-500/10 dark:shadow-brown-950/50 flex flex-col z-40 ${borderStart} border-brown-200/50 dark:border-brown-700/30
                ${isMobile
                    ? `fixed inset-y-0 ${sideStart}-0 w-72 transform transition-all duration-300 ease-in-out `
                    + (isOpen ? 'translate-x-0 opacity-100 visible pointer-events-auto' : `${translateClosed} opacity-0 invisible pointer-events-none`)
                    : `fixed top-0 ${sideStart}-0 h-screen w-72 transform transition-all duration-300 ease-in-out `
                    + (isOpen ? 'translate-x-0 opacity-100' : `${translateClosed} opacity-0 invisible pointer-events-none`)}
                ${className || ''}
            `}
            style={{ direction: isRTL ? 'rtl' : 'ltr' }}
        >
            {/* Logo Section with gradient accent */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-brown-200/50 dark:border-brown-700/30 bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/20 dark:to-transparent">
                <NavLink to="/" className="flex items-center gap-2 group animate-card-appear" onClick={onClose}>
                    <div className="bg-gradient-to-br from-[#5C3A1E] via-[#7B4D2A] to-[#D97706] p-2 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-105 animate-icon-pulse transition-all duration-300 shadow-[#7B4D2A]/20 hover:shadow-[#7B4D2A]/40 border border-white/20">
                        <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-lg font-bold bg-gradient-to-r from-[#3B2314] to-[#D97706] bg-clip-text text-transparent group-hover:from-[#5C3A1E] group-hover:to-[#B45309] transition-all duration-200">
                        EduAI
                    </span>
                </NavLink>

                <button
                    data-sidebar-toggle
                    onClick={onClose}
                    className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 text-brown-600 dark:text-brown-300 transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-md hover:shadow-primary-500/10"
                    title={t('sidebar.close')}
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {visibleItems.map((item, index) => {
                    const Icon = item.icon;

                    if (item.action === 'upload' || item.action === 'aiChat') {
                        return (
                            <button
                                key={index}
                                onClick={() => {
                                    item.onClick?.();
                                    if (isMobile) onClose?.();
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md
                                    ${item.action === 'aiChat'
                                        ? 'text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 font-medium'
                                        : 'text-brown-700 dark:text-brown-300 hover:bg-brown-50 dark:hover:bg-brown-900'}
                                `}
                                title={item.label}
                            >
                                <Icon className={`h-5 w-5 flex-shrink-0 ${item.action === 'aiChat' ? 'text-primary-600 dark:text-primary-400' : 'text-primary-600 dark:text-primary-400'}`} />
                                <span className="font-medium text-sm">{item.label}</span>
                            </button>
                        );
                    }

                    if (!item.path) return null;

                    return (
                        <NavLink
                            key={index}
                            to={item.path}
                            onClick={onClose}
                            className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md
                                ${location.pathname === item.path
                                    ? 'bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/20 text-primary-700 dark:text-primary-300 font-medium shadow-md shadow-primary-500/10 border border-primary-200/60 dark:border-primary-700/30'
                                    : 'text-brown-700 dark:text-brown-300 hover:bg-brown-50 dark:hover:bg-brown-900'}
                            `}
                            title={item.label}
                        >
                            <Icon className={`h-5 w-5 flex-shrink-0 ${location.pathname === item.path ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                            <span className="font-medium text-sm">{item.label}</span>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Bottom Section */}
            <div className="p-3 border-t border-brown-200/50 dark:border-brown-700/30 bg-gradient-to-r from-primary-50/30 to-transparent dark:from-primary-900/10 dark:to-transparent">
                {currentUser ? (
                    <div className="flex items-center gap-3 px-4 py-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5C3A1E] via-[#7B4D2A] to-[#D97706] flex items-center justify-center shadow-md hover:shadow-lg hover:scale-105 animate-icon-pulse transition-all duration-200 shadow-[#7B4D2A]/20 hover:shadow-[#7B4D2A]/40 border border-white/20">
                            <span className="text-white font-semibold text-sm">
                                {(currentUser.name || currentUser.email || '?').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-brown-900 dark:text-neutral-100 truncate">{currentUser.name}</p>
                            <p className="text-xs text-brown-500 dark:text-neutral-400 truncate">{currentUser.role}</p>
                        </div>
                    </div>
                ) : (
                    <NavLink
                        to="/login"
                        className="flex items-center gap-3 px-4 py-3 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:shadow-primary-500/10"
                        title={t('nav.login')}
                    >
                        <Menu className="h-5 w-5 flex-shrink-0 rotate-180" />
                        <span className="font-medium text-sm">{t('nav.login')}</span>
                    </NavLink>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;