import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../services/authService';
import { useNavigate } from 'react-router-dom';

export default function ResetPassword() {
    const { t } = useTranslation();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);

        try {
            console.log('Attempting to send password reset email to:', email);
            await resetPassword(email);
            setMessage(t('auth.resetPasswordSuccess'));
            console.log('Password reset email sent successfully');
        } catch (err: any) {
            console.error('Password reset failed:', err);
            setError(err.message || t('auth.resetPasswordError'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center py-12 px-4">
            <div className="max-w-md w-full space-y-6 p-8 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-[#1E40AF]/5 border border-slate-200/80 dark:border-blue-400/20">
                <h2 className="text-center text-3xl font-bold bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 bg-clip-text text-transparent">{t('resetPassword.title')}</h2>
                <p className="text-center text-slate-600 dark:text-blue-200/70 text-sm">
                    {t('resetPassword.description')}
                </p>
                {message && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl relative animate-fade-in-up">
                        <p className="text-center">{message}</p>
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl relative animate-fade-in-up">
                        <p className="text-center">{error}</p>
                    </div>
                )}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email" className="sr-only">{t('resetPassword.emailLabel')}</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-slate-300/80 dark:border-blue-400/20 placeholder-slate-400 dark:placeholder-blue-300/40 text-slate-900 dark:text-slate-100 bg-white dark:bg-[#0F172A]/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/40 focus:border-[#1E40AF] focus:z-10 text-sm transition-all duration-200"
                            placeholder={t('resetPassword.emailLabel')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-ripple group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 hover:shadow-lg hover:shadow-[#1E40AF]/25 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E40AF]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {t('resetPassword.sending')}
                                </>
                            ) : t('resetPassword.submitButton')}
                        </button>
                    </div>
                </form>
                <div className="text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-[#1E40AF] dark:text-blue-400 hover:text-[#0F172A] dark:hover:text-blue-300 font-medium transition-colors"
                    >
                        {t('resetPassword.backToLogin')}
                    </button>
                </div>
            </div>
        </div>
    );
}
