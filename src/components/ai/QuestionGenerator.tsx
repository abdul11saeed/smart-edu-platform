import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Save } from 'lucide-react';
import { aiService, Question } from '../../utils/aiService';

interface QuestionGeneratorProps {
    fileName?: string;
    fileContent?: string;
    onClose?: () => void;
}

const createLocalQuestions = (text: string, count: number, t: any) => {
    const sentences = text.split(/[.!?。\n]+/).map(s => s.trim()).filter(s => s.length > 20);
    return Array.from({ length: count }, (_, index) => {
        const source = sentences[index % Math.max(sentences.length, 1)] || text.slice(0, 160);
        const masked = source.replace(/[^\s\u0600-\u06FFA-Za-z0-9]/g, '').split(/\s+/).filter(Boolean);
        const keyword = masked[Math.floor(masked.length / 2)] || t('ai.questions.fallbackKeyword');
        return {
            id: `local-${index}-${Date.now()}`,
            type: 'multiple-choice' as const,
            question: t('ai.questions.fallbackQuestion', { keyword }),
            options: [source.slice(0, 120), t('ai.questions.unrelatedIdea'), t('ai.questions.reverseExample'), t('ai.questions.inaccurateDefinition')],
            answer: source.slice(0, 120)
        };
    });
};

const QuestionGenerator = ({ fileName, fileContent, onClose }: QuestionGeneratorProps) => {
    const { t, i18n } = useTranslation();
    const [questionType, setQuestionType] = useState<'true-false' | 'multiple-choice' | 'both'>('multiple-choice');
    const [numQuestions, setNumQuestions] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [manualText, setManualText] = useState('');

    const contentToProcess = (fileContent?.trim() && !['[ملف', '[File'].some(prefix => fileContent?.startsWith(prefix))) ? fileContent : manualText;

    const generateQuestions = async () => {
        if (!contentToProcess?.trim()) return;

        setIsGenerating(true);
        try {
             const result = await aiService.generateQuestions({
                 text: contentToProcess,
                 questionType: questionType === 'both' ? 'multiple-choice' : questionType,
                 numQuestions,
                 language: i18n.language
             });
            setGeneratedQuestions(result.questions);
        } catch (error) {
            console.error('Error generating questions:', error);
            // Fallback
            setGeneratedQuestions(createLocalQuestions(contentToProcess, numQuestions, t));
        } finally {
            setIsGenerating(false);
        }
    };

    const exportQuestions = () => {
        if (generatedQuestions.length === 0) return;

        setIsExporting(true);

        // Create text content
        const locale = i18n.language === 'ar' ? 'ar-SA' : 'en-US';
        let content = `${t('ai.questions.title')}\n`;
        content += `${t('ai.questions.fromFile', { name: fileName || 'export' })}\n`;
        content += `${'='.repeat(50)}\n\n`;

        generatedQuestions.forEach((q, index) => {
            content += `${index + 1}. ${q.question}\n`;
            if (q.options) {
                q.options.forEach((opt, i) => {
                    content += `   ${String.fromCharCode(97 + i)}) ${opt}\n`;
                });
            }
            content += `   ${t('ai.questions.answer')} ${q.answer}\n\n`;
        });

        // Create and download file
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `questions_${fileName || 'export'}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setIsExporting(false);
    };

    const saveToCourse = () => {
        if (generatedQuestions.length === 0) return;

        setIsSaving(true);

        // Save to localStorage (in real app, save to database)
        const savedQuestions = JSON.parse(localStorage.getItem('saved_questions') || '[]');
        savedQuestions.push({
            id: Date.now().toString(),
            fileName: fileName || 'Unknown',
            questions: generatedQuestions,
            createdAt: new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')
        });
        localStorage.setItem('saved_questions', JSON.stringify(savedQuestions));

        alert(t('ai.questions.savedSuccess'));
        setIsSaving(false);
    };

    const renderQuestion = (q: Question) => {
        if (q.type === 'true-false') {
            return (
                <div key={q.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg mb-4 bg-gray-50 dark:bg-gray-700/50">
                    <p className="font-medium mb-2 text-gray-900 dark:text-gray-100">{q.question}</p>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                            <input
                                type="radio"
                                name={`q-${q.id}`}
                                value="true"
                                className="ml-2"
                                defaultChecked={q.answer === t('ai.questions.true')}
                            />
                            <label className="text-gray-700 dark:text-gray-300">{t('ai.questions.true')}</label>
                        </div>
                        <div className="flex items-center">
                            <input
                                type="radio"
                                name={`q-${q.id}`}
                                value="false"
                                className="ml-2"
                                defaultChecked={q.answer === t('ai.questions.false')}
                            />
                            <label className="text-gray-700 dark:text-gray-300">{t('ai.questions.false')}</label>
                        </div>
                    </div>
                    <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                        {t('ai.questions.answer')} {q.answer === t('ai.questions.true') ? t('ai.questions.true') : t('ai.questions.false')}
                    </div>
                </div>
            );
        }

        return (
            <div key={q.id} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg mb-4 bg-gray-50 dark:bg-gray-700/50">
                <p className="font-medium mb-2 text-gray-900 dark:text-gray-100">{q.question}</p>
                {q.options?.map((option, index) => (
                    <div key={index} className="flex items-center mb-1">
                        <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={option}
                            className="ml-2"
                            defaultChecked={option === q.answer}
                        />
                        <label className="text-gray-700 dark:text-gray-300">{option}</label>
                    </div>
                ))}
                <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                    {t('ai.questions.answer')} {q.answer}
                </div>
            </div>
        );
    };

    return (
        <div dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-3xl mx-auto text-gray-900 dark:text-gray-100">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center">
                    <FileText className="h-5 w-5 ml-2 text-primary-500 dark:text-primary-400" />
                    {t('ai.questions.title')}
                </h2>
                {onClose && (
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        ✕
                    </button>
                )}
            </div>

            {fileName && (
                <p className="text-sm text-gray-800 dark:text-gray-200 mb-4">{t('ai.questions.fromFile', { name: fileName })}</p>
            )}

            {(!fileContent?.trim() || ['[ملف', '[File'].some(prefix => fileContent?.startsWith(prefix))) && (
                <div className="rounded-lg border border-dashed border-accent-200 dark:border-accent-700 bg-accent-50 dark:bg-accent-900/30 p-4 text-center text-gray-800 dark:text-gray-200 mb-6">
                    <p className="font-medium mb-2">{t('ai.questions.notExtracted')}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{t('ai.questions.pasteText')}</p>
                    <textarea
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        placeholder={t('ai.questions.pastePlaceholder')}
                        className="w-full rounded-lg border border-accent-200 dark:border-accent-700 p-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-accent-500 dark:bg-gray-700"
                        rows={6}
                    />
                </div>
            )}

            <div className="space-y-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        {t('ai.questions.questionType')}
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="true-false"
                                checked={questionType === 'true-false'}
                                onChange={(e) => setQuestionType(e.target.value as 'true-false')}
                                className="ml-2"
                            />
                            {t('ai.questions.trueFalse')}
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="multiple-choice"
                                checked={questionType === 'multiple-choice'}
                                onChange={(e) => setQuestionType(e.target.value as 'multiple-choice')}
                                className="ml-2"
                            />
                            {t('ai.questions.multipleChoice')}
                        </label>
                        <label className="flex items-center">
                            <input
                                type="radio"
                                value="both"
                                checked={questionType === 'both'}
                                onChange={(e) => setQuestionType(e.target.value as 'both')}
                                className="ml-2"
                            />
                            {t('ai.questions.both')}
                        </label>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        {t('ai.questions.numQuestions')}
                    </label>
                    <select
                        value={numQuestions}
                        onChange={(e) => setNumQuestions(Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
                    >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                    </select>
                </div>
            </div>

            <button
                onClick={generateQuestions}
                disabled={isGenerating || !contentToProcess?.trim()}
                className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isGenerating ? t('ai.questions.generating') : t('ai.questions.generateButton')}
            </button>

            {generatedQuestions.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">{t('ai.questions.generatedTitle')}</h3>
                    <div className="max-h-96 overflow-y-auto">
                        {generatedQuestions.map(renderQuestion)}
                    </div>
                    <div className="flex space-x-4 mt-4">
                        <button
                            onClick={exportQuestions}
                            disabled={isExporting}
                            className="bg-secondary-600 text-white py-2 px-4 rounded-lg hover:bg-secondary-700 disabled:opacity-50 flex items-center"
                        >
                            <Download className="h-4 w-4 ml-2" />
                            {isExporting ? t('ai.questions.exporting') : t('ai.questions.export')}
                        </button>
                        <button
                            onClick={saveToCourse}
                            disabled={isSaving}
                            className="bg-accent-600 text-white py-2 px-4 rounded-lg hover:bg-accent-700 disabled:opacity-50 flex items-center"
                        >
                            <Save className="h-4 w-4 ml-2" />
                            {isSaving ? t('ai.questions.saving') : t('ai.questions.save')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuestionGenerator;