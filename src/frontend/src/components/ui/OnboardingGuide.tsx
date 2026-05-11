/** @jsxImportSource @emotion/react */
import React, { useState, useEffect, useCallback } from 'react';
import { css, keyframes } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Button } from './Button';
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  MapPin,
  PlayCircle,
  Settings,
  Users,
  BarChart3,
} from 'lucide-react';

export interface TourStep {
  id: string;
  target?: string; // CSS selector for element to highlight
  title: string;
  content: string | React.ReactNode;
  icon?: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface OnboardingGuideProps {
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  autoStart?: boolean;
  showProgress?: boolean;
  themeColor?: string;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
`;

const iconMap: Record<string, React.ReactNode> = {
  start: <PlayCircle size={20} />,
  settings: <Settings size={20} />,
  users: <Users size={20} />,
  chart: <BarChart3 size={20} />,
  default: <MapPin size={20} />,
};

export const OnboardingGuide: React.FC<OnboardingGuideProps> = ({
  steps,
  onComplete,
  onSkip,
  autoStart = false,
  showProgress = true,
  themeColor = designTokens.colors.primary[600],
}) => {
  const [isActive, setIsActive] = useState(autoStart);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  // Find target element and calculate position
  useEffect(() => {
    if (!isActive || !step?.target) {
      setTargetRect(null);
      return;
    }

    const updateTargetRect = () => {
      const element = document.querySelector(step.target!);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect);

    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect);
    };
  }, [isActive, step?.target]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      setIsActive(false);
      onComplete?.();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }, [isLastStep, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    onSkip?.();
  }, [onSkip]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  // Calculate tooltip position
  const getTooltipStyle = () => {
    if (!targetRect || step?.placement === 'center') {
      return css`
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      `;
    }

    const placement = step?.placement || 'right';
    const offset = 16;

    const positions: Record<string, ReturnType<typeof css>> = {
      top: css`
        bottom: calc(${window.innerHeight - targetRect.top}px + ${offset}px);
        left: calc(${targetRect.left + targetRect.width / 2}px);
        transform: translateX(-50%);
      `,
      bottom: css`
        top: calc(${targetRect.bottom}px + ${offset}px);
        left: calc(${targetRect.left + targetRect.width / 2}px);
        transform: translateX(-50%);
      `,
      left: css`
        right: calc(${window.innerWidth - targetRect.left}px + ${offset}px);
        top: calc(${targetRect.top + targetRect.height / 2}px);
        transform: translateY(-50%);
      `,
      right: css`
        left: calc(${targetRect.right}px + ${offset}px);
        top: calc(${targetRect.top + targetRect.height / 2}px);
        transform: translateY(-50%);
      `,
    };

    return positions[placement] || positions.right;
  };

  // Spotlight effect
  const spotlightStyle = targetRect
    ? css`
        position: fixed;
        top: ${targetRect.top - 8}px;
        left: ${targetRect.left - 8}px;
        width: ${targetRect.width + 16}px;
        height: ${targetRect.height + 16}px;
        border-radius: ${designTokens.borderRadius.md};
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
        animation: ${pulse} 2s ease-in-out infinite;
        z-index: 9996;
      `
    : null;

  if (!isActive) {
    // Floating start button
    return (
      <div
        css={css`
          position: fixed;
          bottom: ${designTokens.spacing[6]};
          right: ${designTokens.spacing[6]};
          z-index: 9995;
          display: flex;
          flex-direction: column;
          gap: ${designTokens.spacing[2]};
        `}
      >
        <button
          onClick={handleSkip}
          css={css`
            position: absolute;
            top: -32px;
            right: 0;
            padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-muted);
            background: transparent;
            border: none;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.15s;

            &:hover {
              opacity: 1;
            }
          `}
        >
          Skip tour
        </button>
        <Button
          variant="primary"
          leftIcon={<MapPin size={18} />}
          onClick={startTour}
          css={css`
            border-radius: 50px;
            padding: ${designTokens.spacing[3]} ${designTokens.spacing[5]};
            box-shadow: ${designTokens.shadows.lg};
          `}
        >
          Start Tour
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        css={css`
          position: fixed;
          inset: 0;
          z-index: 9995;
          pointer-events: none;
        `}
      />

      {/* Spotlight */}
      {spotlightStyle && <div css={spotlightStyle} />}

      {/* Tooltip card */}
      <div
        css={css`
          ${getTooltipStyle()}
          z-index: 9997;
          max-width: 360px;
          width: calc(100vw - ${designTokens.spacing[8]});
          background: var(--bg-primary);
          border-radius: ${designTokens.borderRadius.xl};
          box-shadow: ${designTokens.shadows.xl};
          animation: ${fadeIn} 0.2s ease-out;
          overflow: hidden;
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        {/* Header */}
        <div
          css={css`
            display: flex;
            align-items: flex-start;
            gap: ${designTokens.spacing[3]};
            padding: ${designTokens.spacing[4]};
            background: linear-gradient(135deg, ${themeColor}15, ${themeColor}05);
            border-bottom: 1px solid var(--border-subtle);
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              justify-content: center;
              width: 40px;
              height: 40px;
              border-radius: ${designTokens.borderRadius.md};
              background: ${themeColor};
              color: white;
              flex-shrink: 0;
            `}
          >
            {step?.icon || iconMap[step?.id] || iconMap.default}
          </div>
          <div
            css={css`
              flex: 1;
              min-width: 0;
            `}
          >
            <div
              css={css`
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: ${designTokens.spacing[2]};
              `}
            >
              <h3
                id="tour-title"
                css={css`
                  font-size: ${designTokens.typography.fontSize.base};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  color: var(--text-primary);
                  margin: 0;
                `}
              >
                {step?.title || 'Welcome'}
              </h3>
              <button
                onClick={handleSkip}
                css={css`
                  padding: ${designTokens.spacing[1]};
                  color: var(--text-muted);
                  background: transparent;
                  border: none;
                  border-radius: ${designTokens.borderRadius.sm};
                  cursor: pointer;
                  transition: color 0.15s;

                  &:hover {
                    color: var(--text-primary);
                  }
                `}
                aria-label="Skip tour"
              >
                <X size={16} />
              </button>
            </div>

