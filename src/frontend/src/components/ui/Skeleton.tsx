/** @jsxImportSource @emotion/react */
import React from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
}

const shimmer = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

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

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
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

export default Skeleton;
