/**
 * Frontend AI service.
 *
 * Thin wrapper around the backend endpoint `/api/ai/route` (POST). The backend
 * returns a single Markdown/plain-text `content` string; this module maps each
 * high-level task (summarize / explain / questions / translate / chat) to the
 * correct request shape and parses the returned text into the structured
 * objects the UI components consume.
 *
 * NOTE: The backend only echoes `content`. Fields like `keyPoints`, `examples`
 * and the `questions` array are best-effort extracted client-side so the UI
 * degrades gracefully (those blocks are optional in the components).
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

    export interface Question {
        id: string;
        question: string;
        answer: string;
        type: 'multiple-choice' | 'true-false';
        options?: string[];
    }

    export interface SummarizeResponse {
        summary: string;
        keyPoints: string[];
    }

export interface ExplainResponse {
    explanation: string;
    simpleExplanation?: string;
    examples?: string[];
}

export interface TranslateResponse {
    translatedText: string;
}

export interface Attachment {
    name?: string;
    content?: string;
    readable?: boolean;
}

interface BaseInput {
    conversationMessages?: ChatMessage[];
    /** In this app the caller passes the chat sessionId here (see AIChat). */
    userId?: string;
}

interface SummarizeInput extends BaseInput {
    text?: string;
    fileName?: string;
    context?: string;
}

interface ExplainInput extends BaseInput {
    concept: string;
    context?: string;
}

interface GenerateQuestionsInput extends BaseInput {
    text?: string;
    numQuestions?: number;
    questionType?: string;
}

interface TranslateInput extends BaseInput {
    text?: string;
    targetLanguage?: string;
    fileName?: string;
}

interface ChatInput {
    messages: ChatMessage[];
    sessionId?: string;
}

// Split the model response into bullet/numbered list items.
const extractListItems = (text: string): string[] =>
    text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[-*•]|\d+[\.\)]/.test(l))
        .map((l) => l.replace(/^[-*•]\s*|^[\d+][\.\)]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 12);

// Heuristic parser: turn a Markdown list of questions into Question objects.
const parseQuestions = (text: string): Question[] => {
    const questions: Question[] = [];
    const blocks = text
        .split(/\n\s*(?=\d+[\.\)]\s|[\u0660-\u0669][\.\)]\s)/)
        .map((b) => b.trim())
        .filter(Boolean);

    for (const block of blocks) {
        const firstLine = block.split('\n')[0] ?? '';
        const questionText = firstLine
            .replace(/^(?:\d+[\.\)]\s*|[\u0660-\u0669][\.\)]\s*)/, '')
            .replace(/^(?:السؤال\s*[:：-]\s*)?/i, '')
            .trim();
        if (!questionText) continue;

        const ansMatch = block.match(/(?:الإجابة|الاجابة|answer)\s*[:：-]\s*(.+)/i);
        const answer = ansMatch ? ansMatch[1].trim() : '';

        const optionLines = block
            .split('\n')
            .filter((l) => /^[a-dA-D][\.\)]\s*[-–]\s*/.test(l) || /^[أ-د]\s*[-–]\s*/.test(l));
        const options = optionLines
            .map((o) => o.replace(/^[a-dA-D][\.\)]\s*[-–]\s*|^[أ-د]\s*[-–]\s*/, '').trim())
            .filter(Boolean);

        const type: Question['type'] =
            /صواب|خطأ|true|false/i.test(block) && answer ? 'true-false' : 'multiple-choice';

        questions.push({
            id: `q_${questions.length}_${Date.now()}`,
            question: questionText,
            answer,
            type,
            options: options.length ? options : undefined,
        });
    }
    return questions;
};

const callAI = async (payload: Record<string, unknown>): Promise<string> => {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}/ai/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e) {
        throw new Error('تعذر الوصول إلى خدمة الذكاء الاصطناعي. تحقق من اتصالك بالخادم.');
    }

    if (!res.ok) {
        let message = `AI request failed (${res.status})`;
        try {
            const data = await res.json();
            if (data?.error?.message) message = data.error.message;
        } catch {
            /* ignore parse error */
        }
        throw new Error(message);
    }

    const data = (await res.json()) as { content?: string; error?: { message?: string } };
    if (data?.error?.message) throw new Error(data.error.message);
    return data?.content ?? '';
};

export const aiService = {
    async summarize(input: SummarizeInput, attachments?: Attachment[]): Promise<SummarizeResponse> {
        const content = await callAI({
            taskType: 'summarize',
            inputText: input.text || '',
            fileName: input.fileName,
            context: input.context,
            messages: input.conversationMessages,
            sessionId: input.userId,
            attachments,
        });
        return { summary: content, keyPoints: extractListItems(content) };
    },

    async explain(input: ExplainInput, attachments?: Attachment[]): Promise<ExplainResponse> {
        const content = await callAI({
            taskType: 'explain',
            inputText: input.concept,
            context: input.context,
            messages: input.conversationMessages,
            sessionId: input.userId,
            attachments,
        });
        return { explanation: content };
    },

    async generateQuestions(
        input: GenerateQuestionsInput,
        attachments?: Attachment[]
    ): Promise<{ questions: Question[] }> {
        const content = await callAI({
            taskType: 'questions',
            inputText: input.text || '',
            numQuestions: input.numQuestions,
            questionType: input.questionType,
            messages: input.conversationMessages,
            sessionId: input.userId,
            attachments,
        });
        return { questions: parseQuestions(content) };
    },

    async translate(input: TranslateInput, attachments?: Attachment[]): Promise<TranslateResponse> {
        const content = await callAI({
            taskType: 'translate',
            inputText: input.text || '',
            targetLanguage: input.targetLanguage,
            fileName: input.fileName,
            messages: input.conversationMessages,
            sessionId: input.userId,
            attachments,
        });
        return { translatedText: content };
    },

    async chat(input: ChatInput, attachments?: Attachment[]): Promise<{ response: string }> {
        const content = await callAI({
            taskType: 'chat',
            messages: input.messages,
            sessionId: input.sessionId,
            attachments,
        });
        return { response: content };
    },
};

export default aiService;
