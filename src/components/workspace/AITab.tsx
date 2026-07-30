import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Lightbulb, HelpCircle, Languages, Sparkles } from 'lucide-react';
import { aiService } from '../../utils/aiService';
import { MarkdownRenderer } from '../markdown';
import Explainer from '../ai/Explainer';
import Summarizer from '../ai/Summarizer';
import QuestionGenerator from '../ai/QuestionGenerator';
import Translator from '../ai/Translator';

interface AITabProps {
    currentCourseFiles?: { id: string; name: string; localTextPreview?: string }[];
    selectedFile?: { id: string; name: string; content?: string; localTextPreview?: string } | null;
    onSelectFile?: (file: { id: string; name: string; content?: string; localTextPreview?: string }) => void;
    courseId?: string;
    onClose?: () => void;
}

type AIAction = 'explain' | 'summarize' | 'questions' | 'translate' | null;

const TOOLS = [
    { id: 'summarizer' as AIAction, titleKey: 'ai.summarizer.title', descriptionKey: 'ai.summarizer.selectFile', icon: FileText, color: 'emerald' },
    { id: 'explainer' as AIAction, titleKey: 'ai.explainer.title', descriptionKey: 'ai.explainer.writeQuestion', icon: Lightbulb, color: 'violet' },
    { id: 'translator' as AIAction, titleKey: 'ai.translator.title', descriptionKey: 'ai.translator.pasteText', icon: Languages, color: 'purple' },
    { id: 'questions' as AIAction, titleKey: 'ai.questions.title', descriptionKey: 'ai.questions.fromFile', icon: HelpCircle, color: 'amber' },
];

const AITab = ({ selectedFile: _selectedFile, onClose }: AITabProps) => {
    const { t, i18n } = useTranslation();
    const [aiAction, setAiAction] = useState<AIAction>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiContent, setAiContent] = useState<string | null>(null);

    const selectedFileContent = useMemo(() => {
        if (!_selectedFile) return null;
        const localTextPreview = _selectedFile.localTextPreview;
        const hasValidPreview = localTextPreview && !['[ملف', '[File'].some(prefix => localTextPreview.startsWith(prefix));
        return hasValidPreview ? localTextPreview : (_selectedFile.content || undefined);
    }, [_selectedFile]);

    const handleAIAction = async (action: AIAction) => {
        if (!_selectedFile && action !== 'explain') return;
        setAiAction(action);
        setAiLoading(true);
        setAiContent(null);

        try {
            switch (action) {
            case 'summarize': {
                     const result = await aiService.summarize({ text: selectedFileContent || '', fileName: _selectedFile?.name, language: i18n.language });
                     setAiContent(result.summary);
                     break;
                 }
                 case 'explain': {
                     const result = await aiService.explain({ concept: selectedFileContent || '', context: selectedFileContent || undefined, language: i18n.language });
                     setAiContent(result.explanation);
                     break;
                 }
                 case 'questions': {
                     const result = await aiService.generateQuestions({ text: selectedFileContent || '', questionType: 'both', numQuestions: 5, language: i18n.language });
                     setAiContent(result.questions.map((q, i) => `${i + 1}. ${q.question}\n   ${q.type === 'true-false' ? t('ai.questions.trueFalse') : t('ai.questions.answer') + ': ' + q.answer}`).join('\n\n'));
                     break;
                 }
                 case 'translate': {
                     const result = await aiService.translate({ text: selectedFileContent || '', targetLanguage: i18n.language === 'ar' ? 'ar' : 'en', fileName: _selectedFile?.name, language: i18n.language });
                     setAiContent(result.translatedText);
                     break;
                 }
                default:
                    break;
            }
        } catch (error) {
            console.error('Error executing AI action:', error);
            setAiContent(t('ai.errorProcessing'));
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary-500" />
                        {t('ai.aiChat')}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {t('ai.quickTools')}
                    </p>
                </div>
                {onClose && (
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        ✕
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                {TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        onClick={() => handleAIAction(tool.id)}
                        disabled={!_selectedFile && tool.id !== 'explain'}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${aiAction === tool.id
                            ? `border-${tool.color}-500 bg-${tool.color}-50 dark:bg-${tool.color}-900/20`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                    >
                        <tool.icon className={`h-6 w-6 mb-2 text-${tool.color}-600 dark:text-${tool.color}-400`} />
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {t(tool.titleKey)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t(tool.descriptionKey)}
                        </p>
                    </button>
                ))}
            </div>

            {aiLoading && (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    <p className="mr-4 text-slate-600 dark:text-slate-300">{t('ai.thinking')}</p>
                </div>
            )}

            {aiContent && !aiLoading && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <div className="prose max-w-none text-gray-700 dark:text-gray-300">
                        <MarkdownRenderer content={aiContent} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AITab;
