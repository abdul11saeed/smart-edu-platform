import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    accent?: 'pdf' | 'doc' | 'ppt' | 'other' | 'none';
    glass?: boolean;
    gradient?: boolean;
}

interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
    subtitle?: string;
}

interface CardContentProps {
    children: React.ReactNode;
    className?: string;
}

interface CardActionsProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * Unified Card Component with Header, Content, and Actions
 * Features:
 * - Consistent border radius (rounded-2xl)
 * - Hover elevation effect with modern shadow
 * - Flexible padding options
 * - Header, Content, Actions sections
 * - Glassmorphism variant (glass)
 * - Left accent border based on file type
 * - Gradient border on hover
 * - Stagger animation support
 */
export const Card: React.FC<CardProps> & {
    Header: React.FC<CardHeaderProps>;
    Content: React.FC<CardContentProps>;
    Actions: React.FC<CardActionsProps>;
} = ({ children, className = '', hover = true, padding = 'md', accent = 'none', glass = false, gradient = false }) => {
    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-6',
    };

    const accentClasses = {
        pdf: 'card-accent-pdf',
        doc: 'card-accent-doc',
        ppt: 'card-accent-ppt',
        other: 'card-accent-other',
        none: '',
    };

    const baseClasses = glass
        ? 'glass-card-modern'
        : 'bg-gradient-to-br from-[#F9F0E6] to-[#F2E0CE]/30 dark:from-slate-800 dark:to-slate-900 backdrop-blur-sm rounded-2xl border border-[#E8C9A8]/80 dark:border-slate-700/60 shadow-sm';

    const hoverClasses = hover
        ? 'hover:shadow-lg hover:shadow-primary-500/10 dark:hover:shadow-primary-900/30 hover:-translate-y-1 hover:border-primary-200/60 dark:hover:border-primary-700/40 transition-all duration-300 ease-spring'
        : '';

    const gradientClasses = gradient ? 'gradient-border' : '';

    return (
        <div
            className={`
        animate-card-appear
        ${baseClasses}
        ${hoverClasses}
        ${accentClasses[accent]}
        ${gradientClasses}
        ${paddingClasses[padding]}
        ${className}
      `}
        >
            {children}
        </div>
    );
};

/**
 * Card Header - Title and optional description
 */
const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => (
    <div className={`border-b border-brown-200/80 dark:border-brown-700/50 pb-4 mb-4 ${className}`}>
        {children}
    </div>
);

/**
 * Card Content - Main content area
 */
const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => (
    <div className={className}>
        {children}
    </div>
);

/**
 * Card Actions - Footer with buttons/actions
 */
const CardActions: React.FC<CardActionsProps> = ({ children, className = '' }) => (
    <div className={`border-t border-brown-200/80 dark:border-brown-700/50 pt-4 mt-4 flex items-center justify-end gap-3 ${className}`}>
        {children}
    </div>
);

Card.Header = CardHeader;
Card.Content = CardContent;
Card.Actions = CardActions;

export default Card;
