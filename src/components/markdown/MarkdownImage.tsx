import React, { memo } from 'react';

export interface MarkdownImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    children?: React.ReactNode;
}

/**
 * MarkdownImage
 * -------------
 * Renders images inside Markdown as responsive, rounded, and constrained
 * to the message width so they never overflow the chat bubble.
 */
const MarkdownImage = memo(function MarkdownImage({ alt, className, ...props }: MarkdownImageProps) {
    return (
        <img
            alt={alt || ''}
            loading="lazy"
            className={`mx-auto my-4 max-w-full rounded-xl border border-gray-200 shadow-sm dark:border-gray-700 ${
                className || ''
            }`}
            {...props}
        />
    );
});

export default MarkdownImage;
