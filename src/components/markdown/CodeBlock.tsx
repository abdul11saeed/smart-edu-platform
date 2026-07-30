import React, { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';

export interface CodeBlockProps {
    /** Detected programming language (e.g. "js", "ts", "python"). */
    language?: string;
    /** Raw className passed by rehype-highlight (e.g. "language-js hljs"). */
    className?: string;
    /** Highlighted children produced by rehype-highlight (React nodes). */
    children?: React.ReactNode;
}

/**
 * Recursively extract plain text from React children.
 * Used to copy the *raw* source code (without the highlighting markup).
 */
function extractText(node: React.ReactNode): string {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (React.isValidElement(node)) {
        return extractText((node.props as { children?: React.ReactNode }).children);
    }
    return '';
}

/** Friendly labels for common languages shown in the header bar. */
const LANGUAGE_LABELS: Record<string, string> = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    jsx: 'JSX',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    tsx: 'TSX',
    py: 'Python',
    python: 'Python',
    cpp: 'C++',
    'c++': 'C++',
    c: 'C',
    cs: 'C#',
    java: 'Java',
    go: 'Go',
    rust: 'Rust',
    rs: 'Rust',
    php: 'PHP',
    rb: 'Ruby',
    ruby: 'Ruby',
    swift: 'Swift',
    kt: 'Kotlin',
    kotlin: 'Kotlin',
    sql: 'SQL',
    html: 'HTML',
    xml: 'XML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    md: 'Markdown',
    markdown: 'Markdown',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Shell',
    plaintext: 'codeBlock.plaintext',
    text: 'codeBlock.text',
};

/**
 * CodeBlock
 * ----------
 * Professional code container (ChatGPT / GitHub style):
 *  - macOS-style traffic-light header
 *  - language label
 *  - copy-to-clipboard button
 *  - dark background with syntax highlighting (via highlight.js)
 *  - horizontal scroll so long lines never break the layout
 *  - forced LTR direction (code must stay left-to-right even in an RTL app)
 */
const CodeBlock = memo(function CodeBlock({ language = 'text', className, children }: CodeBlockProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const rawText = useMemo(() => extractText(children), [children]);

    const lang = (language || 'text').toLowerCase();
    const rawLabel = LANGUAGE_LABELS[lang];
    const label = typeof rawLabel === 'string' && rawLabel.startsWith('codeBlock.') ? t(rawLabel) : (rawLabel || lang.toUpperCase());

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(rawText);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable - ignore */
        }
    }, [rawText]);

    return (
        <div
            className="relative my-4 w-full min-w-0 max-w-full rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 overflow-x-auto overflow-y-hidden"
            dir="ltr"
        >
            {/* Header bar */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-700/60 bg-[#161b22] px-3 sm:px-4 py-2">
                <div className="flex items-center gap-2">
                    <span className="flex gap-1.5" aria-hidden="true">
                        <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#ff5f56]" />
                        <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#ffbd2e]" />
                        <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-[#27c93f]" />
                    </span>
                    <span className="ml-2 select-none font-mono text-[10px] sm:text-xs font-medium text-gray-300">
                        {label}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={handleCopy}
                    title={copied ? t('codeBlock.copied') : t('codeBlock.copy')}
                    aria-label={copied ? t('codeBlock.copied') : t('codeBlock.copy')}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                >
                    {copied ? (
                        <>
                            <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-400" />
                            <span className="text-green-400 hidden sm:inline">{t('codeBlock.copied')}</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            <span className="hidden sm:inline">{t('codeBlock.copy')}</span>
                        </>
                    )}
                </button>
            </div>

            {/* Code area */}
            <pre className="m-0 bg-[#0d1117] p-3 sm:p-4 text-xs sm:text-sm leading-relaxed whitespace-pre">
                {/* !p-0 neutralizes github-dark.css 1em padding so it doesn't stack
                    on top of the <pre> padding (avoids a double inset) */}
                <code className={`${className || ''} hljs font-mono whitespace-pre !p-0 min-w-0 break-all`} style={{ wordBreak: 'break-word' }}>{children}</code>
            </pre>
        </div>
    );
});

export default CodeBlock;
