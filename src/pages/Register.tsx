import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../stores/appStore';
import { registerWithEmail, loginWithGoogle, EMAIL_REGEX } from '../services/authService';
import { Eye, EyeOff } from 'lucide-react';

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

// Consistent style helper used by auth form inputs - warm brown theme
const authInputClasses =
  "appearance-none rounded-xl relative block w-full px-4 py-3 pr-10 border border-brown-300/80 dark:border-brown-600/40 " +
  "placeholder-brown-400 text-brown-900 dark:text-neutral-100 bg-white/80 dark:bg-brown-900/60 backdrop-blur-sm " +
  "focus:outline-none focus:ring-2 focus:ring-[#7B4D2A]/40 focus:border-[#7B4D2A] focus:z-10 " +
  "sm:text-sm transition-all duration-200";

const Register: React.FC = () => {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors }, watch } = useForm<RegisterForm>();
  const currentUser = useAppStore((state) => state.currentUser);
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const password = watch('password');

  // If the user is already authenticated, send them to the home screen
  // instead of showing the registration form again.
  useEffect(() => {
    if (currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setRegisterError('');

    try {
      // All new users register as students by default
      // Only admins can promote users to admin role.
      // The Zustand user is set by onAuthChange (single source of truth),
      // so we avoid a duplicate set here.
      await registerWithEmail(data.email, data.password, data.name, 'student');
      navigate('/');
    } catch (error: any) {
      // If the auth state observer already set the user (success via onAuthChange)
      // and navigation is imminent, do NOT show a misleading error message.
      if (useAppStore.getState().currentUser) {
        return;
      }
      setRegisterError(error.message || t('auth.registerError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setIsLoading(true);
    setRegisterError('');

    try {
      await loginWithGoogle();
      navigate('/');
    } catch (error: any) {
      // If the auth state observer already set the user (success via onAuthChange)
      // and navigation is imminent, do NOT show a misleading error message.
      if (useAppStore.getState().currentUser) {
        return;
      }
      // When the popup was blocked and we fell back to the full-page redirect
      // flow, the page is about to navigate to Google. Do not flash an error.
      if (error?.message === 'AUTH_REDIRECT_IN_PROGRESS') {
        return;
      }
      setRegisterError(error.message || t('auth.loginError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold bg-gradient-to-l from-[#7B4D2A] to-[#3B2314] dark:from-[#D4A77A] dark:to-[#B8865E] bg-clip-text text-transparent">
            {t('auth.register')}
          </h2>
          <p className="mt-2 text-center text-sm text-brown-600 dark:text-[#D4A77A]/70">
            {t('auth.defaultStudent')}
          </p>
        </div>

        {registerError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl relative" role="alert">
            <span className="block sm:inline">{registerError}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} onChange={() => setRegisterError('')}>
          <div className="rounded-xl shadow-sm -space-y-px">
            <div>
              <label htmlFor="name" className="sr-only">{t('auth.name')}</label>
              <input
                {...register('name', { required: t('auth.nameRequired'), minLength: { value: 2, message: t('auth.nameMinLength') } })}
                id="name"
                name="name"
                type="text"
                className={`${authInputClasses} rounded-t-xl`}
                placeholder={t('auth.name')}
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">{t('auth.email')}</label>
              <input
                {...register('email', {
                  required: t('auth.emailRequired'),
                  pattern: {
                    value: EMAIL_REGEX,
                    message: t('auth.emailInvalid')
                  }
                })}
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className={`${authInputClasses}`}
                placeholder={t('auth.email')}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">{t('auth.password')}</label>
              <input
                {...register('password', {
                  required: t('auth.passwordRequired'),
                  minLength: { value: 6, message: t('auth.passwordMinLength') }
                })}
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className={`${authInputClasses}`}
                placeholder={t('auth.password')}
              />
            </div>
            <div className="relative">
              <label htmlFor="confirmPassword" className="sr-only">{t('auth.confirmPassword')}</label>
              <input
                {...register('confirmPassword', {
                  required: t('auth.confirmPasswordRequired'),
                  validate: value => value === password || t('auth.passwordsMismatch')
                })}
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? "text" : "password"}
                className={`${authInputClasses} rounded-b-md`}
                placeholder={t('auth.confirmPassword')}
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

          {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
          {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-ripple group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-l from-[#7B4D2A] to-[#3B2314] dark:from-[#7B4D2A] dark:to-[#1A1512] hover:from-[#3B2314] hover:to-[#7B4D2A] dark:hover:from-[#5C3A1E] dark:hover:to-[#3B2314] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7B4D2A]/50 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#7B4D2A]/20 hover:shadow-xl hover:shadow-[#7B4D2A]/30 transition-all"
            >
              {isLoading ? t('common.loading') : t('auth.register')}
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
                onClick={handleGoogleRegister}
                disabled={isLoading}
                className="btn-ripple w-full flex justify-center items-center px-4 py-3 border border-brown-200 dark:border-brown-600/20 rounded-xl shadow-sm text-sm font-medium text-brown-700 dark:text-[#D4A77A] bg-white/80 dark:bg-brown-900/60 backdrop-blur-sm hover:bg-brown-50 dark:hover:bg-[#5C3A1E]/10 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7B4D2A]/50 disabled:opacity-50 transition-all"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#6e70d6" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#289385" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#c98a3e" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#6e70d6" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t('auth.loginWithGoogle')}
              </button>
            </div>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-[#7B4D2A] dark:text-[#D4A77A] hover:text-[#3B2314] dark:hover:text-[#B8865E] transition-colors">
              {t('auth.alreadyHaveAccount')}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
