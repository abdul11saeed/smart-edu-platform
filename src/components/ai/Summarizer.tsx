import { useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { aiService, SummarizeResponse } from '../../utils/aiService';
import { getScannedFileImageAttachments, type ScannedFileAttachment } from '../../services/localFileStorage';
import { MarkdownRenderer } from '../markdown';

const exportSummary = (summaryData: SummarizeResponse, fileName?: string) => {
    if (!summaryData) return;
    let content = `ملخص المحتوى\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `${summaryData.summary}\n\n`;
    if (summaryData.keyPoints.length > 0) {
        content += `النقاط الرئيسية:\n`;
        summaryData.keyPoints.forEach((point, index) => {
            content += `${index + 1}. ${point}\n`;
        });
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ملخص_${fileName || 'محتوى'}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

interface SummarizerProps {
    fileName?: string;
    fileContent?: string;
    file?: { name?: string; downloadURL?: string; url?: string; localDataUrl?: string };
    onClose?: () => void;
}

const createLocalSummary = (text: string) => {
    const sentences = text.split(/[.!?。\n]+/).map(s => s.trim()).filter(Boolean);
    const intro = sentences.slice(0, 2).join(' ');
    const closing = sentences.length > 2 ? ` يغطي النص أيضاً: ${sentences.slice(2, 5).join(' ')}` : '';
    return `يتناول المحتوى الموضوع التالي: ${intro || 'نص مختار من الملف'}.${closing}`;
};

const createLocalKeyPoints = (text: string) => {
    const sentences = text.split(/[.!?。\n]+/).map(s => s.trim()).filter(Boolean);
    return sentences.slice(0, 4).map(sentence => sentence.length > 140 ? `${sentence.slice(0, 140)}...` : sentence);
};

const Summarizer = ({ fileName, fileContent, file, onClose }: SummarizerProps) => {
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryData, setSummaryData] = useState<SummarizeResponse | null>(null);
    const [manualText, setManualText] = useState('');

    const isImageBasedFile = !!(file && /\.(pdf|pptx|jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name || ''));
    const contentToProcess = (fileContent?.trim() && !fileContent.startsWith('[ملف')) ? fileContent : manualText;
    const canGenerate = contentToProcess.trim().length > 0 || isImageBasedFile;

    const generateSummary = async () => {
        if (!canGenerate) return;

        setIsSummarizing(true);
        try {
            // Scanned/image-only files: read them via the vision/OCR pipeline.
            let attachments: ScannedFileAttachment[] | undefined;
            if (!contentToProcess.trim() && file) {
                try {
                    const scanned = await getScannedFileImageAttachments(file);
                    if (scanned && scanned.length) attachments = scanned;
                } catch (e) {
                    console.warn('Scanned file extraction failed:', e);
                }
            }
            const text = attachments?.length
                ? 'الرجاء تلخيص محتوى الملف المرفق (صور ممسوحة).'
                : contentToProcess;

            const result = await aiService.summarize({
                text,
                fileName
            }, attachments);
            setSummaryData(result);
        } catch (error) {
            console.error('Error generating summary:', error);
            // Fallback to mock data if API fails
            setSummaryData({
                summary: `تعذر الاتصال بخدمة الذكاء الاصطناعي، لذلك تم إنشاء ملخص محلي مؤقت:\n\n${createLocalSummary(contentToProcess)}`,
                keyPoints: createLocalKeyPoints(contentToProcess)
            });
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl mx-auto text-gray-900 dark:text-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center">
            <FileText className="h-5 w-5 ml-2 text-primary-500 dark:text-primary-400" />
            تلخيص الملف
          </h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              ✕
            </button>
          )}
        </div>
  
        {fileName && (
          <p className="text-sm text-gray-800 dark:text-gray-200 mb-4">الملف: {fileName}</p>
        )}
  
        {(!fileContent?.trim() || fileContent.startsWith('[ملف')) && (
          <div className="rounded-lg border border-dashed border-primary-200 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/30 p-4 text-center text-gray-800 dark:text-gray-200 mb-6">
            <p className="font-medium mb-2">لم يتم استخراج نص الملف تلقائياً</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">الصق نص الملف هنا حتى يتمكن الذكاء الاصطناعي أو الملخص المحلي من معالجته.</p>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="الصق نص الملف أو الملاحظات هنا..."
              className="w-full rounded-lg border border-primary-200 dark:border-primary-700 p-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 dark:bg-gray-700"
              rows={6}
            />
          </div>
        )}
  
        <div className="mb-6">
          <button
            onClick={generateSummary}
            disabled={isSummarizing || !canGenerate}
            className="bg-primary-600 text-white py-2 px-6 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSummarizing ? 'جاري إنشاء الملخص...' : 'إنشاء الملخص'}
          </button>
        </div>
  
        {summaryData && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">ملخص المحتوى</h3>
              <button
                onClick={() => exportSummary(summaryData, fileName)}
                className="flex items-center text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                <Download className="h-4 w-4 ml-1" />
                تصدير
              </button>
            </div>
  
            <div className="prose max-w-none mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
              <MarkdownRenderer content={summaryData.summary} />
            </div>
  
            {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">النقاط الرئيسية:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {summaryData.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-700 dark:text-gray-300">{point}</li>
                  ))}
                </ul>
              </div>
            )}
  
            <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <span>تم إنشاؤه باستخدام الذكاء الاصطناعي • {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        )}
  
        {!summaryData && !isSummarizing && (
          <div className="text-center py-12 text-gray-800 dark:text-gray-300">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium text-gray-700 dark:text-gray-200">اختر ملفاً واضغط إنشاء الملخص</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">يمكنك لصق النص يدوياً إذا كان الملف بصيغة غير مدعومة.</p>
          </div>
        )}
      </div>
    );
};

export default Summarizer;