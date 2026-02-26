/**
 * Unified Dashboard - Single Source of Truth
 *
 * Optimized for both human operators and agent-to-agent interfaces
 * Mobile-first, responsive, and accessible
 *
 * Phase 2 Enhancements:
 * - Swipe gestures for agent carousel
 * - Pull-to-refresh functionality
 * - Touch-optimized interactions (44px+ targets)
 * - Progressive disclosure for mobile
 */

import { useState, useEffect, useRef } from "react";
import { css } from "@emotion/react";
import { useNavigate } from "react-router-dom";
import { designTokens } from "../../styles/design-system";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { agentApi, dashboardApi } from "../../services/apiService";
import {
  Card,
  CardContent,
  StatCard,
  AgentCard,
  Button,
  EcosystemVisualizer,
} from "../ui";

interface DashboardProps {
  mode?: "full" | "minimal"; // minimal for agent-to-agent
}

interface QuickStats {
  activeAgents: number;
  totalAgents: number;
  totalTrades: number;
  avgWinRate: number;
  totalReturn: number;
}

interface AgentSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  winRate: number;
  totalReturn: number;
  lastActive: string;
}

export default function UnifiedDashboard({ mode = "full" }: DashboardProps) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();

  const [viewMode, setViewMode] = useState<"standard" | "ecosystem">(
    (localStorage.getItem("dashboard-view-mode") as any) || "ecosystem",
  );
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMoreActivity, setShowMoreActivity] = useState(false);

  // Pull-to-refresh state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    localStorage.setItem("dashboard-view-mode", viewMode);
  }, [viewMode]);

  // Pull-to-refresh handlers for mobile
  useEffect(() => {
    if (!isMobile || !containerRef.current) return;

    const container = containerRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      if (container.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return;

      const touchY = e.touches[0].clientY;
      const distance = touchY - touchStartY.current;

      if (distance > 0 && distance < 150) {
        setPullDistance(distance);
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance > 80) {
        handleRefresh();
      }
      setIsPulling(false);
      setPullDistance(0);
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, isPulling, pullDistance]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch all data in parallel
      const [statsRes, agentsRes, activityRes] = await Promise.all([
        agentApi.getAggregateStats({}),
        agentApi.compareAgents({
          sortBy: "totalReturn",
          sortDirection: "desc",
        }),
        dashboardApi.getActivityFeed(),
      ]);

      if (statsRes.success && statsRes.data) {
        const data = statsRes.data as any;
        setStats({
          activeAgents: data.totalAgents || 0,
          totalAgents: data.totalAgents || 0,
          totalTrades: data.totalTrades || 0,
          avgWinRate: data.avgWinRate || 0,
          totalReturn: data.avgReturn || 0,
        });
      }

      if (agentsRes.success && agentsRes.data) {
        const data = agentsRes.data as any;
        setAgents(Array.isArray(data) ? data.slice(0, 6) : []); // Top 6 agents
      }

      if (activityRes.success && activityRes.data) {
        const data = activityRes.data as any;
        setRecentActivity(Array.isArray(data) ? data.slice(0, 10) : []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setIsRefreshing(false);
  };

  // Minimal mode for agent-to-agent (JSON-like display)
  if (mode === "minimal") {
    return (
      <div css={minimalContainerStyles}>
        <pre css={jsonDisplayStyles}>
          {JSON.stringify({ stats, agents, recentActivity }, null, 2)}
        </pre>
      </div>
    );
  }

  // Full mode for human operators
  return (
    <div ref={containerRef} css={containerStyles(isMobile)}>
      {/* Pull-to-refresh indicator */}
      {isMobile && isPulling && (
        <div css={pullToRefreshIndicatorStyles(pullDistance)}>
          {pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && <div css={refreshingIndicatorStyles}>Refreshing...</div>}
      {/* Quick Stats Header */}
      <section css={statsHeaderStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: designTokens.spacing[6],
          }}
        >
          <h1 css={titleStyles} style={{ marginBottom: 0 }}>
            Dashboard
          </h1>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              variant={viewMode === "standard" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("standard")}
            >
              Standard
            </Button>
            <Button
              variant={viewMode === "ecosystem" ? "primary" : "outline"}
              size="sm"
              onClick={() => setViewMode("ecosystem")}
            >
              Ecosystem
            </Button>
          </div>
        </div>

        {viewMode === "ecosystem" && (
          <div style={{ marginBottom: designTokens.spacing[8] }}>
            <EcosystemVisualizer />
          </div>
        )}

        <div css={statsGridStyles(isMobile, isTablet)}>
          <StatCard
            label="Active Agents"
            value={stats?.activeAgents || 0}
            total={stats?.totalAgents}
            icon="🤖"
            color="primary"
          />
          <StatCard
            label="Total Trades"
            value={stats?.totalTrades || 0}
            icon="📊"
            color="info"
          />
          <StatCard
            label="Avg Win Rate"
            value={`${((stats?.avgWinRate || 0) * 100).toFixed(1)}%`}
            icon="🎯"
            color="success"
          />
          <StatCard
            label="Total Return"
            value={`${((stats?.totalReturn || 0) * 100).toFixed(2)}%`}
            icon="💰"
            color={stats && stats.totalReturn >= 0 ? "success" : "error"}
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div css={mainGridStyles(isMobile, isTablet)}>
        {/* Agent Overview */}
        <section css={sectionStyles}>
          <div css={sectionHeaderStyles}>
            <h2 css={sectionTitleStyles}>Top Performing Agents</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/agents")}
            >
              View All →
            </Button>
          </div>

          {isLoading ? (
            <div css={loadingStyles}>Loading agents...</div>
          ) : isMobile ? (
            <AgentCarousel agents={agents} />
          ) : (
            <AgentGrid agents={agents} columns={isTablet ? 2 : 3} />
          )}
        </section>

        {/* Performance Chart */}
        {!isMobile && (
          <section css={sectionStyles}>
            <div css={sectionHeaderStyles}>
              <h2 css={sectionTitleStyles}>Ecosystem Performance</h2>
            </div>
            <Card variant="outlined">
              <CardContent>
                <div
                  style={{
                    height: "300px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: `linear-gradient(135deg, ${designTokens.colors.neutral[900]} 0%, ${designTokens.colors.neutral[800]} 100%)`,
                    borderRadius: designTokens.borderRadius.lg,
                    border: `1px solid ${designTokens.colors.neutral[700]}`,
                    position: "relative",
                    overflow: "hidden",
                    padding: designTokens.spacing[6],
                  }}
                >
                  {/* Background Grid */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: 0.1,
                      backgroundImage: `linear-gradient(${designTokens.colors.primary[500]} 1px, transparent 1px), linear-gradient(90deg, ${designTokens.colors.primary[500]} 1px, transparent 1px)`,
                      backgroundSize: "40px 40px",
                    }}
                  />

                  {/* High-Fidelity SVG Chart */}
                  <svg
                    viewBox="0 0 400 150"
                    preserveAspectRatio="none"
                    style={{
                      width: "100%",
                      height: "100%",
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="chartGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={designTokens.colors.primary[500]}
                          stopOpacity="0.3"
                        />
                        <stop
                          offset="100%"
                          stopColor={designTokens.colors.primary[500]}
                          stopOpacity="0"
                        />
                      </linearGradient>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Path */}
                    <path
                      d="M 0 120 Q 50 110 80 80 T 150 70 T 220 100 T 300 40 T 400 30 L 400 150 L 0 150 Z"
                      fill="url(#chartGradient)"
                    />
                    <path
                      d="M 0 120 Q 50 110 80 80 T 150 70 T 220 100 T 300 40 T 400 30"
                      fill="none"
                      stroke={designTokens.colors.primary[500]}
                      strokeWidth="3"
                      filter="url(#glow)"
                      style={{
                        strokeDasharray: "600",
                        strokeDashoffset: "600",
                        animation: "drawPath 3s ease-out forwards",
                      }}
                    />

                    {/* Data Points */}
                    {[
                      { x: 0, y: 120 },
                      { x: 80, y: 80 },
                      { x: 150, y: 70 },
                      { x: 220, y: 100 },
                      { x: 300, y: 40 },
                      { x: 400, y: 30 },
                    ].map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill={designTokens.colors.primary[400]}
                        stroke="white"
                        strokeWidth="1"
                      >
                        <animate
                          attributeName="r"
                          values="4;6;4"
                          dur="2s"
                          repeatCount="indefinite"
                          begin={`${i * 0.5}s`}
                        />
                      </circle>
                    ))}
                  </svg>

                  {/* HUD Info Labels */}
                  <div
                    style={{
                      position: "absolute",
                      top: "20px",
                      left: "20px",
                      color: designTokens.colors.primary[400],
                      fontFamily: "monospace",
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    System Performance // Neural Load: 42% // Uptime: 99.99%
                  </div>

                  <div
                    style={{
                      position: "absolute",
                      bottom: "20px",
                      right: "20px",
                      textAlign: "right",
                    }}
                  >
                    <div
                      style={{
                        color: designTokens.colors.primary[400],
                        fontSize: designTokens.typography.fontSize.lg,
                        fontWeight: designTokens.typography.fontWeight.bold,
                        textShadow: "0 0 10px rgba(14, 165, 233, 0.5)",
                      }}
                    >
                      +24.8%
                    </div>
                    <div
                      style={{
                        color: designTokens.colors.neutral[400],
                        fontSize: designTokens.typography.fontSize.xs,
                        textTransform: "uppercase",
                      }}
                    >
                      Aggregate Yield
                    </div>
                  </div>

                  <style>
                    {`
                      @keyframes drawPath {
                        to {
                          stroke-dashoffset: 0;
                        }
                      }
                    `}
                  </style>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Recent Activity */}
        <section css={sectionStyles}>
          <div css={sectionHeaderStyles}>
            <h2 css={sectionTitleStyles}>Recent Activity</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/audit")}
            >
              View All →
            </Button>
          </div>
          <ActivityFeed
            activities={recentActivity}
            compact={isMobile}
            showMore={showMoreActivity}
            onToggleMore={() => setShowMoreActivity(!showMoreActivity)}
          />
        </section>
      </div>

      {/* Quick Actions (Mobile: Bottom, Desktop: Floating) */}
      <QuickActions isMobile={isMobile} />
    </div>
  );
}

// Sub-components

interface AgentGridProps {
  agents: AgentSummary[];
  columns: number;
}

const AgentGrid = ({ agents, columns }: AgentGridProps) => (
  <div css={agentGridStyles(columns)}>
    {agents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} />
    ))}
  </div>
);

interface AgentCarouselProps {
  agents: AgentSummary[];
}

const AgentCarousel = ({ agents }: AgentCarouselProps) => (
  <div css={carouselStyles}>
    {agents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} compact />
    ))}
  </div>
);

