// AI Router - Provider abstraction, key rotation, timeout, retry, and fallback support
// All AI provider keys are loaded from server environment variables only.

const { v4: uuidv4 } = require('uuid');

const DEFAULT_OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 15000);
const DEFAULT_RETRY_LIMIT = Math.max(1, Number(process.env.AI_REQUEST_RETRY_LIMIT || 2));
const DEFAULT_KEY_RETRY_LIMIT = Math.max(1, Number(process.env.AI_KEY_RETRY_LIMIT || 3));

const ERROR_RETRY_STATUS = new Set([402, 429, 500, 502, 503, 504]);

function getApiKeys() {
  if (process.env.OPENROUTER_API_KEYS) {
    return process.env.OPENROUTER_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  }

  const keys = [];
  const maxKeys = Math.max(0, Number(process.env.OPENROUTER_API_KEY_MAX_KEYS || 10));
  for (let i = 1; i <= maxKeys; i += 1) {
    const key = process.env[`OPENROUTER_API_KEY_${i}`];
    if (key) keys.push(key.trim());
  }
  return keys.filter(Boolean);
}

const keyUsage = new Map();
const keyFailureTracker = new Map();
const PERMANENT_FAILURE_THRESHOLD = 3;
const COOLDOWN_AFTER_FAILURE_MS = 3 * 60 * 1000;

// Server-side session store for conversation continuity
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_SESSION_MESSAGES = 20;
const sessionStore = new Map();

function getSession(sessionId) {
  if (!sessionId) return null;
  const session = sessionStore.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.updatedAt > SESSION_TTL_MS) {
    sessionStore.delete(sessionId);
    return null;
  }
  return session;
}

function saveSession(sessionId, messages) {
  if (!sessionId) return;
  const trimmed = messages.slice(-MAX_SESSION_MESSAGES);
  sessionStore.set(sessionId, {
    messages: trimmed,
    updatedAt: Date.now()
  });
  // Periodic cleanup of expired sessions
  if (sessionStore.size > 500) {
    const now = Date.now();
    for (const [id, session] of sessionStore.entries()) {
      if (now - session.updatedAt > SESSION_TTL_MS) {
        sessionStore.delete(id);
      }
    }
  }
}

function determineTaskType(task) {
  if (!task) return 'chat';
  switch (String(task).trim().toLowerCase()) {
    case 'summarize':
    case 'summary':
      return 'summarize';
    case 'explain':
    case 'explanation':
      return 'explain';
    case 'questions':
    case 'generatequestions':
    case 'quiz':
      return 'questions';
    case 'translate':
      return 'translate';
    case 'programming':
    case 'coding':
    case 'fix':
      return 'programming';
    case 'analysis':
    case 'deep':
    case 'strategy':
      return 'analysis';
    case 'vision':
      return 'vision';
    case 'ocr':
      return 'ocr';
    default:
      return 'chat';
  }
}

function getSystemPromptForTask(taskType, language) {
  const isArabic = language === 'ar';
  const lang = isArabic ? 'Arabic' : 'English';
  const prompts = {
    chat: `You are a helpful AI assistant for educational purposes. Respond in ${lang}. Be concise and accurate.`,
    summarize: `You are an educational AI assistant specialized in summarizing academic content. Summarize clearly and concisely in ${lang}. Extract key points for students.`,
    explain: `You are an educational AI assistant specialized in explaining concepts. Explain clearly in ${lang} with examples from daily life. Structure your response with definition, detailed explanation, and practical examples.`,
    questions: `You are an educational AI assistant specialized in creating test questions. Generate diverse questions (true/false and multiple choice) with correct answers in ${lang}. Maintain academic accuracy.`,
    translate: `You are an educational AI translator. Translate text accurately while preserving academic terminology. Maintain formatting and structure. The target language is ${lang}.`,
    analysis: `You are an advanced AI assistant for deep analysis. Provide thorough, well-structured responses in ${lang} with examples and references. Prioritize accuracy and depth.`,
    vision: `You are a vision AI assistant. Analyze images and describe them accurately. When analyzing educational content in images, describe what you see and interpret educational value in ${lang}.`,
    ocr: `You are an OCR specialist AI. Extract text from images accurately and then analyze the extracted text in ${lang}.`
  };
  return prompts[taskType] || prompts.chat;
}

function getMaxTokensForTask(taskType) {
  const maxTokens = {
    chat: 2000,
    summarize: 1500,
    explain: 1500,
    questions: 1200,
    translate: 2500,
    analysis: 2000,
    vision: 2000,
    ocr: 3000
  };
  return maxTokens[taskType] || 2000;
}

