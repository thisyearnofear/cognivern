import React, { useEffect } from 'react';
import { css } from '@emotion/react';
import { useParams, useNavigate } from 'react-router-dom';
import { designTokens, keyframeAnimations, easings } from '../../styles/design-system';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAgentData } from '../../hooks/useAgentData';
import { AgentType } from '../../types';
import VoiceBriefing from './VoiceBriefing';

const profileContainerStyles = css`
  max-width: 1400px;
  margin: 0 auto;
  padding: ${designTokens.spacing[8]} ${designTokens.spacing[6]};
  animation: ${keyframeAnimations.fadeInUp} 0.8s ${easings.out};
  --scroll-y: 0;
`;

const asymmetricGridStyles = css`
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: ${designTokens.spacing[8]};

  @media (max-width: ${designTokens.breakpoints.lg}) {
    display: flex;
    flex-direction: column;
  }
`;

const headerCardStyles = css`
  grid-column: span 12;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: ${designTokens.spacing[12]};
  align-items: center;
  padding: ${designTokens.spacing[16]};
  background: radial-gradient(
    circle at 0% 0%,
    ${designTokens.colors.primary[50]} 0%,
    rgba(255, 255, 255, 0.9) 100%
  );
  backdrop-filter: blur(20px);
  border-radius: ${designTokens.borderRadius['3xl']};
  border: 1px solid ${designTokens.colors.neutral[200]};
  position: relative;
  overflow: hidden;
  margin-bottom: ${designTokens.spacing[12]};
  box-shadow: 0 40px 80px -20px rgba(0, 0, 0, 0.08);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      linear-gradient(${designTokens.colors.neutral[200]} 1px, transparent 1px),
      linear-gradient(90deg, ${designTokens.colors.neutral[200]} 1px, transparent 1px);
    background-size: 32px 32px;
    opacity: 0.05;
    pointer-events: none;
  }

  @media (max-width: ${designTokens.breakpoints.md}) {
    grid-template-columns: 1fr;
    text-align: center;
    padding: ${designTokens.spacing[10]};
    gap: ${designTokens.spacing[8]};
  }
`;

const avatarContainerStyles = css`
  width: 240px;
  height: 240px;
  border-radius: ${designTokens.borderRadius['2xl']};
  background: linear-gradient(
    135deg,
    ${designTokens.colors.primary[600]} 0%,
    ${designTokens.colors.primary[900]} 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 6rem;
  font-weight: 800;
  color: white;
  box-shadow: 0 30px 60px -12px rgba(15, 23, 42, 0.3);
  position: relative;
  z-index: 1;
  border: 4px solid white;

  &::after {
    content: '';
    position: absolute;
    inset: -10px;
    border: 1px solid ${designTokens.colors.primary[200]};
    border-radius: inherit;
    opacity: 0.5;
  }

  @media (max-width: ${designTokens.breakpoints.md}) {
    margin: 0 auto;
  }
`;

const statsColumnStyles = css`
  grid-column: span 4;
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[6]};

  @media (max-width: ${designTokens.breakpoints.lg}) {
    grid-column: span 12;
  }
`;

const mainContentColumnStyles = css`
  grid-column: span 8;
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[12]};

  @media (max-width: ${designTokens.breakpoints.lg}) {
    grid-column: span 12;
  }
`;

const infoSectionStyles = css`
  margin-bottom: ${designTokens.spacing[4]};
`;

const sectionTitleStyles = css`
  font-size: ${designTokens.typography.fontSize['xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[700]};
  margin-bottom: ${designTokens.spacing[8]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[4]};
  text-transform: uppercase;
  letter-spacing: 0.15em;

  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, ${designTokens.colors.primary[100]}, transparent);
  }
`;

const dataGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: ${designTokens.spacing[6]};
`;

const dataItemStyles = css`
  padding: ${designTokens.spacing[8]};
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: ${designTokens.borderRadius.xl};
  border: 1px solid ${designTokens.colors.neutral[100]};
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.04);
  transition: all 0.4s ${easings.out};

  &:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.1);
    border-color: ${designTokens.colors.primary[200]};
  }
`;

const dataLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[400]};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: bold;
  margin-bottom: ${designTokens.spacing[3]};
`;

const dataValueStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  letter-spacing: -0.01em;
`;

const techBadgeStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: ${designTokens.spacing[3]};
`;