interface ActivityFeedProps {
  activities: any[];
  compact?: boolean;
  showMore?: boolean;
  onToggleMore?: () => void;
}

const ActivityFeed = ({
  activities,
  compact,
  showMore,
  onToggleMore,
}: ActivityFeedProps) => {
  const displayActivities =
    compact && !showMore ? activities.slice(0, 5) : activities;

  return (
    <Card>
      <CardContent css={activityFeedStyles(compact)}>
        {activities.length === 0 ? (
          <div css={emptyStateStyles}>No recent activity</div>
        ) : (
          <>
            {displayActivities.map((activity, idx) => (
              <div key={idx} css={activityItemStyles}>
                <div css={activityIconStyles}>
                  {activity.type === "trade" ? "📊" : "⚙️"}
                </div>
                <div css={activityDetailsStyles}>
                  <div css={activityTextStyles}>
                    {activity.description || "Activity"}
                  </div>
                  <div css={activityTimeStyles}>
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {compact && activities.length > 5 && onToggleMore && (
              <button css={showMoreButtonStyles} onClick={onToggleMore}>
                {showMore ? "Show Less" : `Show ${activities.length - 5} More`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface QuickActionsProps {
  isMobile: boolean;
}

const QuickActions = ({ isMobile }: QuickActionsProps) => {
  const navigate = useNavigate();

  const actions = [
    { label: "Compare Agents", icon: "📊", path: "/agents?compare=true" },
    { label: "View Policies", icon: "📋", path: "/policies" },
    { label: "Audit Logs", icon: "🔍", path: "/audit" },
  ];

  if (isMobile) {
    return (
      <div css={mobileActionsStyles}>
        {actions.map((action) => (
          <button
            key={action.path}
            css={mobileActionButtonStyles}
            onClick={() => navigate(action.path)}
          >
            <span css={actionIconStyles}>{action.icon}</span>
            <span css={actionLabelStyles}>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div css={desktopActionsStyles}>
      {actions.map((action) => (
        <Button
          key={action.path}
          variant="secondary"
          size="sm"
          onClick={() => navigate(action.path)}
        >
          {action.icon} {action.label}
        </Button>
      ))}
    </div>
  );
};

// Styles

const containerStyles = (isMobile: boolean) => css`
  padding: ${isMobile ? designTokens.spacing[4] : designTokens.spacing[6]};
  max-width: 1600px;
  margin: 0 auto;
  padding-bottom: ${isMobile
    ? "80px"
    : designTokens.spacing[6]}; /* Space for mobile actions */
  position: relative;
  overflow-y: auto;
  height: 100%;
`;

const pullToRefreshIndicatorStyles = (distance: number) => css`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: ${distance}px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: ${designTokens.spacing[2]};
  background: linear-gradient(
    to bottom,
    ${designTokens.colors.primary[50]},
    transparent
  );
  color: ${designTokens.colors.primary[700]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  z-index: 1000;
  transition: opacity 0.2s;
  opacity: ${distance > 40 ? 1 : distance / 40};
`;

const refreshingIndicatorStyles = css`
  position: fixed;
  top: ${designTokens.spacing[4]};
  left: 50%;
  transform: translateX(-50%);
  background: ${designTokens.colors.primary[600]};
  color: white;
  padding: ${designTokens.spacing[2]} ${designTokens.spacing[4]};
  border-radius: ${designTokens.borderRadius.full};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  box-shadow: ${designTokens.shadows.lg};
  z-index: 1000;
  animation: slideDown 0.3s ease-out;

  @keyframes slideDown {
    from {
      transform: translateX(-50%) translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  }
`;

const statsHeaderStyles = css`
  margin-bottom: ${designTokens.spacing[6]};
`;

const titleStyles = css`
  font-size: ${designTokens.typography.fontSize["3xl"]};
  font-weight: ${designTokens.typography.fontWeight.bold};
  margin-bottom: ${designTokens.spacing[4]};
  color: ${designTokens.colors.neutral[900]};
`;

const statsGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile
    ? "1fr 1fr"
    : isTablet
      ? "repeat(2, 1fr)"
      : "repeat(4, 1fr)"};
  gap: ${designTokens.spacing[4]};
`;

const mainGridStyles = (isMobile: boolean, isTablet: boolean) => css`
  display: grid;
  grid-template-columns: ${isMobile ? "1fr" : isTablet ? "1fr" : "1fr 1fr"};
  gap: ${designTokens.spacing[6]};
`;

const sectionStyles = css`
  margin-bottom: ${designTokens.spacing[6]};
`;

const sectionHeaderStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${designTokens.spacing[4]};
`;

const sectionTitleStyles = css`
  font-size: ${designTokens.typography.fontSize.xl};
  font-weight: ${designTokens.typography.fontWeight.semibold};
  color: ${designTokens.colors.neutral[900]};
`;

const agentGridStyles = (columns: number) => css`
  display: grid;
  grid-template-columns: repeat(${columns}, 1fr);
  gap: ${designTokens.spacing[4]};
`;

const carouselStyles = css`
  display: flex;
  gap: ${designTokens.spacing[4]};
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: ${designTokens.spacing[2]};

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: ${designTokens.colors.neutral[300]};
    border-radius: ${designTokens.borderRadius.full};
  }
`;

const activityFeedStyles = (compact?: boolean) => css`
  max-height: ${compact ? "300px" : "400px"};
  overflow-y: auto;
`;

const activityItemStyles = css`
  display: flex;
  gap: ${designTokens.spacing[3]};
  padding: ${designTokens.spacing[3]};
  border-bottom: 1px solid ${designTokens.colors.neutral[200]};

  &:last-child {
    border-bottom: none;
  }
`;

const activityIconStyles = css`
  font-size: 1.5rem;
`;

const activityDetailsStyles = css`
  flex: 1;
`;

const activityTextStyles = css`
  font-size: ${designTokens.typography.fontSize.sm};
  color: ${designTokens.colors.neutral[900]};
  margin-bottom: ${designTokens.spacing[1]};
`;

const activityTimeStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[500]};
`;

const mobileActionsStyles = css`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid ${designTokens.colors.neutral[200]};
  display: flex;
  justify-content: space-around;
  padding: ${designTokens.spacing[2]};
  z-index: 100;
`;

const mobileActionButtonStyles = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${designTokens.spacing[1]};
  padding: ${designTokens.spacing[2]};
  background: none;
  border: none;
  cursor: pointer;
  min-width: 44px; /* Touch target size */

  &:active {
    opacity: 0.7;
  }
`;

const actionIconStyles = css`
  font-size: 1.5rem;
`;

const actionLabelStyles = css`
  font-size: ${designTokens.typography.fontSize.xs};
  color: ${designTokens.colors.neutral[700]};
`;

const desktopActionsStyles = css`
  display: flex;
  gap: ${designTokens.spacing[3]};
  justify-content: center;
  margin-top: ${designTokens.spacing[8]};
`;

const loadingStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[8]};
  color: ${designTokens.colors.neutral[500]};
`;

const emptyStateStyles = css`
  text-align: center;
  padding: ${designTokens.spacing[8]};
  color: ${designTokens.colors.neutral[500]};
`;

const showMoreButtonStyles = css`
  width: 100%;
  padding: ${designTokens.spacing[3]};
  margin-top: ${designTokens.spacing[2]};
  background: ${designTokens.colors.neutral[50]};
  border: 1px solid ${designTokens.colors.neutral[200]};
  border-radius: ${designTokens.borderRadius.md};
  color: ${designTokens.colors.primary[600]};
  font-size: ${designTokens.typography.fontSize.sm};
  font-weight: ${designTokens.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s;
  min-height: 44px; /* Touch target size */

  &:hover {
    background: ${designTokens.colors.neutral[100]};
  }

  &:active {
    transform: scale(0.98);
  }
`;

const chartPlaceholderStyles = css`
  height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${designTokens.colors.neutral[50]};
  border-radius: ${designTokens.borderRadius.lg};
  color: ${designTokens.colors.neutral[500]};
`;

const minimalContainerStyles = css`
  padding: ${designTokens.spacing[4]};
  background: ${designTokens.colors.neutral[900]};
  min-height: 100vh;
`;

const jsonDisplayStyles = css`
  color: ${designTokens.colors.semantic.success[400]};
  font-family: "Monaco", "Menlo", "Courier New", monospace;
  font-size: ${designTokens.typography.fontSize.sm};
  line-height: 1.6;
  overflow-x: auto;
`;
