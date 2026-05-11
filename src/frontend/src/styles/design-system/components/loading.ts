import { css } from '@emotion/react';
import { designTokens } from '../tokens/designTokens';
import { keyframeAnimations } from '../animations/keyframes';

export const loadingStyles = {
  container: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${designTokens.spacing[3]};
  `,
  spinner: (
    size: 'sm' | 'md' | 'lg' = 'md',
    color: string = designTokens.colors.primary[500]
  ) => css`
    border: 2px solid ${designTokens.colors.neutral[200]};
    border-top: 2px solid ${color};
    border-radius: 50%;
    ${keyframeAnimations.spin}

    ${size === 'sm' &&
    css`
      width: 16px;
      height: 16px;
    `}

    ${size === 'md' &&
    css`
      width: 24px;
      height: 24px;
    `}

    ${size === 'lg' &&
    css`
      width: 32px;
      height: 32px;
    `}
  `,
  dots: (color: string = designTokens.colors.primary[500]) => css`
    display: flex;
    gap: ${designTokens.spacing[1]};

    & > div {
      width: 8px;
      height: 8px;
      background-color: ${color};
      border-radius: 50%;
      animation: loadingDots 1.4s ease-in-out infinite both;
    }

    & > div:nth-of-type(1) {
      animation-delay: -0.32s;
    }
    & > div:nth-of-type(2) {
      animation-delay: -0.16s;
    }

    @keyframes loadingDots {
      0%,
      80%,
      100% {
        transform: scale(0);
      }
      40% {
        transform: scale(1);
      }
    }
  `,
  pulse: (color: string = designTokens.colors.primary[500]) => css`
    width: 40px;
    height: 40px;
    background-color: ${color};
    border-radius: 50%;
    animation: loadingPulse 1s ease-in-out infinite;

    @keyframes loadingPulse {
      0% {
        transform: scale(0);
      }
      100% {
        transform: scale(1);
        opacity: 0;
      }
    }
  `,
  bars: (color: string = designTokens.colors.primary[500]) => css`
    display: flex;
    gap: ${designTokens.spacing[1]};

    & > div {
      width: 4px;
      height: 20px;
      background-color: ${color};
      animation: loadingBars 1.2s ease-in-out infinite;
    }

    & > div:nth-of-type(1) {
      animation-delay: -1.1s;
    }
    & > div:nth-of-type(2) {
      animation-delay: -1s;
    }
    & > div:nth-of-type(3) {
      animation-delay: -0.9s;
    }

    @keyframes loadingBars {
      0%,
      40%,
      100% {
        transform: scaleY(0.4);
      }
      20% {
        transform: scaleY(1);
      }
    }
  `,
  text: (size: 'sm' | 'md' | 'lg' = 'md') => css`
    font-size: ${size === 'sm'
      ? designTokens.typography.fontSize.sm
      : size === 'lg'
        ? designTokens.typography.fontSize.lg
        : designTokens.typography.fontSize.base};
    /* Theme-aware text color */
    color: var(--text-secondary);
    text-align: center;
  `,
  skeleton: (
    variant: 'text' | 'rectangular' | 'circular' | 'card' = 'text',
    width?: string | number,
    height?: string | number
  ) => css`
    /* Theme-aware skeleton background */
    background-color: var(--card-bg-elevated);
    position: relative;
    overflow: hidden;
    width: ${typeof width === 'number' ? `${width}px` : width || '100%'};
    height: ${typeof height === 'number' ? `${height}px` : height || '1rem'};

    ${variant === 'text' &&
    css`
      border-radius: ${designTokens.borderRadius.sm};
      margin-bottom: ${designTokens.spacing[2]};
      &:last-child {
        width: 80%;
      }
    `}

    ${variant === 'circular' &&
    css`
      border-radius: 50%;
    `}

    ${variant === 'rectangular' &&
    css`
      border-radius: ${designTokens.borderRadius.md};
    `}

    ${variant === 'card' &&
    css`
      border-radius: ${designTokens.borderRadius.lg};
      height: 200px;
    `}

    /* Dark mode shimmer uses lighter gradient */
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.5), transparent);
      animation: skeleton-shimmer 1.5s infinite;
    }

    /* Dark mode: darker shimmer for better contrast */
    .dark &::after {
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    }

    @keyframes skeleton-shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `,
  pageSkeleton: {
    container: css`
      padding: 2rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 400px;
      gap: 2rem;
    `,
    card: css`
      width: 100%;
      max-width: 600px;
    `,
  },
};
