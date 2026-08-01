/**
 * Arabic text normalization for search.
 * Handles common variations that cause exact-match searches to fail:
 * - Removes tashkeel (diacritics)
 * - Normalizes alef forms (أ, إ, آ, ٱ) → ا
 * - Normalizes alef maksura (ى) → ي
 * - Normalizes ta marbuta (ة) → ه
 */

const TASHKEEL_RE = /[\u064B-\u065F\u0670]/g;
const ALEF_FORMS = /[أإآٱ]/g;
const ALEF_MAKSURA = /[ى]/g;
const TA_MARBUTA = /[ة]/g;
const TATWEEL = /\u0640/g;

export function normalizeArabic(text: string): string {
    return text
        .replace(TASHKEEL_RE, '')
        .replace(ALEF_FORMS, 'ا')
        .replace(ALEF_MAKSURA, 'ي')
        .replace(TA_MARBUTA, 'ه')
        .replace(TATWEEL, '')
        .trim();
}
