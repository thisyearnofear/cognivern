import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  shadowSystem,
  keyframeAnimations,
  layoutUtils,
} from "../../styles/design-system";
import { Card, CardContent, CardTitle, CardDescription } from "../ui/Card";
import { getApiUrl } from "../../utils/api";
import BlockchainStatus from "../blockchain/BlockchainStatus";
import ConnectionStatus from "../ui/ConnectionStatus";
import { Tooltip } from "../ui/Tooltip";
import { useAppStore } from "../../stores/appStore";

interface DashboardProps {
  userType: string;
}

import { BaseAgent, SystemHealth } from "../../types";

interface AgentMonitoringData extends BaseAgent {
  type: "trading" | "analysis" | "monitoring";
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

// SystemHealth now imported from types

interface AIRecommendation {
  id: string;
  type: "optimization" | "security" | "performance" | "compliance";
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
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
    content: "";
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
    background: ${colorSystem.gradients.danger};
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

  &.online,
  &.healthy,
  &.active,
  &.logging,
  &.operational {
    background: ${designTokens.colors.semantic.success[500]};
    box-shadow: 0 0 8px ${designTokens.colors.semantic.success[300]};
    ${keyframeAnimations.pulse}
  }

  &.degraded,
  &.warning,
  &.delayed,
  &.limited {
    background: ${designTokens.colors.semantic.warning[500]};
    ${keyframeAnimations.pulse}
  }

  &.offline,
  &.critical,
  &.error,
  &.failed,
  &.unavailable {
    background: ${designTokens.colors.semantic.error[500]};
    ${keyframeAnimations.pulse}
  }

  &.idle,
  &.maintenance {
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
  justify-content: space-between;
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

const explanationBoxStyles = css`
  max-width: 800px;
  margin: 0 auto ${designTokens.spacing[6]};
  padding: ${designTokens.spacing[5]};
  background: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.lg};
  border: 1px solid ${designTokens.colors.neutral[200]};
  text-align: left;

  @media (max-width: ${designTokens.breakpoints.md}) {
    padding: ${designTokens.spacing[3]};
  }

  h3 {
    font-size: ${designTokens.typography.fontSize.base};
    font-weight: ${designTokens.typography.fontWeight.semibold};
    margin: 0 0 ${designTokens.spacing[2]};
    color: ${designTokens.colors.neutral[900]};
  }

  p {
    font-size: ${designTokens.typography.fontSize.sm};
    color: ${designTokens.colors.neutral[600]};
    margin: 0 0 ${designTokens.spacing[2]};
    line-height: ${designTokens.typography.lineHeight.relaxed};
  }

  strong {
    color: ${designTokens.colors.neutral[900]};
  }
`;

const statusSummaryStyles = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${designTokens.spacing[8]};
  padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]};
  background: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.xl};
  box-shadow: ${shadowSystem.md};
  margin-bottom: ${designTokens.spacing[8]};
  border: 1px solid ${designTokens.colors.neutral[200]};

  @media (max-width: ${designTokens.breakpoints.md}) {
    flex-direction: column;
    gap: ${designTokens.spacing[4]};
  }
`;

const statusItemStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[2]};
`;

const statusLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
  font-weight: ${designTokens.typography.fontWeight.medium};
`;

const statusValueStyles = css`
  font-size: ${designTokens.typography.fontSize.lg};
  font-weight: ${designTokens.typography.fontWeight.bold};
  color: ${designTokens.colors.neutral[900]};
`;

const nextStepsStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

const nextStepItemStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[4]};
  background: ${designTokens.colors.neutral[0]};
  border: 1px solid ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.lg};
  margin-bottom: ${designTokens.spacing[3]};
  transition: all 0.2s ease;
  cursor: pointer;
  min-height: 48px;

  &:hover {
    border-color: ${designTokens.colors.primary[300]};
    background: ${designTokens.colors.primary[50]};
    transform: translateX(4px);
  }

  &:focus-visible {
    outline: 2px solid ${designTokens.colors.primary[500]};
    outline-offset: 2px;
  }

  &:last-child {
    margin-bottom: 0;
  }

  @media (max-width: ${designTokens.breakpoints.md}) {
    padding: ${designTokens.spacing[3]};
    min-height: 52px;
  }
`;

