/** @jsxImportSource @emotion/react */
import React from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

// ===========================================
// TYPES
// ===========================================

export type SkeletonVariant = 'text' | 'rectangular' | 'circular' | 'card' | 'chart';
export type SkeletonSize = 'sm' | 'md' | 'lg';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  count?: number;
}

export interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: string;
  minWidth?: string;
}

export interface SkeletonTableRowProps {
  columns?: number;
}

export interface SkeletonChartProps {
  height?: number;
}

export interface AsyncSkeletonProps {
  isLoading: boolean;
  error?: Error | null;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
}

// ===========================================
// ANIMATIONS
// ===========================================

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

// ===========================================
// BASE SKELETON
// ===========================================

const skeletonBaseStyles = css`
  display: block;
  background: linear-gradient(
    90deg,
    ${designTokens.colors.neutral[200]} 25%,
    ${designTokens.colors.neutral[100]} 50%,
    ${designTokens.colors.neutral[200]} 75%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.5s ease-in-out infinite;
`;

// Size configurations
const sizeStyles: Record<SkeletonSize, { width: string; height: number }> = {
  sm: { width: '60px', height: 12 },
  md: { width: '120px', height: 20 },
  lg: { width: '200px', height: 32 },
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  borderRadius = designTokens.borderRadius.md,
  className,
}) => {
  return (
    <div
      css={skeletonBaseStyles}
      className={className}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
      }}
    />
  );
};

// Preset skeleton patterns for common use cases
export const SkeletonText: React.FC<{ lines?: number; lastLineWidth?: string }> = ({
  lines = 3,
  lastLineWidth = '60%',
}) => (
  <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[2]};`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        height={16}
        width={i === lines - 1 ? lastLineWidth : '100%'}
        borderRadius={designTokens.borderRadius.sm}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div
    css={css`
      padding: ${designTokens.spacing[4]};
      background: ${designTokens.colors.neutral[0]};
      border-radius: ${designTokens.borderRadius.lg};
      border: 1px solid ${designTokens.colors.neutral[200]};
    `}
  >
    <div css={css`display: flex; gap: ${designTokens.spacing[3]}; margin-bottom: ${designTokens.spacing[4]};`}>
      <Skeleton width={48} height={48} borderRadius={designTokens.borderRadius.md} />
      <div css={css`flex: 1;`}>
        <Skeleton height={20} width="60%" />
        <div css={css`margin-top: ${designTokens.spacing[2]};`}>
          <Skeleton height={14} width="40%" />
        </div>
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonButton: React.FC<{ width?: string | number }> = ({ width = 120 }) => (
  <Skeleton
    height={40}
    width={width}
    borderRadius={designTokens.borderRadius.md}
  />
);

// ===========================================
// EXTENDED SKELETON PATTERNS
// ===========================================

/**
 * Avatar skeleton placeholder
 */
export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = { sm: 32, md: 48, lg: 64 };
  const px = sizes[size];
  return <Skeleton variant="circular" width={px} height={px} />;
};

/**
 * Chart skeleton with title placeholder
 */
export const SkeletonChart: React.FC<SkeletonChartProps> = ({ height = 200 }) => (
  <div
    css={css`
      display: flex;
      flex-direction: column;
      gap: ${designTokens.spacing[2]};
      height: ${height}px;
    `}
  >
    <Skeleton variant="text" width="30%" height={16} />
    <Skeleton width="100%" height={height - 40} borderRadius={designTokens.borderRadius.md} />
  </div>
);

/**
 * Table row skeleton
 */
export const SkeletonTableRow: React.FC<SkeletonTableRowProps> = ({ columns = 4 }) => (
  <div
    css={css`
      display: grid;
      grid-template-columns: repeat(${columns}, 1fr);
      gap: ${designTokens.spacing[4]};
      padding: ${designTokens.spacing[3]} 0;
      border-bottom: 1px solid var(--border-subtle, ${designTokens.colors.neutral[200]});
    `}
  >
    {Array.from({ length: columns }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === 0 ? '80%' : '60%'}
        height={14}
      />
    ))}
  </div>
);

/**
 * Full page skeleton loader
 */
export const PageSkeleton: React.FC = () => (
  <div
    css={css`
      padding: ${designTokens.spacing[6]};
      max-width: 1200px;
      margin: 0 auto;
      animation: ${fadeIn} 0.3s ease-out;
    `}
  >
    {/* Header skeleton */}
    <div css={css`margin-bottom: ${designTokens.spacing[6]};`}>
      <Skeleton variant="text" width="30%" height={32} />
      <Skeleton
        variant="text"
        width="50%"
        height={16}
        css={css`
          margin-top: ${designTokens.spacing[2]};
        `}
      />
    </div>

    {/* Stats cards */}
    <div
      css={css`
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: ${designTokens.spacing[4]};
        margin-bottom: ${designTokens.spacing[6]};

        @media (max-width: 768px) {
          grid-template-columns: repeat(2, 1fr);
        }

        @media (max-width: 480px) {
          grid-template-columns: 1fr;
        }
      `}
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} width="100%" height={80} borderRadius={designTokens.borderRadius.lg} />
      ))}
    </div>

    {/* Content cards */}
    <div
      css={css`
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: ${designTokens.spacing[4]};

        @media (max-width: 1024px) {
          grid-template-columns: 1fr;
        }
      `}
    >
      <Skeleton width="100%" height={200} borderRadius={designTokens.borderRadius.lg} />
      <Skeleton width="100%" height={200} borderRadius={designTokens.borderRadius.lg} />
    </div>
  </div>
);

/**
 * Async state wrapper with loading/error handling
 */
export const AsyncSkeleton: React.FC<AsyncSkeletonProps> = ({
  isLoading,
  error,
  children,
  skeleton,
  errorMessage = 'Failed to load content',
  onRetry,
}) => {
  if (isLoading) {
    return skeleton || <PageSkeleton />;
  }

  if (error) {
    return (
      <div
        css={css`
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: ${designTokens.spacing[8]};
          text-align: center;
          color: var(--text-secondary, ${designTokens.colors.neutral[600]});
        `}
        role="alert"
      >
        <p css={css`margin-bottom: ${designTokens.spacing[4]};`}>{errorMessage}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            css={css`
              padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
              background: ${designTokens.colors.primary[500]};
              color: white;
              border: none;
              border-radius: ${designTokens.borderRadius.md};
              cursor: pointer;
              font-weight: ${designTokens.typography.fontWeight.medium};

              &:hover {
                background: ${designTokens.colors.primary[600]};
              }
            `}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default Skeleton;
