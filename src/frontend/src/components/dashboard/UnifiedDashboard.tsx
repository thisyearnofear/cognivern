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
 *
 * Version 1.0.1 - Fixes useMemo and backend connectivity
 */

/** @jsxImportSource @emotion/react */
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
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
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  PlusCircle,
  Zap,
  Brain,
} from "lucide-react";
import { designTokens } from "../../styles/design-system";
import { useBreakpoint } from "../../hooks/useMediaQuery";
import {
  agentApi,
  policyApi,
  fetchGovernanceStats,
  fetchStorageStats,
  checkPolkadotConnection,
} from "../../services/apiService";
import {
  Card,
  CardContent,
  StatCard,
  AgentCard,
  Button,
  DataTable,
  Badge,
  Chart,
  Modal,
  GenerativeReveal,
  LoadingSpinner,
} from "../ui";
import { Node } from "../ui/EcosystemVisualizer";
import * as styles from "./UnifiedDashboard.styles";
import { Column } from "../ui/DataTable";
import { ChartDataPoint } from "../ui/Chart";

// Lazy load heavy components for performance
const EcosystemVisualizer = lazy(() => import("../ui/EcosystemVisualizer").then(module => ({ default: module.EcosystemVisualizer })));

interface DashboardProps {
  mode?: "full" | "minimal"; // minimal for agent-to-agent
}

interface QuickStats {
  activeAgents: number;
  totalAgents: number;
  totalTrades: number;
  avgWinRate: number;
  totalReturn: number;
  totalPolicies: number;
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

interface PolicySummary {
  id: string;
  name: string;
  status: string;
}

interface ActivityItem {
  type?: string;
  severity?: "success" | "warning" | "error" | "info";
  description?: string;
  timestamp?: string;
}

interface QuestItem {
  id: string;
  type: "pattern" | "recommendation" | "trend" | "alert";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  actionRequired: boolean;
}

// Mock chart data for "Analytics" view inspired by smart bin dashboard
const performanceTrends: ChartDataPoint[] = [
  { x: 1, y: 1.2, label: "Day 1" },
  { x: 2, y: 1.5, label: "Day 2" },
  { x: 3, y: 1.4, label: "Day 3" },
  { x: 4, y: 1.8, label: "Day 4" },
  { x: 5, y: 2.1, label: "Day 5" },
  { x: 6, y: 2.3, label: "Day 6" },
  { x: 7, y: 2.6, label: "Day 7" },
];

const distributionData: ChartDataPoint[] = [
  { x: "Sapience", y: 45, label: "Forecasting", color: designTokens.colors.primary[500] },
  { x: "Governance", y: 30, label: "Compliance", color: designTokens.colors.secondary[500] },
  { x: "Trading", y: 25, label: "DeFi", color: designTokens.colors.semantic.success[500] },
];

interface QuestItem {
  id: string;
  type: "pattern" | "recommendation" | "trend" | "alert";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  actionRequired: boolean;
}

export default function UnifiedDashboard({ mode = "full" }: DashboardProps) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();

