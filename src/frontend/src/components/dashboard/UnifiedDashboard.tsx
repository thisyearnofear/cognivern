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
import {
  Users,
  BarChart3,
  Percent,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldCheck,
  FileSearch,
  LayoutDashboard,
  Search,
} from "lucide-react";
import { designTokens } from "../../styles/design-system";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import { agentApi } from "../../services/apiService";
import { Card, CardContent, StatCard, AgentCard, Button } from "../ui";
import * as styles from "./UnifiedDashboard.styles";

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

interface ActivityItem {
  type?: string;
  description?: string;
  timestamp?: string;
}

export default function UnifiedDashboard({ mode = "full" }: DashboardProps) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();

  const [stats, setStats] = useState<QuickStats | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
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
      // Keep dashboard resilient: one failing call should not blank the entire screen.
      const [statsResult, agentsResult, activityResult] = await Promise.allSettled([
        agentApi.getAggregateStats({}),
        agentApi.compareAgents({
          sortBy: "totalReturn",
          sortDirection: "desc",
        }),
        agentApi.getRecentActivity(),
      ]);

      if (
        statsResult.status === "fulfilled" &&
        statsResult.value.success &&
        statsResult.value.data
      ) {
        const data = statsResult.value.data as any;
        setStats({
          activeAgents: data.totalAgents || 0,
          totalAgents: data.totalAgents || 0,
          totalTrades: data.totalTrades || 0,
          avgWinRate: data.avgWinRate || 0,
          totalReturn: data.avgReturn || 0,
        });
      }

      if (
        agentsResult.status === "fulfilled" &&
        agentsResult.value.success &&
        agentsResult.value.data
      ) {
        const data = agentsResult.value.data as any;
        setAgents(Array.isArray(data) ? data.slice(0, 6) : []); // Top 6 agents
      }

      if (
        activityResult.status === "fulfilled" &&
        activityResult.value.success &&
        activityResult.value.data
      ) {
        const payload = activityResult.value.data as { logs?: ActivityItem[] };
        const logs = Array.isArray(payload.logs) ? payload.logs : [];
        setRecentActivity(logs.slice(0, 10));
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
      <div css={styles.minimalContainerStyles}>
        <pre css={styles.jsonDisplayStyles}>
          {JSON.stringify({ stats, agents, recentActivity }, null, 2)}
        </pre>
      </div>
    );
  }

  // Full mode for human operators
  return (
    <div ref={containerRef} css={styles.containerStyles(isMobile)}>
      {/* Pull-to-refresh indicator */}
      {isMobile && isPulling && (
        <div css={styles.pullToRefreshIndicatorStyles(pullDistance)}>
          {pullDistance > 80 ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && (
        <div css={styles.refreshingIndicatorStyles}>Refreshing...</div>
      )}
      {/* Quick Stats Header */}
      <section css={styles.statsHeaderStyles}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: designTokens.spacing[6],
          }}
        >
          <h1 css={styles.titleStyles} style={{ marginBottom: 0 }}>
            Dashboard
          </h1>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Refresh
          </Button>
        </div>

        <div css={styles.statsGridStyles(isMobile, isTablet)}>
          <StatCard
            label="Active Agents"
            value={stats?.activeAgents || 0}
            total={stats?.totalAgents}
            icon={<Users size={24} />}
            color="primary"
          />
          <StatCard
            label="Total Trades"
            value={stats?.totalTrades || 0}
            icon={<BarChart3 size={24} />}
            color="info"
          />
          <StatCard
            label="Avg Win Rate"
            value={`${((stats?.avgWinRate || 0) * 100).toFixed(1)}%`}
            icon={<Percent size={24} />}
            color="success"
          />
          <StatCard
            label="Total Return"
            value={`${((stats?.totalReturn || 0) * 100).toFixed(2)}%`}
            icon={
              stats && stats.totalReturn >= 0 ? (
                <TrendingUp size={24} />
              ) : (
                <TrendingDown size={24} />
              )
            }
            color={stats && stats.totalReturn >= 0 ? "success" : "error"}
          />
        </div>
      </section>

      {/* Main Content Grid */}
      <div css={styles.mainGridStyles(isMobile, isTablet)}>
        {/* Agent Overview */}
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Top Performing Agents</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/agents")}
            >
              View All <ArrowRight size={16} />
            </Button>
          </div>

          {isLoading ? (
            <div css={styles.loadingStyles}>Loading agents...</div>
          ) : isMobile ? (
            <AgentCarousel agents={agents} />
          ) : (
            <AgentGrid agents={agents} columns={isTablet ? 2 : 3} />
          )}
        </section>

        {/* Recent Activity */}
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Recent Activity</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/audit")}
            >
              View All <ArrowRight size={16} />
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
  <div css={styles.agentGridStyles(columns)}>
    {agents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} />
    ))}
  </div>
);

interface AgentCarouselProps {
  agents: AgentSummary[];
}

const AgentCarousel = ({ agents }: AgentCarouselProps) => (
  <div css={styles.carouselStyles}>
    {agents.map((agent) => (
      <AgentCard key={agent.id} agent={agent} compact />
    ))}
  </div>
);

interface ActivityFeedProps {
  activities: ActivityItem[];
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
      <CardContent css={styles.activityFeedStyles(compact)}>
        {activities.length === 0 ? (
          <div css={styles.emptyStateStyles}>
            <FileSearch size={48} />
            <div>No recent activity</div>
          </div>
        ) : (
          <>
            {displayActivities.map((activity, idx) => (
              <div key={idx} css={styles.activityItemStyles}>
                <div css={styles.activityIconStyles}>
                  {activity.type === "trade" ? (
                    <BarChart3 size={20} />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                </div>
                <div css={styles.activityDetailsStyles}>
                  <div css={styles.activityTextStyles}>
                    {activity.description || "Activity"}
                  </div>
                  <div css={styles.activityTimeStyles}>
                    {activity.timestamp
                      ? new Date(activity.timestamp).toLocaleTimeString()
                      : "Unknown time"}
                  </div>
                </div>
              </div>
            ))}
            {compact && activities.length > 5 && onToggleMore && (
              <button css={styles.showMoreButtonStyles} onClick={onToggleMore}>
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
    {
      label: "Dashboard",
      icon: <LayoutDashboard size={20} />,
      path: "/",
    },
    {
      label: "Policies",
      icon: <ShieldCheck size={20} />,
      path: "/policies",
    },
    {
      label: "Search",
      icon: <Search size={20} />,
      path: "/audit",
    },
  ];

  if (isMobile) {
    return (
      <div css={styles.mobileActionsStyles}>
        {actions.map((action) => (
          <button
            key={action.path}
            css={styles.mobileActionButtonStyles}
            onClick={() => navigate(action.path)}
          >
            <div css={styles.mobileActionIconStyles}>{action.icon}</div>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      css={css`
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: ${designTokens.spacing[3]};
        z-index: 100;
      `}
    >
      {actions.map((action) => (
        <Button
          key={action.path}
          variant="primary"
          size="sm"
          onClick={() => navigate(action.path)}
          style={{
            boxShadow: designTokens.shadows.lg,
            borderRadius: designTokens.borderRadius.full,
            width: "auto",
            padding: `${designTokens.spacing[2]} ${designTokens.spacing[4]}`,
          }}
        >
          {action.icon}
          <span style={{ marginLeft: designTokens.spacing[2] }}>
            {action.label}
          </span>
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
