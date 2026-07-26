import React, { memo } from 'react';

export interface MarkdownTableProps extends React.TableHTMLAttributes<HTMLTableElement> {
    children?: React.ReactNode;
}

/**
 * MarkdownTable
 * -------------
 * Wraps GitHub-Flavored-Markdown tables in a horizontally scrollable,
 * responsive container so wide tables never break the chat layout.
 * The actual <th>/<td> styling is provided by `github-markdown-css`
 * (`.markdown-body`) plus Tailwind Typography (`prose`), applied on the
 * parent MarkdownRenderer.
 */
const MarkdownTable = memo(function MarkdownTable({ children, className, ...props }: MarkdownTableProps) {
    return (
        <div className="my-4 w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm dark:border-gray-700">
            <table
                className={`w-full border-collapse text-sm ${className || ''}`}
                {...props}
            >
                {children}
            </table>
        </div>
    );
});

export default MarkdownTable;
