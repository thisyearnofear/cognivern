import React, { useEffect, useState } from "react";
import { css } from "@emotion/react";
import { useParams, useNavigate } from "react-router-dom";
import {
  designTokens,
  shadowSystem,
  keyframeAnimations
} from "../../styles/design-system";
import {
  Card,
  CardContent,
} from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useAgentData } from "../../hooks/useAgentData";
import { AgentType } from "../../types";

const profileContainerStyles = css`
  max-width: 1400px;
  margin: 0 auto;
  padding: ${designTokens.spacing[8]} ${designTokens.spacing[6]};
  ${keyframeAnimations.fadeInUp};
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
  gap: ${designTokens.spacing[10]};
  align-items: center;
  padding: ${designTokens.spacing[12]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius["3xl"]};
  border: 1px solid ${designTokens.colors.neutral[100]};
  position: relative;
  overflow: hidden;
  margin-bottom: ${designTokens.spacing[12]};

  @media (max-width: ${designTokens.breakpoints.md}) {
    grid-template-columns: 1fr;
    text-align: center;
    padding: ${designTokens.spacing[8]};
  }
`;

const avatarContainerStyles = css`
  width: 200px;
  height: 200px;
  border-radius: ${designTokens.borderRadius["2xl"]};
  background: linear-gradient(135deg, ${designTokens.colors.primary[500]}, ${designTokens.colors.primary[800]});
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5rem;
  box-shadow: ${shadowSystem.xl};
  ${keyframeAnimations.parallax(-0.2)};
  transition: transform 0.1s linear;

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
  font-size: ${designTokens.typography.fontSize["2xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[6]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[4]};
  ${keyframeAnimations.revealUp};

  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: ${designTokens.colors.neutral[200]};
  }
`;

const dataGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: ${designTokens.spacing[6]};
`;

const dataItemStyles = css`
  padding: ${designTokens.spacing[6]};
  background: white;
  border-radius: ${designTokens.borderRadius.xl};
  border: 1px solid ${designTokens.colors.neutral[100]};
  box-shadow: ${shadowSystem.sm};
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    box-shadow: ${shadowSystem.md};
    border-color: ${designTokens.colors.primary[200]};
  }
`;

const dataLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: bold;
  margin-bottom: ${designTokens.spacing[2]};
`;

const dataValueStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
`;

const techBadgeStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: ${designTokens.spacing[3]};
`;

