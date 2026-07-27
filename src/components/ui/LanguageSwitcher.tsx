import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Globe } from 'lucide-react';

const LanguageSwitcher = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentLang = i18n.language;

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-brown-700 dark:text-brown-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all duration-200 hover:scale-105 active:scale-95"
        title={t('language.switch', 'Change language')}
        aria-label={t('language.switch', 'Change language')}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang === 'ar' ? 'عربي' : 'EN'}</span>
      </button>
      {open && (
        <div className="absolute end-0 mt-2 w-36 bg-[#FFFBEB]/95 dark:bg-brown-900/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-primary-500/10 border border-brown-200/50 dark:border-brown-700/30 overflow-hidden z-[60] animate-fade-in-down">
          <button
            onClick={() => changeLanguage('ar')}
            className={`w-full text-right px-4 py-3 text-sm font-medium transition-colors duration-200 ${currentLang === 'ar'
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
              : 'text-brown-700 dark:text-brown-300 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              }`}
          >
            العربية
          </button>
          <button
            onClick={() => changeLanguage('en')}
            className={`w-full text-right px-4 py-3 text-sm font-medium transition-colors duration-200 ${currentLang === 'en'
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
              : 'text-brown-700 dark:text-brown-300 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              }`}
          >
            English
          </button>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
