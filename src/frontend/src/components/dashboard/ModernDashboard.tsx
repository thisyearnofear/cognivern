import { useState, useEffect } from "react";
import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  shadowSystem,
  keyframeAnimations,
  layoutUtils,
} from "../../styles/design-system";
import { Card, CardContent, CardTitle } from "../ui/Card";
import { getApiUrl } from "../../utils/api";
import BlockchainStatus from "../blockchain/BlockchainStatus";
import ConnectionStatus from "../ui/ConnectionStatus";
import { Tooltip } from "../ui/Tooltip";
import { BaseAgent, SystemHealth } from "../../types";

interface DashboardProps {
  userType: string;
}

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

      const agentsResponse = await fetch(getApiUrl("/api/agents/monitoring"), {
        headers,
      });
      if (!agentsResponse.ok) {
        throw new Error(
          `Agent monitoring unavailable (${agentsResponse.status})`,
        );
      }
      const agentsResult = await agentsResponse.json();

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

      setIsApiConnected(true);
      setLastUpdated(new Date());
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data";
      console.error("Error fetching dashboard data:", errorMessage);

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
              {(systemHealth.metrics?.totalForecasts || 0).toLocaleString()}
            </div>
            <div css={textStyles.description}>Forecasts generated</div>
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

      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
          gap: ${designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[8]};
        `}
      >
        {Array.isArray(agentData) &&
          agentData.map((agent) => (
            <Card
              key={agent.id}
              variant="elevated"
              css={css`
                position: relative;
                transition: all 0.3s ease;

                &:hover {
                  transform: translateY(-4px);
                  box-shadow: ${shadowSystem.xl};
                }
              `}
            >
              <CardContent>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    align-items: start;
                    margin-bottom: ${designTokens.spacing[4]};
                  `}
                >
                  <div>
                    <CardTitle
                      css={css`
                        margin-bottom: ${designTokens.spacing[1]};
                      `}
                    >
                      {agent.name}
                    </CardTitle>
                    <span
                      css={css`
                        display: inline-block;
                        padding: ${designTokens.spacing[1]}
                          ${designTokens.spacing[2]};
                        background: ${designTokens.colors.primary[100]};
                        color: ${designTokens.colors.primary[700]};
                        border-radius: ${designTokens.borderRadius.full};
                        font-size: ${designTokens.typography.fontSize.xs};
                        font-weight: ${designTokens.typography.fontWeight
                          .semibold};
                        text-transform: uppercase;
                      `}
                    >
                      {agent.type}
                    </span>
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
                  <div
                    css={css`
                      display: grid;
                      grid-template-columns: 1fr 1fr;
                      gap: ${designTokens.spacing[3]};
                      margin-bottom: ${designTokens.spacing[4]};
                    `}
                  >
                    <div
                      css={css`
                        text-align: center;
                        padding: ${designTokens.spacing[3]};
                        background: ${designTokens.colors.neutral[50]};
                        border-radius: ${designTokens.borderRadius.md};
                      `}
                    >
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.lg};
                          font-weight: ${designTokens.typography.fontWeight
                            .bold};
                          color: ${designTokens.colors.primary[600]};
                          margin-bottom: ${designTokens.spacing[1]};
                        `}
                      >
                        {agent.performance.uptime}%
                      </div>
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.xs};
                          color: ${designTokens.colors.neutral[600]};
                          text-transform: uppercase;
                          letter-spacing: 0.05em;
                        `}
                      >
                        Uptime
                      </div>
                    </div>
                    <div
                      css={css`
                        text-align: center;
                        padding: ${designTokens.spacing[3]};
                        background: ${designTokens.colors.neutral[50]};
                        border-radius: ${designTokens.borderRadius.md};
                      `}
                    >
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.lg};
                          font-weight: ${designTokens.typography.fontWeight
                            .bold};
                          color: ${designTokens.colors.primary[600]};
                          margin-bottom: ${designTokens.spacing[1]};
                        `}
                      >
                        {agent.performance.successRate}%
                      </div>
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.xs};
                          color: ${designTokens.colors.neutral[600]};
                          text-transform: uppercase;
                          letter-spacing: 0.05em;
                        `}
                      >
                        Success Rate
                      </div>
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
                    <div
                      css={css`
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: ${designTokens.spacing[3]};
                        margin-bottom: ${designTokens.spacing[4]};
                      `}
                    >
                      <div
                        css={css`
                          text-align: center;
                          padding: ${designTokens.spacing[3]};
                          background: ${designTokens.colors.neutral[50]};
                          border-radius: ${designTokens.borderRadius.md};
                        `}
                      >
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.lg};
                            font-weight: ${designTokens.typography.fontWeight
                              .bold};
                            color: ${designTokens.colors.primary[600]};
                            margin-bottom: ${designTokens.spacing[1]};
                          `}
                        >
                          ${agent.financialMetrics.totalValue.toLocaleString()}
                        </div>
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            color: ${designTokens.colors.neutral[600]};
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                          `}
                        >
                          Total Value
                        </div>
                      </div>
                      <div
                        css={css`
                          text-align: center;
                          padding: ${designTokens.spacing[3]};
                          background: ${designTokens.colors.neutral[50]};
                          border-radius: ${designTokens.borderRadius.md};
                        `}
                      >
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.lg};
                            font-weight: ${designTokens.typography.fontWeight
                              .bold};
                            color: ${agent.financialMetrics.dailyPnL >= 0
                              ? designTokens.colors.semantic.success[600]
                              : designTokens.colors.semantic.error[600]};
                            margin-bottom: ${designTokens.spacing[1]};
                          `}
                        >
                          {agent.financialMetrics.dailyPnL >= 0 ? "+" : ""}$
                          {agent.financialMetrics.dailyPnL.toFixed(2)}
                        </div>
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            color: ${designTokens.colors.neutral[600]};
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                          `}
                        >
                          Daily P&L
                        </div>
                      </div>
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
            min-height: 300px;
          `}
        >
          <Card
            variant="default"
            css={css`
              max-width: 500px;
              border-color: ${designTokens.colors.semantic.error[200]};
              background: ${designTokens.colors.semantic.error[50]};
            `}
          >
            <CardContent
              css={css`
                text-align: center;
                padding: ${designTokens.spacing[8]};
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
              <h3
                css={css`
                  color: ${designTokens.colors.semantic.error[700]};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Data Fetching Failed
              </h3>
              <p
                css={css`
                  color: ${designTokens.colors.neutral[600]};
                  margin-bottom: ${designTokens.spacing[6]};
                  font-size: ${designTokens.typography.fontSize.sm};
                `}
              >
                {error}
              </p>
              <button
                css={css`
                  padding: ${designTokens.spacing[2]} ${designTokens.spacing[6]};
                  background: ${designTokens.colors.primary[500]};
                  color: white;
                  border: none;
                  border-radius: ${designTokens.borderRadius.md};
                  cursor: pointer;
                  font-weight: ${designTokens.typography.fontWeight.medium};

                  &:hover {
                    background: ${designTokens.colors.primary[600]};
                  }
                `}
                onClick={() => fetchDashboardData(true)}
              >
                Retry Connection
              </button>

              <div
                css={css`
                  margin-top: ${designTokens.spacing[4]};
                  padding-top: ${designTokens.spacing[4]};
                  border-top: 1px solid
                    ${designTokens.colors.semantic.error[200]};
                `}
              >
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

        <div
          css={css`
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
          `}
        >
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

      {renderSystemHealth()}
      {renderAgentMonitoring()}

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
