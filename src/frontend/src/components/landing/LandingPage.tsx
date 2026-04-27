/** @jsxImportSource @emotion/react */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@emotion/react';
import { designTokens } from '../../styles/design-system';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Shield, Wallet, Key, BarChart3, ArrowRight, Brain, Zap, Globe, Lock } from 'lucide-react';

interface LandingPageProps {
  onComplete?: () => void; // Kept for backward compatibility - now uses routing instead
}

export const LandingPage: React.FC<LandingPageProps> = ({ onComplete }) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const features = [
    {
      icon: <Wallet size={24} />,
      title: 'OWS Wallet Control',
      description: 'Connect encrypted wallets - agents request spend but you control approval',
      accent: designTokens.colors.accent[500],
    },
    {
      icon: <Shield size={24} />,
      title: 'Policy Guardrails',
      description: 'Set limits, require approvals, deny high-risk transactions automatically',
      accent: designTokens.colors.semantic.success[500],
    },
    {
      icon: <Key size={24} />,
      title: 'Scoped API Keys',
      description: 'Give agents limited access - not full wallet control - with revocable keys',
      accent: designTokens.colors.semantic.info[500],
    },
    {
      icon: <BarChart3 size={24} />,
      title: 'Audit Trail',
      description: 'Every decision logged with evidence - know exactly what agents did and why',
      accent: designTokens.colors.semantic.warning[500],
    },
  ];

  const handleGetStarted = () => {
    navigate('/onboarding');
  };

  const handleExplore = () => {
    navigate('/dashboard');
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
        <div
          css={css`
            display: flex;
            align-items: center;
            gap: ${designTokens.spacing[3]};
          `}
        >
          <span
            css={css`
              display: inline-flex;
              align-items: center;
              gap: ${designTokens.spacing[1]};
              padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
              background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
              color: #00d4ff;
              border-radius: ${designTokens.borderRadius.full};
              font-size: ${designTokens.typography.fontSize.xs};
              font-weight: ${designTokens.typography.fontWeight.semibold};
              letter-spacing: 0.05em;
              border: 1px solid rgba(0, 212, 255, 0.3);
            `}
          >
            <Globe size={12} />X Layer Arena
          </span>
          <Button variant="ghost" onClick={handleExplore}>
            Skip to Dashboard →
          </Button>
        </div>
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
            font-size: ${designTokens.typography.fontSize['4xl']};
            font-weight: ${designTokens.typography.fontWeight.bold};
            color: ${designTokens.colors.neutral[900]};
            margin-bottom: ${designTokens.spacing[6]};
            line-height: 1.2;

            @media (max-width: 640px) {
              font-size: ${designTokens.typography.fontSize['3xl']};
            }
          `}
        >
          Give Agents Spending Power
          <br />
          <span
            css={css`
              background: ${designTokens.colorSystem.gradients.accent};
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
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
          Cognivern connects to OWS wallets and lets you set policy guardrails. Agents can request
          spend - you decide what gets approved. Every decision is logged with evidence for your
          audit trail.
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
            { label: 'Multi-Chain', value: '3' },
            { label: 'Audit Coverage', value: '100%' },
            { label: '0G Storage', value: 'Live' },
          ].map((item) => (
            <div
              key={item.label}
              css={css`
                text-align: center;
              `}
            >
              <div
                css={css`
                  font-size: ${designTokens.typography.fontSize['2xl']};
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
                &:hover {
                  border-color: ${feature.accent};
                  box-shadow: 0 0 20px ${feature.accent}30;
                  transform: translateY(-4px);
                }
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
                    background: ${feature.accent}15;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: ${feature.accent};
                    transition: all 0.3s ease;
                    &:hover {
                      transform: scale(1.1);
                      background: ${feature.accent}25;
                    }
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

        {/* Multi-Chain Section */}
        <div
          css={css`
            margin-top: ${designTokens.spacing[12]};
            padding: ${designTokens.spacing[8]};
            background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
            border-radius: ${designTokens.borderRadius.xl};
            border: 1px solid rgba(0, 212, 255, 0.2);
            text-align: left;
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[2]};
              margin-bottom: ${designTokens.spacing[4]};
            `}
          >
            <Globe size={20} color="#00d4ff" />
            <h2
              css={css`
                font-size: ${designTokens.typography.fontSize.lg};
                font-weight: ${designTokens.typography.fontWeight.semibold};
                color: #00d4ff;
                margin: 0;
              `}
            >
              Multi-Chain Architecture
            </h2>
          </div>
          <div
            css={css`
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: ${designTokens.spacing[6]};
              @media (max-width: 768px) {
                grid-template-columns: 1fr;
              }
            `}
          >
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                <Zap size={16} color="#00d4ff" />
                <span
                  css={css`
                    color: #00d4ff;
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    font-size: ${designTokens.typography.fontSize.sm};
                  `}
                >
                  X Layer (Execution)
                </span>
              </div>
              <p
                css={css`
                  color: rgba(255, 255, 255, 0.6);
                  font-size: ${designTokens.typography.fontSize.sm};
                  margin: 0 0 ${designTokens.spacing[2]} 0;
                `}
              >
                Agent spend approvals &amp; policy enforcement on OKX's zkEVM L2
              </p>
              <code
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: rgba(0, 212, 255, 0.7);
                  word-break: break-all;
                `}
              >
                0x755602bB...e2DD6
              </code>
              <a
                href="https://www.okx.com/explorer/xlayer-test/address/0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6"
                target="_blank"
                rel="noopener noreferrer"
                css={css`
                  display: inline-block;
                  margin-top: ${designTokens.spacing[2]};
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: #00d4ff;
                  text-decoration: none;
                  &:hover {
                    text-decoration: underline;
                  }
                `}
              >
                View on Explorer ↗
              </a>
            </div>
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                <Lock size={16} color="#a78bfa" />
                <span
                  css={css`
                    color: #a78bfa;
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    font-size: ${designTokens.typography.fontSize.sm};
                  `}
                >
                  Filecoin (Audit Archive)
                </span>
              </div>
              <p
                css={css`
                  color: rgba(255, 255, 255, 0.6);
                  font-size: ${designTokens.typography.fontSize.sm};
                  margin: 0 0 ${designTokens.spacing[2]} 0;
                `}
              >
                Long-term immutable governance records on decentralized storage
              </p>
              <code
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: rgba(167, 139, 250, 0.7);
                  word-break: break-all;
                `}
              >
                Filecoin Calibration Testnet
              </code>
              <a
                href="https://calibration.filfox.info/en/address/0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada"
                target="_blank"
                rel="noopener noreferrer"
                css={css`
                  display: inline-block;
                  margin-top: ${designTokens.spacing[2]};
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: #a78bfa;
                  text-decoration: none;
                  &:hover {
                    text-decoration: underline;
                  }
                `}
              >
                View on Explorer ↗
              </a>
            </div>
            <div>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  gap: ${designTokens.spacing[2]};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                <Globe size={16} color="#34d399" />
                <span
                  css={css`
                    color: #34d399;
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    font-size: ${designTokens.typography.fontSize.sm};
                  `}
                >
                  0G Network (Live Audit)
                </span>
              </div>
              <p
                css={css`
                  color: rgba(255, 255, 255, 0.6);
                  font-size: ${designTokens.typography.fontSize.sm};
                  margin: 0 0 ${designTokens.spacing[2]} 0;
                `}
              >
                Every governance decision anchored to 0G decentralized storage in real-time
              </p>
              <code
                css={css`
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: rgba(52, 211, 153, 0.7);
                  word-break: break-all;
                `}
              >
                0G Newton Testnet · Track 3
              </code>
              <a
                href="https://storagescan.0g.ai/"
                target="_blank"
                rel="noopener noreferrer"
                css={css`
                  display: inline-block;
                  margin-top: ${designTokens.spacing[2]};
                  font-size: ${designTokens.typography.fontSize.xs};
                  color: #34d399;
                  text-decoration: none;
                  &:hover {
                    text-decoration: underline;
                  }
                `}
              >
                View on Explorer ↗
              </a>
            </div>
          </div>
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
            Our guided setup walks you through connecting a wallet and setting your first policy in
            under 2 minutes.
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
        Built for X Layer Arena & 0G APAC Hackathon · Multi-Chain: X Layer + Filecoin + 0G · Open
        Wallet Standard Compliant
      </footer>
    </div>
  );
};

export default LandingPage;
