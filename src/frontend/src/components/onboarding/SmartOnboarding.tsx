import React, { useState, useEffect } from "react";
import { useAppStore } from "../../stores/appStore";
import { designTokens } from "../../styles/designTokens";
import { Button } from "../ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/Card";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  canSkip?: boolean;
}

export const SmartOnboarding: React.FC = () => {
  const { preferences, user, completeOnboarding, updatePreferences } =
    useAppStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUserType, setSelectedUserType] = useState<string>("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should be shown
  useEffect(() => {
    const shouldShow = !preferences.onboardingCompleted && !user.isConnected;
    setShowOnboarding(shouldShow);
  }, [preferences.onboardingCompleted, user.isConnected]);

  const userTypes = [
    {
      id: "trader",
      title: "AI Trader",
      description: "I want to use AI agents for automated trading",
      icon: "📈",
      features: [
        "Automated trading strategies",
        "Risk management",
        "Performance analytics",
      ],
    },
    {
      id: "developer",
      title: "Developer",
      description: "I want to build and integrate AI governance solutions",
      icon: "👨‍💻",
      features: ["API access", "Custom policies", "Integration tools"],
    },
    {
      id: "governance",
      title: "Governance Expert",
      description: "I want to create and manage AI governance policies",
      icon: "⚖️",
      features: ["Policy creation", "Compliance monitoring", "Audit trails"],
    },
    {
      id: "explorer",
      title: "Explorer",
      description: "I want to explore AI governance capabilities",
      icon: "🔍",
      features: ["Demo access", "Learning resources", "Guided tours"],
    },
  ];

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Welcome to Cognivern",
      description: "The future of AI agent governance",
      component: (
        <div style={{ textAlign: "center", padding: designTokens.spacing[6] }}>
          <div
            style={{ fontSize: "64px", marginBottom: designTokens.spacing[4] }}
          >
            🧠
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
            Decentralized governance for AI agents built on Filecoin's sovereign
            data layer. Create transparent, verifiable, and trustless AI
            governance.
          </p>
        </div>
      ),
      canSkip: true,
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
                      fontSize: "32px",
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
                // Show quick tour
                console.log("Starting quick tour...");
              }}
            >
              Take a Quick Tour
            </Button>
            <Button variant="primary" onClick={() => handleComplete()}>
              Go to Dashboard
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
  };

  const handleComplete = () => {
    completeOnboarding(selectedUserType || "explorer");
    setShowOnboarding(false);
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
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>{steps[currentStep].description}</CardDescription>
          </CardHeader>
          <CardContent>{steps[currentStep].component}</CardContent>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <div style={{ display: "flex", gap: designTokens.spacing[2] }}>
            {steps[currentStep].canSkip && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip for now
              </Button>
            )}
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
