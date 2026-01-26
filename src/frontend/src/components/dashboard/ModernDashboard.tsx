import { useState, useEffect, lazy, Suspense } from "react";
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
import {
  cardHoverStylesNoTransform,
  textStyles,
  buttonStyles,
} from "./sharedStyles";
import { Tooltip } from "../ui/Tooltip";
import { BaseAgent, SystemHealth, AgentType } from "../../types";
import { useSapienceData } from "../../hooks/useSapienceData";

// Lazy load SapienceMarkets for code splitting
const SapienceMarkets = lazy(() => import("../sapience/SapienceMarkets"));

interface DashboardProps {
  userType: string;
}

interface AgentMonitoringData extends BaseAgent {
  type: AgentType;
  lastActivity: string;
  avatar?: string;
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
  sapienceProfile?: {
    agentRank: number;
    totalEarnings: number;
    winRate: number;
    forecastsWon: number;
    reputation: number;
  };
  governanceProfile?: {
    isDeployed: boolean;
    policyCompliance: number;
    auditScore: number;
    riskLevel: "low" | "medium" | "high";
    deploymentStatus: string;
  };
  trustScore?: number;
  overallRank?: number;
}

// Note: Live markets are now fetched directly in SapienceMarkets component

interface DashboardSummary {
  sapience: {
    liveMarkets: number;
    activeAgents: number;
    totalPoolValue: number;
  };
  governance: {
    totalPolicies: number;
    totalAgents: number;
    totalActions: number;
  };
  unified: {
    deployedAgents: number;
    averageTrustScore: number;
    totalValue: number;
  };
}

