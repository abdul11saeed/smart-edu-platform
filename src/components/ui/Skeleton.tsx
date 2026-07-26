import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
    width?: string | number;
    height?: string | number;
    animation?: 'pulse' | 'wave' | 'none';
}

/**
 * Skeleton Component - Loading placeholder
 * Alternative to spinners for better UX
 * 
 * Variants:
 * - text: For text loading states
 * - circular: For avatar/circle placeholders
 * - rectangular: For card/image placeholders
 * - rounded: For button/form placeholders
 */
export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'text',
    width,
    height,
    animation = 'pulse',
}) => {
    const variantClasses = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-none',
        rounded: 'rounded-lg',
    };

    const animationClasses = {
        pulse: 'animate-pulse',
        wave: 'animate-shimmer',
        none: '',
    };

    // Default heights based on variant
    const defaultHeights: Record<string, string> = {
        text: '1rem',
        circular: '3rem',
        rectangular: '10rem',
        rounded: '2.5rem',
    };

    return (
        <div
            className={`
        bg-gray-200
        ${variantClasses[variant]}
        ${animationClasses[animation]}
        ${className}
      `}
            style={{
                width: width ?? (variant === 'circular' ? '3rem' : '100%'),
                height: height ?? defaultHeights[variant],
            }}
        />
    );
};

/**
 * Skeleton Card - Ready-made loading card pattern
 */
interface SkeletonCardProps {
    showHeader?: boolean;
    showContent?: boolean;
    showFooter?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
    showHeader = true,
    showContent = true,
    showFooter = true,
}) => {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5">
            {showHeader && (
                <div className="border-b border-gray-100 pb-4 mb-4">
                    <Skeleton variant="text" width="60%" height="1.5rem" />
                    <Skeleton variant="text" width="40%" height="1rem" className="mt-2" />
                </div>
            )}

            {showContent && (
                <div className="space-y-3">
                    <Skeleton variant="text" />
                    <Skeleton variant="text" />
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="rectangular" height="8rem" className="mt-4" />
                </div>
            )}

            {showFooter && (
                <div className="border-t border-gray-100 pt-4 mt-4 flex justify-end gap-3">
                    <Skeleton variant="rounded" width="5rem" height="2.25rem" />
                    <Skeleton variant="rounded" width="5rem" height="2.25rem" />
                </div>
            )}
        </div>
    );
};

/**
 * Skeleton List - For list loading states
 */
interface SkeletonListProps {
    items?: number;
    showAvatar?: boolean;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
    items = 5,
    showAvatar = true,
}) => {
    return (
        <div className="space-y-4">
            {Array.from({ length: items }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-100"
                >
                    {showAvatar && (
                        <Skeleton variant="circular" width="3rem" height="3rem" />
                    )}
                    <div className="flex-1 space-y-2">
                        <Skeleton variant="text" width="40%" />
                        <Skeleton variant="text" width="70%" />
                    </div>
                    <Skeleton variant="rounded" width="4rem" height="2rem" />
                </div>
            ))}
        </div>
    );
};

/**
 * Skeleton Table - For table loading states
 */
interface SkeletonTableProps {
    columns?: number;
    rows?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
    columns = 4,
    rows = 5,
}) => {
    return (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-100">
                <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                    {Array.from({ length: columns }).map((_, index) => (
                        <Skeleton key={index} variant="text" />
                    ))}
                </div>
            </div>

            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div
                    key={rowIndex}
                    className="border-b border-gray-100 last:border-b-0"
                >
                    <div className="grid gap-4 p-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <Skeleton key={colIndex} variant="text" />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Skeleton;
