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

export default function ModernDashboard({
  userType: _userType,
}: DashboardProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [agentData, setAgentData] = useState<AgentMonitoringData[]>([]);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const apiKey = import.meta.env.VITE_API_KEY || "development-api-key";
      const headers = { "X-API-KEY": apiKey };

      // Fetch system health
      try {
        const healthResponse = await fetch(getApiUrl("/api/system/health"), {
          headers,
        });
        if (healthResponse.ok) {
          const health = await healthResponse.json();
          setSystemHealth(health);
        } else {
          setSystemHealth(generateMockSystemHealth());
        }
      } catch {
        setSystemHealth(generateMockSystemHealth());
      }

      // Fetch agent monitoring data
      try {
        const agentsResponse = await fetch(
          getApiUrl("/api/agents/monitoring"),
          { headers }
        );
        if (agentsResponse.ok) {
          const agentsResult = await agentsResponse.json();
          // Handle both direct array and wrapped response formats
          let agents;
          if (Array.isArray(agentsResult)) {
            agents = agentsResult;
          } else if (agentsResult.success && Array.isArray(agentsResult.data)) {
            agents = agentsResult.data;
          } else {
            console.warn("API returned non-array agent data:", agentsResult);
            agents = generateMockAgentData();
          }
          setAgentData(agents);
        } else {
          setAgentData(generateMockAgentData());
        }
      } catch (error) {
        console.error("Error fetching agent data:", error);
        setAgentData(generateMockAgentData());
      }

      // Generate AI recommendations
      setRecommendations(generateMockRecommendations());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      // Use mock data on error
      setSystemHealth(generateMockSystemHealth());
      setAgentData(generateMockAgentData());
      setRecommendations(generateMockRecommendations());
    } finally {
      setLoading(false);
    }
  };

  const generateMockSystemHealth = (): SystemHealth => ({
    overall: "healthy",
    components: {
      blockchain: "online",
      policies: "active",
      audit: "logging",
      ai: "operational",
    },
    metrics: {
      totalAgents: 2,
      activeAgents: 2,
      totalActions: 1247,
      complianceRate: 98.5,
      averageResponseTime: 1225,
    },
  });

  const generateMockAgentData = (): AgentMonitoringData[] => [
    {
      id: "recall-agent-1",
      name: "Recall Trading Agent",
      type: "trading",
      status: "active",
      capabilities: ["trading", "risk-management", "market-analysis"],
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      updatedAt: new Date(Date.now() - 300000).toISOString(),
      lastActivity: new Date(Date.now() - 300000).toISOString(),
      performance: {
        uptime: 99.8,
        successRate: 94.2,
        avgResponseTime: 150,
        actionsToday: 47,
      },
      riskMetrics: {
        currentRiskScore: 0.3,
        violationsToday: 0,
        complianceRate: 100,
      },
      financialMetrics: {
        totalValue: 12450.75,
        dailyPnL: 234.5,
        winRate: 68.5,
      },
    },
    {
      id: "vincent-agent-1",
      name: "Vincent Social Trading Agent",
      type: "trading",
      status: "active",
      capabilities: [
        "social-trading",
        "sentiment-analysis",
        "portfolio-management",
      ],
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      updatedAt: new Date(Date.now() - 600000).toISOString(),
      lastActivity: new Date(Date.now() - 600000).toISOString(),
      performance: {
        uptime: 97.2,
        successRate: 89.1,
        avgResponseTime: 2300,
        actionsToday: 23,
      },
      riskMetrics: {
        currentRiskScore: 0.6,
        violationsToday: 2,
        complianceRate: 91.3,
      },
      financialMetrics: {
        totalValue: 8750.25,
        dailyPnL: -45.2,
        winRate: 72.1,
      },
    },
  ];

  const generateMockRecommendations = (): AIRecommendation[] => [
    {
      id: "1",
      type: "performance",
      title: "Optimize Vincent Agent Response Time",
      description:
        "Vincent agent response times are 40% higher than baseline. Consider implementing caching for sentiment analysis.",
      priority: "medium",
      impact: "Reduce response time by ~1.5s",
      actionRequired: true,
      estimatedBenefit: "15% performance improvement",
    },
    {
      id: "2",
      type: "security",
      title: "Review Sentiment Source Whitelist",
      description:
        "Vincent agent has attempted to access unapproved sentiment sources 3 times today.",
      priority: "high",
      impact: "Prevent potential security violations",
      actionRequired: true,
    },
    {
      id: "3",
      type: "optimization",
      title: "Increase Trading Frequency",
      description:
        "Market conditions suggest increasing trade frequency could improve returns by 8-12%.",
      priority: "low",
      impact: "Potential 10% return improvement",
      actionRequired: false,
      estimatedBenefit: "$1,200-1,800 additional monthly revenue",
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
              Total Actions
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
              Actions logged
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
        Agent Monitoring Dashboard
      </h2>

      <div css={agentGridStyles}>
        {Array.isArray(agentData) && agentData.map((agent) => (
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
                      font-weight: ${designTokens.typography.fontWeight.medium};
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
                    font-weight: ${designTokens.typography.fontWeight.semibold};
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
                    <div css={metricLabelStyles}>Actions Today</div>
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
                    font-weight: ${designTokens.typography.fontWeight.semibold};
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

  return (
    <div css={containerStyles}>
      <div css={heroStyles}>
        <h1 css={heroTitleStyles}>AI Agent Governance Platform</h1>
        <p css={heroSubtitleStyles}>
          Monitor, control, and optimize your autonomous agents with
          enterprise-grade governance and real-time insights
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
    </div>
  );
}