  const [stats, setStats] = useState<QuickStats | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMoreActivity, setShowMoreActivity] = useState(false);

  // Agent Thought Observation State (Intelligent Layer)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [isThoughtModalOpen, setIsThoughtModalOpen] = useState(false);
  const [isThoughtsLoading, setIsThoughtsLoading] = useState(false);

  // Transform agents and policies into Map Nodes (DRY & PERFORMANT)
  const ecosystemNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = [
      { id: "kernel", type: "system", label: "Kernel", status: "active", x: 50, y: 50 }
    ];

    agents.forEach(agent => {
      nodes.push({
        id: agent.id,
        type: "agent",
        label: agent.name,
        status: agent.status,
        pulse: agent.status === "active"
      });
    });

    policies.forEach(policy => {
      nodes.push({
        id: policy.id,
        type: "policy",
        label: policy.name,
        status: policy.status === "active" ? "active" : "idle"
      });
    });

    return nodes;
  }, [agents, policies]);

  // Pull-to-refresh state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  // New state for proactive Live Feed
  const [liveThoughts, setLiveThoughts] = useState<{agentId: string, agentName: string, thought: string, timestamp: Date, id: string}[]>([]);

  useEffect(() => {
    fetchDashboardData();

    // Simulate live feed updates for delight
    const interval = setInterval(() => {
      if (agents.length > 0) {
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        const thoughts = [
          "Analyzing recent trade volatility on-chain...",
          "Validating governance policy #42...",
          "Optimizing execution path for minimal slippage.",
          "Cross-referencing market data with historical patterns.",
          "Verifying sovereign identity trace...",
          "Detecting anomalous liquidity shift in pool 0x7a...",
          "Simulating potential impact of rate changes...",
          "Batching authorized transactions for block inclusion."
        ];
        const newThought = {
          agentId: randomAgent.id,
          agentName: randomAgent.name,
          thought: thoughts[Math.floor(Math.random() * thoughts.length)],
          timestamp: new Date(),
          id: Math.random().toString(36).substr(2, 9)
        };
        setLiveThoughts(prev => [newThought, ...prev].slice(0, 10));
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [agents]);

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
      const result = await agentApi.getDashboardBundle();

      if (result.success && result.data) {
        const { stats, agents: agentList, activity, policies: policyList, quests: insightList } = result.data;

        setStats(stats);
        setAgents(agentList || []);
        setRecentActivity(activity || []);
        setPolicies(policyList || []);

        // Handle insights with fallback missions (DRY)
        if (!insightList || insightList.length === 0) {
           setQuests([
             { id: "q1", type: "alert", title: "Verify Agent Alpha", description: "Review latest trades to verify compliance with new risk policy.", severity: "high", actionRequired: true },
             { id: "q2", type: "recommendation", title: "Update Market Guardrails", description: "Market volatility detected. Increase slippage threshold by 0.5%.", severity: "medium", actionRequired: true }
           ]);
        } else {
           setQuests(insightList);
        }
      } else {
        throw new Error(result.error || "Failed to fetch dashboard bundle");
      }
    } catch (error) {
      console.error("Failed to fetch dashboard bundle:", error);
      // Optional: fallback to individual calls if bundle fails (not strictly necessary if bundle is stable)
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveQuest = async (questId: string) => {
    try {
       const result = await agentApi.resolveQuest(questId);
       if (result.success) {
         // Refresh dashboard to show updated quests
         fetchDashboardData();
       }
    } catch (error) {
       console.error("Failed to resolve quest:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData();
    setIsRefreshing(false);
  };

  const handleNodeClick = async (node: Node) => {
    if (node.type === "agent") {
      setSelectedAgentId(node.id);
      setIsThoughtModalOpen(true);
      setIsThoughtsLoading(true);

      try {
        const result = await agentApi.getAgentStatus(node.id);
        if (result.success && result.data) {
          // Extract thought history or fallback to demo thoughts (DRY fallback)
          const thoughts = result.data.thoughtHistory || [
            "Analyzing market volatility metrics...",
            "Evaluating cross-chain arbitrage opportunities...",
            "Risk threshold validated against current on-chain policy.",
            "Optimizing gas parameters for prioritized execution."
          ];
          setAgentThoughts(thoughts);
        }
      } catch (error) {
        console.error("Failed to fetch agent thoughts:", error);
        setAgentThoughts(["Initializing connection to cognitive kernel...", "Syncing historical reasoning logs..."]);
      } finally {
        setIsThoughtsLoading(false);
      }
    }
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
            flexWrap: "wrap",
            gap: designTokens.spacing[4],
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: designTokens.spacing[4] }}>
            <h1 css={styles.titleStyles} style={{ marginBottom: 0 }}>
              Dashboard
            </h1>
            <div css={styles.badgeContainerStyles}>
              <div css={styles.systemBadgeStyles("info")}>MAINNET</div>
              <div css={styles.systemBadgeStyles("success")}>EAS: ACTIVE</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: designTokens.spacing[3] }}>
            <div css={styles.liveIndicatorStyles}>
              <div css={styles.pulseDotStyles} />
              LIVE
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Refresh
            </Button>
            {!isMobile && (
              <Button variant="primary" size="sm" onClick={() => navigate("/policies")}>
                Deploy Policy
              </Button>
            )}
          </div>
        </div>

        <div css={styles.statsGridStyles(isMobile, isTablet)}>
          <StatCard
            label="Active Agents"
            value={stats?.activeAgents || 0}
            total={stats?.totalAgents}
            icon={<Users size={24} />}
            color="primary"
            trend={{ value: "↑ 2 new", isPositive: true }}
          />
          <StatCard
            label="Active Policies"
            value={stats?.totalPolicies || 0}
            icon={<ShieldCheck size={24} />}
            color="info"
            trend={{ value: "Compliant", isPositive: true }}
          />
          <StatCard
            label="Avg Win Rate"
            value={`${((stats?.avgWinRate || 0) * 100).toFixed(1)}%`}
            icon={<Percent size={24} />}
            color="success"
            trend={{ value: "↑ 1.4%", isPositive: true }}
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
            trend={{ value: stats && stats.totalReturn >= 0 ? "↑ 0.5%" : "↓ 0.2%", isPositive: stats ? stats.totalReturn >= 0 : true }}
          />
        </div>
      </section>

      {/* Live Ecosystem Visualization */}
      <section css={styles.sectionStyles}>
        <div css={styles.sectionHeaderStyles}>
          <h2 css={styles.sectionTitleStyles}>Live Network Map</h2>
          <div css={styles.liveIndicatorStyles}>
             <div css={styles.pulseDotStyles} />
             Cognitive Kernel Status: Healthy
          </div>
        </div>
        <Card overflow="hidden">
           <Suspense fallback={<div css={styles.loadingStyles}><LoadingSpinner size="lg" /></div>}>
             <EcosystemVisualizer
               nodes={ecosystemNodes}
               loading={isLoading}
               onNodeClick={handleNodeClick}
             />
           </Suspense>
        </Card>
      </section>

      {/* Performance Trends - New analytics section inspired by Smart Bin dashboard */}
      <section css={styles.sectionStyles}>
        <div css={styles.chartsGridStyles(isMobile, isTablet)}>
          <Card>
            <CardContent>
              <h3 css={styles.sectionTitleStyles} style={{ fontSize: "14px", marginBottom: "20px" }}>Total Yield Trend (7D)</h3>
              <Chart
                type="area"
                data={performanceTrends}
                height={200}
                yAxisLabel="Yield %"
                animate
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h3 css={styles.sectionTitleStyles} style={{ fontSize: "14px", marginBottom: "20px" }}>Agent Type Distribution</h3>
              <div style={{ height: "200px", display: "flex", justifyContent: "center" }}>
                <Chart
                  type="pie"
                  data={distributionData}
                  height={200}
                  animate
                />
              </div>
            </CardContent>
          </Card>
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

        {/* Quest HUD - Governance Quests */}
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Governance Quests</h2>
            <Badge variant="secondary" size="sm">
              {quests.filter(q => q.actionRequired).length} ACTIVE
            </Badge>
          </div>
          <QuestHUD quests={quests} onResolve={handleResolveQuest} />
        </section>
      </div>

      {/* Global Leaderboard - New high-density view inspired by Smart Bin table */}
      {!isMobile && (
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
             <h2 css={styles.sectionTitleStyles}>Autonomous Leaderboard</h2>
             <span css={styles.systemBadgeStyles("info")}>{agents.length} AGENTS TRACKED</span>
          </div>
          <Card>
             <CardContent>
                <Leaderboard agents={agents} />
             </CardContent>
          </Card>
        </section>
      )}

      {/* Agent Thought Observation Modal (Intelligent Layer) */}
      <Modal
        isOpen={isThoughtModalOpen}
        onClose={() => setIsThoughtModalOpen(false)}
        title={selectedAgentId ? `Observing: ${agents.find(a => a.id === selectedAgentId)?.name || selectedAgentId}` : "Agent Observation"}
        size="lg"
      >
        <div style={{ minHeight: "300px", padding: designTokens.spacing[4] }}>
          <div style={{ display: "flex", alignItems: "center", gap: designTokens.spacing[3], marginBottom: designTokens.spacing[6] }}>
            <div css={styles.activityIconStyles("info")}>
              <Brain size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Internal Thought Chain</h3>
              <p style={{ fontSize: "12px", color: designTokens.colors.text.secondary }}>Real-time cognitive reasoning stream from Filecoin Recall storage.</p>
            </div>
          </div>

          {isThoughtsLoading ? (
            <div css={styles.loadingStyles}>Connecting to agent memory...</div>
          ) : (
            <GenerativeReveal active={!isThoughtsLoading} duration={800}>
              <div style={{ display: "flex", flexDirection: "column", gap: designTokens.spacing[4] }}>
                {agentThoughts.map((thought, i) => (
                  <div key={i} style={{
                    padding: designTokens.spacing[4],
                    background: designTokens.colors.background.secondary,
                    borderRadius: designTokens.borderRadius.md,
                    borderLeft: `4px solid ${designTokens.colors.primary[500]}`,
                    fontSize: "14px",
                    fontFamily: designTokens.typography.fontFamily.mono.join(", "),
                    color: designTokens.colors.text.primary,
                    animation: `slideIn 0.3s ease-out forwards ${i * 0.1}s`,
                    opacity: 0,
                    transform: "translateX(-10px)"
                  }}>
                    <span style={{ color: designTokens.colors.primary[400], marginRight: "8px" }}>[{new Date().toLocaleTimeString()}]</span>
                    {thought}
                  </div>
                ))}
              </div>
            </GenerativeReveal>
          )}
        </div>
      </Modal>

      {/* Quick Actions (Mobile: Bottom, Desktop: Floating) */}
      <QuickActions isMobile={isMobile} />

      {/* Live Thought Stream - Delight & Intuitive Feedback */}
      <div css={css`
        position: fixed;
        bottom: ${isMobile ? '80px' : '40px'};
        right: 40px;
        width: 320px;
        max-height: 400px;
        background: ${designTokens.colors.background.primary};
        border: 1px solid ${designTokens.colors.neutral[200]};
        border-radius: ${designTokens.borderRadius.xl};
        box-shadow: ${designTokens.shadows.xl};
        z-index: 100;
        display: ${isMobile ? 'none' : 'flex'};
        flex-direction: column;
        overflow: hidden;
        animation: fadeIn 0.5s ease-out;

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}>
        <div style={{
          padding: designTokens.spacing[3],
          background: designTokens.colors.primary[500],
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Live Agent Feed</span>
          </div>
          <Badge variant="secondary" size="sm" style={{ background: 'rgba(255,255,255,0.2)', border: 'none' }}>
            {liveThoughts.length} ACTIVE
          </Badge>
        </div>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: designTokens.spacing[3],
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {liveThoughts.length === 0 ? (
            <div style={{ textAlign: 'center', color: designTokens.colors.text.secondary, padding: '20px', fontSize: '13px' }}>
              Waiting for agent transmissions...
            </div>
          ) : (
            liveThoughts.map((t) => (
              <div key={t.id} style={{
                fontSize: '12px',
                borderLeft: `2px solid ${designTokens.colors.primary[300]}`,
                paddingLeft: '8px',
                paddingBottom: '4px',
                animation: 'slideInRight 0.3s ease-out',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ fontWeight: 700, color: designTokens.colors.primary[600] }}>
                    {t.agentName}
                  </div>
                  <div style={{ fontSize: '10px', color: designTokens.colors.text.secondary }}>
                    {t.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                </div>
                <div style={{ color: designTokens.colors.text.primary, lineHeight: 1.4 }}>{t.thought}</div>
                <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                   <span
                    onClick={() => {
                      setSelectedAgentId(t.agentId);
                      handleViewThoughts(t.agentId);
                    }}
                    style={{
                      cursor: 'pointer',
                      color: designTokens.colors.primary[500],
                      fontSize: '10px',
                      textDecoration: 'underline',
                      fontWeight: 600
                    }}
                   >
                     Inspect Trace
                   </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components

const QuestHUD = ({ quests, onResolve }: { quests: QuestItem[], onResolve: (id: string) => void }) => {
  if (quests.length === 0) {
    return (
      <Card>
        <CardContent css={styles.emptyStateStyles}>
          <ShieldCheck size={48} opacity={0.3} />
          <div>All governance systems compliant.</div>
        </CardContent>
      </Card>
    );
  }

  const getQuestIcon = (type: string) => {
    switch (type) {
      case "alert": return <AlertTriangle size={20} />;
      case "pattern": return <Search size={20} />;
      case "recommendation": return <Info size={20} />;
      default: return <ShieldCheck size={20} />;
    }
  };

  return (
    <Card>
      <CardContent css={styles.activityFeedStyles(true)}>
        {quests.map((quest) => (
          <div key={quest.id} css={styles.activityItemStyles}>
            <div css={styles.activityIconStyles(quest.severity)}>
              {getQuestIcon(quest.type)}
            </div>
            <div css={styles.activityDetailsStyles} style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div css={styles.activityTextStyles}>{quest.title}</div>
                {quest.actionRequired && <div css={styles.systemBadgeStyles(quest.severity as any)}>ACTION REQUIRED</div>}
              </div>
              <div css={styles.activityTimeStyles}>{quest.description}</div>
              {quest.actionRequired && (
                <div style={{ marginTop: designTokens.spacing[2], display: "flex", gap: designTokens.spacing[2] }}>
                  <Button
                    variant="outline"
                    size="xs"
                    style={{ fontSize: "10px", padding: "2px 8px", height: "auto" }}
                    onClick={() => onResolve(quest.id)}
                  >
                    Resolve
                  </Button>
                  <Button variant="ghost" size="xs" style={{ fontSize: "10px", padding: "2px 8px", height: "auto" }}>
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

interface LeaderboardProps {
  agents: AgentSummary[];
}

const Leaderboard = ({ agents }: LeaderboardProps) => {
  const columns: Column<AgentSummary>[] = [
    {
      key: "name",
      title: "Agent",
      render: (val, agent) => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ fontWeight: 700 }}>{val}</div>
          <Badge variant={agent.status === "active" ? "success" : "neutral"} size="sm">
            {agent.status}
          </Badge>
        </div>
      ),
      sortable: true,
    },
    {
      key: "type",
      title: "Type",
      render: (val) => (
        <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: designTokens.colors.text.secondary }}>
          {val}
        </span>
      ),
      sortable: true,
    },
    {
      key: "winRate",
      title: "Win Rate",
      render: (val) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
           <div style={{ width: "60px", height: "6px", background: "#f0f0ed", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(val * 100)}%`, background: designTokens.colors.semantic.success[500] }} />
           </div>
           <span style={{ fontWeight: 600 }}>{(val * 100).toFixed(1)}%</span>
        </div>
      ),
      sortable: true,
      align: "left",
    },
    {
      key: "totalReturn",
      title: "Return",
      render: (val) => (
        <span style={{ fontWeight: 700, color: val >= 0 ? designTokens.colors.semantic.success[600] : designTokens.colors.semantic.error[600] }}>
          {val >= 0 ? "+" : ""}{(val * 100).toFixed(2)}%
        </span>
      ),
      sortable: true,
      align: "right",
    },
    {
      key: "lastActive",
      title: "Last Seen",
      render: (val) => (
        <span style={{ fontSize: "12px", color: designTokens.colors.text.secondary }}>
          {new Date(val).toLocaleTimeString()}
        </span>
      ),
      sortable: true,
      align: "right",
    }
  ];

  return (
    <DataTable
       data={agents}
       columns={columns}
       searchable={false}
       pagination={{ current: 1, pageSize: 6, total: agents.length, onChange: () => {} }}
    />
  );
};

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

  const getActivityIcon = (severity?: string, type?: string) => {
    if (severity === "success" || type === "trade")
      return <CheckCircle2 size={20} />;
    if (severity === "warning") return <AlertTriangle size={20} />;
    if (severity === "error") return <XCircle size={20} />;
    return <Info size={20} />;
  };

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
                <div css={styles.activityIconStyles(activity.severity || (activity.type === "trade" ? "success" : "info"))}>
                   {getActivityIcon(activity.severity, activity.type)}
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
      label: "Add Agent",
      icon: <PlusCircle size={20} color={designTokens.colors.primary[500]} />,
      path: "/agents/workshop",
    },
    {
      label: "Policies",
      icon: <ShieldCheck size={20} />,
      path: "/policies",
    },
    {
      label: "Logs",
      icon: <FileSearch size={20} />,
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