interface ActivityFeedItem {
  type: string;
  source: "sapience" | "filecoin" | "system";
  timestamp: string;
  data: any;
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

const navContainerStyles = css`
  display: flex;
  justify-content: center;
  gap: ${designTokens.spacing[2]};
  margin-bottom: ${designTokens.spacing[8]};
  padding: ${designTokens.spacing[1]};
  background: ${designTokens.colors.neutral[100]};
  border-radius: ${designTokens.borderRadius.full};
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
`;

const navButtonStyles = (active: boolean) => css`
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[6]};
  border-radius: ${designTokens.borderRadius.full};
  border: none;
  background: ${active ? designTokens.colors.neutral[0] : "transparent"};
  color: ${active
    ? designTokens.colors.primary[600]
    : designTokens.colors.neutral[600]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${active ? shadowSystem.sm : "none"};

  &:hover {
    color: ${designTokens.colors.primary[500]};
  }
`;

const activityFeedStyles = css`
  display: flex;
  flex-direction: column;
  gap: ${designTokens.spacing[3]};
`;

const activityItemStyles = (source: string) => css`
  display: flex;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[4]};
  background: ${designTokens.colors.neutral[0]};
  border-radius: ${designTokens.borderRadius.lg};
  border-left: 4px solid
    ${source === "sapience"
      ? designTokens.colors.secondary[500]
      : source === "filecoin"
        ? designTokens.colors.primary[500]
        : designTokens.colors.neutral[400]};
  ${cardHoverStylesNoTransform}
`;

export default function ModernDashboard({
  userType: _userType,
}: DashboardProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [agentData, setAgentData] = useState<AgentMonitoringData[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isApiConnected, setIsApiConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<
    "overview" | "markets" | "agents" | "governance"
  >("overview");

  // Sapience real-time data
  const { stats: sapienceStats, leaderboard: sapienceLeaderboard } = useSapienceData();

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
      const rawApiKey = import.meta.env.VITE_API_KEY || "sapience-hackathon-key";
      const apiKey = rawApiKey.trim();
      const headers = { "X-API-KEY": apiKey };
      
      // Debug: Log masked key to verify it's being picked up
      console.log(`[Dashboard] Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

      if (isInitial) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setLoadingStep(1);
      }

      // 1. Fetch System Health
      const healthUrl = getApiUrl("/api/system/health");
      const healthResponse = await fetch(healthUrl, {
        headers,
      });
      
      if (!healthResponse.ok) {
        const errorBody = await healthResponse.text().catch(() => 'No body');
        console.error(`[Dashboard] Health check failed (${healthResponse.status}):`, errorBody);
        throw new Error(`System health unavailable (${healthResponse.status})`);
      }
      const health = await healthResponse.json();
      setSystemHealth(health);

      if (isInitial) {
        setLoadingStep(2);
      }

      // 2. Fetch Unified Summary
      try {
        const summaryResponse = await fetch(getApiUrl("/api/dashboard/unified"), {
          headers,
        });
        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          if (summaryResult.success && summaryResult.data) {
              const data = summaryResult.data;
              setSummary({
                  sapience: {
                      liveMarkets: data.systemHealth?.activeAgents || 0,
                      activeAgents: data.systemHealth?.activeAgents || 0,
                      totalPoolValue: 0
                  },
                  governance: {
                      totalPolicies: 0,
                      totalAgents: data.systemHealth?.totalAgents || 0,
                      totalActions: data.systemHealth?.totalActions || 0
                  },
                  unified: {
                      deployedAgents: data.systemHealth?.activeAgents || 0,
                      averageTrustScore: data.systemHealth?.complianceRate || 0,
                      totalValue: 0
                  }
              });
              
              if (data.recentActivity) {
                  setActivityFeed(data.recentActivity.map((a: any) => ({
                      type: a.type,
                      source: a.agent?.includes('sapience') ? 'sapience' : 'system',
                      timestamp: a.timestamp,
                      data: { details: a.action }
                  })));
              }
          }
        }
      } catch (e) {
        console.warn("Summary API not available, falling back to basic metrics");
      }

      // 3. Fetch Agents (Unified/Monitoring)
      let agentsResult;
      const agentsResponse = await fetch(getApiUrl("/api/agents/unified"), {
        headers,
      }).catch(() => fetch(getApiUrl("/api/agents/monitoring"), { headers }));

      if (!agentsResponse.ok) {
        throw new Error(
          `Agent monitoring unavailable (${agentsResponse.status})`,
        );
      }
      agentsResult = await agentsResponse.json();

      let agents;
      if (Array.isArray(agentsResult)) {
        agents = agentsResult;
      } else if (agentsResult.success && Array.isArray(agentsResult.data)) {
        agents = agentsResult.data;
      } else if (agentsResult.success && agentsResult.data && Array.isArray(agentsResult.data.agents)) {
        agents = agentsResult.data.agents;
      } else if (agentsResult.agents && Array.isArray(agentsResult.agents)) {
        agents = agentsResult.agents;
      } else {
        console.error("Invalid agent data format. Received:", agentsResult);
        throw new Error("Invalid agent data format from API");
      }
      setAgentData(agents);

      // Note: Live Sapience markets are now fetched by SapienceMarkets component via useSapienceData hook

      // 4. Fetch Activity Feed
      try {
        if (agentsResult.success && agentsResult.data && agentsResult.data.recentActivity) {
            setActivityFeed(agentsResult.data.recentActivity.map((a: any) => ({
                type: a.type,
                source: a.agent?.includes('sapience') ? 'sapience' : 'system',
                timestamp: a.timestamp,
                data: { details: a.action }
            })));
        } else {
            const feedResponse = await fetch(getApiUrl("/api/feed/live"), {
              headers,
            });
            if (feedResponse.ok) {
              const feedData = await feedResponse.json();
              setActivityFeed(feedData.feed || []);
            }
        }
      } catch (e) {
        console.warn("Activity Feed API not available");
      }

      if (isInitial) {
        setLoadingStep(3);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setIsApiConnected(true);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching dashboard data:", error);

      if (isInitial || !systemHealth) {
        setError(error instanceof Error ? error.message : "Failed to load dashboard data");
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

  const renderPlatformSummary = () => {
    // Show Sapience stats from the hook, fallback to summary data if available
    const activeMarkets = sapienceStats?.activeConditions ?? summary?.sapience?.liveMarkets ?? 0;
    const totalForecasts = sapienceStats?.totalForecasts ?? summary?.sapience?.totalPoolValue ?? 0;
    const totalConditions = sapienceStats?.totalConditions ?? 0;

    return (
      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: ${designTokens.spacing[6]};
          margin-bottom: ${designTokens.spacing[8]};
        `}
      >
        <Card
          variant="elevated"
          css={css`
            background: linear-gradient(
              135deg,
              ${designTokens.colors.primary[900]} 0%,
              ${designTokens.colors.primary[700]} 100%
            );
            color: white;
          `}
        >
          <CardContent>
            <CardTitle css={css`color: white; opacity: 0.9; font-size: 0.9rem;`}>🔮 Sapience Forecasts</CardTitle>
            <div css={css`display: flex; justify-content: space-between; margin-top: 1rem;`}>
              <div>
                <div css={css`font-size: 1.5rem; font-weight: bold;`}>{activeMarkets}</div>
                <div css={css`font-size: 0.75rem; opacity: 0.8;`}>Active Markets</div>
              </div>
              <div>
                <div css={css`font-size: 1.5rem; font-weight: bold;`}>{totalForecasts.toLocaleString()}</div>
                <div css={css`font-size: 0.75rem; opacity: 0.8;`}>Forecasts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          variant="elevated"
          css={css`
            background: linear-gradient(
              135deg,
              ${designTokens.colors.secondary[900]} 0%,
              ${designTokens.colors.secondary[700]} 100%
            );
            color: white;
          `}
        >
          <CardContent>
            <CardTitle css={css`color: white; opacity: 0.9; font-size: 0.9rem;`}>⛓️ Filecoin Governance</CardTitle>
            <div css={css`display: flex; justify-content: space-between; margin-top: 1rem;`}>
              <div>
                <div css={css`font-size: 1.5rem; font-weight: bold;`}>{summary?.governance?.totalPolicies ?? 0}</div>
                <div css={css`font-size: 0.75rem; opacity: 0.8;`}>Policies</div>
              </div>
              <div>
                <div css={css`font-size: 1.5rem; font-weight: bold;`}>{summary?.governance?.totalActions ?? 0}</div>
                <div css={css`font-size: 0.75rem; opacity: 0.8;`}>Actions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          variant="elevated"
          css={css`
            background: white;
            border-left: 4px solid ${designTokens.colors.primary[500]};
          `}
        >
          <CardContent>
            <CardTitle css={css`font-size: 0.9rem;`}>🌟 Unified Platform</CardTitle>
            <div css={css`display: flex; justify-content: space-between; margin-top: 1rem;`}>
              <div>
                <div css={css`font-size: 1.5rem; font-weight: bold; color: ${designTokens.colors.primary[700]};`}>{totalConditions}</div>
                <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]};`}>All Markets</div>
              </div>
              <div>
                <div css={css`font-size: 1.5rem; font-weight: bold; color: ${designTokens.colors.primary[700]};`}>{sapienceLeaderboard.length}</div>
                <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[500]};`}>Forecasters</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderActivityFeed = () => {
    if (activityFeed.length === 0) return null;

    return (
      <Card variant="default">
        <CardContent>
          <CardTitle css={css`margin-bottom: ${designTokens.spacing[6]};`}>📡 Live Activity Feed</CardTitle>
          <div css={activityFeedStyles}>
            {activityFeed.slice(0, 5).map((item, index) => (
              <div key={index} css={activityItemStyles(item.source)}>
                <div css={css`font-size: 1.25rem;`}>
                  {item.source === "sapience" ? "🏁" : item.source === "filecoin" ? "⛓️" : "🤖"}
                </div>
                <div css={css`flex: 1;`}>
                  <div css={css`font-weight: bold; font-size: 0.85rem; text-transform: uppercase; color: ${designTokens.colors.neutral[500]};`}>
                    {item.type.replace("_", " ")}
                  </div>
                  <div css={css`font-size: 0.95rem; margin: 2px 0;`}>
                    {item.type === "forecast_win" && (
                      <><strong>{item.data.agent.name}</strong> correctly predicted market outcome</>
                    )}
                    {item.type === "governance_action" && (
                      <>{item.data.details}</>
                    )}
                    {!["competition_win", "governance_action"].includes(item.type) && (
                      <>{JSON.stringify(item.data)}</>
                    )}
                  </div>
                  <div css={css`font-size: 0.75rem; color: ${designTokens.colors.neutral[400]};`}>
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
                      {agent.type === "recall" ? "Sapience" : agent.type}
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
                  <div css={textStyles.description}>
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
                        {agent.performance?.uptime ?? 0}%
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
                        {agent.performance?.successRate ?? 0}%
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
                        {agent.riskMetrics?.complianceRate ?? 100}%
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
                          background: ${(agent.riskMetrics?.complianceRate ?? 100) > 95
                            ? designTokens.colors.semantic.success[500]
                            : (agent.riskMetrics?.complianceRate ?? 100) > 90
                              ? designTokens.colors.semantic.warning[500]
                              : designTokens.colors.semantic.error[500]};
                          width: ${agent.riskMetrics?.complianceRate ?? 100}%;
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
                      ${buttonStyles.primary}
                    `}
                  >
                    View Details
                  </button>
                  <button
                    css={css`
                      flex: 1;
                      ${buttonStyles.secondary}
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
                  ${buttonStyles.primary}
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

        {/* Tabbed Navigation */}
        <div css={navContainerStyles}>
          <button
            css={navButtonStyles(activeView === "overview")}
            onClick={() => setActiveView("overview")}
          >
            📊 Overview
          </button>
          <button
            css={navButtonStyles(activeView === "markets")}
            onClick={() => setActiveView("markets")}
          >
            🏆 Markets
          </button>
          <button
            css={navButtonStyles(activeView === "agents")}
            onClick={() => setActiveView("agents")}
          >
            🤖 Agents
          </button>
          <button
            css={navButtonStyles(activeView === "governance")}
            onClick={() => setActiveView("governance")}
          >
            🛡️ Governance
          </button>
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

      {/* Dynamic View Rendering */}
      <div
        css={css`
          ${keyframeAnimations.fadeInUp}
        `}
      >
        {activeView === "overview" && (
          <>
            {renderPlatformSummary()}
            {renderSystemHealth()}
            <div
              css={css`
                display: grid;
                grid-template-columns: 1fr 350px;
                gap: ${designTokens.spacing[6]};
                margin-top: ${designTokens.spacing[8]};

                @media (max-width: ${designTokens.breakpoints.lg}) {
                  grid-template-columns: 1fr;
                }
              `}
            >
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: ${designTokens.spacing[6]};
                `}
              >
                {renderAgentMonitoring()}
                <div
                  css={css`
                    max-width: 100%;
                    padding: ${designTokens.spacing[5]};
                    background: ${designTokens.colors.neutral[0]};
                    border-radius: ${designTokens.borderRadius.lg};
                    border: 1px solid ${designTokens.colors.neutral[200]};
                    text-align: left;

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
                    <strong>Sapience</strong> is an autonomous AI agent designed
                    for prediction market participation. It analyzes market data,
                    generates forecasts, and attests to its predictions on-chain.
                  </p>
                  <p>
                    Operated within strict compliance policies, providing
                    transparent, verifiable predictions through EAS.
                  </p>
                </div>
              </div>
              <div>{renderActivityFeed()}</div>
            </div>
          </>
        )}

        {activeView === "markets" && (
          <Suspense fallback={
            <div css={css`
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 300px;
            `}>
              <div css={css`
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
              `} />
            </div>
          }>
            <SapienceMarkets />
          </Suspense>
        )}

        {activeView === "agents" && renderAgentMonitoring()}

        {activeView === "governance" && (
          <div css={css`max-width: 800px; margin: 0 auto;`}>
            <Card variant="elevated">
              <CardContent>
                <CardTitle css={css`margin-bottom: 1.5rem;`}>
                  🛡️ AI Governance Framework
                </CardTitle>
                <div css={css`display: flex; flex-direction: column; gap: 1.5rem;`}>
                  <div
                    css={css`
                      padding: 1rem;
                      background: ${designTokens.colors.neutral[50]};
                      border-radius: 8px;
                      border-left: 4px solid
                        ${designTokens.colors.primary[500]};
                    `}
                  >
                    <h4 css={css`margin-bottom: 0.5rem;`}>Immutable Logic</h4>
                    <p
                      css={css`
                        font-size: 0.9rem;
                        color: ${designTokens.colors.neutral[600]};
                      `}
                    >
                      All agent decisions are governed by smart contracts on
                      Filecoin FVM, ensuring compliance with predefined safety
                      bounds.
                    </p>
                  </div>
                  <div
                    css={css`
                      padding: 1rem;
                      background: ${designTokens.colors.neutral[50]};
                      border-radius: 8px;
                      border-left: 4px solid
                        ${designTokens.colors.secondary[500]};
                    `}
                  >
                    <h4 css={css`margin-bottom: 0.5rem;`}>
                      Real-Time Policy Enforcement
                    </h4>
                    <p
                      css={css`
                        font-size: 0.9rem;
                        color: ${designTokens.colors.neutral[600]};
                      `}
                    >
                      Decision audits are performed before any trading action is
                      executed, preventing high-risk violations automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div
        css={css`
          margin-top: ${designTokens.spacing[10]};
          display: flex;
          justify-content: center;
        `}
      >
        <BlockchainStatus />
      </div>

      <ConnectionStatus isConnected={isApiConnected} apiUrl="Sapience API" />
    </div>
  );
}
