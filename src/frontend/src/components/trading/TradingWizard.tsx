import React, { useState } from "react";
import { designTokens } from "../../styles/designTokens";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import AnimatedButton from "../ui/AnimatedButton";

export interface TradingWizardProps {
  onComplete: (config: TradingConfig) => void;
  onSkip: () => void;
}

export interface TradingConfig {
  userType: "beginner" | "intermediate" | "advanced";
  agentType: "recall" | "vincent";
  riskLevel: "conservative" | "moderate" | "aggressive";
  autoStart: boolean;
}

export const TradingWizard: React.FC<TradingWizardProps> = ({
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Partial<TradingConfig>>({});
  const { isMobile } = useBreakpoint();

  const steps = [
    {
      id: 1,
      title: "Welcome to AI Trading",
      subtitle: "Let's get you started with automated trading",
    },
    {
      id: 2,
      title: "What's your experience?",
      subtitle: "This helps us customize your experience",
    },
    {
      id: 3,
      title: "Choose your trading style",
      subtitle: "Select the AI agent that fits your needs",
    },
    {
      id: 4,
      title: "Set your risk level",
      subtitle: "How aggressive should your trading be?",
    },
    {
      id: 5,
      title: "Ready to start!",
      subtitle: "Your AI trading agent is configured",
    },
  ];

  const userTypes = [
    {
      id: "beginner",
      title: "New to Trading",
      description: "I want to learn while the AI handles the complexity",
      icon: "🌱",
      features: [
        "Guided tutorials",
        "Conservative defaults",
        "Educational insights",
      ],
    },
    {
      id: "intermediate",
      title: "Some Experience",
      description: "I understand basics but want AI assistance",
      icon: "📈",
      features: [
        "Balanced approach",
        "Customizable settings",
        "Performance analytics",
      ],
    },
    {
      id: "advanced",
      title: "Experienced Trader",
      description: "I want full control and advanced features",
      icon: "🚀",
      features: [
        "Advanced strategies",
        "Full customization",
        "Real-time monitoring",
      ],
    },
  ];

  const agentTypes = [
    {
      id: "recall",
      title: "Recall Competition Agent",
      description:
        "Optimized for trading competitions with aggressive strategies",
      icon: "🏆",
      features: [
        "Competition-focused",
        "High-frequency trading",
        "Performance tracking",
      ],
      recommended: config.userType === "advanced",
    },
    {
      id: "vincent",
      title: "Vincent Social Agent",
      description: "Uses social sentiment and market analysis for decisions",
      icon: "🧠",
      features: ["Sentiment analysis", "Social signals", "Risk management"],
      recommended: config.userType !== "advanced",
    },
  ];

  const riskLevels = [
    {
      id: "conservative",
      title: "Conservative",
      description: "Lower risk, steady growth approach",
      icon: "🛡️",
      expectedReturn: "5-15% annually",
      maxDrawdown: "< 5%",
    },
    {
      id: "moderate",
      title: "Moderate",
      description: "Balanced risk and reward strategy",
      icon: "⚖️",
      expectedReturn: "15-30% annually",
      maxDrawdown: "< 15%",
    },
    {
      id: "aggressive",
      title: "Aggressive",
      description: "Higher risk for potentially higher returns",
      icon: "🔥",
      expectedReturn: "30%+ annually",
      maxDrawdown: "< 30%",
    },
  ];

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      onComplete(config as TradingConfig);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 2:
        return !!config.userType;
      case 3:
        return !!config.agentType;
      case 4:
        return !!config.riskLevel;
      default:
        return true;
    }
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "800px",
    margin: "0 auto",
    padding: designTokens.spacing[6],
  };

  const progressStyle: React.CSSProperties = {
    width: "100%",
    height: "4px",
    backgroundColor: designTokens.colors.neutral[200],
    borderRadius: designTokens.borderRadius.full,
    marginBottom: designTokens.spacing[8],
    overflow: "hidden",
  };

  const progressFillStyle: React.CSSProperties = {
    height: "100%",
    backgroundColor: designTokens.colors.primary[500],
    width: `${(step / steps.length) * 100}%`,
    transition: `width ${designTokens.animation.duration.normal} ${designTokens.animation.easing.easeOut}`,
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div
            style={{ textAlign: "center", padding: designTokens.spacing[8] }}
          >
            <div
              style={{
                fontSize: "64px",
                marginBottom: designTokens.spacing[4],
              }}
            >
              🤖
            </div>
            <h2
              style={{
                fontSize: designTokens.typography.fontSize["3xl"],
                marginBottom: designTokens.spacing[4],
              }}
            >
              AI Trading Made Simple
            </h2>
            <p
              style={{
                fontSize: designTokens.typography.fontSize.lg,
                color: designTokens.colors.neutral[600],
                maxWidth: "500px",
                margin: "0 auto",
              }}
            >
              Let our AI agents handle the complexity while you focus on your
              goals. We'll set up everything based on your preferences.
            </p>
          </div>
        );

      case 2:
        return (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(auto-fit, minmax(250px, 1fr))",
                gap: designTokens.spacing[4],
                marginTop: designTokens.spacing[6],
              }}
            >
              {userTypes.map((type) => (
                <Card
                  key={type.id}
                  interactive
                  variant={
                    config.userType === type.id ? "elevated" : "outlined"
                  }
                  style={{
                    cursor: "pointer",
                    border:
                      config.userType === type.id
                        ? `2px solid ${designTokens.colors.primary[500]}`
                        : undefined,
                  }}
                  onClick={() =>
                    setConfig({ ...config, userType: type.id as any })
                  }
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
                        }}
                      >
                        {type.title}
                      </h3>
                      <p
                        style={{
                          margin: `${designTokens.spacing[2]} 0`,
                          color: designTokens.colors.neutral[600],
                        }}
                      >
                        {type.description}
                      </p>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {type.features.map((feature, index) => (
                        <li
                          key={index}
                          style={{
                            padding: `${designTokens.spacing[1]} 0`,
                            display: "flex",
                            alignItems: "center",
                            gap: designTokens.spacing[2],
                            fontSize: designTokens.typography.fontSize.sm,
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
          </div>
        );

      case 3:
        return (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: designTokens.spacing[4],
                marginTop: designTokens.spacing[6],
              }}
            >
              {agentTypes.map((agent) => (
                <Card
                  key={agent.id}
                  interactive
                  variant={
                    config.agentType === agent.id ? "elevated" : "outlined"
                  }
                  style={{
                    cursor: "pointer",
                    border:
                      config.agentType === agent.id
                        ? `2px solid ${designTokens.colors.primary[500]}`
                        : undefined,
                    position: "relative",
                  }}
                  onClick={() =>
                    setConfig({ ...config, agentType: agent.id as any })
                  }
                >
                  {agent.recommended && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-8px",
                        right: "16px",
                        backgroundColor:
                          designTokens.colors.semantic.success[500],
                        color: "white",
                        padding: `${designTokens.spacing[1]} ${designTokens.spacing[2]}`,
                        borderRadius: designTokens.borderRadius.full,
                        fontSize: designTokens.typography.fontSize.xs,
                        fontWeight: designTokens.typography.fontWeight.semibold,
                      }}
                    >
                      Recommended
                    </div>
                  )}
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
                        {agent.icon}
                      </div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: designTokens.typography.fontSize.lg,
                        }}
                      >
                        {agent.title}
                      </h3>
                      <p
                        style={{
                          margin: `${designTokens.spacing[2]} 0`,
                          color: designTokens.colors.neutral[600],
                        }}
                      >
                        {agent.description}
                      </p>
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {agent.features.map((feature, index) => (
                        <li
                          key={index}
                          style={{
                            padding: `${designTokens.spacing[1]} 0`,
                            display: "flex",
                            alignItems: "center",
                            gap: designTokens.spacing[2],
                            fontSize: designTokens.typography.fontSize.sm,
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
          </div>
        );

      case 4:
        return (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                gap: designTokens.spacing[4],
                marginTop: designTokens.spacing[6],
              }}
            >
              {riskLevels.map((risk) => (
                <Card
                  key={risk.id}
                  interactive
                  variant={
                    config.riskLevel === risk.id ? "elevated" : "outlined"
                  }
                  style={{
                    cursor: "pointer",
                    border:
                      config.riskLevel === risk.id
                        ? `2px solid ${designTokens.colors.primary[500]}`
                        : undefined,
                  }}
                  onClick={() =>
                    setConfig({ ...config, riskLevel: risk.id as any })
                  }
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
                        {risk.icon}
                      </div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: designTokens.typography.fontSize.lg,
                        }}
                      >
                        {risk.title}
                      </h3>
                      <p
                        style={{
                          margin: `${designTokens.spacing[2]} 0`,
                          color: designTokens.colors.neutral[600],
                        }}
                      >
                        {risk.description}
                      </p>
                    </div>
                    <div
                      style={{ fontSize: designTokens.typography.fontSize.sm }}
                    >
                      <div style={{ marginBottom: designTokens.spacing[1] }}>
                        <strong>Expected Return:</strong> {risk.expectedReturn}
                      </div>
                      <div>
                        <strong>Max Drawdown:</strong> {risk.maxDrawdown}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div
            style={{ textAlign: "center", padding: designTokens.spacing[8] }}
          >
            <div
              style={{
                fontSize: "64px",
                marginBottom: designTokens.spacing[4],
              }}
            >
              🎉
            </div>
            <h2
              style={{
                fontSize: designTokens.typography.fontSize["2xl"],
                marginBottom: designTokens.spacing[4],
              }}
            >
              You're All Set!
            </h2>
            <div
              style={{
                backgroundColor: designTokens.colors.neutral[50],
                padding: designTokens.spacing[6],
                borderRadius: designTokens.borderRadius.lg,
                marginBottom: designTokens.spacing[6],
              }}
            >
              <h3>Your Configuration:</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: designTokens.spacing[4],
                }}
              >
                <div>
                  <strong>Experience Level:</strong>
                  <br />
                  {userTypes.find((t) => t.id === config.userType)?.title}
                </div>
                <div>
                  <strong>AI Agent:</strong>
                  <br />
                  {agentTypes.find((a) => a.id === config.agentType)?.title}
                </div>
                <div>
                  <strong>Risk Level:</strong>
                  <br />
                  {riskLevels.find((r) => r.id === config.riskLevel)?.title}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: designTokens.spacing[3],
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: designTokens.spacing[2],
                }}
              >
                <input
                  type="checkbox"
                  checked={config.autoStart || false}
                  onChange={(e) =>
                    setConfig({ ...config, autoStart: e.target.checked })
                  }
                />
                Start trading immediately
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {/* Progress Bar */}
      <div style={progressStyle}>
        <div style={progressFillStyle} />
      </div>

      {/* Step Header */}
      <div
        style={{ textAlign: "center", marginBottom: designTokens.spacing[6] }}
      >
        <h1
          style={{
            fontSize: designTokens.typography.fontSize["2xl"],
            margin: 0,
          }}
        >
          {steps[step - 1].title}
        </h1>
        <p
          style={{
            color: designTokens.colors.neutral[600],
            margin: `${designTokens.spacing[2]} 0`,
          }}
        >
          {steps[step - 1].subtitle}
        </p>
      </div>

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: designTokens.spacing[8],
        }}
      >
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={handleBack}>
              ← Back
            </Button>
          )}
        </div>

        <div style={{ display: "flex", gap: designTokens.spacing[2] }}>
          <Button variant="ghost" onClick={onSkip}>
            Skip Setup
          </Button>
          <AnimatedButton
            variant="primary"
            onClick={handleNext}
            disabled={!canProceed()}
            animationType="scale"
          >
            {step === steps.length ? "Start Trading" : "Next"} →
          </AnimatedButton>
        </div>
      </div>
    </div>
  );
};

export default TradingWizard;
