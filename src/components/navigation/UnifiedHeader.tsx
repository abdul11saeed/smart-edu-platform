import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Bell,
    Edit,
    GraduationCap,
    LogOut,
    Menu,
    MessageCircle,
    Moon,
    Reply,
    Settings,
    Sun,
    ThumbsUp,
    Trash2,
    X,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { logout } from '../../services/authService';
import {
    subscribeToUserNotifications,
    markNotificationAsRead,
    Notification,
} from '../../services/notificationService';
import i18n from '../../i18n';

const UnifiedHeader = ({
    onMenuClick,
    sidebarOpen,
    isPublic = false,
}: {
    onMenuClick: () => void;
    sidebarOpen: boolean;
    isPublic?: boolean;
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        currentUser,
        setCurrentUser,
        isDarkMode,
        toggleDarkMode,
    } = useAppStore();

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const userMenuRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    const unreadNotifications = notifications.filter((n) => !n.read);
    const unreadCount = unreadNotifications.length;

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'private_message':
                return <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />;
            case 'discussion_reply':
                return <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
            case 'like':
                return <ThumbsUp className="h-4 w-4 text-pink-600 dark:text-pink-400 flex-shrink-0" />;
            case 'message_edited':
                return <Edit className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0" />;
            case 'message_deleted':
                return <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />;
            default:
                return <Bell className="h-4 w-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />;
        }
    };

    useEffect(() => {
        if (!currentUser?.id) return;
        const unsubscribe = subscribeToUserNotifications(currentUser.id, (notifs) => {
            setNotifications(notifs);
        });
        return () => unsubscribe();
    }, [currentUser?.id]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
            if (notificationsRef.current && !notificationsRef.current.contains(target)) setNotificationsOpen(false);
        };

        if (userMenuOpen || notificationsOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [userMenuOpen, notificationsOpen]);

    // Close dropdowns on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (notificationsOpen) setNotificationsOpen(false);
                if (userMenuOpen) setUserMenuOpen(false);
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [notificationsOpen, userMenuOpen]);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const handleLogout = async () => {
        try {
            await logout();
            setCurrentUser(null);
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            setCurrentUser(null);
            navigate('/login');
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markNotificationAsRead(notification.id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
            );
        }
        if (notification.link) {
            navigate(notification.link);
        }
        setNotificationsOpen(false);
    };

    return (
        <header className={`fixed top-0 right-0 left-0 h-16 bg-[#FFFBEB]/85 dark:bg-brown-900/85 backdrop-blur-xl shadow-lg shadow-primary-500/5 border-b border-brown-200/50 dark:border-brown-700/30 z-50 transition-all duration-300`}>
            {/* Subtle gradient line at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary-400/40 to-transparent dark:via-primary-600/40"></div>

            <div className="h-full px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="bg-gradient-to-br from-[#5C3A1E] via-[#7B4D2A] to-[#D97706] p-1.5 rounded-xl shadow-lg group-hover:shadow-xl group-hover:scale-105 animate-icon-pulse shadow-[#7B4D2A]/20 hover:shadow-[#7B4D2A]/40 transition-all duration-300 border border-white/20">
                            <GraduationCap className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-bold bg-gradient-to-r from-[#3B2314] to-[#D97706] bg-clip-text text-transparent hidden sm:block group-hover:from-[#5C3A1E] group-hover:to-[#B45309] transition-all duration-200">
                            EduAI
                        </span>
                    </Link>

                    <div className="w-px h-6 bg-gradient-to-b from-transparent via-primary-200 to-transparent dark:from-transparent dark:via-primary-700 dark:to-transparent hidden sm:block" />

                    <button
                        onClick={onMenuClick}
                        className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-brown-700 dark:text-brown-300 transition-all duration-200 hover:scale-110 active:scale-95 hover:shadow-md hover:shadow-primary-500/10"
                        title={sidebarOpen ? t('sidebar.close') : t('sidebar.open')}
                    >
                        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>

                <div className="flex items-center gap-2">

                    {/* Show login button for guests, notifications + profile for logged-in users */}
                    {isPublic ? (
                        <Link
                            to="/login"
                            className="btn-modern-primary flex items-center gap-2 px-4 py-2 text-sm"
                        >
                            {t('nav.login')}
                        </Link>
                    ) : (
                        <>
                            {/* Notifications */}
                            <div className="relative" ref={notificationsRef}>
                                <button
                                    onClick={() => setNotificationsOpen((prev) => !prev)}
                                    className="relative p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-brown-700 dark:text-brown-300 transition-all duration-200 hover:scale-110 hover:shadow-md hover:shadow-primary-500/10"
                                    title={t('notifications.title')}
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-gradient-to-r from-red-500 to-red-600 text-[10px] font-semibold text-white flex items-center justify-center shadow-lg animate-pulse">
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>

                                {notificationsOpen && (
                                    <div className="absolute end-0 mt-2 w-64 xs:w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-[#FFFBEB]/95 dark:bg-brown-900/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-primary-500/10 border border-brown-200/50 dark:border-brown-700/30 overflow-hidden z-[60] animate-fade-in-down">
                                        {/* Gradient header */}
                                        <div className="px-4 py-3 bg-gradient-to-r from-primary-50 to-secondary-50 dark:from-primary-900/30 dark:to-secondary-900/30 border-b border-brown-200/50 dark:border-brown-700/30 text-sm font-semibold text-brown-800 dark:text-neutral-100 flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <Bell className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                                                {t('notifications.title')}
                                            </span>
                                            {unreadCount > 0 && (
                                                <span className="text-xs bg-gradient-to-r from-red-500 to-red-600 text-white px-2 py-0.5 rounded-full font-medium shadow-sm">{t('notifications.unreadCountText', { count: unreadCount })}</span>
                                            )}
                                        </div>
                                        {notifications.filter(n => !n.read).length === 0 ? (
                                            <div className="p-6 text-sm text-brown-500 dark:text-neutral-400 text-center">{t('notifications.noNotifications')}</div>
                                        ) : (
                                            <div className="max-h-80 overflow-y-auto">
                                                {notifications.filter(n => !n.read).slice(0, 10).map((notification) => (
                                                    <button
                                                        key={notification.id}
                                                        onClick={() => handleNotificationClick(notification)}
                                                        className={`w-full text-right px-4 py-3 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 border-b border-brown-100 dark:border-brown-700/50 last:border-b-0 transition-all duration-200 ${!notification.read ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            {getNotificationIcon(notification.type)}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-brown-800 dark:text-neutral-100 text-sm">{notification.title}</div>
                                                                {notification.body && <div className="text-xs text-brown-500 dark:text-neutral-400 mt-1 line-clamp-2">{notification.body}</div>}
                                                                <p className="text-xs text-brown-400 dark:text-neutral-500 mt-1">{t('notifications.fromLabel', { name: notification.fromUserName })}</p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {notifications.length > 10 && (
                                            <div className="px-4 py-2 border-t border-brown-200/50 dark:border-brown-700/30 bg-gradient-to-r from-primary-50/30 to-transparent dark:from-primary-900/10 dark:to-transparent">
                                                <button
                                                    onClick={() => {
                                                        setNotificationsOpen(false);
                                                        navigate('/notifications');
                                                    }}
                                                    className="text-sm text-primary-700 dark:text-primary-300 hover:text-primary-800 dark:hover:text-primary-200 font-medium transition-colors"
                                                >
                                                    {t('notifications.viewAll')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Profile - clicking the avatar icon opens the menu */}
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    onClick={() => setUserMenuOpen((prev) => !prev)}
                                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 via-primary-500 to-secondary-600 text-white font-semibold shadow-lg hover:shadow-xl hover:ring-2 hover:ring-primary-400/50 hover:scale-110 transition-all duration-300 border border-white/20 overflow-hidden"
                                    title={currentUser?.name || t('nav.account')}
                                >
                                    {currentUser?.photoURL ? (
                                        <img
                                            src={currentUser.photoURL}
                                            alt={currentUser.name || t('nav.account')}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        (currentUser?.name?.charAt(0) || 'U')
                                    )}
                                </button>

                                {userMenuOpen && (
                                    <div className="absolute end-0 mt-2 w-56 sm:w-64 max-w-[calc(100vw-2rem)] bg-[#FFFBEB]/95 dark:bg-brown-900/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-primary-500/10 border border-brown-200/50 dark:border-brown-700/30 z-[60] overflow-hidden animate-fade-in-down">
                                        {/* User info - gradient header */}
                                        <div className="px-4 py-3 bg-gradient-to-r from-primary-50/80 to-secondary-50/80 dark:from-primary-900/30 dark:to-secondary-900/30 border-b border-brown-200/50 dark:border-brown-700/30">
                                            <p className="font-semibold text-brown-800 dark:text-neutral-100 truncate">
                                                {currentUser?.name || t('common.welcome')}
                                            </p>
                                            {currentUser?.email && (
                                                <p className="text-xs text-brown-500 dark:text-neutral-400 truncate">
                                                    {currentUser.email}
                                                </p>
                                            )}
                                        </div>

                                        <Link
                                            to="/profile"
                                            className="block px-4 py-3 text-right text-brown-700 dark:text-brown-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors duration-200 font-medium"
                                        >
                                            {t('nav.profile')}
                                        </Link>

                                        {/* Settings button */}
                                        <button
                                            onClick={() => setSettingsOpen((prev) => !prev)}
                                            className="w-full text-right px-4 py-3 flex items-center justify-between text-brown-700 dark:text-brown-300 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-colors duration-200 font-medium"
                                        >
                                            <span>{t('admin.settings')}</span>
                                            <Settings className="h-4 w-4" />
                                        </button>

                                        {settingsOpen && (
                                            <div className="px-4 py-3 space-y-3 border-t border-brown-100 dark:border-brown-700/50 bg-brown-50/50 dark:bg-brown-900/20">
                                                {/* Night mode toggle */}
                                                <button
                                                    onClick={toggleDarkMode}
                                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 bg-white/60 dark:bg-brown-800/60 border border-brown-200/50 dark:border-brown-700/50 text-brown-700 dark:text-brown-200 hover:border-primary-400 dark:hover:border-primary-500"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        {isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                                                        {t('darkMode.toggle')}
                                                    </span>
                                                    <div className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${isDarkMode ? 'bg-primary-600' : 'bg-brown-300'}`}>
                                                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${isDarkMode ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                </button>

                                                {/* Language switcher */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => { i18n.changeLanguage('ar'); localStorage.setItem('i18nextLng', 'ar'); }}
                                                        className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${i18n.language === 'ar'
                                                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 border border-primary-300 dark:border-primary-700'
                                                            : 'bg-white/60 dark:bg-brown-800/60 border border-brown-200/50 dark:border-brown-700/50 text-brown-700 dark:text-brown-300 hover:border-primary-400 dark:hover:border-primary-500'
                                                            }`}
                                                    >
                                                        {t('language.ar')}
                                                    </button>
                                                    <button
                                                        onClick={() => { i18n.changeLanguage('en'); localStorage.setItem('i18nextLng', 'en'); }}
                                                        className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${i18n.language === 'en'
                                                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 border border-primary-300 dark:border-primary-700'
                                                            : 'bg-white/60 dark:bg-brown-800/60 border border-brown-200/50 dark:border-brown-700/50 text-brown-700 dark:text-brown-300 hover:border-primary-400 dark:hover:border-primary-500'
                                                            }`}
                                                    >
                                                        {t('language.en')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border-t border-brown-100 dark:border-brown-700/50 my-1"></div>

                                        {/* Logout button */}
                                        <button
                                            onClick={() => {
                                                handleLogout();
                                                setUserMenuOpen(false);
                                            }}
                                            className="w-full text-right px-4 py-3 flex items-center justify-between gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 font-medium"
                                        >
                                            <span>{t('nav.logout')}</span>
                                            <LogOut className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default UnifiedHeader;
