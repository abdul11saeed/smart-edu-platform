import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Lightbulb } from 'lucide-react';
import { aiService, ExplainResponse } from '../../utils/aiService';
import { getScannedFileImageAttachments, type ScannedFileAttachment } from '../../services/localFileStorage';
import { MarkdownRenderer } from '../markdown';

interface ExplainerProps {
  topic?: string;
  file?: { name?: string; downloadURL?: string; url?: string; localDataUrl?: string };
  onClose?: () => void;
}

const createLocalExplanation = (concept: string, context: string | undefined) => {
  const contextSnippet = context ? ` ${context.slice(0, 500)}` : '';
  return {
    explanation: `شرح لمفهوم "${concept}": فكرة أو مفهوم يحتاج إلى فهم من خلال تعريفه وأهميته وتطبيقاته.${contextSnippet}`,
    simpleExplanation: `ببساطة: "${concept}" يعني الفكرة الأساسية التي تساعدك على فهم الموضوع وربطه بالتطبيقات العملية.`,
    examples: [
      `اكتب تعريفاً موجزاً لـ "${concept}" بكلماتك الخاصة ثم قارنه بالشرح أعلاه.`,
      `ابحث عن مثال عملي من الدرس أو الحياة اليومية يتعلق بـ "${concept}".`,
      context ? 'استخدم الجمل المهمة في النص كمفاتيح لفهم الفكرة.' : 'راجع ملاحظاتك أو الملف المرفق للحصول على سياق إضافي.'
    ]
  };
};

const Explainer = ({ topic, file, onClose }: ExplainerProps) => {
  const { t, i18n } = useTranslation();
  const [userQuestion, setUserQuestion] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationData, setExplanationData] = useState<ExplainResponse | null>(null);
  const [manualContext, setManualContext] = useState('');

  const contextToUse = (topic?.trim() && !['[ملف', '[File'].some(prefix => topic?.startsWith(prefix))) ? topic : manualContext;
  const topicIsPlaceholder = !topic?.trim() || ['[ملف', '[File'].some(prefix => topic?.startsWith(prefix));

  const generateExplanation = async () => {
    if (!userQuestion.trim()) return;

    setIsExplaining(true);
    try {
      // Scanned/image-only files: read them via the vision/OCR pipeline and
      // let the image carry the context (the user's question is the concept).
      let attachments: ScannedFileAttachment[] | undefined;
      if (topicIsPlaceholder && file) {
        try {
          const scanned = await getScannedFileImageAttachments(file);
          if (scanned && scanned.length) attachments = scanned;
        } catch (e) {
          console.warn('Scanned file extraction failed:', e);
        }
      }

       const result = await aiService.explain({
         concept: userQuestion,
         context: (attachments?.length ? undefined : contextToUse) || undefined,
         language: i18n.language
       }, attachments);
      setExplanationData(result);
    } catch (error) {
      console.error('Error generating explanation:', error);
      // Fallback
      setExplanationData(createLocalExplanation(userQuestion, contextToUse));
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl mx-auto text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <User className="h-5 w-5 ml-2 text-secondary-500 dark:text-secondary-400" />
          {t('ai.explainer.title')}
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ✕
          </button>
        )}
      </div>

      {topic && !['[ملف', '[File'].some(prefix => topic?.startsWith(prefix)) && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{t('ai.explainer.context')} {topic.slice(0, 180)}</p>
      )}

      {['[ملف', '[File'].some(prefix => topic?.startsWith(prefix)) && (
        <div className="rounded-lg border border-dashed border-secondary-200 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-900/30 p-4 text-center text-gray-800 dark:text-gray-200 mb-6">
          <p className="font-medium mb-2">{t('ai.explainer.notExtracted')}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{t('ai.explainer.pasteText')}</p>
          <textarea
            value={manualContext}
            onChange={(e) => setManualContext(e.target.value)}
            placeholder={t('ai.explainer.pastePlaceholder')}
            className="w-full rounded-lg border border-secondary-200 dark:border-secondary-700 p-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-secondary-500 dark:bg-gray-700 dark:focus:ring-secondary-400"
            rows={6}
          />
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          {t('ai.explainer.whatToExplain')}
        </label>
        <textarea
          value={userQuestion}
          onChange={(e) => setUserQuestion(e.target.value)}
          placeholder={t('ai.explainer.questionPlaceholder')}
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-secondary-500 focus:border-secondary-500 resize-none dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400"
          rows={3}
        />
        <button
          onClick={generateExplanation}
          disabled={isExplaining || !userQuestion.trim()}
          className="mt-3 bg-secondary-600 text-white py-2 px-6 rounded-lg hover:bg-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExplaining ? t('ai.explainer.generating') : t('ai.explainer.generateButton')}
        </button>
      </div>

      {explanationData && (
        <div className="bg-secondary-50 dark:bg-secondary-900/30 rounded-lg p-4">
          <div className="flex items-center mb-4">
            <Lightbulb className="h-5 w-5 text-secondary-500 ml-2 dark:text-secondary-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{t('ai.explainer.title')}</h3>
          </div>

          <div className="prose max-w-none mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <MarkdownRenderer content={explanationData.explanation} />
          </div>

          {explanationData.simpleExplanation && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('ai.explainer.simpleExplanation')}</h4>
              <p className="text-gray-700 dark:text-gray-300">{explanationData.simpleExplanation}</p>
            </div>
          )}

          {explanationData.examples && explanationData.examples.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('ai.explainer.examples')}</h4>
              <ul className="list-disc list-inside space-y-1">
                {explanationData.examples.map((example, index) => (
                  <li key={index} className="text-gray-700 dark:text-gray-300">{example}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
            <span>{t('ai.explainer.generatedAt', { time: new Date().toLocaleTimeString(i18n.language === 'ar' ? 'ar-SA' : 'en-US') })}</span>
          </div>
        </div>
      )}

      {!explanationData && !isExplaining && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium text-gray-700 dark:text-gray-300">{t('ai.explainer.writeQuestion')}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t('ai.explainer.canUseContext')}</p>
        </div>
      )}
    </div>
  );
};

export default Explainer;
