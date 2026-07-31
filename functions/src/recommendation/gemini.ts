/**
 * Gemini helper functions for content classification, keyword extraction,
 * summarization, and domain detection.
 * Ported from server/recommendationRouter.js
 */

import {generativeModel, geminiAvailable} from "./initialization.js";

export async function callGemini(prompt: string, systemPrompt: string | null = null): Promise<string | null> {
  if (!generativeModel) {
    return null; // Fallback when Gemini is not available
  }

  try {
    const request: any = {
      contents: [{role: "user", parts: [{text: prompt}]}],
    };

    if (systemPrompt) {
      request.systemInstruction = {parts: [{text: systemPrompt}]};
    }

    const response = await generativeModel.generateContent(request);
    const result = await response.response;
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || null;
    return text;
  } catch (error: any) {
    console.error("Gemini call error:", error);
    return null;
  }
}

export async function extractKeywordsWithGemini(text: string): Promise<string[]> {
  const prompt = `استخرج من النص التالي 5-10 كلمات مفتاحية مناسبة للتصنيف الأكاديمي. اكتبها كقائمة مفصولة بفواصل:

النص: "${text.slice(0, 2000)}"

الكلمات المفتاحية:`;

  const result = await callGemini(prompt, "أنت مساعد متخصص في استخراج الكلمات المفتاحية الأكاديمية.");
  if (result) {
    return result.split(/[,\n]/).map((k) => k.trim()).filter((k) => k.length > 1).slice(0, 10);
  }
  // Fallback: simple word extraction
  const words = text.match(/[\u0600-\u06FFA-Za-z]{4,}/g) || [];
  return [...new Set(words)].slice(0, 10);
}

export async function classifyContentWithGemini(title: string, description?: string): Promise<string | null> {
  const prompt = `صنف المحتوى التالي إلى واحدة من هذه الفئات:
- تقنية المعلومات
- الذكاء الاصطناعي
- البرمجة
- الأمن السيبراني
- الطب
- الهندسة
- تعليم
- عام

العنوان: "${title}"
الوصف: "${description?.slice(0, 500) || ""}"

الفئة:`;

  const result = await callGemini(prompt, "أنت مساعد متخصص في تصنيف المحتوى الأكاديمي.");
  if (result) {
    const lower = result.toLowerCase();
    if (lower.includes("ذكاء") || lower.includes("ai") || lower.includes("machine learning")) return "ai";
    if (lower.includes("أمن") || lower.includes("cyber") || lower.includes("سيبراني") || lower.includes("حماية") || lower.includes("أمن معلومات")) return "cybersecurity";
    if (lower.includes("برمجة") || lower.includes("programming") || lower.includes("كود") || lower.includes("تطوير ويب") || lower.includes("تطوير")) return "programming";
    if (lower.includes("طب") || lower.includes("صحة") || lower.includes("طبى")) return "medical";
    if (lower.includes("هندسة") || lower.includes("engineering")) return "engineering";
    if (lower.includes("تقنية") || lower.includes("كمبيوتر") || lower.includes("حاسوب") || lower.includes("تكنولوجيا")) return "tech";
    if (lower.includes("تعليم") || lower.includes("دورة") || lower.includes("course")) return "free_courses";
  }
  return "general";
}

export async function generateSummaryWithGemini(text: string, maxLength = 150): Promise<string> {
  const prompt = `لخص النص التالي في جملة واحدة قصيرة (أقل من ${maxLength} حرف) باللغة العربية:

"${text.slice(0, 3000)}"

الملخص:`;

  const result = await callGemini(prompt, "أنت مساعد متخصص في التلخيص الأكاديمي.");
  if (result && result.length <= maxLength + 50) {
    return result.trim();
  }
  // Fallback
  const sentences = text.split(/[.!?。\n]+/).filter((s) => s.trim().length > 10);
  if (sentences.length > 0) {
    return sentences[0].trim().slice(0, maxLength);
  }
  return text.slice(0, maxLength) + "...";
}

export async function determineDomainWithGemini(text: string): Promise<string> {
  const prompt = `حدد المجال الأكاديمي لهذا المحتوى من بين: تقنية المعلومات، الذكاء الاصطناعي، الطب، الهندسة، تعليم، عام.

"${text.slice(0, 2000)}"

المجال:`;

  const result = await callGemini(prompt, "أنت مساعد متخصص في تحديد المجال الأكاديمي.");
  return result?.trim() || "general";
}

export {geminiAvailable};
