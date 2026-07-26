import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';

import CodeBlock from './CodeBlock';
import MarkdownTable from './MarkdownTable';
import MarkdownImage from './MarkdownImage';
import MarkdownLink from './MarkdownLink';
import BlockQuote from './BlockQuote';

export interface MarkdownRendererProps {
    /** The raw Markdown string returned by the AI model. */
    content: string;
    /** Extra Tailwind classes for the wrapper (spacing, bg, etc.). */
    className?: string;
    /** Text direction. Defaults to "rtl" for the Arabic UI. */
    dir?: 'rtl' | 'ltr';
}

/* Plugins are created once at module scope for performance
   (avoids re-instantiating on every render). */
const remarkPlugins = [remarkGfm, remarkBreaks, remarkMath];
const rehypePlugins = [rehypeRaw, rehypeHighlight, rehypeKatex];

/**
 * Decide whether a `code` element is a fenced block or inline code.
 *  - Block: has a `language-xxx` class (provided by fenced ``` blocks).
 *  - Block (no language): contains a newline.
 *  - Otherwise: inline code.
 */
function isBlockCode(className?: string, children?: React.ReactNode): boolean {
    if (className && /language-/.test(className)) return true;
    if (typeof children === 'string') return children.includes('\n');
    if (Array.isArray(children)) return children.some((c) => typeof c === 'string' && c.includes('\n'));
    return false;
}

/* Custom element mapping. Defined at module scope so the object identity
   is stable across renders (helps React.memo prevent unnecessary work). */
const markdownComponents: Components = {
    // Flatten <pre> so our CodeBlock (which renders its own <pre>) is not
    // nested inside an extra <pre> (invalid HTML).
    pre({ children }) {
        return <>{children}</>;
    },

    code({ className, children, ...props }) {
        if (isBlockCode(className, children)) {
            const match = /language-(\w+)/.exec(className || '');
            return (
                <CodeBlock language={match?.[1] || 'text'} className={className}>
                    {children}
                </CodeBlock>
            );
        }

        // Inline code
        return (
            <code
                className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.875em] text-pink-600 dark:bg-gray-800 dark:text-pink-300"
                dir="ltr"
                {...props}
            >
                {children}
            </code>
        );
    },

    table: MarkdownTable as Components['table'],
    img: MarkdownImage as Components['img'],
    a: MarkdownLink as Components['a'],
    blockquote: BlockQuote as Components['blockquote'],
};

/**
 * MarkdownRenderer
 * ----------------
 * Single, reusable component responsible for rendering AI Markdown output
 * with professional formatting (headings, lists, tables, code + syntax
 * highlighting, math via KaTeX, RTL support, etc.).
 *
 * Memoized so that unchanged messages are not re-parsed/re-rendered when
 * sibling messages update.
 */
const MarkdownRenderer = memo(function MarkdownRenderer({
    content,
    className,
    dir = 'rtl',
}: MarkdownRendererProps) {
    if (!content || !content.trim()) return null;

    return (
        <div
            dir={dir}
            className={
                'markdown-body prose prose-sm sm:prose-base max-w-none min-w-0 break-words leading-6 sm:leading-8 ' +
                (className || '')
            }
        >
            <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
});

export default MarkdownRenderer;