const nextStepIconStyles = (
  status: "pending" | "completed" | "optional",
) => css`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${designTokens.typography.fontSize.base};
  flex-shrink: 0;

  ${status === "pending"
    ? `
      background: ${designTokens.colors.semantic.warning[100]};
      color: ${designTokens.colors.semantic.warning[700]};
    `
    : status === "completed"
      ? `
      background: ${designTokens.colors.semantic.success[100]};
      color: ${designTokens.colors.semantic.success[700]};
    `
      : `
      background: ${designTokens.colors.semantic.info[100]};
      color: ${designTokens.colors.semantic.info[700]};
    `}
`;

const nextStepContentStyles = css`
  flex: 1;
`;

const nextStepTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[1]};
`;

const nextStepDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
`;

const timelineStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

const timelineItemStyles = css`
  display: flex;
  gap: ${designTokens.spacing[4]};
  padding: ${designTokens.spacing[4]} 0;
  border-left: 2px solid ${designTokens.colors.neutral[200]};
  margin-left: ${designTokens.spacing[3]};
  position: relative;

  &:last-child {
    border-left-color: transparent;
  }

  @media (max-width: ${designTokens.breakpoints.md}) {
    padding: ${designTokens.spacing[3]} 0;
    gap: ${designTokens.spacing[2]};
    margin-left: ${designTokens.spacing[2]};
  }
`;

const timelineDotStyles = (status: "success" | "pending" | "failed") => css`
  position: absolute;
  left: -7px;
  top: ${designTokens.spacing[5]};
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${status === "success"
    ? designTokens.colors.semantic.success[500]
    : status === "failed"
      ? designTokens.colors.semantic.error[500]
      : designTokens.colors.semantic.warning[500]};
  border: 2px solid ${designTokens.colors.neutral[0]};
`;

const timelineContentStyles = css`
  flex: 1;
  padding-left: ${designTokens.spacing[2]};
`;

const timelineTimeStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
  margin-bottom: ${designTokens.spacing[1]};
`;

const timelineTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[1]};
`;

const timelineDescriptionStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[600]};
`;

const activityFeedStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

const activityItemStyles = css`
  display: flex;
  align-items: flex-start;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]};
  background: ${designTokens.colors.neutral[0]};
  border: 1px solid ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.lg};
  margin-bottom: ${designTokens.spacing[3]};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${designTokens.colors.primary[300]};
    background: ${designTokens.colors.primary[50]};
  }
`;

const activityIconStyles = css`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${designTokens.colors.primary[100]};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${designTokens.typography.fontSize.lg};
  flex-shrink: 0;
`;

const activityContentStyles = css`
  flex: 1;
`;

const activityTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[1]};
`;

const activityMetaStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
`;

const progressIndicatorStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

const progressHeaderStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${designTokens.spacing[3]};
`;

const progressLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
`;

const progressBarStyles = css`
  width: 100%;
  height: 8px;
  background: ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.full};
  overflow: hidden;
`;

const progressFillStyles = (percentage: number) => css`
  height: 100%;
  background: linear-gradient(
    90deg,
    ${designTokens.colors.primary[500]},
    ${designTokens.colors.primary[600]}
  );
  width: ${percentage}%;
  transition: width 0.5s ease;
`;

const chartStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
`;

const chartBarStyles = () => css`
  width: 100%;
  height: ${designTokens.spacing[12]};
  background: ${designTokens.colors.neutral[100]};
  border-radius: ${designTokens.borderRadius.md};
  overflow: hidden;
  position: relative;
`;

const chartFillStyles = (value: number, max: number) => css`
  height: 100%;
  width: ${(value / max) * 100}%;
  background: linear-gradient(
    90deg,
    ${designTokens.colors.primary[500]},
    ${designTokens.colors.primary[600]}
  );
  transition: width 0.5s ease;
`;

const statusLegendStyles = css`
  margin-bottom: ${designTokens.spacing[8]};
  padding: ${designTokens.spacing[5]};
  background: ${designTokens.colors.neutral[0]};
  border: 1px solid ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.xl};
`;

const legendTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.base};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
  margin: 0 0 ${designTokens.spacing[4]};
  text-align: center;
