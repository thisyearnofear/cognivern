/** @jsxImportSource @emotion/react */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { css } from "@emotion/react";
import { designTokens } from "../../styles/design-system";
import { useAppStore } from "../../stores/appStore";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import {
  Shield,
  Wallet,
  Key,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  Brain,
  Zap,
} from "lucide-react";

interface LandingPageProps {
  onComplete: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const { preferences } = useAppStore();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: <Wallet size={24} />,
      title: "OWS Wallet Control",
      description:
        "Connect encrypted wallets - agents can request spend but you control approval",
    },
    {
      icon: <Shield size={24} />,
      title: "Policy Guardrails",
      description:
        "Set limits, require approvals, deny high-risk transactions automatically",
    },
    {
      icon: <Key size={24} />,
      title: "Scoped API Keys",
      description:
        "Give agents limited access - not full wallet control - with revocable keys",
    },
    {
      icon: <BarChart3 size={24} />,
      title: "Audit Trail",
      description:
        "Every decision logged with evidence - know exactly what agents did and why",
    },
  ];

  const handleGetStarted = () => {
    onComplete();
  };

  const handleExplore = () => {
    navigate("/");
  };

  return (
    <div
      css={css`
        min-height: 100vh;
        background: linear-gradient(
          135deg,
          ${designTokens.colors.neutral[50]} 0%,
          ${designTokens.colors.primary[50]} 50%,
          ${designTokens.colors.neutral[100]} 100%
        );
        padding: ${designTokens.spacing[8]};
        display: flex;
        flex-direction: column;
        align-items: center;
      `}
    >
      {/* Header */}
      <header
        css={css`
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          max-width: 1200px;
          margin-bottom: ${designTokens.spacing[12]};
          opacity: ${isVisible ? 1 : 0};
          transform: translateY(${isVisible ? 0 : -20}px);
          transition: all 0.5s ease-out;
        `}
      >
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[3]};
          `}
        >
          <div
            css={css`
              width: 48px;
              height: 48px;
              border-radius: ${designTokens.borderRadius.lg};
              background: ${designTokens.colors.primary[600]};
              display: flex;
              align-items: center;
              justify-content: center;
            `}
          >
            <Brain size={28} color="white" />
          </div>
          <span
            css={css`
              font-size: ${designTokens.typography.fontSize.xl};
              font-weight: ${designTokens.typography.fontWeight.bold};
              color: ${designTokens.colors.neutral[900]};
            `}
          >
            Cognivern
          </span>
        </div>
        <Button variant="ghost" onClick={handleExplore}>
          Skip to Dashboard →
        </Button>
      </header>

      {/* Hero */}
      <main
        css={css`
          max-width: 800px;
          text-align: center;
          opacity: ${isVisible ? 1 : 0};
          transform: translateY(${isVisible ? 0 : 20}px);
          transition: all 0.6s ease-out 0.2s;
        `}
      >
        <div
          css={css`
            margin-bottom: ${designTokens.spacing[4]};
          `}
        >
          <span
            css={css`
              display: inline-block;
              padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
              background: ${designTokens.colors.primary[100]};
              color: ${designTokens.colors.primary[700]};
              border-radius: ${designTokens.borderRadius.full};
              font-size: ${designTokens.typography.fontSize.sm};
              font-weight: ${designTokens.typography.fontWeight.medium};
            `}
          >
            SpendOS for Autonomous Agents
          </span>
        </div>

        <h1
          css={css`
            font-size: ${designTokens.typography.fontSize["4xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            color: ${designTokens.colors.neutral[900]};
            margin-bottom: ${designTokens.spacing[6]};
            line-height: 1.2;

            @media (max-width: 640px) {
              font-size: ${designTokens.typography.fontSize["3xl"]};
            }
          `}
        >
          Give Agents Spending Power
          <br />
          <span
            css={css`
              color: ${designTokens.colors.primary[600]};
            `}
          >
            Without Giving Them a Blank Check
          </span>
        </h1>

        <p
          css={css`
            font-size: ${designTokens.typography.fontSize.lg};
            color: ${designTokens.colors.neutral[600]};
            max-width: 600px;
            margin: 0 auto ${designTokens.spacing[8]};
            line-height: ${designTokens.typography.lineHeight.relaxed};
          `}
        >
          Cognivern connects to OWS wallets and lets you set policy guardrails.
          Agents can request spend - you decide what gets approved. Every
          decision is logged with evidence for your audit trail.
        </p>

        <div
          css={css`
            display: flex;
            gap: ${designTokens.spacing[4]};
            justify-content: center;
            flex-wrap: wrap;
            margin-bottom: ${designTokens.spacing[12]};
          `}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={handleGetStarted}
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
            `}
          >
            Get Started <ArrowRight size={20} />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleExplore}
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
            `}
          >
            Explore Demo <Zap size={18} />
          </Button>
        </div>

        {/* Social Proof */}
        <div
          css={css`
            display: flex;
            justify-content: center;
            gap: ${designTokens.spacing[8]};
            margin-bottom: ${designTokens.spacing[12]};
            flex-wrap: wrap;
          `}
        >
          {[
            { label: "Policy Enforcement", value: "100%" },
            { label: "Audit Coverage", value: "100%" },
            { label: "Wallet Types", value: "EVM" },
          ].map((item) => (
            <div
              key={item.label}
              css={css`
                text-align: center;
              `}
            >
              <div
                css={css`
                  font-size: ${designTokens.typography.fontSize["2xl"]};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  color: ${designTokens.colors.primary[600]};
                `}
              >
                {item.value}
              </div>
              <div
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[500]};
                `}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div
          css={css`
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: ${designTokens.spacing[6]};
            text-align: left;
          `}
        >
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              variant="outlined"
              css={css`
                opacity: ${isVisible ? 1 : 0};
                transform: translateY(${isVisible ? 0 : 20}px);
                transition: all 0.4s ease-out ${0.4 + index * 0.1}s;
              `}
            >
              <CardContent
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: ${designTokens.spacing[3]};
                  padding: ${designTokens.spacing[6]};
                `}
              >
                <div
                  css={css`
                    width: 48px;
                    height: 48px;
                    border-radius: ${designTokens.borderRadius.lg};
                    background: ${designTokens.colors.primary[50]};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${designTokens.colors.primary[600]};
                  `}
                >
                  {feature.icon}
                </div>
                <h3
                  css={css`
                    font-size: ${designTokens.typography.fontSize.lg};
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    color: ${designTokens.colors.neutral[900]};
                    margin: 0;
                  `}
                >
                  {feature.title}
                </h3>
                <p
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                    margin: 0;
                    line-height: ${designTokens.typography.lineHeight.relaxed};
                  `}
                >
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div
          css={css`
            margin-top: ${designTokens.spacing[12]};
            padding: ${designTokens.spacing[8]};
            background: ${designTokens.colors.neutral[0]};
            border-radius: ${designTokens.borderRadius.xl};
            border: 1px solid ${designTokens.colors.neutral[200]};
          `}
        >
          <h2
            css={css`
              font-size: ${designTokens.typography.fontSize.xl};
              font-weight: ${designTokens.typography.fontWeight.semibold};
              margin-bottom: ${designTokens.spacing[4]};
            `}
          >
            Ready to try it?
          </h2>
          <p
            css={css`
              color: ${designTokens.colors.neutral[600]};
              margin-bottom: ${designTokens.spacing[6]};
            `}
          >
            Our guided setup walks you through connecting a wallet and setting
            your first policy in under 2 minutes.
          </p>
          <Button variant="primary" size="lg" onClick={handleGetStarted}>
            Start Setup Wizard →
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer
        css={css`
          margin-top: ${designTokens.spacing[12]};
          color: ${designTokens.colors.neutral[400]};
          font-size: ${designTokens.typography.fontSize.sm};
        `}
      >
        Built for the OWS Hackathon · Open Wallet Standard Compliant
      </footer>
    </div>
  );
};

export default LandingPage;