const PROVIDERS = {
  openrouter: {
    name: 'openrouter',
    baseUrl: DEFAULT_OPENROUTER_API_URL,
    getModelForTask(taskType) {
      const defaultModel = process.env.OPENROUTER_MODEL_CHAT || 'gpt-4o-mini';
      switch (taskType) {
        case 'summarize':
          return process.env.OPENROUTER_MODEL_SUMMARIZE || defaultModel;
        case 'explain':
          return process.env.OPENROUTER_MODEL_EXPLAIN || defaultModel;
        case 'questions':
          return process.env.OPENROUTER_MODEL_QUESTIONS || defaultModel;
        case 'translate':
          return process.env.OPENROUTER_MODEL_TRANSLATE || defaultModel;
        case 'programming':
          return process.env.OPENROUTER_MODEL_PROGRAMMING || defaultModel;
        case 'analysis':
          return process.env.OPENROUTER_MODEL_ANALYSIS || defaultModel;
        case 'vision':
          return process.env.OPENROUTER_MODEL_VISION || defaultModel;
        case 'ocr':
          return process.env.OPENROUTER_MODEL_OCR || defaultModel;
        default:
          return defaultModel;
      }
    },
    buildPayload(model, messages, temperature, maxTokens) {
      return {
        model,
        messages,
        temperature,
        max_tokens: maxTokens
      };
    },
    getEndpoint() {
      return this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    },
    timeoutMs: DEFAULT_TIMEOUT_MS
  }
};

function createAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cleanup: () => clearTimeout(timeout) };
}

function normalizeMessages(prompt, messages, systemPrompt) {
  if (Array.isArray(messages) && messages.length > 0) {
    return systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages;
  }

  return systemPrompt ? [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }] : [{ role: 'user', content: prompt }];
}

function markKeyUsed(key) {
  const usage = keyUsage.get(key) || { count: 0, lastUsed: Date.now() };
  usage.count += 1;
  usage.lastUsed = Date.now();
  keyUsage.set(key, usage);
}

function isKeyPermanentlyFailed(apiKey) {
  const status = keyFailureTracker.get(apiKey);
  if (!status) return false;
  return status.count >= PERMANENT_FAILURE_THRESHOLD;
}

function isKeyInCooldown(apiKey) {
  const status = keyFailureTracker.get(apiKey);
  if (!status) return false;
  if (Date.now() - status.lastFailed < COOLDOWN_AFTER_FAILURE_MS) return true;
  keyFailureTracker.delete(apiKey);
  return false;
}

function recordKeyFailure(apiKey, recoverable) {
  const existing = keyFailureTracker.get(apiKey) || { count: 0, lastFailed: 0 };
  if (recoverable) {
    existing.lastFailed = Date.now();
  } else {
    existing.count += 1;
    existing.lastFailed = Date.now();
  }
  keyFailureTracker.set(apiKey, existing);
}

function resetKeyHealth(apiKey) {
  keyFailureTracker.delete(apiKey);
}

async function fetchWithTimeout(url, options = {}, timeoutMs) {
  const { signal, cleanup } = createAbortSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal });
  } finally {
    cleanup();
  }
}

async function requestWithProvider(provider, apiKey, payload, timeoutMs) {
  const endpoint = provider.getEndpoint();
  return await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.HTTP_REFERER || 'https://eduaiplatform-39fe9.firebaseapp.com',
      'X-Title': process.env.X_TITLE || 'EduAI Platform'
    },
    body: JSON.stringify(payload)
  }, timeoutMs);
}

function isRecoverableError(status, errorData) {
  if (status === 408 || ERROR_RETRY_STATUS.has(status)) return true;
  if (errorData?.error?.code) {
    return ['context_length_exceeded', 'rate_limit_exceeded', 'quota_exceeded', 'server_error'].includes(errorData.error.code);
  }
  return false;
}

function isAuthError(status, errorData) {
  if (status === 401 || status === 403) return true;
  if (errorData?.error?.code === 'authentication_error' || errorData?.error?.code === 'invalid_api_key') return true;
  if (typeof errorData?.error?.message === 'string') {
    const msg = errorData.error.message.toLowerCase();
    if (msg.includes('invalid api key') || msg.includes('unauthorized') || msg.includes('authentication')) return true;
  }
  return false;
}

function truncateMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  // Keep more messages for educational chat to preserve context
  const trimmed = messages.slice(-10);
  const totalLength = trimmed.reduce((sum, msg) => sum + (String(msg.content || '').length), 0);
  return totalLength > 12000 ? trimmed.slice(-3) : trimmed;
}

