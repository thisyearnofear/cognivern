/** @jsxImportSource @emotion/react */
import React, { useEffect, useState } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export type ProgressStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  animated?: boolean;
  striped?: boolean;
}

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface StepProgressProps {
  steps: ProgressStep[];
  currentStep?: number;
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

// Progress Bar Component
export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = false,
  label,
  size = 'md',
  variant = 'default',
  animated = true,
  striped = false,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeConfig = {
    sm: { height: '4px', fontSize: designTokens.typography.fontSize.xs },
    md: { height: '8px', fontSize: designTokens.typography.fontSize.sm },
    lg: { height: '12px', fontSize: designTokens.typography.fontSize.base },
  };

  const variantColors = {
    default: designTokens.colors.primary[600],
    success: designTokens.colors.semantic.success[500],
    warning: designTokens.colors.semantic.warning[500],
    error: designTokens.colors.semantic.error[500],
  };

  return (
    <div
      css={css`
        width: 100%;
      `}
    >
      {(showLabel || label) && (
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${designTokens.spacing[1]};
            font-size: ${sizeConfig[size].fontSize};
            color: var(--text-secondary);
          `}
        >
          <span>{label || 'Progress'}</span>
          <span
            css={css`
              font-weight: ${designTokens.typography.fontWeight.medium};
            `}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div
        css={css`
          height: ${sizeConfig[size].height};
          background: var(--border-subtle);
          border-radius: ${designTokens.borderRadius.full};
          overflow: hidden;
        `}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          css={css`
            height: 100%;
            width: ${percentage}%;
            background: ${variantColors[variant]};
            border-radius: ${designTokens.borderRadius.full};
            transition: width 0.3s ease;
            position: relative;
            overflow: hidden;

            ${striped &&
            css`
              background-image: linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.15) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.15) 50%,
                rgba(255, 255, 255, 0.15) 75%,
                transparent 75%,
                transparent
              );
              background-size: 20px 20px;
            `}

            ${animated &&
            css`
              background-image: linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.2) 25%,
                transparent 25%,
                transparent 50%,
                rgba(255, 255, 255, 0.2) 50%,
                rgba(255, 255, 255, 0.2) 75%,
                transparent 75%,
                transparent
              );
              background-size: 20px 20px;
              animation: ${shimmer} 1s linear infinite;
              background-position: -20px 0;
            `}
          `}
        />
      </div>
    </div>
  );
};

// Step Progress (multi-step indicator)
export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  currentStep,
  showLabels = true,
  orientation = 'horizontal',
}) => {
  const isVertical = orientation === 'vertical';

  return (
    <div
      css={css`
        display: flex;
        flex-direction: ${isVertical ? 'column' : 'row'};
        gap: ${designTokens.spacing[4]};
        width: 100%;
      `}
    >
      {steps.map((step, index) => {
        const isCompleted = step.status === 'completed';
        const isActive = step.status === 'active' || index === currentStep;
        const isPending = step.status === 'pending';
        const isError = step.status === 'error';

        const stepColor = isError
          ? designTokens.colors.semantic.error[500]
          : isCompleted
            ? designTokens.colors.semantic.success[500]
            : isActive
              ? designTokens.colors.primary[600]
              : 'var(--border-subtle)';

        return (
          <div
            key={step.id}
            css={css`
              display: flex;
              align-items: ${isVertical ? 'flex-start' : 'center'};
              gap: ${designTokens.spacing[3]};
              flex: 1;
              position: relative;

              ${!isVertical &&
              index < steps.length - 1 &&
              css`
                &::after {
                  content: '';
                  position: absolute;
                  top: 50%;
                  left: 40px;
                  right: -${designTokens.spacing[4]};
                  height: 2px;
                  background: ${isCompleted ? stepColor : 'var(--border-subtle)'};
                  transform: translateY(-50%);
                  z-index: 0;
                }
              `}

              ${isVertical &&
              index < steps.length - 1 &&
              css`
                &::after {
                  content: '';
                  position: absolute;
                  left: 15px;
                  top: 36px;
                  bottom: -${designTokens.spacing[4]};
                  width: 2px;
                  background: ${isCompleted ? stepColor : 'var(--border-subtle)'};
                  z-index: 0;
                }
              `}
            `}
          >
            {/* Step indicator */}
            <div
              css={css`
                width: 32px;
                height: 32px;
                border-radius: 50%;
                background: ${stepColor};
                color: ${isCompleted || isError ? 'white' : 'var(--text-muted)'};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                z-index: 1;
                font-size: ${designTokens.typography.fontSize.sm};
                font-weight: ${designTokens.typography.fontWeight.semibold};
                transition: all 0.2s ease;
                animation: ${isActive ? pulse : 'none'} 1.5s ease-in-out infinite;
              `}
            >
              {isCompleted ? (
                <CheckCircle size={18} />
              ) : isError ? (
                <AlertCircle size={18} />
              ) : isActive ? (
                <Loader2
                  size={16}
                  css={css`
                    animation: spin 1s linear infinite;
                    @keyframes spin {
                      from {
                        transform: rotate(0deg);
                      }
                      to {
                        transform: rotate(360deg);
                      }
                    }
                  `}
                />
              ) : (
                index + 1
              )}
            </div>

            {/* Label */}
            {showLabels && (
              <div
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    color: ${isActive || isCompleted ? 'var(--text-primary)' : 'var(--text-muted)'};
                  `}
                >
                  {step.label}
                </div>
                {isActive && (
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.xs};
                      color: var(--text-muted);
                      margin-top: 2px;
                    `}
                  >
                    In progress...
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Circular Progress
export const CircularProgress: React.FC<{
  value: number;
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
}> = ({ value, size = 64, strokeWidth = 6, showValue = true, variant = 'default' }) => {
  const percentage = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const variantColors = {
    default: designTokens.colors.primary[600],
    success: designTokens.colors.semantic.success[500],
    warning: designTokens.colors.semantic.warning[500],
    error: designTokens.colors.semantic.error[500],
  };

  return (
    <div
      css={css`
        position: relative;
        width: ${size}px;
        height: ${size}px;
      `}
    >
      <svg
        width={size}
        height={size}
        css={css`
          transform: rotate(-90deg);
        `}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={variantColors[variant]}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          css={css`
            transition: stroke-dashoffset 0.3s ease;
          `}
        />
      </svg>
      {showValue && (
        <div
          css={css`
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${designTokens.typography.fontSize.sm};
            font-weight: ${designTokens.typography.fontWeight.semibold};
            color: var(--text-primary);
          `}
        >
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
