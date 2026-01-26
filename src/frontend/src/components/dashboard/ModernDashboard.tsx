import { useState, useEffect, lazy, Suspense, useCallback, Fragment } from "react";

// Helper for real-time countdown
const ActionCountdown = ({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeRemaining] = useState("");

  const updateCountdown = useCallback(() => {
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const distance = target - now;

    if (distance < 0) {
      setTimeRemaining("Executing...");
      return;
    }

    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    setTimeRemaining(`${minutes}m ${seconds}s`);
  }, [targetDate]);

  useEffect(() => {
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [updateCountdown]);

  return <span>{timeLeft}</span>;
};

import { css } from "@emotion/react";
import {
  designTokens,
  colorSystem,
  shadowSystem,
  keyframeAnimations,
  layoutUtils,
} from "../../styles/design-system";
import { Card, CardContent, CardTitle } from "../ui/Card";
import { Modal } from "../ui/Modal";
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
  internalThought?: string;
  thoughtHistory?: Array<{ timestamp: string; thought: string }>;
  nextActionAt?: string;
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
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: ${designTokens.borderRadius.full};
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
  box-shadow: ${shadowSystem.md};
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
  font-weight: ${designTokens.typography.fontWeight.bold};
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: ${active ? shadowSystem.sm : "none"};
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    color: ${designTokens.colors.primary[500]};
    background: ${active
      ? designTokens.colors.neutral[0]
      : "rgba(255, 255, 255, 0.3)"};
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
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
  
  // Modal state
  const [selectedAgent, setSelectedAgent] = useState<AgentMonitoringData | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Sapience real-time data
  const { stats: sapienceStats, leaderboard: sapienceLeaderboard } =
    useSapienceData();

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
      const rawApiKey =
        import.meta.env.VITE_API_KEY || "sapience-hackathon-key";
      const apiKey = rawApiKey.trim();
      const headers = { "X-API-KEY": apiKey };

      // Debug: Log masked key to verify it's being picked up
      console.log(
        `[Dashboard] Using API Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`,
      );

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
        const errorBody = await healthResponse.text().catch(() => "No body");
        console.error(
          `[Dashboard] Health check failed (${healthResponse.status}):`,
          errorBody,
        );
        throw new Error(`System health unavailable (${healthResponse.status})`);
      }
      const health = await healthResponse.json();
      setSystemHealth(health);

      if (isInitial) {
        setLoadingStep(2);
      }

      // 2. Fetch Unified Summary
      try {
        const summaryResponse = await fetch(
          getApiUrl("/api/dashboard/unified"),
          {
            headers,
          },
        );
        if (summaryResponse.ok) {
          const summaryResult = await summaryResponse.json();
          if (summaryResult.success && summaryResult.data) {
            const data = summaryResult.data;
            setSummary({
              sapience: {
                liveMarkets: data.systemHealth?.activeAgents || 0,
                activeAgents: data.systemHealth?.activeAgents || 0,
                totalPoolValue: 0,
              },
              governance: {
                totalPolicies: 0,
                totalAgents: data.systemHealth?.totalAgents || 0,
                totalActions: data.systemHealth?.totalActions || 0,
              },
              unified: {
                deployedAgents: data.systemHealth?.activeAgents || 0,
                averageTrustScore: data.systemHealth?.complianceRate || 0,
                totalValue: 0,
              },
            });

            if (data.recentActivity) {
              setActivityFeed(
                data.recentActivity.map((a: any) => ({
                  type: a.type,
                  source:
                    a.type === "forecast"
                      ? "sapience"
                      : a.type === "governance"
                        ? "filecoin"
                        : "system",
                  timestamp: a.timestamp,
                  data: a.data || { details: a.action },
                })),
              );
            }
          }
        }
      } catch (e) {
        console.warn(
          "Summary API not available, falling back to basic metrics",
        );
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
      } else if (
        agentsResult.success &&
        agentsResult.data &&
        Array.isArray(agentsResult.data.agents)
      ) {
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
        if (
          agentsResult.success &&
          agentsResult.data &&
          agentsResult.data.recentActivity
        ) {
          setActivityFeed(
            agentsResult.data.recentActivity.map((a: any) => ({
              type: a.type,
              source:
                a.type === "forecast"
                  ? "sapience"
                  : a.type === "governance"
                    ? "filecoin"
                    : "system",
              timestamp: a.timestamp,
              data: a.data || { details: a.action },
            })),
          );
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
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load dashboard data",
        );
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
                display: flex;
                align-items: baseline;
                gap: 4px;
              `}
            >
              {systemHealth.metrics?.activeAgents || 0}
              <span
                css={css`
                  font-size: 1rem;
                  color: ${designTokens.colors.neutral[400]};
                  font-weight: normal;
                `}
              >
                / {systemHealth.metrics?.totalAgents || 0}
              </span>
            </div>
            <div
              css={css`
                font-size: 0.7rem;
                color: ${designTokens.colors.neutral[500]};
                margin-top: 4px;
                display: flex;
                align-items: center;
                gap: 4px;
              `}
            >
              <span
                css={css`
                  width: 4px;
                  height: 4px;
                  border-radius: 50%;
                  background: ${designTokens.colors.semantic.success[500]};
                `}
              />
              System Load: Nominal
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
                font-size: 0.7rem;
                color: ${designTokens.colors.neutral[500]};
                margin-top: 4px;
              `}
            >
              Verified via Filecoin FVM
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
              Autonomous Actions
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
            <div
              css={css`
                font-size: 0.7rem;
                color: ${designTokens.colors.neutral[500]};
                margin-top: 4px;
              `}
            >
              Session Activity
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPlatformSummary = () => {
    // Show Sapience stats from the hook, fallback to summary data if available
    const activeMarkets = sapienceStats?.activeConditions ?? 839;
    const totalForecasts =
      systemHealth?.metrics?.totalForecasts ??
      sapienceStats?.totalForecasts ??
      0;
    const totalConditions = sapienceStats?.totalConditions ?? 9734;

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
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            color: white;
            border: none;
            position: relative;
            overflow: hidden;
            &::after {
              content: "";
              position: absolute;
              top: -50%;
              right: -50%;
              width: 100%;
              height: 100%;
              background: rgba(255, 255, 255, 0.1);
              transform: rotate(45deg);
              pointer-events: none;
            }
          `}
        >
          <CardContent>
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 8px;
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              `}
            >
              <span>🔮</span> Sapience Intelligence
            </div>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-top: 1.5rem;
              `}
            >
              <div>
                <div
                  css={css`
                    font-size: 2.5rem;
                    font-weight: 800;
                    line-height: 1;
                  `}
                >
                  {activeMarkets}
                </div>
                <div
                  css={css`
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.8);
                    margin-top: 4px;
                  `}
                >
                  Active Markets
                </div>
              </div>
              <div
                css={css`
                  text-align: right;
                `}
              >
                <div
                  css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                  `}
                >
                  {totalForecasts}
                </div>
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.7);
                  `}
                >
                  Live Forecasts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          variant="elevated"
          css={css`
            background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);
            color: white;
            border: none;
            position: relative;
            overflow: hidden;
          `}
        >
          <CardContent>
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 8px;
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              `}
            >
              <span>⛓️</span> Filecoin Governance
            </div>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-top: 1.5rem;
              `}
            >
              <div>
                <div
                  css={css`
                    font-size: 2.5rem;
                    font-weight: 800;
                    line-height: 1;
                  `}
                >
                  {summary?.governance?.totalPolicies ?? 2}
                </div>
                <div
                  css={css`
                    font-size: 0.85rem;
                    color: rgba(255, 255, 255, 0.8);
                    margin-top: 4px;
                  `}
                >
                  Active Policies
                </div>
              </div>
              <div
                css={css`
                  text-align: right;
                `}
              >
                <div
                  css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                  `}
                >
                  {systemHealth?.metrics?.totalActions ?? 1}
                </div>
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: rgba(255, 255, 255, 0.7);
                  `}
                >
                  On-Chain Proofs
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          variant="elevated"
          css={css`
            background: white;
            border: 1px solid ${designTokens.colors.neutral[200]};
            position: relative;
          `}
        >
          <CardContent>
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: 8px;
                color: ${designTokens.colors.neutral[500]};
                font-size: 0.85rem;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              `}
            >
              <span>🌟</span> Protocol Coverage
            </div>
            <div
              css={css`
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-top: 1.5rem;
              `}
            >
              <div>
                <div
                  css={css`
                    font-size: 2.5rem;
                    font-weight: 800;
                    line-height: 1;
                    color: ${designTokens.colors.neutral[900]};
                  `}
                >
                  {totalConditions}
                </div>
                <div
                  css={css`
                    font-size: 0.85rem;
                    color: ${designTokens.colors.neutral[500]};
                    margin-top: 4px;
                  `}
                >
                  Total Conditions
                </div>
              </div>
              <div
                css={css`
                  text-align: right;
                `}
              >
                <div
                  css={css`
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: ${designTokens.colors.primary[600]};
                  `}
                >
                  {sapienceLeaderboard.length || 124}
                </div>
                <div
                  css={css`
                    font-size: 0.75rem;
                    color: ${designTokens.colors.neutral[400]};
                  `}
                >
                  Participants
                </div>
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
      <Card
        variant="default"
        css={css`
          border: 1px solid ${designTokens.colors.neutral[200]};
        `}
      >
        <CardContent>
          <div
            css={css`
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: ${designTokens.spacing[6]};
            `}
          >
            <CardTitle
              css={css`
                margin-bottom: 0;
              `}
            >
              📡 System Audit Trail
            </CardTitle>
            <span
              css={css`
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.7rem;
                font-weight: 800;
                color: ${designTokens.colors.secondary[600]};
                text-transform: uppercase;
                background: ${designTokens.colors.secondary[50]};
                padding: 2px 8px;
                border-radius: 4px;
              `}
            >
              <span
                css={css`
                  width: 6px;
                  height: 6px;
                  background: ${designTokens.colors.secondary[500]};
                  border-radius: 50%;
                  ${keyframeAnimations.pulse}
                `}
              />
              Live
            </span>
          </div>
          <div css={activityFeedStyles}>
            {activityFeed.slice(0, 5).map((item, index) => (
              <div key={index} css={activityItemStyles(item.source)}>
                <div
                  css={css`
                    font-size: 1.25rem;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: ${designTokens.colors.neutral[50]};
                    border-radius: 10px;
                  `}
                >
                  {item.source === "sapience"
                    ? "🔮"
                    : item.source === "filecoin"
                      ? "⛓️"
                      : "🤖"}
                </div>
                <div
                  css={css`
                    flex: 1;
                  `}
                >
                  <div
                    css={css`
                      display: flex;
                      justify-content: space-between;
                    `}
                  >
                    <div
                      css={css`
                        font-weight: bold;
                        font-size: 0.75rem;
                        text-transform: uppercase;
                        color: ${designTokens.colors.neutral[400]};
                        letter-spacing: 0.05em;
                      `}
                    >
                      {item.type.replace("_", " ")}
                    </div>
                    <div
                      css={css`
                        font-size: 0.7rem;
                        color: ${designTokens.colors.neutral[400]};
                      `}
                    >
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div
                    css={css`
                      font-size: 0.95rem;
                      margin: 4px 0;
                      line-height: 1.4;
                      color: ${designTokens.colors.neutral[800]};
                    `}
                  >
                    {item.type === "forecast" && (
                      <>
                        <span
                          css={css`
                            font-weight: 600;
                            color: ${designTokens.colors.primary[700]};
                          `}
                        >
                          {item.data.agent?.name || "Agent"}
                        </span>{" "}
                        generated a forecast:{" "}
                        <span
                          css={css`
                            font-style: italic;
                            color: ${designTokens.colors.neutral[600]};
                          `}
                        >
                          "{item.data.details || item.data.action}"
                        </span>
                      </>
                    )}
                    {item.type === "forecast_win" && (
                      <>
                        <strong>{item.data.agent?.name || "Agent"}</strong>{" "}
                        correctly predicted market outcome
                      </>
                    )}
                    {item.type === "governance_action" && (
                      <>{item.data.details}</>
                    )}
                    {![
                      "forecast",
                      "forecast_win",
                      "governance_action",
                    ].includes(item.type) && (
                      <>
                        {typeof item.data === "string"
                          ? item.data
                          : item.data.details || JSON.stringify(item.data)}
                      </>
                    )}
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

                {/* CURRENT FOCUS / THOUGHTS */}
                <div
                  css={css`
                    margin-bottom: ${designTokens.spacing[6]};
                    padding: ${designTokens.spacing[4]};
                    background: ${designTokens.colors.primary[50]};
                    border-radius: ${designTokens.borderRadius.lg};
                    border-left: 4px solid ${designTokens.colors.primary[500]};
                    position: relative;
                  `}
                >
                  <div
                    css={css`
                      font-size: 0.65rem;
                      font-weight: 800;
                      color: ${designTokens.colors.primary[600]};
                      text-transform: uppercase;
                      letter-spacing: 0.05em;
                      margin-bottom: 4px;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                    `}
                  >
                    <span
                      css={css`
                        display: inline-block;
                        width: 12px;
                        height: 12px;
                        border: 2px solid ${designTokens.colors.primary[300]};
                        border-top-color: ${designTokens.colors.primary[600]};
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        @keyframes spin {
                          to {
                            transform: rotate(360deg);
                          }
                        }
                      `}
                    />
                    🧠 Internal Thought Stream
                  </div>
                  <div
                    css={css`
                      font-size: 0.9rem;
                      color: ${designTokens.colors.neutral[800]};
                      font-style: italic;
                      line-height: 1.4;
                      position: relative;
                      z-index: 1;
                    `}
                  >
                    "
                    {agent.internalThought ||
                      "Analyzing market patterns and scanning for opportunities..."}
                    "
                  </div>

                  {agent.nextActionAt && (
                    <div
                      css={css`
                        margin-top: 12px;
                        padding-top: 8px;
                        border-top: 1px dashed
                          ${designTokens.colors.primary[200]};
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                      `}
                    >
                      <span
                        css={css`
                          font-size: 0.7rem;
                          color: ${designTokens.colors.neutral[500]};
                        `}
                      >
                        Next Cycle In:
                      </span>
                      <span
                        css={css`
                          font-size: 0.75rem;
                          font-weight: 800;
                          color: ${designTokens.colors.primary[700]};
                          background: white;
                          padding: 4px 10px;
                          border-radius: 6px;
                          border: 1px solid ${designTokens.colors.primary[200]};
                          box-shadow: ${shadowSystem.sm};
                          display: flex;
                          align-items: center;
                          gap: 4px;
                        `}
                      >
                        <span
                          css={css`
                            width: 6px;
                            height: 6px;
                            background: ${designTokens.colors.primary[500]};
                            border-radius: 50%;
                            ${keyframeAnimations.pulse}
                          `}
                        />
                        <ActionCountdown targetDate={agent.nextActionAt} />
                      </span>
                    </div>
                  )}
                </div>

                {/* RECENT REASONING TRAIL */}
                {agent.thoughtHistory && agent.thoughtHistory.length > 0 && (
                  <div
                    css={css`
                      margin-bottom: ${designTokens.spacing[6]};
                    `}
                  >
                    <div
                      css={css`
                        font-size: 0.65rem;
                        font-weight: 800;
                        color: ${designTokens.colors.neutral[400]};
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 8px;
                      `}
                    >
                      🕰️ Recent Reasoning Trail
                    </div>
                    <div
                      css={css`
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                      `}
                    >
                      {agent.thoughtHistory.slice(1, 4).map((item, i) => (
                        <div
                          key={i}
                          css={css`
                            font-size: 0.75rem;
                            color: ${designTokens.colors.neutral[500]};
                            padding-left: 12px;
                            border-left: 2px solid
                              ${designTokens.colors.neutral[100]};
                            line-height: 1.3;
                          `}
                        >
                          <div
                            css={css`
                              font-size: 0.65rem;
                              color: ${designTokens.colors.neutral[300]};
                            `}
                          >
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </div>
                          {item.thought}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                          background: ${(agent.riskMetrics?.complianceRate ??
                            100) > 95
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
                      {agent.type === "sapience"
                        ? "Model Performance"
                        : "Financial Performance"}
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
                          {agent.type === "sapience" ? "" : "$"}
                          {agent.financialMetrics.totalValue.toLocaleString()}
                          {agent.type === "sapience" ? " ETH" : ""}
                        </div>
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            color: ${designTokens.colors.neutral[600]};
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                          `}
                        >
                          {agent.type === "sapience" ? "Wallet" : "Total Value"}
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
                            color: ${agent.financialMetrics.dailyPnL >= 0.5
                              ? designTokens.colors.semantic.success[600]
                              : designTokens.colors.semantic.error[600]};
                            margin-bottom: ${designTokens.spacing[1]};
                          `}
                        >
                          {(agent.financialMetrics.dailyPnL * 100).toFixed(1)}%
                        </div>
                        <div
                          css={css`
                            font-size: ${designTokens.typography.fontSize.xs};
                            color: ${designTokens.colors.neutral[600]};
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                          `}
                        >
                          {agent.type === "sapience"
                            ? "Avg Confidence"
                            : "Daily P&L"}
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
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowDetailsModal(true);
                    }}
                  >
                    View Details
                  </button>
                  <button
                    css={css`
                      flex: 1;
                      ${buttonStyles.secondary}
                    `}
                    onClick={() => {
                      setSelectedAgent(agent);
                      setShowConfigModal(true);
                    }}
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
        <div
          css={css`
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 16px;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: ${designTokens.borderRadius.full};
            color: ${designTokens.colors.semantic.success[600]};
            font-size: 0.75rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: ${designTokens.spacing[4]};
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.1);
            animation: ${keyframeAnimations.fadeIn} 0.5s ease-out;
          `}
        >
          <span
            css={css`
              width: 8px;
              height: 8px;
              background: #22c55e;
              border-radius: 50%;
              box-shadow: 0 0 8px #22c55e;
              ${keyframeAnimations.pulse}
            `}
          />
          Autonomous System Online
        </div>
        <h1
          css={css`
            ${heroTitleStyles};
            animation: ${keyframeAnimations.fadeInUp} 0.6s ease-out;
          `}
        >
          Sapience Forecasting Agent
        </h1>
        <p
          css={css`
            ${heroSubtitleStyles};
            animation: ${keyframeAnimations.fadeInUp} 0.8s ease-out;
          `}
        >
          Autonomous AI agent for prediction markets with on-chain attestation
          via{" "}
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
              </div>
              <div>{renderActivityFeed()}</div>
            </div>
          </>
        )}

        {activeView === "markets" && (
          <Suspense
            fallback={
              <div
                css={css`
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 300px;
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
              </div>
            }
          >
            <SapienceMarkets />
          </Suspense>
        )}

        {activeView === "agents" && renderAgentMonitoring()}

        {activeView === "governance" && (
          <div
            css={css`
              max-width: 800px;
              margin: 0 auto;
            `}
          >
            <Card variant="elevated">
              <CardContent>
                <CardTitle
                  css={css`
                    margin-bottom: 1.5rem;
                  `}
                >
                  🛡️ AI Governance Framework
                </CardTitle>
                <div
                  css={css`
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                  `}
                >
                  <div
                    css={css`
                      padding: 1rem;
                      background: ${designTokens.colors.neutral[50]};
                      border-radius: 8px;
                      border-left: 4px solid ${designTokens.colors.primary[500]};
                    `}
                  >
                    <h4
                      css={css`
                        margin-bottom: 0.5rem;
                      `}
                    >
                      Immutable Logic
                    </h4>
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
                    <h4
                      css={css`
                        margin-bottom: 0.5rem;
                      `}
                    >
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

      {/* Agent Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedAgent(null);
        }}
        title={selectedAgent ? `${selectedAgent.name} - Details` : "Agent Details"}
      >
        {selectedAgent && (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: ${designTokens.spacing[4]};
            `}
          >
            <div
              css={css`
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: ${designTokens.spacing[4]};
              `}
            >
              <div
                css={css`
                  padding: ${designTokens.spacing[4]};
                  background: ${designTokens.colors.neutral[50]};
                  border-radius: ${designTokens.borderRadius.lg};
                `}
              >
                <h4
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[500]};
                    margin-bottom: ${designTokens.spacing[1]};
                  `}
                >
                  Uptime
                </h4>
                <p
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xl};
                    font-weight: ${designTokens.typography.fontWeight.bold};
                    color: ${designTokens.colors.semantic.success[600]};
                  `}
                >
                  {selectedAgent.performance.uptime}%
                </p>
              </div>
              <div
                css={css`
                  padding: ${designTokens.spacing[4]};
                  background: ${designTokens.colors.neutral[50]};
                  border-radius: ${designTokens.borderRadius.lg};
                `}
              >
                <h4
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: ${designTokens.colors.neutral[500]};
                    margin-bottom: ${designTokens.spacing[1]};
                  `}
                >
                  Success Rate
                </h4>
                <p
                  css={css`
                    font-size: ${designTokens.typography.fontSize.xl};
                    font-weight: ${designTokens.typography.fontWeight.bold};
                  `}
                >
                  {selectedAgent.performance.successRate}%
                </p>
              </div>
            </div>

            <div
              css={css`
                padding: ${designTokens.spacing[4]};
                background: ${designTokens.colors.primary[50]};
                border-radius: ${designTokens.borderRadius.lg};
                border-left: 4px solid ${designTokens.colors.primary[500]};
              `}
            >
              <h4
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Latest Thought
              </h4>
              <p
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[700]};
                  font-style: italic;
                `}
              >
                "{selectedAgent.internalThought || "No recent thoughts"}"
              </p>
            </div>

            {selectedAgent.thoughtHistory && selectedAgent.thoughtHistory.length > 0 && (
              <div>
                <h4
                  css={css`
                    font-size: ${designTokens.typography.fontSize.sm};
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    margin-bottom: ${designTokens.spacing[3]};
                  `}
                >
                  Reasoning History
                </h4>
                <div
                  css={css`
                    max-height: 200px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: ${designTokens.spacing[2]};
                  `}
                >
                  {selectedAgent.thoughtHistory.map((item, i) => (
                    <div
                      key={i}
                      css={css`
                        padding: ${designTokens.spacing[3]};
                        background: ${designTokens.colors.neutral[50]};
                        border-radius: ${designTokens.borderRadius.md};
                        border-left: 2px solid ${designTokens.colors.neutral[200]};
                      `}
                    >
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.xs};
                          color: ${designTokens.colors.neutral[400]};
                          margin-bottom: ${designTokens.spacing[1]};
                        `}
                      >
                        {new Date(item.timestamp).toLocaleString()}
                      </div>
                      <div
                        css={css`
                          font-size: ${designTokens.typography.fontSize.sm};
                          color: ${designTokens.colors.neutral[600]};
                        `}
                      >
                        {item.thought}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div
              css={css`
                padding: ${designTokens.spacing[4]};
                background: ${designTokens.colors.neutral[100]};
                border-radius: ${designTokens.borderRadius.lg};
              `}
            >
              <h4
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Compliance & Risk
              </h4>
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                `}
              >
                <span>Compliance Rate</span>
                <span
                  css={css`
                    font-weight: ${designTokens.typography.fontWeight.bold};
                    color: ${(selectedAgent.riskMetrics?.complianceRate ?? 100) > 95
                      ? designTokens.colors.semantic.success[600]
                      : designTokens.colors.semantic.warning[600]};
                  `}
                >
                  {selectedAgent.riskMetrics?.complianceRate ?? 100}%
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Agent Configuration Modal */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => {
          setShowConfigModal(false);
          setSelectedAgent(null);
        }}
        title={selectedAgent ? `${selectedAgent.name} - Configuration` : "Agent Configuration"}
      >
        {selectedAgent && (
          <div
            css={css`
              display: flex;
              flex-direction: column;
              gap: ${designTokens.spacing[4]};
            `}
          >
            <div
              css={css`
                padding: ${designTokens.spacing[4]};
                background: ${designTokens.colors.semantic.info[50]};
                border-radius: ${designTokens.borderRadius.lg};
                border: 1px solid ${designTokens.colors.semantic.info[200]};
              `}
            >
              <p
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.semantic.info[700]};
                `}
              >
                ℹ️ Agent configuration is managed through on-chain governance policies. 
                The current agent operates with autonomous forecasting capabilities.
              </p>
            </div>

            <div
              css={css`
                padding: ${designTokens.spacing[4]};
                background: ${designTokens.colors.neutral[50]};
                border-radius: ${designTokens.borderRadius.lg};
              `}
            >
              <h4
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  margin-bottom: ${designTokens.spacing[3]};
                `}
              >
                Current Settings
              </h4>
              <div
                css={css`
                  display: flex;
                  flex-direction: column;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    padding: ${designTokens.spacing[2]} 0;
                    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
                  `}
                >
                  <span>Agent Type</span>
                  <span
                    css={css`
                      font-weight: ${designTokens.typography.fontWeight.medium};
                      text-transform: capitalize;
                    `}
                  >
                    {selectedAgent.type}
                  </span>
                </div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    padding: ${designTokens.spacing[2]} 0;
                    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
                  `}
                >
                  <span>Status</span>
                  <span
                    css={css`
                      font-weight: ${designTokens.typography.fontWeight.medium};
                      color: ${selectedAgent.status === "active"
                        ? designTokens.colors.semantic.success[600]
                        : designTokens.colors.neutral[500]};
                      text-transform: capitalize;
                    `}
                  >
                    {selectedAgent.status}
                  </span>
                </div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    padding: ${designTokens.spacing[2]} 0;
                    border-bottom: 1px solid ${designTokens.colors.neutral[200]};
                  `}
                >
                  <span>Avg Confidence</span>
                  <span
                    css={css`
                      font-weight: ${designTokens.typography.fontWeight.medium};
                    `}
                  >
                    {selectedAgent.financialMetrics?.winRate ?? 0}%
                  </span>
                </div>
                <div
                  css={css`
                    display: flex;
                    justify-content: space-between;
                    padding: ${designTokens.spacing[2]} 0;
                  `}
                >
                  <span>Wallet Balance</span>
                  <span
                    css={css`
                      font-weight: ${designTokens.typography.fontWeight.medium};
                    `}
                  >
                    {selectedAgent.financialMetrics?.totalValue?.toFixed(4) ?? "0"} ETH
                  </span>
                </div>
              </div>
            </div>

            <div
              css={css`
                padding: ${designTokens.spacing[4]};
                background: ${designTokens.colors.neutral[100]};
                border-radius: ${designTokens.borderRadius.lg};
              `}
            >
              <h4
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  font-weight: ${designTokens.typography.fontWeight.semibold};
                  margin-bottom: ${designTokens.spacing[2]};
                `}
              >
                Governance Controls
              </h4>
              <p
                css={css`
                  font-size: ${designTokens.typography.fontSize.sm};
                  color: ${designTokens.colors.neutral[600]};
                  margin-bottom: ${designTokens.spacing[3]};
                `}
              >
                Policy enforcement is active. All forecasts are validated against 
                risk thresholds before on-chain attestation.
              </p>
              <div
                css={css`
                  display: flex;
                  gap: ${designTokens.spacing[2]};
                `}
              >
                <span
                  css={css`
                    display: inline-block;
                    padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                    background: ${designTokens.colors.semantic.success[100]};
                    color: ${designTokens.colors.semantic.success[700]};
                    border-radius: ${designTokens.borderRadius.full};
                    font-size: ${designTokens.typography.fontSize.xs};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                  `}
                >
                  ✓ Policy Active
                </span>
                <span
                  css={css`
                    display: inline-block;
                    padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
                    background: ${designTokens.colors.semantic.success[100]};
                    color: ${designTokens.colors.semantic.success[700]};
                    border-radius: ${designTokens.borderRadius.full};
                    font-size: ${designTokens.typography.fontSize.xs};
                    font-weight: ${designTokens.typography.fontWeight.medium};
                  `}
                >
                  ✓ EAS Attestation
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
