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
  ArrowRight,
  CheckCircle2,
  Wallet,
  Key,
  Shield,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { owsApi } from '../../services/apiService';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

// OWS Wallet Setup Step - Guided wallet connection
function OwsSetupStep() {
  const [walletStatus, setWalletStatus] = useState<'checking' | 'connected' | 'none'>('checking');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = async () => {
    try {
      const res = await owsApi.listWallets();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setWalletStatus('connected');
      } else {
        setWalletStatus('none');
      }
    } catch {
      setWalletStatus('none');
    }
  };

  const handleBootstrap = async () => {
    setIsLoading(true);
    try {
      await owsApi.bootstrap();
      setWalletStatus('connected');
    } catch (error) {
      console.error('Failed to bootstrap wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (walletStatus === 'checking') {
    return (
      <div style={{ textAlign: 'center', padding: designTokens.spacing[8] }}>
        <div style={{ marginBottom: designTokens.spacing[4] }}>
          <Brain size={48} color={designTokens.colors.primary[500]} />
        </div>
        <p>Checking wallet status...</p>
      </div>
    );
  }

  if (walletStatus === 'connected') {
    return (
      <div style={{ textAlign: 'center', padding: designTokens.spacing[6] }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: designTokens.colors.semantic.success[100],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: `0 auto ${designTokens.spacing[4]}`,
          }}
        >
          <CheckCircle2 size={32} color={designTokens.colors.semantic.success[500]} />
        </div>
        <h3 style={{ marginBottom: designTokens.spacing[2] }}>Wallet Connected!</h3>
        <p style={{ color: designTokens.colors.neutral[600] }}>
          Your OWS wallet is ready for agent spend governance.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: designTokens.spacing[4] }}>
      <div
        style={{
          textAlign: 'center',
          marginBottom: designTokens.spacing[6],
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--surface-bg-alt, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: `0 auto ${designTokens.spacing[4]}`,
          }}
        >
          <Wallet size={32} color={designTokens.colors.primary[500]} />
        </div>
        <h3 style={{ marginBottom: designTokens.spacing[2], color: 'var(--text-primary)' }}>Connect OWS Wallet</h3>
        <p
          style={{
            color: 'var(--text-secondary)',
            maxWidth: 400,
            margin: '0 auto',
          }}
        >
          Your wallet will be encrypted locally. Agents can request spend but policy rules control
          what gets approved.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: designTokens.spacing[4],
          marginBottom: designTokens.spacing[6],
        }}
      >
        <Card variant="outlined">
          <CardContent style={{ textAlign: 'center', padding: designTokens.spacing[4] }}>
            <Key size={24} color={designTokens.colors.primary[500]} />
            <h4
              style={{
                margin: `${designTokens.spacing[2]} 0`,
                fontSize: designTokens.typography.fontSize.sm,
                color: 'var(--card-text)',
              }}
            >
              Scoped API Keys
            </h4>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.xs,
                color: 'var(--text-secondary)',
              }}
            >
              Agents get limited access, not full wallet control
            </p>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent style={{ textAlign: 'center', padding: designTokens.spacing[4] }}>
            <Shield size={24} color={designTokens.colors.primary[500]} />
            <h4
              style={{
                margin: `${designTokens.spacing[2]} 0`,
                fontSize: designTokens.typography.fontSize.sm,
                color: 'var(--card-text)',
              }}
            >
              Policy Enforcement
            </h4>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.xs,
                color: 'var(--text-secondary)',
              }}
            >
              Every spend checked against your rules before signing
            </p>
          </CardContent>
        </Card>
      </div>

      <div style={{ textAlign: 'center' }}>
        <Button variant="primary" onClick={handleBootstrap} disabled={isLoading}>
          {isLoading ? 'Connecting...' : 'Bootstrap Wallet'}
        </Button>
        <p
          style={{
            marginTop: designTokens.spacing[3],
            fontSize: designTokens.typography.fontSize.sm,
            color: 'var(--text-muted)',
          }}
        >
          Creates an encrypted local vault with derived wallet keys
        </p>
      </div>
    </div>
  );
}

