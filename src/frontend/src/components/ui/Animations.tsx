/** @jsxImportSource @emotion/react */
import React, { useEffect, useRef, useState } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';

/**
 * AnimatedCounter - Smoothly animates numeric values
 */
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 800,
  format = (v) => v.toString(),
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const startValue = useRef(value);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();

  useEffect(() => {
    const startVal = startValue.current;
    const diff = value - startVal;

    if (diff === 0) return;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + diff * eased);

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        startValue.current = value;
        startTimeRef.current = undefined;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <span className={className}>{format(displayValue)}</span>;
};

/**
 * PulseAnimation - Subtle pulse effect for emphasis
 */
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;

export const PulseAnimation: React.FC<{ children: React.ReactNode; active?: boolean }> = ({
  children,
  active = true,
}) => (
  <span
    css={css`
      animation: ${pulse} 2s ease-in-out infinite;
      animation-play-state: ${active ? 'running' : 'paused'};
    `}
  >
    {children}
  </span>
);

/**
 * FadeInAnimation - Staggered fade-in for lists
 */
const fadeSlideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

interface StaggeredListProps {
  children: React.ReactNode;
  delay?: number;
  stagger?: number;
}

export const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  delay = 0,
  stagger = 50,
}) => {
  const items = React.Children.toArray(children);

  return (
    <div
      css={css`
        display: contents;
      `}
    >
      {items.map((child, index) => (
        <div
          key={index}
          css={css`
            animation: ${fadeSlideIn} 0.4s ease-out forwards;
            animation-delay: ${delay + index * stagger}ms;
            opacity: 0;
          `}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

/**
 * GlowEffect - Subtle glow for interactive elements
 */
export const GlowEffect: React.FC<{
  children: React.ReactNode;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
}> = ({ children, color = designTokens.colors.primary[500], intensity = 'low' }) => {
  const opacityMap = { low: '0.15', medium: '0.25', high: '0.4' };

  return (
    <div
      css={css`
        position: relative;
        isolation: isolate;

        &::before {
          content: '';
          position: absolute;
          inset: -20%;
          background: radial-gradient(
            circle at center,
            ${color} ${opacityMap[intensity]},
            transparent 70%
          );
          z-index: -1;
          pointer-events: none;
        }
      `}
    >
      {children}
    </div>
  );
};

/**
 * SkeletonLoader - Configurable loading placeholder
 */
export const SkeletonLoader: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}> = ({ width = '100%', height = 20, borderRadius, variant = 'rectangular' }) => {
  const shimmer = keyframes`
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  `;

  const radius = variant === 'circular' ? '50%' : borderRadius || designTokens.borderRadius.md;

  return (
    <div
      css={css`
        width: ${typeof width === 'number' ? `${width}px` : width};
        height: ${typeof height === 'number' ? `${height}px` : height};
        border-radius: ${radius};
        background: linear-gradient(
          90deg,
          ${designTokens.colors.neutral[100]} 25%,
          ${designTokens.colors.neutral[200]} 50%,
          ${designTokens.colors.neutral[100]} 75%
        );
        background-size: 200% 100%;
        animation: ${shimmer} 1.5s ease-in-out infinite;
      `}
    />
  );
};

/**
 * Tooltip - Hover tooltip component
 */
interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionStyles = {
    top: css`
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
    `,
    bottom: css`
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
    `,
    left: css`
      right: calc(100% + 8px);
      top: 50%;
      transform: translateY(-50%);
    `,
    right: css`
      left: calc(100% + 8px);
      top: 50%;
      transform: translateY(-50%);
    `,
  };

  return (
    <div
      css={css`
        position: relative;
        display: inline-flex;
      `}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          css={css`
            position: absolute;
            z-index: 1000;
            padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
            background: ${designTokens.colors.neutral[800]};
            color: white;
            font-size: ${designTokens.typography.fontSize.xs};
            border-radius: ${designTokens.borderRadius.sm};
            white-space: nowrap;
            pointer-events: none;
            ${positionStyles[position]}
          `}
        >
          {content}
        </div>
      )}
    </div>
  );
};

/**
 * StatusBadge - Animated status indicator
 */
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'warning';
  label?: string;
  pulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  pulse = false,
}) => {
  const statusColors = {
    online: designTokens.colors.semantic.success[500],
    offline: designTokens.colors.neutral[400],
    busy: designTokens.colors.primary[500],
    warning: designTokens.colors.semantic.warning[500],
  };

  return (
    <div
      css={css`
        display: inline-flex;
        align-items: center;
        gap: ${designTokens.spacing[1]};
        padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
        border-radius: ${designTokens.borderRadius.full};
        background: ${statusColors[status]}15;
        font-size: ${designTokens.typography.fontSize.xs};
        font-weight: ${designTokens.typography.fontWeight.semibold};
        color: ${statusColors[status]};
      `}
    >
      <span
        css={css`
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: ${statusColors[status]};
          ${pulse &&
          css`
            animation: ${pulse} 2s ease-in-out infinite;
          `}
        `}
      />
      {label || status}
    </div>
  );
};
