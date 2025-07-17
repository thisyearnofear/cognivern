import React, { useState, useEffect } from 'react';
import { css } from '@emotion/react';
import { 
  designTokens, 
  colorSystem, 
  shadowSystem, 
  keyframeAnimations, 
  layoutUtils 
} from '../../styles/design-system';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { getApiUrl } from '../../utils/api';
import BlockchainStatus from '../blockchain/BlockchainStatus';

interface DashboardProps {
  userType: string;
}

interface AgentMonitoringData {
  id: string;
  name: string;
  type: 'trading' | 'analysis' | 'monitoring';
  status: 'active' | 'idle' | 'error' | 'maintenance';
  lastActivity: string;
  performance: {
    uptime: number;
    successRate: number;
    avgResponseTime: number;
    actionsToday: number;
  };
  riskMetrics: {
    currentRiskScore: number;
    violationsToday: number;
    complianceRate: number;
  };
  financialMetrics?: {
    totalValue: number;
    dailyPnL: number;
    winRate: number;
  };
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  components: {
    blockchain: 'online' | 'degraded' | 'offline';
    policies: 'active' | 'warning' | 'error';
    audit: 'logging' | 'delayed' | 'failed';
    ai: 'operational' | 'limited' | 'unavailable';
  };
  metrics: {
    totalAgents: number;
    activeAgents: number;
    totalActions: number;
    complianceRate: number;
  };
}

interface AIRecommendation {
  id: string;
  type: 'optimization' | 'security' | 'performance' | 'compliance';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  actionRequired: boolean;
  estimatedBenefit?: string;
}

const containerStyles = css`
  ${layoutUtils.container}
  padding: ${designTokens.spacing[6]};
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
`;

const heroStyles = css`
  text-align: center;
  margin-bottom: ${designTokens.spacing[8]};
  ${keyframeAnimations.fadeInUp}
`;

const heroTitleStyles = css`
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: ${designTokens.typography.fontWeight.bold};
  line-height: ${designTokens.typography.lineHeight.tight};
  background: ${colorSystem.gradients.primary};
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: ${designTokens.spacing[4]};
`;

const heroSubtitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  color: ${designTokens.colors.neutral[600]};
  max-width: 700px;
  margin: 0 auto ${designTokens.spacing[6]};
`;

const systemHealthStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${designTokens.spacing[4]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const healthCardStyles = css`
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${colorSystem.gradients.success};
  }
  
  &.warning::before {
    background: ${colorSystem.gradients.warning};
  }
  
  &.critical::before {
    background: ${colorSystem.gradients.error};
  }
`;

const statusIndicatorStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  margin-bottom: ${designTokens.spacing[2]};
`;

const statusDotStyles = css`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  
  &.online, &.healthy, &.active, &.logging, &.operational {
    background: ${designTokens.colors.semantic.success[500]};
    box-shadow: 0 0 8px ${designTokens.colors.semantic.success[300]};
    ${keyframeAnimations.pulse}
  }
  
  &.degraded, &.warning, &.delayed, &.limited {
    background: ${designTokens.colors.semantic.warning[500]};
    ${keyframeAnimations.pulse}
  }
  
  &.offline, &.critical, &.error, &.failed, &.unavailable {
    background: ${designTokens.colors.semantic.error[500]};
    ${keyframeAnimations.pulse}
  }
  
  &.idle, &.maintenance {
    background: ${designTokens.colors.neutral[400]};
  }
`;

const agentGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: ${designTokens.spacing[6]};
  margin-bottom: ${designTokens.spacing[8]};
`;

const agentCardStyles = css`
  position: relative;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: ${shadowSystem.xl};
  }
`;

const agentHeaderStyles = css`
  display: flex;
  justify-content: between;
  align-items: start;
  margin-bottom: ${designTokens.spacing[4]};
`;

const agentTypeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  background: ${designTokens.colors.primary[100]};
  color: ${designTokens.colors.primary[700]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
`;

const metricsGridStyles = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${designTokens.spacing[3]};
  margin-bottom: ${designTokens.spacing[4]};