export const SmartOnboarding: React.FC = () => {
  const { preferences, user, completeOnboarding, updatePreferences } = useAppStore();
  const { isMobile } = useBreakpoint();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    // When directly navigating to /onboarding route, always show the wizard
    const isOnboardingRoute = window.location.pathname === '/onboarding';
    const shouldShow = isOnboardingRoute || (!preferences.onboardingCompleted && !user.isConnected);
    setShowOnboarding(shouldShow);

    // Auto-open wizard when on onboarding route
    if (isOnboardingRoute && !preferences.onboardingCompleted) {
      setIsWizardOpen(true);
    }
  }, [preferences.onboardingCompleted, user.isConnected]);

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

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Cognivern',
      description: 'Spend governance for autonomous agents',
      component: (
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
              color: designTokens.colors.neutral[900],
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
      ),
    },
    {
      id: 'user-type',
      title: 'What brings you here?',
      description: 'Help us personalize your experience',
      component: (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: designTokens.spacing[4],
            padding: designTokens.spacing[4],
          }}
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
                <div
                  style={{
                    textAlign: 'center',
                    marginBottom: designTokens.spacing[3],
                  }}
                >
                  <div
                    style={{
                      fontSize: '24px',
                      marginBottom: designTokens.spacing[2],
                    }}
                  >
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
                      <span
                        style={{
                          color: designTokens.colors.semantic.success[500],
                        }}
                      >
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
      ),
    },
    {
      id: 'ows-setup',
      title: 'Connect Your Wallet',
      description: 'Set up OWS wallet for agent spend governance',
      component: <OwsSetupStep />,
    },
    {
      id: 'complete',
      title: "You're all set!",
      description: 'Ready to explore Cognivern',
      component: (
        <div style={{ textAlign: 'center', padding: designTokens.spacing[6] }}>
          <div style={{ fontSize: '48px', marginBottom: designTokens.spacing[4] }}>🎉</div>
          <h2
            style={{
              fontSize: designTokens.typography.fontSize['2xl'],
              fontWeight: designTokens.typography.fontWeight.bold,
              margin: `0 0 ${designTokens.spacing[4]} 0`,
              color: 'var(--text-primary)',
            }}
          >
            Welcome aboard!
          </h2>
          <p
            style={{
              fontSize: designTokens.typography.fontSize.base,
              color: 'var(--text-secondary)',
              marginBottom: designTokens.spacing[6],
            }}
          >
            Your personalized dashboard is ready. You can always change your preferences later.
          </p>
          <div
            style={{
              display: 'flex',
              gap: designTokens.spacing[3],
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="outline"
              onClick={() => {
                // explorer logic with demo agents
                handleComplete();
              }}
            >
              Demo Playground
            </Button>
            <Button variant="primary" onClick={() => handleComplete()}>
              Enter Dashboard
            </Button>
          </div>
        </div>
      ),
    },
  ];

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

  const handleSkip = () => {
    updatePreferences({ onboardingCompleted: true });
    setShowOnboarding(false);
    setIsWizardOpen(false);
  };

  const handleComplete = () => {
    completeOnboarding(selectedUserType || 'explorer');
    setShowOnboarding(false);
    setIsWizardOpen(false);
  };

  const handleStartOnboarding = () => {
    setCurrentStep(0);
    setIsWizardOpen(true);
  };

  const canProceed = () => {
    if (steps[currentStep].id === 'user-type') {
      return selectedUserType !== '';
    }
    return true;
  };

  if (!showOnboarding) {
    // If navigated directly to /onboarding but already completed, show a message
    if (window.location.pathname === '/onboarding' && preferences.onboardingCompleted) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: designTokens.spacing[6],
            textAlign: 'center',
          }}
        >
          <div>
            <Brain
              size={64}
              color={designTokens.colors.primary[500]}
              style={{ margin: '0 auto' }}
            />
            <h2 style={{ marginTop: designTokens.spacing[4] }}>You're already set up!</h2>
            <p
              style={{
                color: designTokens.colors.neutral[600],
                marginTop: designTokens.spacing[2],
              }}
            >
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  if (!isWizardOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          right: designTokens.spacing[4],
          bottom: designTokens.spacing[4],
          zIndex: designTokens.zIndex.toast,
          width: 'min(420px, calc(100vw - 32px))',
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <CardTitle style={{ fontSize: '16px' }}>Experience the Agentic Era</CardTitle>
                <CardDescription style={{ fontSize: '13px' }}>
                  Explore the dashboard with live agents and verifiable audit trails.
                </CardDescription>
              </div>
              <div
                style={{
                  background: 'var(--surface-bg-alt, #f1f5f9)',
                  padding: '8px',
                  borderRadius: '12px',
                  display: isMobile ? 'none' : 'flex',
                }}
              >
                <Brain size={24} color={designTokens.colors.primary[500]} />
              </div>
            </div>
          </CardHeader>
          <CardContent style={{ paddingTop: 0 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: designTokens.spacing[2],
                marginTop: designTokens.spacing[2],
              }}
            >
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Maybe Later
              </Button>
              <Button variant="primary" size="sm" onClick={handleStartOnboarding}>
                Quick Start
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overlayStyle = css`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--overlay-bg, rgba(15, 23, 42, 0.6));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: ${designTokens.zIndex.modal};
    padding: ${designTokens.spacing[4]};
    animation: fadeIn 0.3s ease-out;

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;

  const modalStyle = css`
    background-color: var(--card-bg, ${designTokens.colors.neutral[0]});
    border-radius: ${designTokens.borderRadius.xl};
    box-shadow: ${designTokens.shadows['2xl']};
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow: auto;
    position: relative;
    color: var(--text-primary, ${designTokens.colors.neutral[900]});
    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;

  const progressStyle: React.CSSProperties = {
    height: '4px',
    backgroundColor: 'var(--divider, #e2e8f0)',
    borderRadius: designTokens.borderRadius.full,
    overflow: 'hidden',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    backgroundColor: designTokens.colors.primary[500],
    width: `${((currentStep + 1) / steps.length) * 100}%`,
    transition: `width ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut}`,
  };

  const footerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: designTokens.spacing[6],
    borderTop: `1px solid var(--divider, ${designTokens.colors.neutral[200]})`,
  };

  return (
    <div css={overlayStyle}>
      <div css={modalStyle}>
        {/* Progress Bar */}
        <div style={progressStyle}>
          <div style={progressFillStyle} />
        </div>

        {/* Content */}
        <div style={{ padding: designTokens.spacing[6] }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: designTokens.spacing[2],
            }}
          >
            <Button variant="ghost" size="sm" onClick={() => setIsWizardOpen(false)}>
              Close
            </Button>
          </div>
          <CardHeader>
            <CardTitle style={{ color: designTokens.colors.neutral[900] }}>{steps[currentStep].title}</CardTitle>
            <CardDescription style={{ color: designTokens.colors.neutral[700] }}>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent
            key={currentStep} // Key forces a re-mount for simple CSS animation
            css={css`
              animation: slideFadeIn 0.3s ease-out;
              @keyframes slideFadeIn {
                from {
                  opacity: 0;
                  transform: translateX(10px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
            `}
          >
            {steps[currentStep].component}
          </CardContent>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ display: 'flex', gap: designTokens.spacing[2] }}>
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>

          <div style={{ display: 'flex', gap: designTokens.spacing[2] }}>
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
              Previous
            </Button>

            {currentStep === steps.length - 1 ? (
              <Button variant="primary" onClick={handleComplete}>
                Get Started
              </Button>
            ) : (
              <Button variant="primary" onClick={handleNext} disabled={!canProceed()}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartOnboarding;