const AgentProfile: React.FC = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}`);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const agentType: AgentType = agentId === "vincent" ? "vincent" : "recall";
  const { status, isLoading } = useAgentData(agentType);

  if (isLoading) {
    return <div css={profileContainerStyles}>Loading agent profile...</div>;
  }

  const extendedData = {
    developer: "CogniVern Labs",
    techStack: ["TypeScript", "PyTorch", "EVM", "IPFS", "OpenAI", "React", "Rust"],
    moltbook: "https://moltbook.io/agents/recall-01",
    erc8004: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    registrationDate: "2025-12-10",
    governanceModel: "DAO Managed",
    auditHash: "0x892...31a",
  };

  return (
    <div css={profileContainerStyles}>
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        css={css`margin-bottom: ${designTokens.spacing[10]};`}
      >
        ← Back to Dashboard
      </Button>

      <div css={headerCardStyles}>
        <div css={avatarContainerStyles}>
          {agentType === "recall" ? "🏆" : "🧠"}
        </div>
        <div css={css`${keyframeAnimations.parallax(-0.05)};`}>
          <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[4]}; margin-bottom: ${designTokens.spacing[4]};`}>
            <Badge variant={status.isActive ? "success" : "secondary"}>
              {status.isActive ? "Active" : "Standby"}
            </Badge>
            <span css={css`font-size: ${designTokens.typography.fontSize.sm}; color: ${designTokens.colors.neutral[500]}; font-family: monospace;`}>
              ERC-8004: {extendedData.erc8004.substring(0, 10)}...
            </span>
          </div>
          <h1 css={css`font-size: ${designTokens.typography.fontSize["5xl"]}; font-weight: bold; margin: 0 0 ${designTokens.spacing[4]} 0; letter-spacing: -0.04em;`}>
            {agentType === "recall" ? "Recall Trading Agent" : "Vincent Social Agent"}
          </h1>
          <p css={css`color: ${designTokens.colors.neutral[600]}; font-size: ${designTokens.typography.fontSize.xl}; max-width: 800px; line-height: 1.6;`}>
            {agentType === "recall"
              ? "High-performance algorithmic trading agent specializing in competition-based market making. Built on top of the Recall network for decentralized execution."
              : "Social-sentiment driven agent that executes trades based on real-time social media analysis and community trends using LLM-based sentiment extraction."}
          </p>
        </div>
        <div css={css`display: flex; flex-direction: column; gap: ${designTokens.spacing[4]};`}>
          <Button variant="primary" size="lg">Connect Agent</Button>
          <Button variant="outline" size="lg">Review Governance</Button>
        </div>
      </div>

      <div css={asymmetricGridStyles}>
        <div css={statsColumnStyles}>
          <h2 css={sectionTitleStyles}>Performance</h2>
          <Card variant="elevated">
            <CardContent css={css`padding: ${designTokens.spacing[8]};`}>
              <div css={dataLabelStyles}>Total Return</div>
              <div css={css`font-size: 3rem; font-weight: 800; color: ${designTokens.colors.semantic.success}; letter-spacing: -0.05em;`}>
                +{(status.performance.totalReturn * 100).toFixed(2)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent css={css`padding: ${designTokens.spacing[6]}; display: flex; justify-content: space-between; align-items: center;`}>
              <div>
                <div css={dataLabelStyles}>Win Rate</div>
                <div css={css`font-size: 1.5rem; font-weight: bold;`}>{(status.performance.winRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div css={dataLabelStyles}>Risk Level</div>
                <Badge variant="warning">Medium</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent css={css`padding: ${designTokens.spacing[6]};`}>
              <div css={dataLabelStyles}>Compliance Score</div>
              <div css={css`font-size: 1.5rem; font-weight: bold; margin-bottom: ${designTokens.spacing[2]};`}>{status.performance.complianceScore}%</div>
              <div css={css`height: 8px; background: ${designTokens.colors.neutral[100]}; border-radius: 4px; overflow: hidden;`}>
                <div css={css`height: 100%; width: ${status.performance.complianceScore}%; background: ${designTokens.colors.primary[500]};`} />
              </div>
            </CardContent>
          </Card>
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
            <Card variant="outline" css={css`padding: ${designTokens.spacing[8]}; background: white;`}>
              <div css={css`display: grid; grid-template-columns: 1fr auto; gap: ${designTokens.spacing[12]}; align-items: start;`}>
                <div>
                  <div css={dataLabelStyles}>Proprietary Tech Stack</div>
                  <div css={techBadgeStyles}>
                    {extendedData.techStack.map(tech => (
                      <Badge key={tech} variant="secondary" css={css`padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]}; font-size: ${designTokens.typography.fontSize.sm};`}>
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div css={css`text-align: right;`}>
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
            <Card variant="outline" css={keyframeAnimations.shimmer}>
              <CardContent css={css`display: flex; align-items: center; justify-content: space-between; padding: ${designTokens.spacing[6]};`}>
                <div>
                  <div css={css`font-weight: bold; font-size: ${designTokens.typography.fontSize.lg}; color: ${designTokens.colors.neutral[900]};`}>
                    Security Audit v2.1 Passed
                  </div>
                  <div css={css`${dataLabelStyles}; margin: 0;`}>Verified Hash: {extendedData.auditHash}</div>
                </div>
                <Badge variant="success" size="lg">Verified</Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentProfile;