`;

const metricItemStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[3]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
`;

const metricValueStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[1]};
`;

const metricLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[600]};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const recommendationsStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: ${designTokens.spacing[4]};
`;

const recommendationCardStyles = css`
  border-left: 4px solid ${designTokens.colors.primary[500]};
  
  &.security {
    border-left-color: ${designTokens.colors.semantic.error[500]};
  }
  
  &.performance {
    border-left-color: ${designTokens.colors.semantic.warning[500]};
  }
  
  &.compliance {
    border-left-color: ${designTokens.colors.semantic.info[500]};
  }
  
  &.optimization {
    border-left-color: ${designTokens.colors.semantic.success[500]};
  }
`;

const priorityBadgeStyles = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  
  &.low {
    background: ${designTokens.colors.semantic.success[100]};
    color: ${designTokens.colors.semantic.success[700]};
  }
  
  &.medium {
    background: ${designTokens.colors.semantic.warning[100]};
    color: ${designTokens.colors.semantic.warning[700]};
  }
  
  &.high {
    background: ${designTokens.colors.semantic.error[100]};
    color: ${designTokens.colors.semantic.error[700]};
  }
  
  &.critical {
    background: ${designTokens.colors.semantic.error[500]};
    color: white;
  }
`;

const StatValue = css`
  font-size: ${designTokens.typography.fontSize['4xl']};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.primary[600]};
  margin-bottom: ${designTokens.spacing[2]};
  ${keyframeAnimations.scaleIn}
`;

const StatLabel = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[500]};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: ${designTokens.typography.fontWeight.medium};
  margin-bottom: ${designTokens.spacing[4]};
`;

const StatDescription = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  line-height: ${designTokens.typography.lineHeight.relaxed};
`;

const SectionTitle = css`
  font-size: ${designTokens.typography.fontSize['2xl']};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[6]};
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  
  &::before {
    content: '';
    width: 4px;
    height: 24px;
    background: ${colorSystem.gradients.primary};
    border-radius: ${designTokens.borderRadius.full};
  }
`;

const ContentSection = css`
  margin-bottom: ${designTokens.spacing[12]};
  ${keyframeAnimations.slideInRight}
`;

const StatusIndicator = css`
  display: inline-flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
  background: ${designTokens.colors.semantic.success[50]};
  color: ${designTokens.colors.semantic.success[700]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  border: 1px solid ${designTokens.colors.semantic.success[200]};
`;

const StatusDot = css`
  width: 8px;
  height: 8px;
  background: ${designTokens.colors.semantic.success[500]};
  border-radius: 50%;
  ${modernDesignSystem.animations.pulse}
`;

const ActionGrid = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${designTokens.spacing[6]};
  margin-top: ${designTokens.spacing[8]};
`;

const ActionCard = css`
  ${getModernCardStyles('glass')}
  padding: ${designTokens.spacing[6]};
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: ${modernDesignSystem.shadows.glow.primary};
  }
`;

const ActionIcon = css`
  font-size: 3rem;
  margin-bottom: ${designTokens.spacing[4]};
  display: block;
  ${modernDesignSystem.animations.float}
`;

const ActionTitle = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[2]};
`;

const ActionDescription = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  line-height: ${designTokens.typography.lineHeight.relaxed};
  margin-bottom: ${designTokens.spacing[4]};
`;

const DifficultyBadge = css`
  display: inline-block;
  padding: ${designTokens.spacing[1]} ${designTokens.spacing[3]};
  background: ${modernDesignSystem.colors.gradients.success};
  color: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.xs};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const LoadingState = css`
  ${modernDesignSystem.layout.flexCenter}
  min-height: 200px;
  flex-direction: column;
  gap: ${designTokens.spacing[4]};
