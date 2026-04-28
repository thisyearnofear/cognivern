/** @jsxImportSource @emotion/react */
import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { useAppStore } from '../../stores/appStore';
import { designTokens } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { Button } from '../ui/Button';
import {
  TrendingUp,
  Code,
  ShieldCheck,
  Search,
  Brain,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { ConnectionModal } from '../web3/ConnectionModal';

/**
 * SmartOnboarding - Unified onboarding flow
 *
 * Single source of truth for initial setup experience.
 * Uses ConnectionModal for wallet setup (DRY principle).
 * Clean step-based state machine, no dual-flow confusion.
 */
export const SmartOnboarding: React.FC = () => {
  const { preferences, user, completeOnboarding } = useAppStore();
  const { isMobile } = useBreakpoint();

  // Single state machine: currentStep drives everything
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<string>('');

  // Onboarding steps - single source of truth
  const steps = [
    { id: 'welcome', label: 'Welcome' },
    { id: 'user-type', label: 'Profile' },
    { id: 'wallet', label: 'Connect' },
    { id: 'complete', label: 'Done' },
  ];

  // Check if onboarding should be shown
  useEffect(() => {
    const isOnboardingRoute = window.location.pathname === '/onboarding';
    // Start at step 0 (welcome) if on onboarding route
    if (isOnboardingRoute && !preferences.onboardingCompleted) {
      setCurrentStep(0);
    }
  }, [preferences.onboardingCompleted]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    completeOnboarding(selectedUserType || 'explorer');
  };

  // User type options
  const userTypes = [
    {
      id: 'operator',
      title: 'Operator',
      description: 'Control how autonomous agents spend from shared wallets.',
      icon: <TrendingUp size={32} color={designTokens.colors.primary[500]} />,
      features: [
        'Per-agent budget controls',
        'Approval thresholds and holds',
        'Live spend visibility',
      ],
    },
    {
      id: 'developer',
      title: 'Builder',
      description: 'Integrate policy checks and audit evidence into your agent stack.',
      icon: <Code size={32} color={designTokens.colors.primary[500]} />,
      features: [
        'BYO-agent ingestion API',
        'Custom policy enforcement',
        'OWS-ready control-plane hooks',
      ],
    },
    {
      id: 'guardian',
      title: 'Guardian',
      description: 'Enforce wallet restrictions and review risky agent actions.',
      icon: <ShieldCheck size={32} color={designTokens.colors.primary[500]} />,
      features: [
        'Real-time policy guardrails',
        'Immutable forensic audit trails',
        'Approval-first governance flows',
      ],
    },
    {
      id: 'explorer',
      title: 'Curious',
      description: 'See how teams can give agents wallets without giving them a blank check.',
      icon: <Search size={32} color={designTokens.colors.primary[500]} />,
      features: ['Interactive audit views', 'Approval and denial examples', 'Hackathon demo mode'],
    },
  ];

  // Progress indicator component
  const ProgressIndicator = () => (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: ${designTokens.spacing[2]};
        padding: ${designTokens.spacing[3]} ${designTokens.spacing[4]};
        background: ${designTokens.colors.neutral[50]};
        border-radius: ${designTokens.borderRadius.lg};
        margin-bottom: ${designTokens.spacing[4]};
      `}
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <React.Fragment key={step.id}>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: ${designTokens.spacing[1]};
              `}
            >
              <div
                css={css`
                  width: ${isMobile ? 28 : 32}px;
                  height: ${isMobile ? 28 : 32}px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  transition: ${designTokens.transitions.fast};
                  background: ${isCompleted
                    ? designTokens.colors.semantic.success[500]
                    : isCurrent
                      ? designTokens.colors.primary[500]
                      : designTokens.colors.neutral[200]};
                  color: ${isCompleted || isCurrent ? 'white' : designTokens.colors.neutral[500]};
                `}
              >
                {isCompleted ? <CheckCircle2 size={16} /> : index + 1}
              </div>
              <span
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: ${isCurrent
                    ? designTokens.colors.primary[600]
                    : designTokens.colors.neutral[400]};
                  font-weight: ${isCurrent ? designTokens.typography.fontWeight.medium : 'normal'};
                `}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                css={css`
                  flex: 1;
                  height: 2px;
                  background: ${isCompleted
                    ? designTokens.colors.semantic.success[200]
                    : designTokens.colors.neutral[200]};
                  border-radius: 1px;
                  min-width: ${designTokens.spacing[4]};
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Step components
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div style={{ textAlign: 'center', padding: designTokens.spacing[6] }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: designTokens.spacing[4],
              }}
            >
              <Brain size={64} color={designTokens.colors.primary[500]} />
            </div>
            <h2
              style={{
                fontSize: designTokens.typography.fontSize['3xl'],
                fontWeight: designTokens.typography.fontWeight.bold,
                margin: `0 0 ${designTokens.spacing[4]} 0`,
                color: 'var(--text-primary)',
              }}
            >
              Welcome to Cognivern
            </h2>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.lg,
                color: 'var(--text-secondary)',
                maxWidth: '500px',
                margin: '0 auto',
                lineHeight: designTokens.typography.lineHeight.relaxed,
              }}
            >
              Give agents real execution power with clear budgets, approval boundaries, and an
              evidence trail your team can actually operate.
            </p>
          </div>
        );

      case 1: // User Type Selection
        return (
          <div style={{ padding: designTokens.spacing[4] }}>
            <h3
              css={css`
                text-align: center;
                margin-bottom: ${designTokens.spacing[4]};
                font-size: ${designTokens.typography.fontSize.xl};
                color: var(--text-primary);
              `}
            >
              What brings you here?
            </h3>
            <div
              css={css`
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: ${designTokens.spacing[4]};
              `}
            >
              {userTypes.map((type) => (
                <Card
                  key={type.id}
                  interactive
                  variant={selectedUserType === type.id ? 'elevated' : 'outlined'}
                  css={css`
                    cursor: pointer;
                    border: ${selectedUserType === type.id
                      ? `2px solid ${designTokens.colors.primary[500]}`
                      : `1px solid ${designTokens.colors.neutral[200]}`};
                    transition: all 0.3s ease;
                    &:hover {
                      transform: scale(1.02);
                      box-shadow: 0 10px 25px -5px ${designTokens.colors.primary[500]}20;
                      border-color: ${designTokens.colors.primary[400]};
                    }
                  `}
                  onClick={() => setSelectedUserType(type.id)}
                >
                  <CardContent>
                    <div style={{ textAlign: 'center', marginBottom: designTokens.spacing[3] }}>
                      <div style={{ fontSize: '24px', marginBottom: designTokens.spacing[2] }}>
                        {type.icon}
                      </div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: designTokens.typography.fontSize.lg,
                          fontWeight: designTokens.typography.fontWeight.semibold,
                          color: 'var(--card-text)',
                        }}
                      >
                        {type.title}
                      </h3>
                      <p
                        style={{
                          margin: `${designTokens.spacing[2]} 0`,
                          fontSize: designTokens.typography.fontSize.sm,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {type.description}
                      </p>
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        fontSize: designTokens.typography.fontSize.xs,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {type.features.map((feature, index) => (
                        <li
                          key={index}
                          style={{
                            padding: `${designTokens.spacing[1]} 0`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: designTokens.spacing[2],
                          }}
                        >
                          <span style={{ color: designTokens.colors.semantic.success[500] }}>
                            ✓
                          </span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 2: // Wallet Connection - use ConnectionModal in embedded mode
        return (
          <div style={{ padding: designTokens.spacing[4] }}>
            <h3
              css={css`
                text-align: center;
                margin-bottom: ${designTokens.spacing[4]};
                font-size: ${designTokens.typography.fontSize.xl};
                color: var(--text-primary);
              `}
            >
              Connect Your Wallet
            </h3>
            <p
              css={css`
                text-align: center;
                margin-bottom: ${designTokens.spacing[4]};
                color: var(--text-secondary);
              `}
            >
              Set up your governance treasury. Agents request spend but policy rules control what
              gets approved.
            </p>
            {/* Use ConnectionModal in embedded mode - DRY */}
            <ConnectionModal mode="embedded" connectionsToShow={['wallet', 'treasury']} />
          </div>
        );

      case 3: // Complete
        return (
          <div style={{ textAlign: 'center', padding: designTokens.spacing[6] }}>
            <div
              css={css`
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: ${designTokens.colors.semantic.success[100]};
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto ${designTokens.spacing[4]};
              `}
            >
              <CheckCircle2 size={40} color={designTokens.colors.semantic.success[500]} />
            </div>
            <h2
              style={{
                fontSize: designTokens.typography.fontSize['2xl'],
                fontWeight: designTokens.typography.fontWeight.bold,
                margin: `0 0 ${designTokens.spacing[2]} 0`,
                color: 'var(--text-primary)',
              }}
            >
              You're all set!
            </h2>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.lg,
                color: 'var(--text-secondary)',
                marginBottom: designTokens.spacing[6],
              }}
            >
              Ready to explore Cognivern and take control of your agent spend.
            </p>

            {/* Show connection status summary */}
            <div
              css={css`
                display: flex;
                justify-content: center;
                gap: ${designTokens.spacing[4]};
                margin-bottom: ${designTokens.spacing[6]};
              `}
            >
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                  background: ${user.isConnected
                    ? designTokens.colors.semantic.success[50]
                    : designTokens.colors.neutral[100]};
                  border-radius: ${designTokens.borderRadius.md};
                  color: ${user.isConnected
                    ? designTokens.colors.semantic.success[700]
                    : designTokens.colors.neutral[500]};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}
              >
                {user.isConnected ? <CheckCircle2 size={16} /> : null}
                {user.isConnected ? 'Wallet Connected' : 'Wallet Not Connected'}
              </div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                  padding: ${designTokens.spacing[2]} ${designTokens.spacing[3]};
                  background: ${user.owsWalletConnected
                    ? designTokens.colors.semantic.success[50]
                    : designTokens.colors.neutral[100]};
                  border-radius: ${designTokens.borderRadius.md};
                  color: ${user.owsWalletConnected
                    ? designTokens.colors.semantic.success[700]
                    : designTokens.colors.neutral[500]};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}
              >
                {user.owsWalletConnected ? <CheckCircle2 size={16} /> : null}
                {user.owsWalletConnected ? 'Treasury Ready' : 'Treasury Not Set'}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Navigation buttons
  const canProceed =
    currentStep === 0 ||
    (currentStep === 1 && selectedUserType) ||
    currentStep === 2 || // Can proceed without connecting wallet (optional)
    currentStep === 3;

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div
      css={css`
        max-width: 800px;
        margin: 0 auto;
        padding: ${designTokens.spacing[4]};
      `}
    >
      {/* Progress Indicator */}
      <ProgressIndicator />

      {/* Step Content */}
      <div
        css={css`
          background: var(--surface-bg, white);
          border-radius: ${designTokens.borderRadius.xl};
          box-shadow: ${designTokens.shadows.lg};
          padding: ${isMobile ? designTokens.spacing[4] : designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[4]};
        `}
      >
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
        `}
      >
        <Button variant="ghost" onClick={handlePrevious} disabled={currentStep === 0}>
          Back
        </Button>

        <div
          css={css`
            display: flex;
            gap: ${designTokens.spacing[3]};
          `}
        >
          <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
            Skip for Now
          </Button>

          {isLastStep ? (
            <Button variant="primary" onClick={handleComplete}>
              Get Started
              <ChevronRight size={16} />
            </Button>
          ) : (
            <Button variant="primary" onClick={handleNext} disabled={!canProceed}>
              Continue
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartOnboarding;