`;

const legendGridStyles = css`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${designTokens.spacing[4]};
`;

const legendItemStyles = css`
  display: flex;
  align-items: center;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]};
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.md};
`;

const legendDotStyles = css`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const legendTextStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[700]};
`;

const loadingStepsContainerStyles = css`
  display: grid;
  gap: ${designTokens.spacing[2]};
  margin-bottom: ${designTokens.spacing[4]};
`;

const loadingDotStyles = (active: boolean) => css`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${active
    ? designTokens.colors.primary[500]
    : designTokens.colors.neutral[200]};
  transition: background 0.3s ease;
`;

export default function ModernDashboard({
  userType: _userType,
}: DashboardProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [agentData, setAgentData] = useState<AgentMonitoringData[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [isApiConnected, setIsApiConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      // Fetch system health
      const healthResponse = await fetch(getApiUrl("/api/system/health"), {
        headers,
      });
      if (!healthResponse.ok) {
        throw new Error(`System health unavailable (${healthResponse.status})`);
      }
      const health = await healthResponse.json();
      setSystemHealth(health);

      // Fetch agent monitoring data
      const agentsResponse = await fetch(getApiUrl("/api/agents/monitoring"), {
        headers,
      });
      if (!agentsResponse.ok) {
        throw new Error(
          `Agent monitoring unavailable (${agentsResponse.status})`,
        );
      }
      const agentsResult = await agentsResponse.json();

      // Handle both direct array and wrapped response formats
      let agents;
      if (Array.isArray(agentsResult)) {
        agents = agentsResult;
      } else if (agentsResult.success && Array.isArray(agentsResult.data)) {
        agents = agentsResult.data;
      } else {
        throw new Error("Invalid agent data format from API");
      }
      setAgentData(agents);

      // All data loaded successfully
      setIsApiConnected(true);
      setLastUpdated(new Date());
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data";
      console.error("Error fetching dashboard data:", errorMessage);
      setError(errorMessage);
      setIsApiConnected(false);
      setSystemHealth(null);
      setAgentData([]);
    } finally {
      setLoading(false);
    }
  };

  const generateMockSystemHealth = (): SystemHealth => ({
    overall: "healthy",
    components: {
      arbitrum: "online",
      eas: "operational",
      ethereal: "online",
      policies: "active",
    },
    metrics: {
      totalAgents: 1,
      activeAgents: 1,
      totalForecasts: 89,
      complianceRate: 100,
      averageAttestationTime: 2400,
    },
  });

  const generateMockAgentData = (): AgentMonitoringData[] => [
    {
      id: "sapience-forecast-1",
      name: "Sapience Forecasting Agent",
      type: "analysis",
      status: "active",
      capabilities: [
        "forecasting",
        "eas-attestation",
        "market-analysis",
        "policy-enforcement",
      ],
      createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
      updatedAt: new Date(Date.now() - 120000).toISOString(),
      lastActivity: new Date(Date.now() - 120000).toISOString(),
      performance: {
        uptime: 99.9,
        successRate: 96.6,
        avgResponseTime: 2400,
        actionsToday: 12,
      },
      riskMetrics: {
        currentRiskScore: 0.15,
        violationsToday: 0,
        complianceRate: 100,
      },
      financialMetrics: {
        totalValue: 24500.5,
        dailyPnL: 892.3,
        winRate: 76.8,
      },
    },
  ];

  const generateMockRecommendations = (): AIRecommendation[] => [
    {
      id: "1",
      type: "performance",
      title: "Improve Forecast Accuracy",
      description:
        "Current forecast model accuracy is 76.8%. Incorporate additional market sentiment data sources to improve calibration.",
      priority: "medium",
      impact: "Increase accuracy by 5-8%",
      actionRequired: true,
      estimatedBenefit: "Better position sizing and market timing",
    },
    {
      id: "2",
      type: "compliance",
      title: "Review EAS Attestation Parameters",
      description:
        "Consider optimizing confidence thresholds for EAS attestations to balance accuracy with on-chain costs.",
      priority: "medium",
      impact:
        "Reduce unnecessary on-chain submissions while maintaining forecast quality",
      actionRequired: false,
    },
    {
      id: "3",
      type: "optimization",
      title: "Expand Market Coverage",
      description:
        "Agent is currently analyzing 8 markets. Expanding to 15 additional markets could diversify portfolio.",
      priority: "low",
      impact: "Increase diversification and market exposure",
      actionRequired: false,
      estimatedBenefit: "Broader prediction market participation",
    },
  ];

  const renderSystemHealth = () => {
    if (!systemHealth || !systemHealth.metrics) return null;

    return (
      <div css={systemHealthStyles}>
        <Card
          variant="default"
          css={css`${healthCardStyles}; &.${systemHealth.overall}`}
        >
          <CardContent>
            <CardTitle
              css={css`
                margin-bottom: ${designTokens.spacing[3]};
              `}
            >
              System Health
            </CardTitle>
            <div css={statusIndicatorStyles}>
              <span css={css`${statusDotStyles}; &.${systemHealth.overall}`} />
              <span
                css={css`
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  text-transform: capitalize;
                `}
              >
                {systemHealth.overall}
              </span>
            </div>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[600]};
              `}
            >
              All systems operational
            </div>
          </CardContent>
        </Card>

        <Card variant="default" css={healthCardStyles}>
          <CardContent>
            <CardTitle
              css={css`
                margin-bottom: ${designTokens.spacing[3]};
              `}
            >
              Active Agents
            </CardTitle>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize["2xl"]};
                font-weight: ${designTokens.typography.fontWeight.bold};
                color: ${designTokens.colors.primary[600]};
              `}
            >
              {systemHealth.metrics?.activeAgents || 0}/
              {systemHealth.metrics?.totalAgents || 0}
            </div>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[600]};
              `}
            >
              Agents monitored
            </div>
          </CardContent>
        </Card>

        <Card variant="default" css={healthCardStyles}>
          <CardContent>
            <CardTitle
              css={css`
                margin-bottom: ${designTokens.spacing[3]};
              `}
            >
              Compliance Rate
            </CardTitle>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize["2xl"]};
                font-weight: ${designTokens.typography.fontWeight.bold};
                color: ${designTokens.colors.semantic.success[600]};
              `}
            >
              {systemHealth.metrics?.complianceRate || 0}%
            </div>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[600]};
              `}
            >
              Policy compliance
            </div>
          </CardContent>
        </Card>

        <Card variant="default" css={healthCardStyles}>
          <CardContent>
            <CardTitle
              css={css`
                margin-bottom: ${designTokens.spacing[3]};
              `}
            >
              Total Forecasts
            </CardTitle>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize["2xl"]};
                font-weight: ${designTokens.typography.fontWeight.bold};
                color: ${designTokens.colors.primary[600]};
              `}
            >
              {(systemHealth.metrics?.totalActions || 0).toLocaleString()}
            </div>
            <div
              css={css`
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[600]};
              `}
            >
              Forecasts generated
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAgentMonitoring = () => (
    <div>
      <h2
        css={css`
          font-size: ${designTokens.typography.fontSize["2xl"]};
          font-weight: ${designTokens.typography.fontWeight.bold};
          margin-bottom: ${designTokens.spacing[6]};
          text-align: center;
        `}
      >
        Forecasting Agent Status
      </h2>

      <div css={agentGridStyles}>
        {Array.isArray(agentData) &&
          agentData.map((agent) => (
            <Card key={agent.id} variant="elevated" css={agentCardStyles}>
              <CardContent>
                <div css={agentHeaderStyles}>
                  <div>
                    <CardTitle
                      css={css`
                        margin-bottom: ${designTokens.spacing[1]};
                      `}
                    >
                      {agent.name}
                    </CardTitle>
                    <span css={agentTypeStyles}>{agent.type}</span>
                  </div>
                  <div css={statusIndicatorStyles}>
                    <span css={css`${statusDotStyles}; &.${agent.status}`} />
                    <span
                      css={css`
                        font-size: ${designTokens.typography.fontSize.sm};
                        font-weight: ${designTokens.typography.fontWeight
                          .medium};
                        text-transform: capitalize;
                      `}
                    >
                      {agent.status}
                    </span>
                  </div>
                </div>

                <div
                  css={css`
                    margin-bottom: ${designTokens.spacing[4]};
                  `}
                >
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.neutral[600]};
                    `}
                  >
                    Last Activity:{" "}
                    {new Date(agent.lastActivity).toLocaleTimeString()}
                  </div>
                </div>

                <div
                  css={css`
                    margin-bottom: ${designTokens.spacing[4]};
                  `}
                >
                  <h4
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                      margin-bottom: ${designTokens.spacing[3]};
                    `}
                  >
                    Performance Metrics
                  </h4>
                  <div css={metricsGridStyles}>
                    <div css={metricItemStyles}>
                      <div css={metricValueStyles}>
                        {agent.performance.uptime}%
                      </div>
                      <div css={metricLabelStyles}>Uptime</div>
                    </div>
                    <div css={metricItemStyles}>
                      <div css={metricValueStyles}>
                        {agent.performance.successRate}%
                      </div>
                      <div css={metricLabelStyles}>Success Rate</div>
                    </div>
                    <div css={metricItemStyles}>
                      <div css={metricValueStyles}>
                        {agent.performance.avgResponseTime}ms
                      </div>
                      <div css={metricLabelStyles}>Avg Response</div>
                    </div>
                    <div css={metricItemStyles}>
                      <div css={metricValueStyles}>
                        {agent.performance.actionsToday}
                      </div>
                      <div css={metricLabelStyles}>Forecasts Today</div>
                    </div>
                  </div>
                </div>

                <div
                  css={css`
                    margin-bottom: ${designTokens.spacing[4]};
                  `}
                >
                  <h4
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                      margin-bottom: ${designTokens.spacing[3]};
                    `}
                  >
                    Risk & Compliance
                  </h4>
                  <div css={metricsGridStyles}>
                    <div css={metricItemStyles}>
                      <div
                        css={css`
                          ${metricValueStyles};
                          color: ${agent.riskMetrics.currentRiskScore > 0.5
                            ? designTokens.colors.semantic.warning[600]
                            : designTokens.colors.semantic.success[600]};
                        `}
                      >
                        {(agent.riskMetrics.currentRiskScore * 100).toFixed(1)}%
                      </div>
                      <div css={metricLabelStyles}>Risk Score</div>
                    </div>
                    <div css={metricItemStyles}>
                      <div
                        css={css`
                          ${metricValueStyles};
                          color: ${agent.riskMetrics.violationsToday > 0
                            ? designTokens.colors.semantic.error[600]
                            : designTokens.colors.semantic.success[600]};
                        `}
                      >
                        {agent.riskMetrics.violationsToday}
                      </div>
                      <div css={metricLabelStyles}>Violations Today</div>
                    </div>
                  </div>
                  <div
                    css={css`
                      margin-top: ${designTokens.spacing[2]};
                    `}
                  >
                    <div
                      css={css`
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: ${designTokens.spacing[1]};
                      `}
                    >
                      <span
                        css={css`
                          font-size: ${designTokens.typography.fontSize.sm};
                          color: ${designTokens.colors.neutral[600]};
                        `}
                      >
                        Compliance Rate
                      </span>
                      <span
                        css={css`
                          font-size: ${designTokens.typography.fontSize.sm};
                          font-weight: ${designTokens.typography.fontWeight
                            .semibold};
                        `}
                      >
                        {agent.riskMetrics.complianceRate}%
                      </span>
                    </div>
                    <div
                      css={css`
                        width: 100%;
                        height: 4px;
                        background: ${designTokens.colors.neutral[200]};
                        border-radius: ${designTokens.borderRadius.full};
                        overflow: hidden;
                      `}
                    >
                      <div
                        css={css`
                          height: 100%;
                          background: ${agent.riskMetrics.complianceRate > 95
                            ? designTokens.colors.semantic.success[500]
                            : agent.riskMetrics.complianceRate > 90
                              ? designTokens.colors.semantic.warning[500]
                              : designTokens.colors.semantic.error[500]};
                          width: ${agent.riskMetrics.complianceRate}%;
                          transition: width 0.3s ease;
                        `}
                      />
                    </div>
                  </div>
                </div>

                {agent.financialMetrics && (
                  <div
                    css={css`
                      margin-bottom: ${designTokens.spacing[4]};
                    `}
                  >
                    <h4
                      css={css`
                        font-size: ${designTokens.typography.fontSize.sm};
                        font-weight: ${designTokens.typography.fontWeight
                          .semibold};
                        margin-bottom: ${designTokens.spacing[3]};
                      `}
                    >
                      Financial Performance
                    </h4>
                    <div css={metricsGridStyles}>
                      <div css={metricItemStyles}>
                        <div css={metricValueStyles}>
                          ${agent.financialMetrics.totalValue.toLocaleString()}
                        </div>
                        <div css={metricLabelStyles}>Total Value</div>
                      </div>
                      <div css={metricItemStyles}>
                        <div
                          css={css`
                            ${metricValueStyles};
                            color: ${agent.financialMetrics.dailyPnL >= 0
                              ? designTokens.colors.semantic.success[600]
                              : designTokens.colors.semantic.error[600]};
                          `}
                        >
                          {agent.financialMetrics.dailyPnL >= 0 ? "+" : ""}$
                          {agent.financialMetrics.dailyPnL.toFixed(2)}
                        </div>
                        <div css={metricLabelStyles}>Daily P&L</div>
                      </div>
                    </div>
                    <div
                      css={css`
                        text-align: center;
                        margin-top: ${designTokens.spacing[2]};
                      `}
                    >
                      <div css={metricValueStyles}>
                        {agent.financialMetrics.winRate}%
                      </div>
                      <div css={metricLabelStyles}>Win Rate</div>
                    </div>
                  </div>
                )}

                <div
                  css={css`
                    display: flex;
                    gap: ${designTokens.spacing[2]};
                  `}
                >
                  <button
                    css={css`
                      flex: 1;
                      padding: ${designTokens.spacing[3]};
                      background: ${designTokens.colors.primary[500]};
                      color: white;
                      border: none;
                      border-radius: ${designTokens.borderRadius.md};
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight.medium};
                      cursor: pointer;
                      transition: background 0.2s ease;

                      &:hover {
                        background: ${designTokens.colors.primary[600]};
                      }
                    `}
                  >
                    View Details
                  </button>
                  <button
                    css={css`
                      flex: 1;
                      padding: ${designTokens.spacing[3]};
                      background: transparent;
                      color: ${designTokens.colors.primary[600]};
                      border: 1px solid ${designTokens.colors.primary[300]};
                      border-radius: ${designTokens.borderRadius.md};
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight.medium};
                      cursor: pointer;
                      transition: all 0.2s ease;

                      &:hover {
                        background: ${designTokens.colors.primary[50]};
                      }
                    `}
                  >
                    Configure
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );

  const renderRecommendations = () => (
    <div>
      <h2
        css={css`
          font-size: ${designTokens.typography.fontSize["2xl"]};
          font-weight: ${designTokens.typography.fontWeight.bold};
          margin-bottom: ${designTokens.spacing[6]};
          text-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: ${designTokens.spacing[2]};
        `}
      >
        🤖 AI Recommendations
        <span
          css={css`
            font-size: ${designTokens.typography.fontSize.sm};
            color: ${designTokens.colors.neutral[500]};
            font-weight: normal;
          `}
        >
          Powered by Gemini
        </span>
      </h2>

      <div css={recommendationsStyles}>
        {recommendations.map((rec) => (
          <Card
            key={rec.id}
            variant="default"
            css={css`${recommendationCardStyles}; &.${rec.type}`}
          >
            <CardContent>
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: start;
                  margin-bottom: ${designTokens.spacing[3]};
                `}
              >
                <CardTitle
                  css={css`
                    margin-bottom: ${designTokens.spacing[2]};
                  `}
                >
                  {rec.title}
                </CardTitle>
                <span css={css`${priorityBadgeStyles}; &.${rec.priority}`}>
                  {rec.priority}
                </span>
              </div>

              <CardDescription
                css={css`
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                {rec.description}
              </CardDescription>

              <div
                css={css`
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                    margin-bottom: ${designTokens.spacing[1]};
                  `}
                >
                  <strong>Impact:</strong> {rec.impact}
                </div>
                {rec.estimatedBenefit && (
                  <div
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${designTokens.colors.semantic.success[600]};
                    `}
                  >
                    <strong>Benefit:</strong> {rec.estimatedBenefit}
                  </div>
                )}
              </div>

              {rec.actionRequired && (
                <button
                  css={css`
                    width: 100%;
                    padding: ${designTokens.spacing[3]};
                    background: ${designTokens.colors.primary[500]};
                    color: white;
                    border: none;
                    border-radius: ${designTokens.borderRadius.md};
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    cursor: pointer;
                    transition: background 0.2s ease;

                    &:hover {
                      background: ${designTokens.colors.primary[600]};
                    }
                  `}
                >
                  Take Action
                </button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div css={containerStyles}>
        <div
          css={css`
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          `}
        >
          <div
            css={css`
              text-align: center;
            `}
          >
            <div
              css={css`
                width: 40px;
                height: 40px;
                border: 3px solid ${designTokens.colors.neutral[200]};
                border-top: 3px solid ${designTokens.colors.primary[500]};
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto ${designTokens.spacing[4]};

                @keyframes spin {
                  0% {
                    transform: rotate(0deg);
                  }
                  100% {
                    transform: rotate(360deg);
                  }
                }
              `}
            />
            <p>Loading monitoring dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div css={containerStyles}>
        <div css={heroStyles}>
          <h1 css={heroTitleStyles}>Sapience Forecasting Agent</h1>
          <p css={heroSubtitleStyles}>
            Autonomous prediction market agent with on-chain attestation via
            EAS, policy-governed execution, and real-time market analysis
          </p>
        </div>

        <div
          css={css`
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
          `}
        >
          <Card variant="elevated">
            <CardContent
              css={css`
                max-width: 500px;
                text-align: center;
              `}
            >
              <div
                css={css`
                  font-size: 48px;
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                ⚠️
              </div>
              <CardTitle
                css={css`
                  color: ${designTokens.colors.semantic.error[600]};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Dashboard Unavailable
              </CardTitle>
              <CardDescription
                css={css`
                  margin-bottom: ${designTokens.spacing[4]};
                `}
              >
                Unable to load dashboard data from the API.
              </CardDescription>

              <div
                css={css`
                  background: ${designTokens.colors.semantic.error[50]};
                  border: 1px solid ${designTokens.colors.semantic.error[200]};
                  border-radius: ${designTokens.borderRadius.md};
                  padding: ${designTokens.spacing[3]};
                  margin-bottom: ${designTokens.spacing[4]};
                  color: ${designTokens.colors.semantic.error[700]};
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-family: monospace;
                  word-break: break-all;
                `}
              >
                {error}
              </div>

              <div
                css={css`
                  display: flex;
                  gap: ${designTokens.spacing[3]};
                  flex-direction: column;
                `}
              >
                <button
                  css={css`
                    padding: ${designTokens.spacing[3]};
                    background: ${designTokens.colors.primary[500]};
                    color: white;
                    border: none;
                    border-radius: ${designTokens.borderRadius.md};
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                    cursor: pointer;
                    transition: background 0.2s ease;

                    &:hover {
                      background: ${designTokens.colors.primary[600]};
                    }
                  `}
                  onClick={() => fetchDashboardData()}
                >
                  🔄 Retry
                </button>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xs};
                    color: ${designTokens.colors.neutral[600]};
                  `}
                >
                  Make sure the backend API is running and accessible at the
                  configured URL.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ConnectionStatus isConnected={isApiConnected} apiUrl="Sapience API" />
      </div>
    );
  }

  return (
    <div css={containerStyles}>
      <div css={heroStyles}>
        <h1 css={heroTitleStyles}>Sapience Forecasting Agent</h1>
        <p css={heroSubtitleStyles}>
          Autonomous prediction market agent with on-chain attestation via EAS,
          policy-governed execution, and real-time market analysis
        </p>
      </div>

      {renderSystemHealth()}
      {renderAgentMonitoring()}
      {renderRecommendations()}

      <div
        css={css`
          margin-top: ${designTokens.spacing[8]};
        `}
      >
        <BlockchainStatus />
      </div>

      <ConnectionStatus isConnected={isApiConnected} apiUrl="Sapience API" />
    </div>
  );
}