`;

const LoadingSpinner = css`
  width: 40px;
  height: 40px;
  border: 3px solid ${designTokens.colors.neutral[200]};
  border-top: 3px solid ${designTokens.colors.primary[500]};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default function ModernDashboard({ userType }: DashboardProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [agentData, setAgentData] = useState<AgentMonitoringData[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch real data on component mount
  useEffect(() => {
    fetchRealData();
  }, []);

  const fetchRealData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      // Simulate loading delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Fetch unified dashboard data
      try {
        const unifiedResponse = await fetch(getApiUrl("/api/dashboard/unified"), {
          headers,
        });
        if (unifiedResponse.ok) {
          const unifiedData = await unifiedResponse.json();
          setGovernanceStats({
            status: "active",
            totalActions: unifiedData.competition.totalActions,
            totalAgents: unifiedData.competition.activeAgents,
            approvalRate: unifiedData.competition.approvalRate,
            totalViolations: unifiedData.competition.policyViolations,
            isRealData: true,
          });
        }
      } catch (err) {
        // Fallback to demo data
        setGovernanceStats({
          status: "active",
          totalActions: 1247,
          totalAgents: 3,
          approvalRate: 98.5,
          totalViolations: 2,
          isRealData: false,
        });
      }

      // Fetch trading status
      try {
        const tradingResponse = await fetch(getApiUrl("/api/trading/status"), {
          headers,
        });
        if (tradingResponse.ok) {
          const status = await tradingResponse.json();
          setTradingStatus(status);
        }
      } catch (err) {
        // Fallback status
        setTradingStatus({
          recallTradingAPI: { configured: true, baseUrl: "https://api.recall.net" },
          filecoinGovernance: { configured: true, contractAddress: "0x..." },
          existingServices: { tradingCompetition: true, metrics: true, auditLog: true },
        });
      }

      // Set demo policies
      setPolicies([
        {
          id: "1",
          name: "Risk Management Policy",
          description: "Automated risk assessment and mitigation rules",
          status: "active",
          rules: ["Max position size: 10%", "Stop loss: 5%", "Daily limit: $1000"],
        },
        {
          id: "2",
          name: "Trading Hours Policy",
          description: "Defines when AI agents can execute trades",
          status: "active",
          rules: ["Market hours only", "No weekend trading", "Emergency override available"],
        },
      ]);

      // Set demo agents
      setAgents([
        {
          id: "recall-agent-1",
          name: "Recall Trading Agent",
          type: "recall",
          status: "active",
          policy: "Trading Competition Policy",
          violations: 0,
          description: "Competition-focused trading agent with proven strategies",
          avatar: "🏆",
        },
        {
          id: "vincent-agent-1",
          name: "Vincent Social Agent",
          type: "vincent",
          status: "active",
          policy: "Social Trading Policy",
          violations: 0,
          description: "Social sentiment-based trading decisions",
          avatar: "📊",
        },
      ]);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = {
    explorer: [
      {
        title: "Explore Live Data",
        description: "View real-time blockchain transactions and AI agent activities",
        icon: "🔗",
        difficulty: "Easy",
        action: () => console.log("Navigate to live data"),
      },
      {
        title: "Learn About Governance",
        description: "Understand how AI agents are governed and controlled",
        icon: "📚",
        difficulty: "Easy",
        action: () => console.log("Navigate to governance docs"),
      },
      {
        title: "View Agent Performance",
        description: "See how AI agents are performing in real-time",
        icon: "📈",
        difficulty: "Easy",
        action: () => console.log("Navigate to performance"),
      },
    ],
    developer: [
      {
        title: "Create Custom Policy",
        description: "Define your own governance rules for AI agents",
        icon: "⚙️",
        difficulty: "Medium",
        action: () => console.log("Navigate to policy creator"),
      },
      {
        title: "Deploy AI Agent",
        description: "Launch your own AI trading agent with governance",
        icon: "🚀",
        difficulty: "Advanced",
        action: () => console.log("Navigate to agent deployment"),
      },
      {
        title: "API Integration",
        description: "Connect your systems to the governance platform",
        icon: "🔌",
        difficulty: "Medium",
        action: () => console.log("Navigate to API docs"),
      },
    ],
    business: [
      {
        title: "ROI Calculator",
        description: "Calculate potential returns from AI governance implementation",
        icon: "💰",
        difficulty: "Easy",
        action: () => console.log("Navigate to ROI calculator"),
      },
      {
        title: "Compliance Dashboard",
        description: "Monitor regulatory compliance across all AI agents",
        icon: "✅",
        difficulty: "Easy",
        action: () => console.log("Navigate to compliance"),
      },
      {
        title: "Enterprise Setup",
        description: "Configure governance for enterprise-scale deployment",
        icon: "🏢",
        difficulty: "Advanced",
        action: () => console.log("Navigate to enterprise setup"),
      },
    ],
  };

  if (isLoading) {
    return (
      <div css={DashboardContainer}>
        <div css={LoadingState}>
          <div css={LoadingSpinner} />
          <p>Loading your personalized dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div css={DashboardContainer}>
      {/* Hero Section */}
      <section css={HeroSection}>
        <h1 css={HeroTitle}>Welcome to the Future of AI Governance</h1>
        <p css={HeroSubtitle}>
          Experience decentralized AI governance in action. Monitor, control, and optimize 
          your AI agents with blockchain-powered transparency and security.
        </p>
        <div css={StatusIndicator}>
          <span css={StatusDot} />
          System Online & Monitoring
        </div>
      </section>

      {/* Stats Overview */}
      {governanceStats && (
        <section css={ContentSection}>
          <h2 css={SectionTitle}>Platform Performance</h2>
          <div css={StatsGrid}>
            <Card variant="elevated" padding="lg">
              <div css={StatCard}>
                <div css={StatValue}>{governanceStats.totalActions.toLocaleString()}</div>
                <div css={StatLabel}>Total Actions</div>
                <div css={StatDescription}>
                  AI decisions processed and validated through governance protocols
                </div>
              </div>
            </Card>
            
            <Card variant="elevated" padding="lg">
              <div css={StatCard}>
                <div css={StatValue}>{governanceStats.totalAgents}</div>
                <div css={StatLabel}>Active Agents</div>
                <div css={StatDescription}>
                  AI agents currently under governance and making autonomous decisions
                </div>
              </div>
            </Card>
            
            <Card variant="elevated" padding="lg">
              <div css={StatCard}>
                <div css={StatValue}>{governanceStats.approvalRate}%</div>
                <div css={StatLabel}>Approval Rate</div>
                <div css={StatDescription}>
                  Percentage of AI decisions that comply with governance policies
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Blockchain Status */}
      <section css={ContentSection}>
        <h2 css={SectionTitle}>Blockchain Infrastructure</h2>
        <Card variant="elevated" padding="lg">
          <BlockchainStatus />
        </Card>
      </section>

      {/* Quick Actions */}
      <section css={ContentSection}>
        <h2 css={SectionTitle}>Get Started</h2>
        <p css={HeroSubtitle}>
          Choose your path to explore AI governance capabilities
        </p>
        <div css={ActionGrid}>
          {quickActions[userType as keyof typeof quickActions]?.map((action, index) => (
            <Card key={index} variant="default" padding="lg" interactive onClick={action.action}>
              <div css={ActionCard}>
                <span css={ActionIcon}>{action.icon}</span>
                <h3 css={ActionTitle}>{action.title}</h3>
                <p css={ActionDescription}>{action.description}</p>
                <span css={DifficultyBadge}>{action.difficulty}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Active Agents Preview */}
      {agents.length > 0 && (
        <section css={ContentSection}>
          <h2 css={SectionTitle}>Active AI Agents</h2>
          <div css={ActionGrid}>
            {agents.map((agent) => (
              <Card key={agent.id} variant="default" padding="lg">
                <div css={ActionCard}>
                  <span css={ActionIcon}>{agent.avatar}</span>
                  <h3 css={ActionTitle}>{agent.name}</h3>
                  <p css={ActionDescription}>{agent.description}</p>
                  <div css={StatusIndicator}>
                    <span css={StatusDot} />
                    {agent.status === 'active' ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}