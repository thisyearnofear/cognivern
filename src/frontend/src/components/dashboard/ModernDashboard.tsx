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
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isApiConnected, setIsApiConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchDashboardData(true);
    const interval = setInterval(() => fetchDashboardData(false), 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
        setLoadingStep(0);
      }
      setError(null);
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      if (isInitial) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setLoadingStep(1);
      }
      
      // Fetch system health
      const healthResponse = await fetch(getApiUrl("/api/system/health"), {
        headers,
      });
      if (!healthResponse.ok) {
        throw new Error(`System health unavailable (${healthResponse.status})`);
      }
      const health = await healthResponse.json();
      setSystemHealth(health);

      if (isInitial) {
        setLoadingStep(2);
      }
      
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

      if (isInitial) {
        setLoadingStep(3);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // All data loaded successfully
      setIsApiConnected(true);
      setLastUpdated(new Date());
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data";
      console.error("Error fetching dashboard data:", errorMessage);
      
      // Only show error if we don't have any data yet
      if (isInitial || !systemHealth) {
        setError(errorMessage);
        setIsApiConnected(false);
        setSystemHealth(null);
        setAgentData([]);
      }
    } finally {
      if (isInitial) {
        setLoading(false);
        setLoadingStep(0);
      }
    }
  };



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

  const renderNextSteps = () => {
    const steps = [
      {
        title: "Connect Wallet",
        description: "Link your Ethereum wallet to enable agent interactions",
        status: "completed" as const,
        icon: "✓",
      },
      {
        title: "Configure Agent Parameters",
        description: "Set forecast confidence thresholds and risk limits",
        status: "pending" as const,
        icon: "⚙️",
      },
      {
        title: "Review Compliance Policies",
        description: "Ensure agent adheres to your risk management rules",
        status: "pending" as const,
        icon: "⚠️",
      },
      {
        title: "Enable Real-time Notifications",
        description: "Get alerts for important agent activities and forecasts",
        status: "optional" as const,
        icon: "🔔",
      },
    ];

    return (
      <div css={nextStepsStyles}>
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[6]};
            text-align: center;
          `}
        >
          Next Steps
        </h2>

        {steps.map((step, index) => (
          <button
            key={index}
            css={nextStepItemStyles}
            role="menuitem"
            tabIndex={0}
            aria-label={`${step.title}: ${step.description}`}
          >
            <div css={nextStepIconStyles(step.status)}>{step.icon}</div>
            <div css={nextStepContentStyles}>
              <div css={nextStepTitleStyles}>{step.title}</div>
              <div css={nextStepDescriptionStyles}>{step.description}</div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderTimeline = () => {
    const timelineData = [
      {
        time: "2 hours ago",
        title: "Forecast Submitted",
        description: "ETH price prediction at $4,250 (95% confidence)",
        status: "success" as const,
      },
      {
        time: "4 hours ago",
        title: "EAS Attestation",
        description: "On-chain attestation recorded for forecast #89",
        status: "success" as const,
      },
      {
        time: "6 hours ago",
        title: "Market Analysis",
        description: "Analyzed 8 prediction markets for opportunities",
        status: "success" as const,
      },
      {
        time: "8 hours ago",
        title: "Policy Check",
        description: "Risk parameters validated within compliance limits",
        status: "pending" as const,
      },
    ];

    return (
      <div css={timelineStyles}>
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[6]};
            text-align: center;
          `}
        >
          Recent Activity Timeline
        </h2>

        <div
          css={css`
            max-width: 700px;
            margin: 0 auto;
          `}
        >
          {timelineData.map((item, index) => (
            <div
              key={index}
              css={timelineItemStyles}
              role="listitem"
              aria-label={`${item.title} - ${item.time}`}
            >
              <div css={timelineDotStyles(item.status)} />
              <div css={timelineContentStyles}>
                <div css={timelineTimeStyles}>{item.time}</div>
                <div css={timelineTitleStyles}>{item.title}</div>
                <div css={timelineDescriptionStyles}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActivityFeed = () => {
    const activities = [
      {
        title: "New Forecast Generated",
        description: "BTC price prediction created",
        icon: "📊",
        time: "10 minutes ago",
        status: "success",
      },
      {
        title: "Compliance Check Passed",
        description: "Risk score within acceptable range",
        icon: "✅",
        time: "15 minutes ago",
        status: "success",
      },
      {
        title: "Market Opportunity Detected",
        description: "New prediction market identified",
        icon: "🎯",
        time: "30 minutes ago",
        status: "warning",
      },
      {
        title: "Attestation Complete",
        description: "EAS on-chain record updated",
        icon: "🔗",
        time: "1 hour ago",
        status: "success",
      },
    ];

    return (
      <div css={activityFeedStyles}>
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[6]};
            text-align: center;
          `}
        >
          Agent Activity Feed
        </h2>

        <div
          css={css`
            max-width: 700px;
            margin: 0 auto;
          `}
        >
          {activities.map((activity, index) => (
            <div
              key={index}
              css={activityItemStyles}
              role="listitem"
              aria-label={`${activity.title} - ${activity.time}`}
            >
              <div css={activityIconStyles}>{activity.icon}</div>
              <div css={activityContentStyles}>
                <div css={activityTitleStyles}>{activity.title}</div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[600]};
                    margin-bottom: ${designTokens.spacing[1]};
                  `}
                >
                  {activity.description}
                </div>
                <div css={activityMetaStyles}>{activity.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProgressIndicator = () => {
    const todayProgress = 78;
    const targetForecasts = 15;
    const completedForecasts = Math.round(
      (todayProgress / 100) * targetForecasts,
    );

    return (
      <div css={progressIndicatorStyles}>
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[6]};
            text-align: center;
          `}
        >
          Today's Forecast Progress
        </h2>

        <Card variant="default">
          <CardContent
            css={css`
              max-width: 700px;
              margin: 0 auto;
            `}
          >
            <div css={progressHeaderStyles}>
              <span css={progressLabelStyles}>
                {completedForecasts} of {targetForecasts} forecasts completed
              </span>
              <span
                css={css`
                  font-size: ${designTokens.typography.fontSize.xl};
                  font-weight: ${designTokens.typography.fontWeight.bold};
                  color: ${designTokens.colors.primary[600]};
                `}
              >
                {todayProgress}%
              </span>
            </div>

            <div css={progressBarStyles}>
              <div css={progressFillStyles(todayProgress)} />
            </div>

            <div
              css={css`
                display: flex;
                justify-content: space-between;
                margin-top: ${designTokens.spacing[3]};
                font-size: ${designTokens.typography.fontSize.sm};
                color: ${designTokens.colors.neutral[600]};
              `}
            >
              <span>Started: 9:00 AM</span>
              <span>Estimated completion: 5:00 PM</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderMarketAnalysis = () => {
    const marketData = [
      {
        name: "ETH Price Prediction",
        value: 89,
        color: designTokens.colors.primary[500],
      },
      {
        name: "BTC Price Prediction",
        value: 75,
        color: designTokens.colors.semantic.success[500],
      },
      {
        name: "DeFi Yield Analysis",
        value: 62,
        color: designTokens.colors.semantic.warning[500],
      },
      {
        name: "Lending Rate Prediction",
        value: 48,
        color: designTokens.colors.semantic.info[500],
      },
    ];

    const maxValue = Math.max(...marketData.map((m) => m.value));

    return (
      <div css={chartStyles}>
        <h2
          css={css`
            font-size: ${designTokens.typography.fontSize["2xl"]};
            font-weight: ${designTokens.typography.fontWeight.bold};
            margin-bottom: ${designTokens.spacing[6]};
            text-align: center;
          `}
        >
          Market Analysis Coverage
        </h2>

        <Card variant="default">
          <CardContent
            css={css`
              max-width: 700px;
              margin: 0 auto;
            `}
          >
            {marketData.map((market, index) => (
              <div
                key={index}
                css={css`
                  margin-bottom: ${designTokens.spacing[4]};
                  &:last-child {
                    margin-bottom: 0;
                  }
                `}
              >
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: ${designTokens.spacing[2]};
                  `}
                >
                  <span
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight.medium};
                      color: ${designTokens.colors.neutral[700]};
                    `}
                  >
                    {market.name}
                  </span>
                  <span
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      font-weight: ${designTokens.typography.fontWeight
                        .semibold};
                      color: ${designTokens.colors.primary[600]};
                    `}
                  >
                    {market.value}%
                  </span>
                </div>
                <div css={chartBarStyles()}>
                  <div
                    css={css`
                      ${chartFillStyles(market.value, maxValue)};
                      background: ${market.color};
                    `}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderStatusLegend = () => {
    const legendItems = [
      {
        label: "Active / Healthy",
        color: designTokens.colors.semantic.success[500],
        description: "Systems running normally",
      },
      {
        label: "Warning / Degraded",
        color: designTokens.colors.semantic.warning[500],
        description: "Performance affected but operational",
      },
      {
        label: "Critical / Error",
        color: designTokens.colors.semantic.error[500],
        description: "Immediate attention required",
      },
      {
        label: "Idle / Maintenance",
        color: designTokens.colors.neutral[400],
        description: "System inactive or under maintenance",
      },
    ];

    return (
      <div css={statusLegendStyles}>
        <h3 css={legendTitleStyles}>Status Legend</h3>
        <div css={legendGridStyles}>
          {legendItems.map((item, index) => (
            <div
              key={index}
              css={legendItemStyles}
              role="listitem"
              aria-label={`${item.label}: ${item.description}`}
            >
              <div
                css={css`
                  ${legendDotStyles};
                  background: ${item.color};
                  ${item.label.includes("Active") ||
                  item.label.includes("Healthy")
                    ? `${keyframeAnimations.pulse}`
                    : ""}
                `}
              />
              <div css={legendTextStyles}>
                <div
                  css={css`
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    margin-bottom: ${designTokens.spacing[1]};
                  `}
                >
                  {item.label}
                </div>
                <div
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xs};
                    color: ${designTokens.colors.neutral[500]};
                  `}
                >
                  {item.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    const loadingSteps = [
      "Connecting to Sapience API...",
      "Fetching agent metrics...",
      "Loading system health...",
      "Preparing dashboard...",
    ];

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
              max-width: 400px;
            `}
          >
            <div
              css={css`
                width: 48px;
                height: 48px;
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
            <h2
              css={css`
                font-size: ${designTokens.typography.fontSize.lg};
                font-weight: ${designTokens.typography.fontWeight.semibold};
                margin-bottom: ${designTokens.spacing[4]};
                color: ${designTokens.colors.neutral[900]};
              `}
            >
              Loading Dashboard
            </h2>

            <div css={loadingStepsContainerStyles}>
              {loadingSteps.map((step, index) => (
                <div
                  key={index}
                  css={css`
                    display: flex;
                    align-items: center;
                    gap: ${designTokens.spacing[3]};
                    padding: ${designTokens.spacing[2]};
                    text-align: left;
                  `}
                  role="listitem"
                >
                  <div
                    css={css`
                      ${loadingDotStyles(index <= loadingStep)};
                      ${index <= loadingStep && index === loadingStep
                        ? `${keyframeAnimations.pulse}`
                        : ""}
                    `}
                  />
                  <span
                    css={css`
                      font-size: ${designTokens.typography.fontSize.sm};
                      color: ${index <= loadingStep
                        ? designTokens.colors.neutral[900]
                        : designTokens.colors.neutral[400]};
                      font-weight: ${index <= loadingStep
                        ? designTokens.typography.fontWeight.medium
                        : designTokens.typography.fontWeight.normal};
                      transition: color 0.3s ease;
                    `}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <p
              css={css`
                margin-top: ${designTokens.spacing[4]};
                font-size: ${designTokens.typography.fontSize.xs};
                color: ${designTokens.colors.neutral[500]};
              `}
            >
              Please wait while we load your dashboard data...
            </p>
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
          Autonomous prediction market agent with on-chain attestation via{" "}
          <Tooltip content="EAS (Ethereum Attestation Service) enables verifiable, on-chain attestations for forecasts and predictions">
            <span
              css={css`
                color: ${designTokens.colors.primary[600]};
                font-weight: ${designTokens.typography.fontWeight.semibold};
                border-bottom: 1px dashed ${designTokens.colors.primary[400]};
                cursor: help;
              `}
            >
              EAS
            </span>
          </Tooltip>
          , policy-governed execution, and real-time market analysis
        </p>

        <div css={explanationBoxStyles}>
          <h3>What is Sapience?</h3>
          <p>
            <strong>Sapience</strong> is an autonomous AI agent designed for
            prediction market participation. It analyzes market data, generates
            forecasts, and attests to its predictions on-chain using the
            Ethereum Attestation Service (EAS).
          </p>
          <p>
            The agent operates within strict compliance policies, continuously
            monitors market conditions, and provides transparent, verifiable
            predictions through blockchain technology.
          </p>
        </div>

        <div
          css={css`
            text-align: center;
            font-size: ${designTokens.typography.fontSize.xs};
            color: ${designTokens.colors.neutral[500]};
            margin-top: ${designTokens.spacing[2]};
          `}
        >
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {renderProgressIndicator()}
      {renderNextSteps()}
      {renderTimeline()}
      {renderMarketAnalysis()}
      {renderSystemHealth()}
      {renderAgentMonitoring()}
      {renderActivityFeed()}
      {renderStatusLegend()}
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
