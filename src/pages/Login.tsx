import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/appStore';
import { loginWithEmail, loginWithGoogle, EMAIL_REGEX } from '../services/authService';
import { useToast } from '../components/ui/Toast';
import { Eye, EyeOff } from 'lucide-react';

// Consistent style helper used by auth form inputs - warm brown theme
const authInputClasses =
  "appearance-none rounded-xl relative block w-full px-4 py-3 pr-10 border border-brown-300/80 dark:border-brown-600/40 " +
  "placeholder-brown-400 text-brown-900 dark:text-neutral-100 bg-white/80 dark:bg-brown-900/60 backdrop-blur-sm " +
  "focus:outline-none focus:ring-2 focus:ring-[#7B4D2A]/40 focus:border-[#7B4D2A] focus:z-10 " +
  "sm:text-sm transition-all duration-200";

interface LoginForm {
  email: string;
  password: string;
}

// Single place that decides where to send a user after auth, based on role.
const getRedirectPath = (role: string): string => (role === 'admin' ? '/admin' : '/');

const Login: React.FC = () => {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const currentUser = useAppStore((state) => state.currentUser);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const location = useLocation();
  const { info } = useToast();

  // If the visitor was redirected here after clicking the AI assistant while
  // not logged in, show the registration notice at the screen level.
  useEffect(() => {
    const state = location.state as { aiLoginRequired?: boolean } | null;
    if (state?.aiLoginRequired) {
      info(t('auth.aiLoginRequired'));
      // Clear the flag so the notice isn't repeated on later renders
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, info, navigate, location.pathname]);

  // If the user is already authenticated, send them to their home screen
  // instead of showing the login form again.
  useEffect(() => {
    if (currentUser) {
      navigate(getRedirectPath(currentUser.role), { replace: true });
    }
  }, [currentUser, navigate]);

const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError('');

    try {
      // Auth flow: Firebase Auth → Realtime DB → Zustand.
      // The Zustand user is set by onAuthChange (in App.tsx), which is the
      // single source of truth, so we avoid a duplicate set here.
      const user = await loginWithEmail(data.email, data.password);

      // Redirect based on role
      navigate(getRedirectPath(user.role));
    } catch (error: any) {
      // If the auth state observer already set the user (success via onAuthChange)
      // and navigation is imminent, do NOT show a misleading error message.
      if (useAppStore.getState().currentUser) {
        return;
      }
      setLoginError(error.message || t('auth.loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoginError('');

    try {
      // Auth flow: Firebase Auth → Realtime DB → Zustand
      const user = await loginWithGoogle();

      // Redirect based on role
      navigate(getRedirectPath(user.role));
    } catch (error: any) {
      // If the auth state observer already set the user (success via onAuthChange)
      // and navigation is imminent, do NOT show a misleading error message.
      if (useAppStore.getState().currentUser) {
        return;
      }
      setLoginError(error.message || t('auth.loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="-mt-4 mx-auto h-28 w-28 bg-gradient-to-br from-[#D4A77A] to-[#B8865E] dark:from-[#B8865E] dark:to-[#D4A77A] rounded-full flex items-center justify-center mb-1 shadow-lg shadow-[#B8865E]/25">
            <img src="/Icons2.png" alt="EduAI" className="h-28 w-28 rounded-full object-contain" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-l from-[#7B4D2A] to-[#3B2314] dark:from-[#D4A77A] dark:to-[#B8865E] bg-clip-text text-transparent">
            {t('auth.login')}
          </h2>
          <p className="mt-2 text-brown-600 dark:text-[#D4A77A]/70">{t('common.welcome')}</p>
        </div>

        {loginError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl relative" role="alert">
            <span className="block sm:inline">{loginError}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} onChange={() => setLoginError('')}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="relative">
              <label htmlFor="email" className="sr-only">
                {t('auth.email')}
              </label>
              <input
                {...register('email', {
                  required: t('errors.generic'),
                  pattern: {
                    value: EMAIL_REGEX,
                    message: t('errors.generic')
                  }
                })}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={`${authInputClasses} rounded-t-md`}
                placeholder={t('auth.email')}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                {t('auth.password')}
              </label>
              <input
                {...register('password', { required: t('common.required') })}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className={`${authInputClasses} rounded-b-md`}
                placeholder={t('auth.password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brown-400 hover:text-[#7B4D2A] dark:hover:text-[#D4A77A] transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {errors.email && <p className="text-red-500 text-sm text-right mt-1">{errors.email.message}</p>}
          {errors.password && <p className="text-red-500 text-sm text-right mt-1">{errors.password.message}</p>}

          <div className="flex items-center justify-between mt-2">
            <Link to="/reset-password" className="text-sm text-[#7B4D2A] dark:text-[#D4A77A] hover:text-[#3B2314] dark:hover:text-[#B8865E] transition-colors">
                {t('auth.forgotPassword')}
            </Link>
          </div>

          <div className="mt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-ripple group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-l from-[#7B4D2A] to-[#3B2314] dark:from-[#7B4D2A] dark:to-[#1A1512] hover:from-[#3B2314] hover:to-[#7B4D2A] dark:hover:from-[#5C3A1E] dark:hover:to-[#3B2314] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7B4D2A]/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#7B4D2A]/20 hover:shadow-xl hover:shadow-[#7B4D2A]/30 transition-all"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('common.loading')}
                </>
              ) : t('auth.login')}
            </button>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brown-300/80 dark:border-brown-600/20" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white/80 dark:bg-brown-900/60 text-brown-500 dark:text-[#D4A77A]/60">{t('common.or')}</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="btn-ripple w-full flex justify-center items-center px-4 py-3 border border-brown-200 dark:border-brown-600/20 rounded-xl shadow-sm text-sm font-medium text-brown-700 dark:text-[#D4A77A] bg-white/80 dark:bg-brown-900/60 backdrop-blur-sm hover:bg-brown-50 dark:hover:bg-[#5C3A1E]/10 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7B4D2A]/50 disabled:opacity-50 transition-all"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 ml-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 ml-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {t('auth.loginWithGoogle')}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center mt-6">
            <Link to="/register" className="text-[#7B4D2A] dark:text-[#D4A77A] hover:text-[#3B2314] dark:hover:text-[#B8865E] font-medium transition-colors">
               {t('auth.noAccount', 'ليس لديك حساب؟ سجل الآن')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
