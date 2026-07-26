import React, { memo } from 'react';

export interface BlockQuoteProps extends React.HTMLAttributes<HTMLQuoteElement> {
    children?: React.ReactNode;
}

/**
 * BlockQuote
 * ----------
 * Styled quotation block (RTL-friendly right border accent).
 */
const BlockQuote = memo(function BlockQuote({ children, className, ...props }: BlockQuoteProps) {
    return (
        <blockquote
            className={`my-4 border-r-4 border-primary-400 bg-primary-50/60 px-4 py-2 text-gray-700 italic dark:border-primary-500 dark:bg-primary-900/20 dark:text-gray-200 ${className || ''
                }`}
            {...props}
        >
            {children}
        </blockquote>
    );
});

export default BlockQuote;
