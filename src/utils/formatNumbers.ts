/**
 * Number formatting utilities that always use English (Western) numerals
 * regardless of the current language/locale.
 * This ensures numbers like 1,234.56 always display as 1,234.56
 * and never as ١٬٢٣٤٫٥٦ (Arabic-Indic numerals).
 */

// Default locale for English numerals
const EN_LOCALE = 'en-US';

/**
 * Format a number with English numerals (Western digits 0-9)
 * @param value - The number to format
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Formatted string with English numerals
 */
export const formatNumberEn = (
  value: number,
  options: Intl.NumberFormatOptions = {}
): string => {
  return new Intl.NumberFormat(EN_LOCALE, options).format(value);
};

/**
 * Format a number as a compact notation (e.g., 1.2K, 1.5M) with English numerals
 * @param value - The number to format
 * @returns Compact formatted string with English numerals
 */
export const formatCompactNumberEn = (value: number): string => {
  return new Intl.NumberFormat(EN_LOCALE, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
};

/**
 * Format a number as percentage with English numerals
 * @param value - The number to format (e.g., 0.75 for 75%)
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Formatted percentage string with English numerals
 */
export const formatPercentEn = (
  value: number,
  options: Intl.NumberFormatOptions = {}
): string => {
  return new Intl.NumberFormat(EN_LOCALE, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
};

/**
 * Format a number as currency with English numerals
 * @param value - The number to format
 * @param currency - Currency code (default: 'USD')
 * @param options - Intl.NumberFormatOptions for customization
 * @returns Formatted currency string with English numerals
 */
export const formatCurrencyEn = (
  value: number,
  currency: string = 'USD',
  options: Intl.NumberFormatOptions = {}
): string => {
  return new Intl.NumberFormat(EN_LOCALE, {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
};

/**
 * Simple number formatting with thousand separators using English numerals
 * @param value - The number to format
 * @returns Formatted string with English numerals and thousand separators
 */
export const formatWithCommasEn = (value: number): string => {
  return formatNumberEn(value, { useGrouping: true });
};

/**
 * Format a decimal number with fixed decimal places using English numerals
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string with English numerals
 */
export const formatFixedEn = (value: number, decimals: number = 1): string => {
  return formatNumberEn(value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });
};

export default {
  formatNumberEn,
  formatCompactNumberEn,
  formatPercentEn,
  formatCurrencyEn,
  formatWithCommasEn,
  formatFixedEn,
};