const AgentProfile: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}`);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const agentType: AgentType = agentId === 'vincent' ? 'vincent' : 'recall';
  const { status, isLoading } = useAgentData(agentType);

  if (isLoading) {
    return <div css={profileContainerStyles}>Loading agent profile...</div>;
  }

  const extendedData = {
    developer: 'CogniVern Labs',
    techStack: ['TypeScript', 'PyTorch', 'EVM', 'IPFS', 'OpenAI', 'React', 'Rust'],
    moltbook: 'https://moltbook.io/agents/recall-01',
    erc8004: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    registrationDate: '2025-12-10',
    governanceModel: 'DAO Managed',
    auditHash: '0x892...31a',
  };

  return (
    <div css={profileContainerStyles}>
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        css={css`
          margin-bottom: ${designTokens.spacing[10]};
          color: ${designTokens.colors.neutral[500]};
          &:hover {
            color: ${designTokens.colors.primary[600]};
          }
        `}
      >
        ← Return to Operations Dashboard
      </Button>

      <div css={headerCardStyles}>
        <div css={avatarContainerStyles}>{agentType === 'recall' ? 'RC' : 'VC'}</div>
        <div
          css={css`
            padding: 0 ${designTokens.spacing[4]};
          `}
        >
          <div
            css={css`
              display: flex;
              align-items: center;
              gap: ${designTokens.spacing[3]};
              margin-bottom: ${designTokens.spacing[6]};
            `}
          >
            <Badge
              variant={status.isActive ? 'success' : 'secondary'}
              css={css`
                padding: ${designTokens.spacing[1]} ${designTokens.spacing[4]};
                font-weight: 800;
                letter-spacing: 0.05em;
                box-shadow: 0 4px 12px
                  ${status.isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0,0,0,0.1)'};
              `}
            >
              {status.isActive ? 'LIVE OPERATIONAL' : 'STANDBY MODE'}
            </Badge>
            <div
              css={css`
                height: 4px;
                width: 4px;
                border-radius: 50%;
                background: ${designTokens.colors.neutral[300]};
              `}
            />
            <span
              css={css`
                font-size: ${designTokens.typography.fontSize.xs};
                color: ${designTokens.colors.neutral[500]};
                font-family: ${designTokens.typography.fontFamily.mono};
                font-weight: 600;
                letter-spacing: 0.1em;
              `}
            >
              REGISTRY: {extendedData.erc8004.substring(0, 14).toUpperCase()}
            </span>
          </div>
          <h1
            css={css`
              font-size: ${designTokens.typography.fontSize['5xl']};
              font-weight: 800;
              margin: 0 0 ${designTokens.spacing[4]} 0;
              letter-spacing: -0.04em;
              background: linear-gradient(
                135deg,
                ${designTokens.colors.neutral[900]} 0%,
                ${designTokens.colors.primary[800]} 100%
              );
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            `}
          >
            {agentType === 'recall' ? 'Recall Intelligence' : 'Vincent Procurement'}
          </h1>
          <p
            css={css`
              color: ${designTokens.colors.neutral[600]};
              font-size: ${designTokens.typography.fontSize.xl};
              max-width: 800px;
              line-height: 1.6;
              font-weight: 400;
            `}
          >
            {agentType === 'recall'
              ? 'Multi-agent coordination specialist for deep context gathering and policy-aware findings synthesis.'
              : 'Autonomous execution specialist focused on supplier negotiation and budget-scoped transactional governance.'}
          </p>
        </div>
        <div
          css={css`
            display: flex;
            flex-direction: column;
            gap: ${designTokens.spacing[4]};
            min-width: 200px;
          `}
        >
          <Button
            variant="primary"
            size="lg"
            css={css`
              height: 56px;
              font-weight: 700;
            `}
          >
            Manage Deployment
          </Button>
          <Button
            variant="outline"
            size="lg"
            css={css`
              height: 56px;
              background: white;
            `}
          >
            Review Governance
          </Button>
        </div>
      </div>

      <div css={asymmetricGridStyles}>
        <div css={statsColumnStyles}>
          <h2 css={sectionTitleStyles}>Performance</h2>
          <Card variant="elevated">
            <CardContent
              css={css`
                padding: ${designTokens.spacing[8]};
              `}
            >
              <div css={dataLabelStyles}>Total Return</div>
              <div
                css={css`
                  font-size: 3rem;
                  font-weight: 800;
                  color: ${designTokens.colors.semantic.success};
                  letter-spacing: -0.05em;
                `}
              >
                +{((status.performance?.totalReturn ?? 0) * 100).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent
              css={css`
                padding: ${designTokens.spacing[6]};
                display: flex;
                justify-content: space-between;
                align-items: center;
              `}
            >
              <div>
                <div css={dataLabelStyles}>Win Rate</div>
                <div
                  css={css`
                    font-size: 1.5rem;
                    font-weight: bold;
                  `}
                >
                  {((status.performance?.winRate ?? 0) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div css={dataLabelStyles}>Risk Level</div>
                <Badge variant="warning">Medium</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent
              css={css`
                padding: ${designTokens.spacing[6]};
              `}
            >
              <div css={dataLabelStyles}>Compliance Score</div>
              <div
                css={css`
                  font-size: 1.5rem;
                  font-weight: bold;
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                {status.performance?.complianceScore ?? 0}%
              </div>
              <div
                css={css`
                  height: 8px;
                  background: ${designTokens.colors.neutral[100]};
                  border-radius: 4px;
                  overflow: hidden;
                `}
              >
                <div
                  css={css`
                    height: 100%;
                    width: ${status.performance?.complianceScore ?? 0}%;
                    background: ${designTokens.colors.primary[500]};
                  `}
                />
              </div>
            </CardContent>
          </Card>

          <VoiceBriefing agentId={agentId || 'recall'} />
        </div>

        <div css={mainContentColumnStyles}>
          <div css={infoSectionStyles}>
            <h2 css={sectionTitleStyles}>Identity & Trust</h2>
            <div css={dataGridStyles}>
              <div css={dataItemStyles}>
                <div css={dataLabelStyles}>Developer</div>
                <div css={dataValueStyles}>{extendedData.developer}</div>
              </div>
              <div css={dataItemStyles}>
                <div css={dataLabelStyles}>Governance</div>
                <div css={dataValueStyles}>{extendedData.governanceModel}</div>
              </div>
              <div css={dataItemStyles}>
                <div css={dataLabelStyles}>Registration Date</div>
                <div css={dataValueStyles}>{extendedData.registrationDate}</div>
              </div>
              <div css={dataItemStyles}>
                <div css={dataLabelStyles}>Verification</div>
                <Badge variant="success">Fully Audited</Badge>
              </div>
            </div>
          </div>

          <div css={infoSectionStyles}>
            <h2 css={sectionTitleStyles}>Technical Foundation</h2>
            <Card
              variant="outlined"
              css={css`
                padding: ${designTokens.spacing[8]};
                background: white;
              `}
            >
              <div
                css={css`
                  display: grid;
                  grid-template-columns: 1fr auto;
                  gap: ${designTokens.spacing[12]};
                  align-items: start;
                `}
              >
                <div>
                  <div css={dataLabelStyles}>Proprietary Tech Stack</div>
                  <div css={techBadgeStyles}>
                    {extendedData.techStack.map((tech) => (
                      <Badge
                        key={tech}
                        variant="secondary"
                        css={css`
                          padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
                          font-size: ${designTokens.typography.fontSize.sm};
                        `}
                      >
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div
                  css={css`
                    text-align: right;
                  `}
                >
                  <div css={dataLabelStyles}>Public Registry</div>
                  <a
                    href={extendedData.moltbook}
                    target="_blank"
                    rel="noopener noreferrer"
                    css={css`
                      display: inline-flex;
                      align-items: center;
                      gap: ${designTokens.spacing[2]};
                      color: ${designTokens.colors.primary[600]};
                      text-decoration: none;
                      font-weight: 600;
                      padding: ${designTokens.spacing[3]} ${designTokens.spacing[5]};
                      background: ${designTokens.colors.primary[50]};
                      border-radius: ${designTokens.borderRadius.lg};
                      transition: all 0.2s ease;
                      &:hover {
                        background: ${designTokens.colors.primary[100]};
                        transform: translateY(-2px);
                      }
                    `}
                  >
                    Moltbook ↗
                  </a>
                </div>
              </div>
            </Card>
          </div>

          <div css={infoSectionStyles}>
            <h2 css={sectionTitleStyles}>Security Audit</h2>
            <Card variant="outlined" css={keyframeAnimations.shimmer}>
              <CardContent
                css={css`
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  padding: ${designTokens.spacing[6]};
                `}
              >
                <div>
                  <div
                    css={css`
                      font-weight: bold;
                      font-size: ${designTokens.typography.fontSize.lg};
                      color: ${designTokens.colors.neutral[900]};
                    `}
                  >
                    Security Audit v2.1 Passed
                  </div>
                  <div
                    css={css`
                      ${dataLabelStyles};
                      margin: 0;
                    `}
                  >
                    Verified Hash: {extendedData.auditHash}
                  </div>
                </div>
                <Badge variant="success" size="lg">
                  Verified
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfile;