            {/* Progress indicator */}
            {showProgress && (
              <div
                css={css`
                  display: flex;
                  gap: ${designTokens.spacing[1]};
                  margin-top: ${designTokens.spacing[2]};
                `}
              >
                {steps.map((_, index) => (
                  <div
                    key={index}
                    css={css`
                      height: 3px;
                      width: ${index === currentStep ? '24px' : '8px'};
                      border-radius: 2px;
                      background: ${index === currentStep ? themeColor : 'var(--border-subtle)'};
                      transition: all 0.2s ease;
                    `}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div
          css={css`
            padding: ${designTokens.spacing[4]};
          `}
        >
          <p
            css={css`
              font-size: ${designTokens.typography.fontSize.sm};
              color: var(--text-secondary);
              line-height: 1.6;
              margin: 0;
            `}
          >
            {step?.content}
          </p>

          {/* Custom action */}
          {step?.action && (
            <button
              onClick={step.action.onClick}
              css={css`
                margin-top: ${designTokens.spacing[3]};
                padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                font-size: ${designTokens.typography.fontSize.xs};
                font-weight: ${designTokens.typography.fontWeight.medium};
                color: ${themeColor};
                background: ${themeColor}15;
                border: 1px solid ${themeColor}30;
                border-radius: ${designTokens.borderRadius.sm};
                cursor: pointer;
                transition: all 0.15s;

                &:hover {
                  background: ${themeColor}25;
                }
              `}
            >
              {step.action.label}
            </button>
          )}
        </div>

        {/* Footer */}
        <div
          css={css`
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
            background: var(--bg-secondary);
            border-top: 1px solid var(--border-subtle);
          `}
        >
          <div
            css={css`
              font-size: ${designTokens.typography.fontSize.xs};
              color: var(--text-muted);
            `}
          >
            Step {currentStep + 1} of {steps.length}
          </div>
          <div
            css={css`
              display: flex;
              gap: ${designTokens.spacing[2]};
            `}
          >
            {currentStep > 0 && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<ChevronLeft size={14} />}
                onClick={handlePrevious}
              >
                Back
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              rightIcon={isLastStep ? <CheckCircle size={14} /> : <ChevronRight size={14} />}
              onClick={handleNext}
            >
              {isLastStep ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

// Checklist component for tracking onboarding progress
export const OnboardingChecklist: React.FC<{
  items: { id: string; label: string; description?: string; completed: boolean }[];
  onItemClick?: (id: string) => void;
}> = ({ items, onItemClick }) => {
  const completedCount = items.filter((item) => item.completed).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div
      css={css`
        background: var(--bg-primary);
        border: 1px solid var(--border-subtle);
        border-radius: ${designTokens.borderRadius.lg};
        padding: ${designTokens.spacing[4]};
      `}
    >
      {/* Header */}
      <div
        css={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: ${designTokens.spacing[4]};
        `}
      >
        <h3
          css={css`
            font-size: ${designTokens.typography.fontSize.base};
            font-weight: ${designTokens.typography.fontWeight.semibold};
            color: var(--text-primary);
            margin: 0;
          `}
        >
          Getting Started
        </h3>
        <span
          css={css`
            font-size: ${designTokens.typography.fontSize.xs};
            color: var(--text-muted);
          `}
        >
          {completedCount} of {items.length} completed
        </span>
      </div>

      {/* Progress bar */}
      <div
        css={css`
          height: 4px;
          background: var(--border-subtle);
          border-radius: 2px;
          margin-bottom: ${designTokens.spacing[4]};
          overflow: hidden;
        `}
      >
        <div
          css={css`
            height: 100%;
            width: ${progress}%;
            background: ${designTokens.colors.primary[600]};
            border-radius: 2px;
            transition: width 0.3s ease;
          `}
        />
      </div>

      {/* Items */}
      <div
        css={css`
          display: flex;
          flex-direction: column;
          gap: ${designTokens.spacing[2]};
        `}
      >
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick?.(item.id)}
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[3]};
              padding: ${designTokens.spacing[3]};
              background: ${item.completed ? 'var(--bg-secondary)' : 'transparent'};
              border: 1px solid ${item.completed ? 'var(--border-subtle)' : 'transparent'};
              border-radius: ${designTokens.borderRadius.md};
              cursor: pointer;
              text-align: left;
              transition: all 0.15s;

              &:hover {
                background: var(--bg-secondary);
              }
            `}
          >
            <div
              css={css`
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 2px solid
                  ${item.completed
                    ? designTokens.colors.semantic.success[500]
                    : 'var(--border-subtle)'};
                background: ${item.completed
                  ? designTokens.colors.semantic.success[500]
                  : 'transparent'};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: all 0.15s;
              `}
            >
              {item.completed && <CheckCircle size={12} color="white" />}
            </div>
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
                  color: ${item.completed ? 'var(--text-muted)' : 'var(--text-primary)'};
                  text-decoration: ${item.completed ? 'line-through' : 'none'};
                `}
              >
                {item.label}
              </div>
              {item.description && (
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xs};
                    color: var(--text-muted);
                    margin-top: 2px;
                  `}
                >
                  {item.description}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OnboardingGuide;
