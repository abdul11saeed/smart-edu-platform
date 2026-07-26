import React, { memo } from 'react';

export interface MarkdownLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    children?: React.ReactNode;
}

/**
 * MarkdownLink
 * ------------
 * Opens links in a new tab securely (rel="noopener noreferrer"),
 * with a clear, hoverable accent colour that fits the RTL theme.
 */
const MarkdownLink = memo(function MarkdownLink({ children, className, href, ...props }: MarkdownLinkProps) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-medium text-primary-600 underline decoration-primary-300 underline-offset-2 transition-colors hover:text-primary-700 hover:decoration-primary-500 dark:text-primary-400 dark:hover:text-primary-300 ${
                className || ''
            }`}
            {...props}
        >
            {children}
        </a>
    );
});

export default MarkdownLink;
