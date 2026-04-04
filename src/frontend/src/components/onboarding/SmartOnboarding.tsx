import React, { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { designTokens } from "../../styles/design-system";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { Button } from "../ui/Button";
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
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/Card";
import { owsApi } from "../../services/apiService";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
}

// OWS Wallet Setup Step - Guided wallet connection
function OwsSetupStep() {
  const [walletStatus, setWalletStatus] = useState<
    "checking" | "connected" | "none"
  >("checking");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkWalletStatus();
  }, []);

  const checkWalletStatus = async () => {
    try {
      const res = await owsApi.listWallets();
      if (res.success && res.data && res.data.length > 0) {
        setWalletStatus("connected");
      } else {
        setWalletStatus("none");
      }
    } catch {
      setWalletStatus("none");
    }
  };

  const handleBootstrap = async () => {
    setIsLoading(true);
    try {
      await owsApi.bootstrap();
      setWalletStatus("connected");
    } catch (error) {
      console.error("Failed to bootstrap wallet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (walletStatus === "checking") {
    return (
      <div style={{ textAlign: "center", padding: designTokens.spacing[8] }}>
        <div style={{ marginBottom: designTokens.spacing[4] }}>
          <Brain size={48} color={designTokens.colors.primary[500]} />
        </div>
        <p>Checking wallet status...</p>
      </div>
    );
  }

  if (walletStatus === "connected") {
    return (
      <div style={{ textAlign: "center", padding: designTokens.spacing[6] }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: designTokens.colors.semantic.success[100],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: `0 auto ${designTokens.spacing[4]}`,
          }}
        >
          <CheckCircle2
            size={32}
            color={designTokens.colors.semantic.success[500]}
          />
        </div>
        <h3 style={{ marginBottom: designTokens.spacing[2] }}>
          Wallet Connected!
        </h3>
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
          textAlign: "center",
          marginBottom: designTokens.spacing[6],
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: designTokens.colors.primary[50],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: `0 auto ${designTokens.spacing[4]}`,
          }}
        >
          <Wallet size={32} color={designTokens.colors.primary[500]} />
        </div>
        <h3 style={{ marginBottom: designTokens.spacing[2] }}>
          Connect OWS Wallet
        </h3>
        <p
          style={{
            color: designTokens.colors.neutral[600],
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          Your wallet will be encrypted locally. Agents can request spend but
          policy rules control what gets approved.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: designTokens.spacing[4],
          marginBottom: designTokens.spacing[6],
        }}
      >
        <Card variant="outlined">
          <CardContent
            style={{ textAlign: "center", padding: designTokens.spacing[4] }}
          >
            <Key size={24} color={designTokens.colors.primary[500]} />
            <h4
              style={{
                margin: `${designTokens.spacing[2]} 0`,
                fontSize: designTokens.typography.fontSize.sm,
              }}
            >
              Scoped API Keys
            </h4>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.xs,
                color: designTokens.colors.neutral[500],
              }}
            >
              Agents get limited access, not full wallet control
            </p>
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent
            style={{ textAlign: "center", padding: designTokens.spacing[4] }}
          >
            <Shield size={24} color={designTokens.colors.primary[500]} />
            <h4
              style={{
                margin: `${designTokens.spacing[2]} 0`,
                fontSize: designTokens.typography.fontSize.sm,
              }}
            >
              Policy Enforcement
            </h4>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.xs,
                color: designTokens.colors.neutral[500],
              }}
            >
              Every spend checked against your rules before signing
            </p>
          </CardContent>
        </Card>
      </div>

      <div style={{ textAlign: "center" }}>
        <Button
          variant="primary"
          onClick={handleBootstrap}
          disabled={isLoading}
        >
          {isLoading ? "Connecting..." : "Bootstrap Wallet"}
        </Button>
        <p
          style={{
            marginTop: designTokens.spacing[3],
            fontSize: designTokens.typography.fontSize.sm,
            color: designTokens.colors.neutral[400],
          }}
        >
          Creates an encrypted local vault with derived wallet keys
        </p>
      </div>
    </div>
  );
}

