import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { ArrowLeft, Bell, Check } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { getUserNotifications, markNotificationAsRead, subscribeToUserNotifications, Notification } from '../services/notificationService';

const NotificationsPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAppStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) {
            navigate('/login', { replace: true });
            return;
        }

        const fetchNotifications = async () => {
            try {
                const notifs = await getUserNotifications(currentUser.id, 50);
                setNotifications(notifs);
            } catch (err) {
                setError(t('notifications.loadingNotifications'));
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();

        // Real-time subscription
        const unsubscribe = subscribeToUserNotifications(currentUser.id, (notifs) => {
            setNotifications(notifs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, navigate, t]);

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
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'private_message': return '💬';
            case 'discussion_reply': return '💭';
            case 'like': return '❤️';
            case 'message_edited': return '✏️';
            case 'message_deleted': return '🗑️';
            default: return '🔔';
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return t('notifications.timeJustNow');
        if (diffMins < 60) return t('notifications.timeMinutesAgo', { minutes: diffMins });
        if (diffHours < 24) return t('notifications.timeHoursAgo', { hours: diffHours });
        return t('notifications.timeDaysAgo', { days: diffDays });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">{t('notifications.loadingNotifications')}</p>
                </div>
            </div>
        );
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
         <div className="container mx-auto px-4 py-6 max-w-3xl" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => {
                        if (window.history.length > 1) {
                            navigate(-1);
                        } else {
                            navigate('/');
                        }
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title={t('notifications.back')}
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Bell className="h-6 w-6 text-primary-600" />
                        {t('notifications.notificationsList')}
                        {unreadCount > 0 && (
                            <span className="bg-primary-600 text-white text-xs px-2 py-1 rounded-full">
                                {unreadCount} {t('notifications.unreadNotification')}
                            </span>
                        )}
                    </h1>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-red-700">{error}</p>
                </div>
            )}

            {/* Notifications List */}
            {notifications.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <Bell className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-300">{t('notifications.noNotificationsYet')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.filter(n => !n.read).map((notification) => (
                        <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${notification.read
                                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                : 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                            {notification.title}
                                        </h3>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                            {formatTime(notification.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 line-clamp-2">
                                        {notification.body}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t('notifications.from')} {notification.fromUserName}
                                    </p>
                                </div>
                                {!notification.read && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            markNotificationAsRead(notification.id);
                                            setNotifications((prev) =>
                                                prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
                                            );
                                        }}
                                        className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                                        title={t('notifications.markAsReadTitle')}
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
