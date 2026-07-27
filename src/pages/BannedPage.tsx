import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/appStore';

const BannedPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const currentUser = useAppStore((state) => state.currentUser);
    const [remainingTime, setRemainingTime] = useState<string>('');
    const [isPermanent, setIsPermanent] = useState(false);
    const [remainingRaw, setRemainingRaw] = useState<{ days: number; hours: number; minutes: number } | null>(null);

    useEffect(() => {
        if (!currentUser?.isBanned) {
            navigate('/');
            return;
        }

        const updateRemainingTime = () => {
            if (!currentUser?.banExpiresAt || currentUser.banExpiresAt === 0) {
                setIsPermanent(true);
                setRemainingTime(t('banned.permanentBan'));
                setRemainingRaw(null);
                return;
            }

            const now = Date.now();
            const remaining = currentUser.banExpiresAt - now;

            if (remaining <= 0) {
                setIsPermanent(false);
                setRemainingTime(t('banned.expired'));
                setRemainingRaw(null);
                return;
            }

            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

            setRemainingRaw({ days, hours, minutes });

            if (days > 0) {
                setRemainingTime(t('banned.daysAndHours', { days, hours }));
            } else if (hours > 0) {
                setRemainingTime(t('banned.hoursAndMinutes', { hours, minutes }));
            } else {
                setRemainingTime(t('banned.minutes', { minutes }));
            }
        };

        updateRemainingTime();
        const interval = setInterval(updateRemainingTime, 60000);

        return () => clearInterval(interval);
    }, [currentUser, navigate, t]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                    {t('banned.bannedTitle')}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {t('banned.bannedDescription')}
                </p>
                {!isPermanent && remainingTime !== t('banned.expired') && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            {t('banned.remainingTime')} <span className="font-semibold">{remainingTime}</span>
                        </p>
                    </div>
                )}
                {isPermanent && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                        <p className="text-sm text-red-800 dark:text-red-300">
                            {t('banned.permanentBan')}
                        </p>
                    </div>
                )}
                <button
                    onClick={() => navigate('/')}
                    className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                    {t('banned.backToHome')}
                </button>
            </div>
        </div>
    );
};

export default BannedPage;