export const SmartOnboarding: React.FC = () => {
  const { preferences, user, completeOnboarding, updatePreferences } =
    useAppStore();
  const { isMobile } = useBreakpoint();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    const shouldShow = !preferences.onboardingCompleted && !user.isConnected;
    setShowOnboarding(shouldShow);
  }, [preferences.onboardingCompleted, user.isConnected]);

  const userTypes = [
    {
      id: "operator",
      title: "Operator",
      description: "Control how autonomous agents spend from shared wallets.",
      icon: <TrendingUp size={32} color={designTokens.colors.primary[500]} />,
      features: [
        "Per-agent budget controls",
        "Approval thresholds and holds",
        "Live spend visibility",
      ],
    },
    {
      id: "developer",
      title: "Builder",
      description:
        "Integrate policy checks and audit evidence into your agent stack.",
      icon: <Code size={32} color={designTokens.colors.primary[500]} />,
      features: [
        "BYO-agent ingestion API",
        "Custom policy enforcement",
        "OWS-ready control-plane hooks",
      ],
    },
    {
      id: "guardian",
      title: "Guardian",
      description:
        "Enforce wallet restrictions and review risky agent actions.",
      icon: <ShieldCheck size={32} color={designTokens.colors.primary[500]} />,
      features: [
        "Real-time policy guardrails",
        "Immutable forensic audit trails",
        "Approval-first governance flows",
      ],
    },
    {
      id: "explorer",
      title: "Curious",
      description:
        "See how teams can give agents wallets without giving them a blank check.",
      icon: <Search size={32} color={designTokens.colors.primary[500]} />,
      features: [
        "Interactive audit views",
        "Approval and denial examples",
        "Hackathon demo mode",
      ],
    },
  ];

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Cognivern",
      description: "Spend governance for autonomous agents",
      component: (
        <div style={{ textAlign: "center", padding: designTokens.spacing[6] }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: designTokens.spacing[4],
            }}
          >
            <Brain size={64} color={designTokens.colors.primary[500]} />
          </div>
          <h2
            style={{
              fontSize: designTokens.typography.fontSize["3xl"],
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
              color: designTokens.colors.neutral[600],
              maxWidth: "500px",
              margin: "0 auto",
              lineHeight: designTokens.typography.lineHeight.relaxed,
            }}
          >
            Give agents real execution power with clear budgets, approval
            boundaries, and an evidence trail your team can actually operate.
          </p>
        </div>
      ),
    },
    {
      id: "user-type",
      title: "What brings you here?",
      description: "Help us personalize your experience",
      component: (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: designTokens.spacing[4],
            padding: designTokens.spacing[4],
          }}
        >
          {userTypes.map((type) => (
            <Card
              key={type.id}
              interactive
              variant={selectedUserType === type.id ? "elevated" : "outlined"}
              style={{
                cursor: "pointer",
                border:
                  selectedUserType === type.id
                    ? `2px solid ${designTokens.colors.primary[500]}`
                    : undefined,
              }}
              onClick={() => setSelectedUserType(type.id)}
            >
              <CardContent>
                <div
                  style={{
                    textAlign: "center",
                    marginBottom: designTokens.spacing[3],
                  }}
                >
                  <div
                    style={{
                      fontSize: "24px",
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
                    }}
                  >
                    {type.title}
                  </h3>
                  <p
                    style={{
                      margin: `${designTokens.spacing[2]} 0`,
                      fontSize: designTokens.typography.fontSize.sm,
                      color: designTokens.colors.neutral[600],
                    }}
                  >
                    {type.description}
                  </p>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    fontSize: designTokens.typography.fontSize.xs,
                    color: designTokens.colors.neutral[500],
                  }}
                >
                  {type.features.map((feature, index) => (
                    <li
                      key={index}
                      style={{
                        padding: `${designTokens.spacing[1]} 0`,
                        display: "flex",
                        alignItems: "center",
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
      id: "ows-setup",
      title: "Connect Your Wallet",
      description: "Set up OWS wallet for agent spend governance",
      component: <OwsSetupStep />,
    },
    {
      id: "complete",
      title: "You're all set!",
      description: "Ready to explore Cognivern",
      component: (
        <div style={{ textAlign: "center", padding: designTokens.spacing[6] }}>
          <div
            style={{ fontSize: "48px", marginBottom: designTokens.spacing[4] }}
          >
            🎉
          </div>
          <h2
            style={{
              fontSize: designTokens.typography.fontSize["2xl"],
              fontWeight: designTokens.typography.fontWeight.bold,
              margin: `0 0 ${designTokens.spacing[4]} 0`,
            }}
          >
            Welcome aboard!
          </h2>
          <p
            style={{
              fontSize: designTokens.typography.fontSize.base,
              color: designTokens.colors.neutral[600],
              marginBottom: designTokens.spacing[6],
            }}
          >
            Your personalized dashboard is ready. You can always change your
            preferences later.
          </p>
          <div
            style={{
              display: "flex",
              gap: designTokens.spacing[3],
              justifyContent: "center",
              flexWrap: "wrap",
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
    completeOnboarding(selectedUserType || "explorer");
    setShowOnboarding(false);
    setIsWizardOpen(false);
  };

  const handleStartOnboarding = () => {
    setCurrentStep(0);
    setIsWizardOpen(true);
  };

  const canProceed = () => {
    if (steps[currentStep].id === "user-type") {
      return selectedUserType !== "";
    }
    return true;
  };

  if (!showOnboarding) {
    return null;
  }

  if (!isWizardOpen) {
    return (
      <div
        style={{
          position: "fixed",
          right: designTokens.spacing[4],
          bottom: designTokens.spacing[4],
          zIndex: designTokens.zIndex.toast,
          width: "min(420px, calc(100vw - 32px))",
        }}
      >
        <Card variant="elevated">
          <CardHeader>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                <CardTitle style={{ fontSize: "16px" }}>
                  Experience the Agentic Era
                </CardTitle>
                <CardDescription style={{ fontSize: "13px" }}>
                  Explore the dashboard with live agents and verifiable audit
                  trails.
                </CardDescription>
              </div>
              <div
                style={{
                  background: designTokens.colors.primary[50],
                  padding: "8px",
                  borderRadius: "12px",
                  display: isMobile ? "none" : "flex",
                }}
              >
                <Brain size={24} color={designTokens.colors.primary[500]} />
              </div>
            </div>
          </CardHeader>
          <CardContent style={{ paddingTop: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: designTokens.spacing[2],
                marginTop: designTokens.spacing[2],
              }}
            >
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Maybe Later
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartOnboarding}
              >
                Quick Start
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: designTokens.zIndex.modal,
    padding: designTokens.spacing[4],
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: designTokens.colors.neutral[0],
    borderRadius: designTokens.borderRadius.xl,
    boxShadow: designTokens.shadows["2xl"],
    maxWidth: "800px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    position: "relative",
  };

  const progressStyle: React.CSSProperties = {
    height: "4px",
    backgroundColor: designTokens.colors.neutral[200],
    borderRadius: designTokens.borderRadius.full,
    overflow: "hidden",
  };

  const progressFillStyle: React.CSSProperties = {
    height: "100%",
    backgroundColor: designTokens.colors.primary[500],
    width: `${((currentStep + 1) / steps.length) * 100}%`,
    transition: `width ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeInOut}`,
  };

  const footerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: designTokens.spacing[6],
    borderTop: `1px solid ${designTokens.colors.neutral[200]}`,
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Progress Bar */}
        <div style={progressStyle}>
          <div style={progressFillStyle} />
        </div>

        {/* Content */}
        <div style={{ padding: designTokens.spacing[6] }}>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: designTokens.spacing[2],
            }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsWizardOpen(false)}
            >
              Close
            </Button>
          </div>
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>{steps[currentStep].component}</CardContent>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ display: "flex", gap: designTokens.spacing[2] }}>
            <Button variant="ghost" onClick={handleSkip}>
              Skip for now
            </Button>
          </div>

          <div style={{ display: "flex", gap: designTokens.spacing[2] }}>
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>

            {currentStep === steps.length - 1 ? (
              <Button variant="primary" onClick={handleComplete}>
                Get Started
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed()}
              >
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
