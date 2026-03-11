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
import {
  agentApi,
  fetchGovernanceStats,
  fetchStorageStats,
  checkPolkadotConnection,
} from "../../services/apiService";
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
      const [statsResult, agentsResult, activityResult] =
        await Promise.allSettled([
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

  // Desktop: sidebar handles navigation — only render mobile bottom bar
  if (!isMobile) return null;

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
};
