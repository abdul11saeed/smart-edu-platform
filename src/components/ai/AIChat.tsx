import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  Send,
  X,
  Bot,
  User,
  Sparkles,
  FileText,
  Lightbulb,
  FileQuestion,
  HelpCircle,
  Languages,
  History,
  Plus,
  Trash2,
  Copy,
  Check,
  MessageSquare,
  PanelLeft,
  PanelRight
} from 'lucide-react';
import { aiService, ExplainResponse, SummarizeResponse, Question, ChatMessage } from '../../utils/aiService';
import { MarkdownRenderer } from '../markdown';
import { extractTextPreview, getScannedFileImageAttachments } from '../../services/localFileStorage';
import { useAppStore } from '../../stores/appStore';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

type ChatFile = {
  id: string;
  name: string;
  content?: string;
  readable?: boolean;
};

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  type?: 'text' | 'explanation' | 'summary' | 'questions';
  data?: ExplainResponse | SummarizeResponse | Question[];
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  hint: string;
  action: 'explain' | 'summarize' | 'generate-questions' | 'translate' | 'general';
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
}

interface AIChatUser {
  id?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  courseFiles?: ChatFile[];
  allFiles?: ChatFile[];
  currentUser?: AIChatUser | null;
  initialSelectedFile?: ChatFile | null;
}

const STORAGE_PREFIX = 'eduai_ai_conversations';

// Build a per-user storage key so each user only ever reads/writes their own
// AI conversations. On shared devices this prevents one user's history from
// leaking into another user's session. Falls back to 'guest' when no user.
const getStorageKey = (user?: AIChatUser | null): string => {
  const identifier = user?.id || user?.email;
  return identifier ? `${STORAGE_PREFIX}_${identifier}` : `${STORAGE_PREFIX}_guest`;
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const makeGreeting = (t: (key: string) => string): Message => ({
  id: uid(),
  role: 'ai',
  content: t('ai.welcome'),
  type: 'text'
});

const loadConversations = (storageKey: string): Conversation[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveConversations = (storageKey: string, convs: Conversation[]) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(convs.slice(0, 50)));
  } catch {
    /* storage full or unavailable - ignore */
  }
};

