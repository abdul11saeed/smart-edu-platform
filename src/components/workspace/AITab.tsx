import { useState } from 'react';
import { Bot, FileText, Lightbulb, HelpCircle } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import Modal from '../ui/Modal';
import Summarizer from '../ai/Summarizer';
import Explainer from '../ai/Explainer';
import QuestionGenerator from '../ai/QuestionGenerator';
import Translator from '../ai/Translator';

interface AITabProps {
    courseId: string;
}

const AITab = ({ courseId: _courseId }: AITabProps) => {
    const { currentCourseFiles } = useAppStore();
    const [activeModal, setActiveModal] = useState<'summarizer' | 'explainer' | 'questions' | 'translator' | null>(null);
    const [selectedFile, setSelectedFile] = useState('');
    const [selectedFileContent, setSelectedFileContent] = useState('');
    const [selectedFileObj, setSelectedFileObj] = useState<typeof currentCourseFiles[number] | null>(null);

    const getFileContent = (file: typeof currentCourseFiles[number]) => {
        return file.localTextPreview || '';
    };

    const openFileTool = (file: typeof currentCourseFiles[number], tool: 'summarizer' | 'explainer' | 'translator' | 'questions') => {
        setSelectedFile(file.name);
        setSelectedFileContent(getFileContent(file));
        setSelectedFileObj(file);
        setActiveModal(tool);
    };

    const aiTools = [
        {
            id: 'summarizer',
            title: 'تلخيص المحتوى',
            description: 'استخرج النقاط الرئيسية والملخصات',
            icon: FileText,
            color: 'from-primary-500 to-primary-700',
            action: () => {
                const firstFile = currentCourseFiles[0];
                if (firstFile) {
                    openFileTool(firstFile, 'summarizer');
                } else {
                    setActiveModal('summarizer');
                }
            },
        },
        {
            id: 'explainer',
            title: 'شرح المفاهيم',
            description: 'بسّط الفهم ووضح النقاط الصعبة',
            icon: Lightbulb,
            color: 'from-secondary-500 to-secondary-700',
            action: () => {
                const firstFile = currentCourseFiles[0];
                if (firstFile) {
                    openFileTool(firstFile, 'explainer');
                } else {
                    setActiveModal('explainer');
                }
            },
        },
        {
            id: 'translator',
            title: 'ترجمة الملف',
            description: 'ترجم محتوى الملف إلى لغة أخرى',
            icon: Lightbulb,
            color: 'from-purple-500 to-purple-700',
            action: () => {
                const firstFile = currentCourseFiles[0];
                if (firstFile) {
                    openFileTool(firstFile, 'translator');
                } else {
                    setActiveModal('translator');
                }
            },
        },
        {
            id: 'questions',
            title: 'توليد أسئلة',
            description: 'أنشئ اختبارات و أسئلة للمراجعة',
            icon: HelpCircle,
            color: 'from-accent-500 to-accent-700',
            action: () => {
                const firstFile = currentCourseFiles[0];
                if (firstFile) {
                    openFileTool(firstFile, 'questions');
                } else {
                    setActiveModal('questions');
                }
            },
        },
    ];

    return (
        <div className="space-y-6">
            {/* Course Context */}
            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-4 border border-primary-100">
                <div className="flex items-center">
                    <Bot className="h-6 w-6 text-primary-600 ml-3" />
                    <div>
                        <p className="font-semibold text-gray-900">مساعد الذكاء الاصطناعي</p>
                        <p className="text-sm text-gray-600">
                            {currentCourseFiles.filter(file => file.localTextPreview && !file.localTextPreview.startsWith('[ملف')).length} ملف قابل للقراءة من {currentCourseFiles.length}
                        </p>
                    </div>
                </div>
            </div>

            {/* AI Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {aiTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                        <button
                            key={tool.id}
                            onClick={tool.action}
                            className={`
                                p-6 rounded-xl border-2 border-dashed border-gray-200 
                                hover:border-transparent hover:shadow-lg transition-all group
                                bg-gradient-to-br ${tool.color}
                                text-white
                            `}
                        >
                            <div className="text-center">
                                <div className="bg-white/20 p-3 rounded-full inline-block mb-3">
                                    <Icon className="h-8 w-8 text-white" />
                                </div>
                                <p className="font-bold text-lg">{tool.title}</p>
                                <p className="text-white/80 text-sm mt-1">{tool.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* AI Modals */}
            <Modal
                fullScreen
                isOpen={activeModal === 'summarizer'}
                onClose={() => setActiveModal(null)}
            >
                <Summarizer
                    fileName={selectedFile}
                    fileContent={selectedFileContent}
                    file={selectedFileObj || undefined}
                    onClose={() => setActiveModal(null)}
                />
            </Modal>

            <Modal
                fullScreen
                isOpen={activeModal === 'explainer'}
                onClose={() => setActiveModal(null)}
            >
                <Explainer 
                    topic={selectedFileContent || 'محتوى المقرر'} 
                    file={selectedFileObj || undefined}
                    onClose={() => setActiveModal(null)} 
                />
            </Modal>

            <Modal
                fullScreen
                isOpen={activeModal === 'questions'}
                onClose={() => setActiveModal(null)}
            >
                <QuestionGenerator
                    fileName={selectedFile}
                    fileContent={selectedFileContent}
                    onClose={() => setActiveModal(null)}
                />
            </Modal>

            <Modal
                fullScreen
                isOpen={activeModal === 'translator'}
                onClose={() => setActiveModal(null)}
            >
                <Translator
                    fileName={selectedFile}
                    fileContent={selectedFileContent}
                    file={selectedFileObj || undefined}
                    onClose={() => setActiveModal(null)}
                />
            </Modal>
        </div>
    );
};

export default AITab;