// Remove any image_url parts from a payload so a text-only request can
// still succeed when the provider rejects the image (graceful fallback).
function stripImagesFromPayload(payload) {
  if (!payload || !Array.isArray(payload.messages)) return;
  for (const msg of payload.messages) {
    if (msg && msg.role === 'user' && Array.isArray(msg.content)) {
      const remaining = msg.content.filter((p) => !(p && p.type === 'image_url'));
      if (remaining.length === 0) {
        msg.content = '';
      } else if (remaining.length === 1 && remaining[0].type === 'text') {
        msg.content = remaining[0].text;
      } else {
        msg.content = remaining;
      }
    }
  }
}

async function tryProviderWithKeyRotation(provider, keys, payload) {
  let lastError = null;
  const clonePayload = JSON.parse(JSON.stringify(payload));
  let attemptedKeys = 0;
  const requestHasImages = JSON.stringify(payload).includes('image_url');
  let imagesStripped = false;

  for (const apiKey of keys) {
    if (isKeyPermanentlyFailed(apiKey)) continue;
    if (isKeyInCooldown(apiKey)) continue;

    attemptedKeys += 1;
    markKeyUsed(apiKey);
    const currentPayload = JSON.parse(JSON.stringify(clonePayload));

    for (let retry = 0; retry < DEFAULT_RETRY_LIMIT; retry += 1) {
      try {
        const response = await requestWithProvider(provider, apiKey, currentPayload, provider.timeoutMs);
        const status = response.status;
        const data = await response.json().catch(() => null);

        if (response.ok) {
          resetKeyHealth(apiKey);
          return { data, apiKey };
        }

         if (data?.error?.code === 'context_length_exceeded') {
           currentPayload.messages = truncateMessages(currentPayload.messages);
           currentPayload.max_tokens = Math.min(currentPayload.max_tokens || 2000, 1500);
         }

         // If the request included an image and the provider rejected it,
         // retry once with the image removed so the text request still works.
         if (requestHasImages && !imagesStripped && !isAuthError(status, data)) {
           imagesStripped = true;
           stripImagesFromPayload(currentPayload);
           lastError = new Error('تعذرت معالجة الصورة، تمت المحاولة بدونها.');
           try {
             const retryResp = await requestWithProvider(provider, apiKey, currentPayload, provider.timeoutMs);
             const rStatus = retryResp.status;
             const rData = await retryResp.json().catch(() => null);
             if (retryResp.ok) {
               resetKeyHealth(apiKey);
               return { data: rData, apiKey };
             }
             if (!isRecoverableError(rStatus, rData)) {
               lastError = new Error(rData?.error?.message || `AI provider responded with status ${rStatus}`);
               break;
             }
             recordKeyFailure(apiKey, true);
           } catch (e) {
             lastError = e;
           }
           await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
           continue;
         }

         if (isAuthError(status, data)) {
           recordKeyFailure(apiKey, false);
           lastError = new Error(data?.error?.message || `AI provider authentication error ${status}`);
           break;
         }

         if (!isRecoverableError(status, data)) {
           lastError = new Error(data?.error?.message || `AI provider responded with status ${status}`);
           break;
         }

         lastError = new Error(data?.error?.message || `AI provider retryable error ${status}`);
         recordKeyFailure(apiKey, true);
         await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
      } catch (error) {
        if (error.name === 'AbortError') {
          recordKeyFailure(apiKey, true);
          lastError = new Error('AI request timeout. حاول مرة أخرى.');
          continue;
        }

        lastError = error;
        const isRecoverableNetwork = error instanceof TypeError || (error.message && error.message.includes('fetch'));
        if (!isRecoverableNetwork) {
          recordKeyFailure(apiKey, false);
        }
        if (retry === DEFAULT_RETRY_LIMIT - 1) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (retry + 1)));
      }
    }
  }

  if (attemptedKeys === 0) {
    throw new Error('جميع المفاتيح غير متاحة حالياً. يرجى المحاولة لاحقاً أو الاتصال بالمسؤول.');
  }

  throw lastError || new Error('تعذر الوصول إلى خدمة الذكاء الاصطناعي.');
}