const deriveTitle = (msgs: Message[]): string => {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return 'New chat';
  const text = firstUser.content.replace(/\s+/g, ' ').trim();
  return text.length > 32 ? text.slice(0, 32) + '…' : text || 'New chat';
};

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const minute = Math.floor(diff / 60000);
  const hours = Math.floor(minute / 60);
  const days = Math.floor(hours / 24);

  const locale = typeof window !== 'undefined' ? (document.documentElement.lang || 'ar') : 'ar';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (minute < 1) return rtf.format(0, 'minute');
  if (minute < 60) return rtf.format(-minute, 'minute');
  if (hours < 24) return rtf.format(-hours, 'hour');
  if (days < 30) return rtf.format(-days, 'day');
  try {
    return new Date(ts).toLocaleDateString(locale);
  } catch {
    return '';
  }
};

 const AIChat = ({ isOpen, onClose, courseFiles = [], allFiles = [], currentUser = null, initialSelectedFile }: AIChatProps) => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar';
    const [messages, setMessages] = useState<Message[]>([makeGreeting(t)]);
   const [inputMessage, setInputMessage] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [activeTool, setActiveTool] = useState<string | null>(null);
   const [selectedFile, setSelectedFile] = useState<ChatFile | null>(null);
   const [conversations, setConversations] = useState<Conversation[]>([]);
   const [activeId, setActiveId] = useState<string | null>(null);
   const [isHistoryOpen, setIsHistoryOpen] = useState(false);
   const [copiedId, setCopiedId] = useState<string | null>(null);
   const [viewportH, setViewportH] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 800);
   const [isNarrow, setIsNarrow] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

   const { aiChatOpenMode, setAiChatOpenMode } = useAppStore();

  const chatRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  const mergedFiles = useMemo<ChatFile[]>(
    () => [...courseFiles, ...allFiles.filter((f) => !courseFiles.some((cf) => cf.id === f.id))],
    [courseFiles, allFiles]
  );

  // Per-user localStorage key: guarantees each user only accesses their own
  // AI conversation history (important on shared devices/browsers).
  const storageKey = useMemo(() => getStorageKey(currentUser), [currentUser]);

  const initialSelectedFileRef = useRef<ChatFile | undefined>(undefined);

  useEffect(() => {
    initialSelectedFileRef.current = initialSelectedFile ?? undefined;
  }, [initialSelectedFile]);

  // Sync selectedFile when initialSelectedFile is provided and chat is open
  useEffect(() => {
    if (!isOpen) return;
    if (initialSelectedFileRef.current) {
      setSelectedFile(initialSelectedFileRef.current);
    }
  }, [isOpen, initialSelectedFile]);

  // Handle click outside to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Lock page scroll while the chat is open. We also remember the scroll position
  // so that closing the chat returns the user to exactly where they were on the
  // previous screen (the correct interface) instead of jumping to the footer.
  // On mobile (narrow), we skip body overflow locking because it interferes with
  // the browser's viewport resize behavior when the virtual keyboard opens/closes,
  // which causes the chat to appear stuck or mispositioned.
  useEffect(() => {
    if (!isOpen) return;
    const docEl = document.documentElement;
    const body = document.body;
    let scrollY = 0;

    // Get scroll position and calculate scrollbar width safely
    try {
      scrollY = window.scrollY;
    } catch (e) {
      scrollY = 0;
    }

    const computeScrollBarWidth = () => {
      try {
        return (window.innerWidth || 0) - (docEl.clientWidth || 0);
      } catch (e) {
        return 0;
      }
    };

    const scrollBarWidth = computeScrollBarWidth();
    const isRTL = docEl.dir === 'rtl';

    const previous = {
      bodyOverflow: body.style.overflow,
      docOverflow: docEl.style.overflow,
      paddingRight: body.style.paddingRight,
      paddingLeft: body.style.paddingLeft,
    };

    // Only lock body scroll on desktop to avoid mobile viewport resize issues
    if (!isNarrow) {
      body.style.overflow = 'hidden';
      docEl.style.overflow = 'hidden';
      // Prevent the page from shifting horizontally when the scrollbar disappears
      if (scrollBarWidth > 0) {
        if (isRTL) body.style.paddingLeft = `${scrollBarWidth}px`;
        else body.style.paddingRight = `${scrollBarWidth}px`;
      }
    }

    return () => {
      if (!isNarrow) {
        body.style.overflow = previous.bodyOverflow;
        docEl.style.overflow = previous.docOverflow;
        body.style.paddingRight = previous.paddingRight;
        body.style.paddingLeft = previous.paddingLeft;
      }
      // Return the page to where the user was before opening the chat
      try {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
      } catch (e) {
        // ignore scroll errors on cleanup
      }
    };
  }, [isOpen, isNarrow]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isHistoryOpen) setIsHistoryOpen(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isHistoryOpen, onClose]);

   // Load / restore conversation state whenever the window opens
   useEffect(() => {
     if (!isOpen) return;
     const convs = loadConversations(storageKey);
     setConversations(convs);

     const shouldResumeRecent = aiChatOpenMode === 'resume-if-recent';
     // 10 minutes in milliseconds
     const TEN_MINUTES = 10 * 60 * 1000;
     const now = Date.now();

     if (shouldResumeRecent && convs.length > 0) {
       // Find the most recent conversation updated within the last 10 minutes
       const recentConv = convs.find((c) => now - c.updatedAt <= TEN_MINUTES);
       if (recentConv) {
         setActiveId(recentConv.id);
         setMessages(recentConv.messages);
         sessionIdRef.current = recentConv.sessionId ?? null;
       } else {
         // No recent conversation — start fresh
         setActiveId(null);
         setMessages([makeGreeting(t)]);
         sessionIdRef.current = null;
       }
     } else {
       // Default behaviour: open the most recent conversation or start fresh
       if (convs.length > 0) {
         setActiveId(convs[0].id);
         setMessages(convs[0].messages);
       } else {
         setActiveId(null);
         setMessages([makeGreeting(t)]);
       }
     }

     // Reset the mode so it does not affect future opens
     if (shouldResumeRecent) {
       setAiChatOpenMode('default');
     }

     setActiveTool(null);
     setSelectedFile(null);
     setInputMessage('');
     setIsHistoryOpen(false);

     if (initialSelectedFileRef.current) {
       setSelectedFile(initialSelectedFileRef.current);
     }

     setTimeout(() => inputRef.current?.focus(), 50);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isOpen, storageKey]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isLoading]);

  // Update welcome message when language changes so it always matches the selected language
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0 && prev[0].role === 'ai' && prev[0].type === 'text') {
        return [{ ...prev[0], content: t('ai.welcome') }];
      }
      return prev;
    });
  }, [i18n.language, t]);

   // Keep the chat sized to the visible viewport so the virtual keyboard never hides the input
   useEffect(() => {
     if (!isOpen) return;
     let rafId: number | null = null;
     let lastHeight = viewportH;
     let lastNarrow = isNarrow;
     const vv = typeof window !== 'undefined' ? window.visualViewport : null;

     const update = () => {
       try {
         const newHeight = vv ? vv.height : (window.innerHeight || 800);
         const newIsNarrow = (window.innerWidth || 1280) < 768;

         // Only update state if values actually changed to prevent unnecessary re-renders
         const heightChanged = newHeight !== lastHeight;
         const narrowChanged = newIsNarrow !== lastNarrow;

         if (heightChanged) {
           lastHeight = newHeight;
           setViewportH(newHeight);
         }
         if (narrowChanged) {
           lastNarrow = newIsNarrow;
           setIsNarrow(newIsNarrow);
         }
       } catch (e) {
         // Fallback values if window properties are unavailable
         lastHeight = 800;
         lastNarrow = false;
         setViewportH(800);
         setIsNarrow(false);
       }
       rafId = null;
     };

     // Schedule update via RAF, but always schedule a new one on each event
     // This ensures no resize event is dropped even during rapid keyboard toggle
     const scheduleUpdate = () => {
       if (rafId === null) {
         rafId = requestAnimationFrame(update);
       }
     };

     // Initial update
     update();

     if (vv) {
       vv.addEventListener('resize', scheduleUpdate);
     }
     window.addEventListener('resize', scheduleUpdate);
     window.addEventListener('focus', scheduleUpdate);

     // Also listen for orientation change which affects viewport on mobile
     window.addEventListener('orientationchange', scheduleUpdate);

     return () => {
       if (rafId !== null) {
         cancelAnimationFrame(rafId);
       }
       if (vv) {
         vv.removeEventListener('resize', scheduleUpdate);
       }
       window.removeEventListener('resize', scheduleUpdate);
       window.removeEventListener('focus', scheduleUpdate);
       window.removeEventListener('orientationchange', scheduleUpdate);
     };
   }, [isOpen]);

  const persist = useCallback((msgs: Message[], convId: string) => {
    const convs = loadConversations(storageKey);
    const idx = convs.findIndex((c) => c.id === convId);
    const existingSessionId = idx >= 0 ? convs[idx].sessionId : undefined;
    const conv: Conversation = {
      id: convId,
      title: deriveTitle(msgs),
      messages: msgs,
      createdAt: idx >= 0 ? convs[idx].createdAt : Date.now(),
      updatedAt: Date.now(),
      sessionId: sessionIdRef.current ?? existingSessionId
    };
    let next: Conversation[];
    if (idx >= 0) {
      next = [...convs];
      next[idx] = conv;
    } else {
      next = [conv, ...convs];
    }
    next = next.sort((a, b) => b.updatedAt - a.updatedAt);
    saveConversations(storageKey, next);
    setConversations(next);
  }, [storageKey]);

  const quickActions: QuickAction[] = [
    {
      id: 'explain',
      label: t('ai.tools.explain'),
      icon: <Lightbulb className="w-5 h-5" />,
      description: t('ai.tools.explainHint'),
      hint: t('ai.tools.explainHint'),
      action: 'explain'
    },
    {
      id: 'summarize',
      label: t('ai.tools.summarize'),
      icon: <FileText className="w-5 h-5" />,
      description: t('ai.tools.summarizeHint'),
      hint: t('ai.tools.summarizeHint'),
      action: 'summarize'
    },
    {
      id: 'questions',
      label: t('ai.tools.questions'),
      icon: <FileQuestion className="w-5 h-5" />,
      description: t('ai.tools.questionsHint'),
      hint: t('ai.tools.questionsHint'),
      action: 'generate-questions'
    },
    {
      id: 'translate',
      label: t('ai.tools.translate'),
      icon: <Languages className="w-5 h-5" />,
      description: t('ai.tools.translateHint'),
      hint: t('ai.tools.translateHint'),
      action: 'translate'
    },
    {
      id: 'general',
      label: t('ai.tools.general'),
      icon: <HelpCircle className="w-5 h-5" />,
      description: t('ai.tools.generalHint'),
      hint: t('ai.tools.generalHint'),
      action: 'general'
    }
  ];

  const handleQuickAction = (action: QuickAction) => {
    setActiveTool(action.action);
    // Only set hint if no file is selected (manual flow); otherwise chip shows the file
    if (!selectedFile) {
      setInputMessage(action.hint);
    }
    // Keep selectedFile if already set (Ask AI pre-selection flow)
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleFileSelect = (file: ChatFile) => {
    setSelectedFile(file);
    // Don't auto-fill input with file name — the attachment chip below will show it
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    // Block anonymous/unauthenticated usage to protect the shared (paid) API quota
    if (!currentUser) return;

    const userMessage = inputMessage.trim();
    const userMsg: Message = { id: uid(), role: 'user', content: userMessage };
    const baseMessages = [...messages, userMsg];

    setInputMessage('');
    setMessages(baseMessages);

    const convId = activeId ?? `c_${uid()}`;
    if (!activeId) setActiveId(convId);

    // Generate or reuse sessionId for server-side session continuity
    const sessionId = sessionIdRef.current ?? `s_${uid()}`;
    if (!sessionIdRef.current) sessionIdRef.current = sessionId;

    persist(baseMessages, convId);

    setIsLoading(true);

    try {
      // Resolve file content: fetch via proxy for URLs, extract text for all file types (PDF, DOC, etc.)
      let resolvedContent = selectedFile?.content;
      let fileReadable = false;

      if (selectedFile) {
        // Case 1: content is a URL - fetch and extract text
        if (resolvedContent && /^https?:\/\//.test(resolvedContent)) {
          try {
            // Use backend proxy to bypass CORS restrictions on Firebase Storage
            const proxyUrl = `${API_BASE}/files/download?url=${encodeURIComponent(resolvedContent)}&name=${encodeURIComponent(selectedFile.name)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) {
              throw new Error(`File proxy responded ${response.status}`);
            }
            const blob = await response.blob();
            const fileName = selectedFile.name.toLowerCase();

            if (blob.type.startsWith('text/') ||
              /\.(txt|md|markdown|csv|json|rtf|html|htm|xml|yaml|yml)$/i.test(fileName)) {
              resolvedContent = await blob.text();
              fileReadable = true;
            } else if (blob.type.startsWith('image/')) {
              // For images, convert to base64 data URL for vision support
              resolvedContent = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              fileReadable = true;
            } else {
              // For PDF, DOC, PPT and other binary types, try to extract text using pdf.js or other methods
              try {
                const fileFromBlob = new File([blob], selectedFile.name, { type: blob.type });
                const extractedText = await extractTextPreview(fileFromBlob);
                if (extractedText && !['[ملف', '[File'].some(prefix => extractedText.startsWith(prefix))) {
                  resolvedContent = extractedText;
                  fileReadable = true;
                } else {
                  fileReadable = false;
                }
              } catch (e) {
                console.warn('Failed to extract text from blob:', e);
                fileReadable = false;
              }
            }
          } catch (e) {
            console.warn('Failed to fetch file content:', e);
          }
        }
        // Case 2: content is actual readable text from local preview
        else if (typeof resolvedContent === 'string') {
          const resolvedStr = resolvedContent;
          if (!['[ملف', '[File'].some(prefix => resolvedStr.startsWith(prefix))) {
            fileReadable = true;
          }
        }
      }

      let attachments = selectedFile && resolvedContent ? [
        {
          name: selectedFile.name,
          content: resolvedContent,
          readable: fileReadable,
        },
      ] : undefined;

      const hasGoodContent = selectedFile && resolvedContent &&
        typeof resolvedContent === 'string' &&
        !['[ملف', '[File'].some(prefix => resolvedContent.startsWith(prefix));
      let unreadableFileSelected = selectedFile !== null && !hasGoodContent && !fileReadable;

      // For scanned/image-only files (PDF/PPTX/images without extractable text),
      // read them via the vision/OCR pipeline and use the images as attachments.
      let scannedImagesFound = false;
      if (unreadableFileSelected && selectedFile) {
        try {
          const scanned = await getScannedFileImageAttachments(
            {
              name: selectedFile.name,
              url: resolvedContent && /^https?:\/\//.test(resolvedContent) ? resolvedContent : undefined,
            },
            API_BASE
          );
          if (scanned && scanned.length) {
            attachments = scanned;
            scannedImagesFound = true;
          }
        } catch (e) {
          console.warn('Scanned file image extraction failed:', e);
        }
      }
      if (scannedImagesFound) unreadableFileSelected = false;

      // Images are sent as vision attachments, never as raw base64 prompt text.
      const isImageFile = scannedImagesFound || (typeof resolvedContent === 'string' && resolvedContent.startsWith('data:image/'));
      const textForTool = isImageFile ? userMessage : resolvedContent;

      // Build chat history once for all tools to maintain session continuity
      const chatHistory: ChatMessage[] = baseMessages
        .filter((m): m is Message & { role: 'user' | 'ai' } => m.role === 'user' || m.role === 'ai')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

      // Decide intent. An explicitly selected quick-action (activeTool) always wins.
      // Keyword auto-detection is only applied on the first exchange (when there is
      // no real conversation context yet) so that, inside an ongoing chat, the model
      // keeps the session context and isn't hijacked by a word like "شرح"/"لخص" and
      // loses previous turns (the tool helpers are stateless and ignore history).
      const isFirstExchange = baseMessages.length <= 2;
      const keywordTool: string | null =
        /شرح|اشرح|فسر|explain/i.test(userMessage) ? 'explain'
          : /تلخيص|لخص|summarize/i.test(userMessage) ? 'summarize'
            : /أسئلة|اختبار|questions/i.test(userMessage) ? 'generate-questions'
              : /ترجم|ترجمة|translate/i.test(userMessage) ? 'translate'
                : null;
      const effectiveTool: string | null = activeTool ?? (isFirstExchange ? keywordTool : null);
      const fileActionRequested = Boolean(effectiveTool);

      let aiContent = '';
      let aiType: Message['type'] = 'text';
      let aiData: Message['data'];

      if (unreadableFileSelected && fileActionRequested) {
        aiContent = t('ai.unreadableFile');
      } else if (effectiveTool === 'explain') {
        const result = await aiService.explain(
          { concept: userMessage, context: isImageFile ? undefined : (resolvedContent || undefined), conversationMessages: chatHistory, userId: sessionId, language: i18n.language },
          attachments
        );
        aiContent = result.explanation;
        aiType = 'explanation';
        aiData = result;
      } else if (effectiveTool === 'summarize') {
        if (unreadableFileSelected) {
          aiContent = t('ai.unreadableFile');
        } else {
          const result = await aiService.summarize(
            { text: textForTool || userMessage, fileName: selectedFile?.name, conversationMessages: chatHistory, userId: sessionId, language: i18n.language },
            attachments
          );
          aiContent = result.summary;
          aiType = 'summary';
          aiData = result;
        }
      } else if (effectiveTool === 'generate-questions') {
        if (unreadableFileSelected) {
          aiContent = t('ai.unreadableFile');
        } else {
          const result = await aiService.generateQuestions(
            {
              text: textForTool || userMessage,
              questionType: 'both',
              numQuestions: 5,
              conversationMessages: chatHistory,
              userId: sessionId,
              language: i18n.language
            },
            attachments
          );
          aiContent = `${t('ai.questionsGenerated', { count: result.questions.length })}\n\n${result.questions
            .map((q, i) => `${i + 1}. ${q.question}${q.options ? '\n   ' + t('ai.questions.options') + ': ' + q.options.join(', ') : ''}\n   ' + t('ai.questions.answer') + ': ${q.answer}`)
            .join('\n\n')}`;
          aiType = 'questions';
          aiData = result.questions;
        }
      } else if (effectiveTool === 'translate') {
        if (unreadableFileSelected) {
          aiContent = t('ai.unreadableFile');
        } else {
          const detectTargetLanguage = (message: string): string => {
            const lower = message.toLowerCase();
            const targetEnglish = lower.includes('الإنجليزية') || lower.includes('الإنجليزية') || lower.includes('english');
            const targetFrench = lower.includes('الفرنسية') || lower.includes('الفرنسية') || lower.includes('french');
            const targetArabic = lower.includes('العربية') || lower.includes('العربية') || lower.includes('arabic');
            if (targetEnglish) return 'en';
            if (targetFrench) return 'fr';
            if (targetArabic) return 'ar';
            return i18n.language === 'ar' ? 'en' : 'ar';
          };

          const result = await aiService.translate(
            {
              text: textForTool || userMessage,
              targetLanguage: detectTargetLanguage(userMessage),
              fileName: selectedFile?.name,
              conversationMessages: chatHistory,
              userId: sessionId,
              language: i18n.language
            },
            attachments
          );
          aiContent = result.translatedText;
        }
      } else {
        // General chat with conversation history for session continuity
        const chatResult = await aiService.chat({ messages: chatHistory, sessionId, language: i18n.language }, attachments);
        aiContent = chatResult.response;
        aiType = 'text';
      }

      const aiMsg: Message = { id: uid(), role: 'ai', content: aiContent, type: aiType, data: aiData };
      const nextMessages = [...baseMessages, aiMsg];
      setMessages(nextMessages);
      persist(nextMessages, convId);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const errMsg: Message = {
        id: uid(),
        role: 'ai',
        content: t('ai.errorProcessing')
      };
      const nextMessages = [...baseMessages, errMsg];
      setMessages(nextMessages);
      persist(nextMessages, convId);
    } finally {
      setIsLoading(false);
      setActiveTool(null);
      setSelectedFile(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  const openConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveId(id);
    setMessages(conv.messages);
    sessionIdRef.current = conv.sessionId ?? null;
    setIsHistoryOpen(false);
    setActiveTool(null);
    setSelectedFile(null);
    setInputMessage('');
  };

  const startNewChat = () => {
    setActiveId(null);
    setMessages([makeGreeting(t)]);
    sessionIdRef.current = null;
    setIsHistoryOpen(false);
    setActiveTool(null);
    setSelectedFile(null);
    setInputMessage('');
  };

  const deleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = conversations.filter((c) => c.id !== id);
    saveConversations(storageKey, next);
    setConversations(next);
    if (activeId === id) {
      if (next.length > 0) openConversation(next[0].id);
      else startNewChat();
    }
  };

  const copyMessage = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const getInitials = () => {
    const name = currentUser?.displayName || currentUser?.email || '';
    if (!name) return 'AI';
    return name.trim().charAt(0).toUpperCase();
  };

  const renderMessageContent = (message: Message) => {
    if (message.type === 'explanation' && message.data) {
      const data = message.data as ExplainResponse;
      return (
        <div className="space-y-3">
          <MarkdownRenderer content={message.content} className="text-gray-800 dark:text-gray-100 leading-relaxed" />
          {data.simpleExplanation && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border-r-4 border-blue-500 p-3 rounded">
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('ai.explainer.simpleExplanation')}</p>
              <p className="text-sm text-blue-700 dark:text-blue-100">{data.simpleExplanation}</p>
            </div>
          )}
          {data.examples && data.examples.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/30 border-r-4 border-green-500 p-3 rounded">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">{t('ai.explainer.examples')}</p>
              <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-100 space-y-1">
                {data.examples.map((example, i) => (
                  <li key={i}>{example}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (message.type === 'summary' && message.data) {
      const data = message.data as SummarizeResponse;
      return (
        <div className="space-y-3">
          <MarkdownRenderer content={message.content} className="text-gray-800 dark:text-gray-100" />
          {data.keyPoints && data.keyPoints.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/30 border-r-4 border-purple-500 p-3 rounded">
              <p className="text-sm font-medium text-purple-800 dark:text-purple-200">{t('ai.summarizer.keyPoints')}</p>
              <ul className="list-disc list-inside text-sm text-purple-700 dark:text-purple-100 space-y-1">
                {data.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    if (message.type === 'questions' && message.data) {
      return <MarkdownRenderer content={message.content} className="text-gray-800 dark:text-gray-100" />;
    }

    return <MarkdownRenderer content={message.content} className="text-gray-800 dark:text-gray-100" />;
  };

  if (!isOpen) return null;

  const activeAction = quickActions.find((a) => a.action === activeTool);

  return createPortal(
    <div
      ref={chatRef}
      onClick={(e) => e.stopPropagation()}
      className="fixed top-0 left-0 right-0 md:top-auto md:bottom-4 md:mx-auto w-full md:w-[min(920px,92vw)] md:h-[78vh] md:min-h-[520px] md:max-h-[calc(100dvh-2rem)] bg-white dark:bg-gray-900 rounded-none md:rounded-2xl shadow-2xl border-0 md:border md:border-gray-200 dark:md:border-gray-700 flex flex-col z-[100] overflow-hidden relative mobile-chat-viewport"
      style={isNarrow ? { height: `${viewportH}px` } : undefined}
    >
      {/* ===== Header ===== */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-secondary-600 text-white px-4 pt-[env(safe-area-inset-top)] py-3 flex items-center justify-between flex-shrink-0 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          {/* Profile - opens chat history */}
          <button
            onClick={() => setIsHistoryOpen(true)}
            type="button"
            title={t('ai.profile')}
            aria-label={t('ai.profileName')}
            className="group relative flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 transition-colors ring-2 ring-white/40 overflow-hidden"
          >
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt={t('ai.profileName')} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-sm">{getInitials()}</span>
            )}
          </button>

          {/* New chat */}
          <button
            onClick={startNewChat}
            type="button"
            title={t('ai.newChat')}
            aria-label={t('ai.newChat')}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-white/30 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <div className="relative">
            <div className="bg-white/20 backdrop-blur p-2 rounded-xl shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-primary-600 rounded-full" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] leading-tight truncate">{t('app.title')}</h3>
            <p className="text-[11px] text-white/80 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-300 rounded-full inline-block" />
              {t('ai.availableNow')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Close */}
          <button
            onClick={onClose}
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-red-500/80 transition-colors"
            aria-label={t('ai.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ===== Body ===== */}
       <div ref={messagesContainerRef} dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-900/60">
        {/* Quick Actions - sticky */}
        <div className="sticky top-0 z-10 bg-white/85 dark:bg-gray-800/85 backdrop-blur border-b border-gray-200 dark:border-gray-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">{t('ai.quickTools')}</p>
          </div>
          <div className="relative flex gap-2 overflow-x-auto pb-1 -mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="absolute left-0 top-0 bottom-1 w-8 bg-gradient-to-r from-white/85 dark:from-gray-800/85 to-transparent pointer-events-none z-10"></div>
            <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white/85 dark:from-gray-800/85 to-transparent pointer-events-none z-10"></div>
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                title={action.description}
                aria-label={action.label}
                type="button"
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${activeTool === action.action
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm scale-[1.02]'
                  : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
              >
                <span className={activeTool === action.action ? 'text-white' : 'text-primary-600 dark:text-primary-400'}>
                  {action.icon}
                </span>
                <span className="whitespace-nowrap">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* File selector */}
        {mergedFiles.length > 0 && (
          <div className="bg-blue-50/70 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40 p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">{t('ai.selectFile')}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mergedFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleFileSelect(file)}
                  className={`flex-shrink-0 max-w-[220px] rounded-full border px-3 py-1.5 text-xs transition-colors ${selectedFile?.id === file.id
                    ? 'border-primary-500 bg-primary-600 text-white shadow-sm'
                    : 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                    }`}
                  title={file.name}
                >
                  <span className="truncate inline-block align-middle max-w-[170px]">{file.name}</span>
                </button>
              ))}
            </div>

          </div>
        )}

        {/* Messages */}
        <div className="p-3 sm:p-4 space-y-4">
          {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? (isRTL ? 'justify-start' : 'justify-end') : (isRTL ? 'justify-end' : 'justify-start')}`}>
              <div
                className={`flex items-start gap-2 min-w-0 max-w-[88%] sm:max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${message.role === 'user'
                    ? 'bg-gradient-to-br from-primary-500 to-primary-700 text-white'
                    : 'bg-white dark:bg-gray-700 text-secondary-700 dark:text-secondary-300 border border-gray-200 dark:border-gray-600'
                    }`}
                >
                  {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="relative group">
                  {message.role === 'ai' && message.content && (
                    <button
                      onClick={() => copyMessage(message.content, message.id)}
                      title={t('ai.copy')}
                      aria-label={t('ai.copy')}
                      className="absolute -top-2 -left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 rounded-full p-1 shadow"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  <div
                    className={`min-w-0 max-w-full w-full rounded-2xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-sm leading-relaxed shadow-sm overflow-hidden overscroll-contain break-words ${message.role === 'user'
                      ? 'bg-primary-600 text-white rounded-tr-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-sm'
                      }`}
                  >
                    {renderMessageContent(message)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 text-secondary-700 dark:text-secondary-300 border border-gray-200 dark:border-gray-600 flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ===== Input ===== */}
      <div className="px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
        {activeAction && (
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">
              {activeAction.icon}
              {activeAction.label}
            </span>
            <button
              onClick={() => {
                setActiveTool(null);
                setInputMessage('');
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              {t('ai.cancel')}
            </button>
          </div>
        )}

        {selectedFile && (
          <div className="mb-2 flex items-center gap-1.5 text-xs text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2.5 py-1.5 w-fit">
            <FileText className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" />
            <span className="truncate max-w-[240px]">{selectedFile.name}</span>
            <button
              onClick={() => setSelectedFile(null)}
              type="button"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 shrink-0"
              title={t('ai.removeFile')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              autoGrow(e.target);
            }}
            onKeyPress={handleKeyPress}
            placeholder={t('ai.placeholder')}
            className="flex-1 resize-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 rounded-xl p-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none leading-relaxed"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="flex-shrink-0 p-2.5 h-11 w-11 flex items-center justify-center bg-gradient-to-br from-primary-600 to-secondary-600 text-white rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            aria-label={t('ai.send')}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ===== Chat History (Profile) Panel ===== */}
      <div
        className={`absolute inset-0 z-20 bg-black/30 transition-opacity duration-200 ${isHistoryOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setIsHistoryOpen(false)}
      />
       <aside
        dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}
        className={`absolute top-0 ${i18n.language === 'ar' ? 'right-0' : 'left-0'} h-full w-[82%] max-w-[300px] bg-white dark:bg-gray-800 shadow-2xl flex flex-col transition-transform duration-300 ease-out z-30 ${isHistoryOpen ? 'translate-x-0' : (i18n.language === 'ar' ? 'translate-x-full' : '-translate-x-full')}
          }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
          <div className="flex items-center gap-2 min-w-0">
            {currentUser?.photoURL ? (
              <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white/50" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">
                {getInitials()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {currentUser?.displayName || currentUser?.email || t('ai.profileName')}
              </p>
              <p className="text-[11px] text-white/80 flex items-center gap-1">
                <History className="w-3 h-3" /> {t('ai.previousConversations')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsHistoryOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 transition-colors"
            aria-label={t('ai.close')}
          >
            {i18n.language === 'ar' ? <PanelRight className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('ai.newChat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 mt-16 px-4">
              <MessageSquare className="w-10 h-10 mb-3 opacity-60" />
              <p className="text-sm">{t('ai.noHistory')}</p>
              <p className="text-xs mt-1">{t('ai.noHistoryHint')}</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv.id)}
                className={`w-full text-right group flex items-start gap-2 p-2.5 rounded-xl border transition-colors ${activeId === conv.id
                  ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                <MessageSquare className="w-4 h-4 mt-0.5 text-primary-500 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{conv.title}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    {timeAgo(conv.updatedAt)} • {conv.messages.length} {t('ai.messages')}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => deleteConversation(conv.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') deleteConversation(conv.id, e as unknown as React.MouseEvent);
                  }}
                  title={t('ai.deleteConversation')}
                  aria-label={t('ai.deleteConversation')}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-gray-300 hover:text-red-500 transition-opacity p-1 -ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </span>
              </button>
            ))
          )}
        </div>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-center text-gray-400 dark:text-gray-500">
            {t('ai.savingLocally')}
          </p>
        </div>
      </aside>
    </div>,
    document.body
  );
};

export default AIChat;
