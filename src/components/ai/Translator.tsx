import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { aiService, TranslateResponse } from '../../utils/aiService';
import { getScannedFileImageAttachments, type ScannedFileAttachment } from '../../services/localFileStorage';
import { MarkdownRenderer } from '../markdown';

interface TranslatorProps {
    fileName?: string;
    fileContent?: string;
    file?: { name?: string; downloadURL?: string; url?: string; localDataUrl?: string };
    onClose?: () => void;
}

const Translator = ({ fileName, fileContent, file, onClose }: TranslatorProps) => {
    const { t, i18n } = useTranslation();
    const [targetLanguage, setTargetLanguage] = useState(t('ai.translator.targetLanguageEnglish'));
    const [isTranslating, setIsTranslating] = useState(false);
    const [translationData, setTranslationData] = useState<TranslateResponse | null>(null);
    const [manualText, setManualText] = useState('');

    const isImageBasedFile = !!(file && /\.(pdf|pptx|jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name || ''));
    const contentToTranslate = (fileContent?.trim() && !['[ملف', '[File'].some(prefix => fileContent?.startsWith(prefix))) ? fileContent : manualText;
    const canTranslate = contentToTranslate.trim().length > 0 || isImageBasedFile;

    const translateContent = async () => {
        if (!canTranslate) return;

        setIsTranslating(true);
        try {
            // Scanned/image-only files: read them via the vision/OCR pipeline.
            let attachments: ScannedFileAttachment[] | undefined;
            if (!contentToTranslate.trim() && file) {
                try {
                    const scanned = await getScannedFileImageAttachments(file);
                    if (scanned && scanned.length) attachments = scanned;
                } catch (e) {
                    console.warn('Scanned file extraction failed:', e);
                }
            }
            const text = attachments?.length
                ? t('ai.translator.scannedFile')
                : contentToTranslate;

             const result = await aiService.translate({
                 text,
                 targetLanguage,
                 fileName,
                 language: i18n.language
             }, attachments);
            setTranslationData(result);
        } catch (error) {
            console.error('Error translating content:', error);
            setTranslationData({
                translatedText: `${t('ai.translator.connectionError')}\n\n${contentToTranslate}`
            });
        } finally {
            setIsTranslating(false);
        }
    };

    return (
      <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl mx-auto text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center text-gray-900 dark:text-gray-100">
            <Languages className="h-5 w-5 ml-2 text-purple-500 dark:text-purple-400" />
            {t('ai.translator.title')}
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              ✕
            </button>
          )}
        </div>
  
        {fileName && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t('ai.translator.fileName', { name: fileName })}</p>
        )}
  
        <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              {t('ai.translator.targetLanguage')}
            </label>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-gray-100"
            >
               <option value={t('ai.translator.targetLanguageEnglish')}>{t('ai.translator.targetLanguageEnglish')}</option>
               <option value={t('ai.translator.targetLanguageArabic')}>{t('ai.translator.targetLanguageArabic')}</option>
               <option value={t('ai.translator.targetLanguageFrench')}>{t('ai.translator.targetLanguageFrench')}</option>
               <option value={t('ai.translator.targetLanguageGerman')}>{t('ai.translator.targetLanguageGerman')}</option>
               <option value={t('ai.translator.targetLanguageSpanish')}>{t('ai.translator.targetLanguageSpanish')}</option>
               <option value={t('ai.translator.targetLanguageTurkish')}>{t('ai.translator.targetLanguageTurkish')}</option>
            </select>
          </div>
  
          <button
            onClick={translateContent}
            disabled={isTranslating || !canTranslate}
            className="w-full md:w-auto bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTranslating ? t('ai.translator.translating') : t('ai.translator.translateButton')}
          </button>
        </div>
  
        {(!fileContent?.trim() || ['[ملف', '[File'].some(prefix => fileContent?.startsWith(prefix))) && (
          <div className="rounded-lg border border-dashed border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 p-4 text-center text-gray-800 dark:text-gray-200">
            <p className="font-medium mb-2">{t('ai.translator.notExtracted')}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{t('ai.translator.pasteText')}</p>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={t('ai.translator.pastePlaceholder')}
              className="w-full rounded-lg border border-purple-200 dark:border-purple-700 p-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
              rows={6}
            />
          </div>
        )}
  
        {translationData && (
          <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Languages className="h-5 w-5 text-purple-600 ml-2 dark:text-purple-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('ai.translator.translationTitle')}</h3>
            </div>
            <div className="prose max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
              <MarkdownRenderer content={translationData.translatedText} />
            </div>
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {t('ai.translator.generatedAt', { time: new Date().toLocaleTimeString(i18n.language === 'ar' ? 'ar-EG' : 'en-US') })}
            </div>
          </div>
        )}
      </div>
    );
};

export default Translator;