module.exports = async (req, res) => {
  try {
    const { taskType, inputText, systemPrompt, messages, options, attachments, sessionId } = req.body || {};
    const prompt = String(inputText || '').trim();
    const keys = getApiKeys();

    if (!prompt && (!Array.isArray(messages) || messages.length === 0)) {
      return res.status(400).json({ error: { message: 'Prompt or messages are required.' } });
    }

    if (keys.length === 0) {
      return res.status(500).json({ error: { message: 'AI service is not configured. Please contact the administrator.' } });
    }

    const task = determineTaskType(taskType);
    const provider = PROVIDERS.openrouter;
    const model = (options && options.model) ? String(options.model) : provider.getModelForTask(task);
    const temperature = options?.temperature ?? ((task === 'translate' || task === 'questions') ? 0.3 : 0.7);
    const maxTokens = options?.max_tokens ?? getMaxTokensForTask(task);

    // Process attachments: include file content in the prompt context
    const language = req.body.language || 'ar';
    let augmentedPrompt = prompt;
    let augmentedSystemPrompt = systemPrompt || getSystemPromptForTask(task, language);
    const imageUrls = [];

    if (Array.isArray(attachments) && attachments.length > 0) {
      const attachmentContexts = attachments
        .filter(a => a && a.content && a.content.trim().length > 0)
        .map(a => {
          // Detect image URLs (base64 data URLs or HTTP/S URLs whose path ends
          // with an image extension, allowing query strings / hashes so Firebase
          // Storage URLs (e.g. ".../photo.png?alt=media&token=...") are matched.
          const isImage = a.content.startsWith('data:image/') ||
            (/^https?:\/\//i.test(a.content) && /\.(png|jpe?g|gif|webp)(?:[?#]|$)/i.test(a.content));

          if (isImage) {
            imageUrls.push(a.content);
            return null;
          }

          const header = a.name ? `[ملف مرفق: ${a.name}]` : '[ملف مرفق]';
          const warning = a.readable === false ? '\n(تنبيه: هذا الملف قد تم قراءته جزئياً أو معالجة OCR)' : '';
          return `${header}${warning}\n---\n${a.content.trim()}\n---`;
        })
        .filter(Boolean);

      if (attachmentContexts.length > 0) {
        const attachmentText = attachmentContexts.join('\n\n');
        augmentedSystemPrompt = `${augmentedSystemPrompt}\n\nلديك ملفات مرفقة بالمحادثة. استخدم محتوى هذه الملفات للإجابة على سؤال المستخدم. إذا كان السؤال يتعلق بملف معين، فاستند إلى محتواه في إجابتك. الملفات المرفقة:\n\n${attachmentText}`;
      }
    }

    // Session continuity: load existing session messages if client didn't provide history
    let sessionMessages = [];
    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        sessionMessages = session.messages;
      }
    }
    const messagesToUse = (messages && messages.length > 0) ? messages : sessionMessages;

    const normalizedMessages = normalizeMessages(augmentedPrompt, messagesToUse, augmentedSystemPrompt);

    // Append image URLs to the last user message for vision-capable models
    if (imageUrls.length > 0 && normalizedMessages.length > 0) {
      const lastMsgIndex = normalizedMessages.length - 1;
      const lastMsg = normalizedMessages[lastMsgIndex];
      if (lastMsg.role === 'user') {
        if (Array.isArray(lastMsg.content)) {
          normalizedMessages[lastMsgIndex] = {
            ...lastMsg,
            content: [
              ...lastMsg.content,
              ...imageUrls.map(url => ({
                type: 'image_url',
                image_url: { url }
              }))
            ]
          };
        } else if (typeof lastMsg.content === 'string') {
          normalizedMessages[lastMsgIndex] = {
            ...lastMsg,
            content: [
              { type: 'text', text: lastMsg.content },
              ...imageUrls.map(url => ({
                type: 'image_url',
                image_url: { url }
              }))
            ]
          };
        }
      }
    }
    const payload = provider.buildPayload(model, normalizedMessages, temperature, maxTokens);

    const result = await tryProviderWithKeyRotation(provider, keys, payload);

    if (!result?.data) {
      throw new Error('AI provider returned an empty response.');
    }

    const routeData = result.data;
    if (routeData?.error) {
      return res.status(502).json({ error: { message: routeData.error.message || 'AI provider error' } });
    }

    const responseContent = routeData.choices?.[0]?.message?.content || routeData.choices?.[0]?.text || routeData.text || routeData;

    // Save updated conversation to session store for recovery
    if (sessionId) {
      const updatedMessages = messagesToUse.length > 0
        ? [...messagesToUse, { role: 'assistant', content: responseContent }]
        : sessionMessages;
      saveSession(sessionId, updatedMessages);
    }

    const maskKey = (key) => key ? `${key.slice(0, 8)}...${key.slice(-4)}` : '***';
    return res.json({
      content: responseContent,
      usage: {
        apiKeyUsed: maskKey(result.apiKey),
        model,
        taskType: task
      },
      sessionId
    });
  } catch (error) {
    console.error('AI Router error:', error);
    const message = error?.message || 'An error occurred while processing your AI request.';
    res.status(500).json({ error: { message } });
  }
};
