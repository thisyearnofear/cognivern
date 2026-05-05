/**
 * Unified Dashboard - Single Source of Truth
 *
 * Optimized for both human operators and agent-to-agent interfaces.
 * Simplified to prioritize operator attention: status, alerts, activity, and governed agents.
 */

/** @jsxImportSource @emotion/react */
import { useState, useEffect, useRef } from 'react';
import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import { Percent, ArrowRight, ShieldCheck, FileSearch, Zap, Brain, Users } from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { agentApi, owsApi } from '../../services/apiService';
import { getApiKey, getApiUrl } from '../../utils/api';
import { copyTextToClipboard } from '../../utils/clipboard';
import {
  Card,
  CardContent,
  StatCard,
  Button,
  Badge,
  Modal,
  GenerativeReveal,
  EmptyState,
} from '../ui';
import * as styles from './UnifiedDashboard.styles';
import { QuestHUD } from './QuestHUD';
import { Leaderboard, AgentGrid } from './Leaderboard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';
import {
  ActivityItem,
  AgentSummary,
  DashboardBundlePayload,
  DashboardProps,
  PolicySummary,
  QuestItem,
  QuickStats,
  UnifiedDashboardPayload,
} from './utils/types';
import {
  buildTrustSignals,
  normalizeActivity,
  normalizeRunStreamActivity,
  unwrapApiPayload,
} from './utils/activity';
import { useAppStore } from '../../stores/appStore';
import { Wallet, Sparkles } from 'lucide-react';

function OwsStatusIndicator() {
  const [owsStatus, setOwsStatus] = useState<{
    walletConnected: boolean;
    walletName?: string;
    apiKeysCount: number;
    agentsCount: number;
    activeAgents: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOwsStatus() {
      try {
        const dashboardRes = await owsApi.getDashboard();

        if (dashboardRes.success && dashboardRes.data) {
          const agents = dashboardRes.data.agents || [];
          const activeAgents = agents.filter((a: any) => a.status === 'active').length;

          setOwsStatus({
            walletConnected: dashboardRes.data.hasWallet || false,
            walletName: dashboardRes.data.wallet?.name,
            apiKeysCount: (dashboardRes.data.apiKeys || []).length,
            agentsCount: agents.length,
            activeAgents,
          });
        } else {
          setOwsStatus({
            walletConnected: false,
            apiKeysCount: 0,
            agentsCount: 0,
            activeAgents: 0,
          });
        }
      } catch {
        setOwsStatus({
          walletConnected: false,
          apiKeysCount: 0,
          agentsCount: 0,
          activeAgents: 0,
        });
      } finally {
        setIsLoading(false);
      }
    }

    void fetchOwsStatus();
  }, []);

  if (isLoading) {
    return (
      <div
        css={css`
          display: flex;
          align-items: center;
          gap: ${designTokens.spacing[2]};
          font-size: ${designTokens.spacing[2]};
          padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
          border-radius: ${designTokens.borderRadius.md};
          background: ${designTokens.colors.neutral[100]};
          opacity: 0.6;
        `}
      >
        <div
          css={css`
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: ${designTokens.colors.neutral[300]};
            animation: pulse 1.5s ease-in-out infinite;
          `}
        />
        <span
          css={css`
            color: ${designTokens.colors.neutral[400]};
            font-size: ${designTokens.typography.fontSize.xs};
          `}
        >
          Loading...
        </span>
      </div>
    );
  }

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        gap: ${designTokens.spacing[2]};
        font-size: ${designTokens.typography.fontSize.xs};
        padding: ${designTokens.spacing[1]} ${designTokens.spacing[2]};
        border-radius: ${designTokens.borderRadius.md};
        background: ${owsStatus?.walletConnected
          ? designTokens.colors.semantic.success[100]
          : designTokens.colors.neutral[100]};
        color: ${owsStatus?.walletConnected
          ? designTokens.colors.semantic.success[700]
          : designTokens.colors.neutral[600]};
      `}
    >
      <div
        css={css`
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${owsStatus?.walletConnected
            ? designTokens.colors.semantic.success[500]
            : designTokens.colors.neutral[400]};
        `}
      />
      <span>
        {owsStatus?.walletConnected
          ? `OWS: ${owsStatus.walletName || 'Connected'}`
          : 'OWS: No Wallet'}
        {owsStatus?.apiKeysCount ? ` · ${owsStatus.apiKeysCount} keys` : ''}
        {owsStatus?.agentsCount
          ? ` · ${owsStatus.activeAgents}/${owsStatus.agentsCount} agents`
          : ''}
      </span>
    </div>
  );
}

const TrustSignals = ({ activity }: { activity: ActivityItem }) => {
  const signals = buildTrustSignals(activity);
  if (!signals.length) return null;

  return (
    <div
      css={css`
        display: flex;
        flex-wrap: wrap;
        gap: ${designTokens.spacing[1]};
      `}
    >
      {signals.map((signal) => (
        <span key={signal.label}>
          <Badge variant={signal.variant} size="sm" title={signal.hint}>
            {signal.label}
          </Badge>
        </span>
      ))}
    </div>
  );
};

export default function UnifiedDashboard({ mode = 'full' }: DashboardProps) {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useBreakpoint();
  const { preferences, enterDemoMode } = useAppStore();
  const isInDemoMode = preferences.demoExplored && !preferences.onboardingCompleted;

  const [stats, setStats] = useState<QuickStats | null>(null);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [policies, setPolicies] = useState<PolicySummary[]>([]);
  const [quests, setQuests] = useState<QuestItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMoreActivity, setShowMoreActivity] = useState(false);
  const [workerThoughts, setWorkerThoughts] = useState<string[]>([]);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [isThoughtModalOpen, setIsThoughtModalOpen] = useState(false);
  const [isThoughtsLoading, setIsThoughtsLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    void fetchDashboardData();
    const intervalId = window.setInterval(() => {
      void fetchDashboardData(false);
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return;
    }

    const streamUrl = `${getApiUrl('/api/dashboard/events/stream')}?apiKey=${encodeURIComponent(apiKey)}`;
    const source = new EventSource(streamUrl);

    const prependActivity = (activity: ActivityItem) => {
      setRecentActivity((current) => {
        const next = [activity, ...current.filter((item) => item.id !== activity.id)];
        return next.slice(0, 25);
      });
    };

    let hasWarnedAboutStream = false;

    source.addEventListener('audit_log', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        prependActivity(normalizeActivity(payload));
      } catch {
        console.warn('Failed to parse dashboard audit stream event');
      }
    });

    source.addEventListener('run_event', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        prependActivity(normalizeRunStreamActivity(payload));
      } catch {
        console.warn('Failed to parse dashboard run stream event');
      }
    });

    source.onerror = () => {
      if (!hasWarnedAboutStream) {
        console.warn('Dashboard event stream temporarily unavailable');
        hasWarnedAboutStream = true;
      }
    };

    return () => {
      source.close();
    };
  }, []);

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
        void handleRefresh();
      }
      setIsPulling(false);
      setPullDistance(0);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, isPulling, pullDistance]);

  const fetchDashboardData = async (showLoader: boolean = true) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const bundleResult = await agentApi.getDashboardBundle();
      const bundle = unwrapApiPayload<DashboardBundlePayload>(bundleResult);

      if (!bundle) {
        throw new Error('Failed to fetch dashboard bundle');
      }

      const agentList = bundle.agents || [];
      const mappedStats: QuickStats = {
        activeAgents: agentList.filter((agent) => agent.status === 'active').length,
        totalAgents: bundle.stats?.totalAgents || agentList.length,
        totalTrades: bundle.stats?.totalTrades || 0,
        avgWinRate: bundle.stats?.avgWinRate || 0,
        totalReturn: bundle.stats?.avgReturn || 0,
        totalPolicies: bundle.stats?.totalPolicies || (bundle.policies || []).length,
      };

      setStats(mappedStats);
      setAgents(agentList);
      setRecentActivity((bundle.activity || []).map((entry) => normalizeActivity(entry)));
      setPolicies(bundle.policies || []);
      setQuests(bundle.quests || []);

      try {
        const unifiedResult = await agentApi.getUnifiedDashboard();
        const unified = unwrapApiPayload<UnifiedDashboardPayload>(unifiedResult);
        setWorkerThoughts(unified?.workerThoughts || []);
      } catch {
        setWorkerThoughts([]);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard bundle:', error);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  const handleResolveQuest = async (questId: string) => {
    try {
      const result = await agentApi.resolveQuest(questId);
      if (result.success) {
        void fetchDashboardData();
      }
    } catch (error) {
      console.error('Failed to resolve dashboard alert:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDashboardData(false);
    setIsRefreshing(false);
  };

  const handleViewThoughts = async (agentId: string) => {
    setSelectedAgentId(agentId);
    setIsThoughtModalOpen(true);
    setIsThoughtsLoading(true);

    try {
      const selectedAgent = agents.find((agent) => agent.id === agentId);
      const traceLines = recentActivity
        .filter(
          (activity) => activity.agentId === agentId || activity.agentName === selectedAgent?.name,
        )
        .map((activity) => {
          const timestamp = activity.timestamp
            ? new Date(activity.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })
            : 'recent';

          return `[${timestamp}] ${activity.description || 'Activity observed'}`;
        });

      setAgentThoughts(
        traceLines.length > 0 ? traceLines : ['No recorded trace events for this agent yet.'],
      );
    } finally {
      setIsThoughtsLoading(false);
    }
  };

  if (mode === 'minimal') {
    return (
      <div css={styles.minimalContainerStyles}>
        <pre css={styles.jsonDisplayStyles}>
          {JSON.stringify({ stats, agents, recentActivity }, null, 2)}
        </pre>
      </div>
    );
  }

  const openAlerts = quests.filter((quest) => quest.actionRequired);

  return (
    <div ref={containerRef} css={styles.containerStyles(isMobile)}>
      {isMobile && isPulling && (
        <div css={styles.pullToRefreshIndicatorStyles(pullDistance)}>
          {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {isRefreshing && <div css={styles.refreshingIndicatorStyles}>Refreshing...</div>}

      <section css={styles.statsHeaderStyles}>
        {/* Demo-to-Real Conversion Banner */}
        {isInDemoMode && !preferences.onboardingCompleted && (
          <div
            css={css`
              background: linear-gradient(135deg, ${designTokens.colors.primary[500]} 0%, ${designTokens.colors.primary[600]} 100%);
              border-radius: ${designTokens.borderRadius.lg};
              padding: ${designTokens.spacing[4]} ${designTokens.spacing[6]};
              margin-bottom: ${designTokens.spacing[6]};
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: ${designTokens.spacing[4]};
              flex-wrap: wrap;
              box-shadow: 0 4px 16px ${designTokens.colors.primary[500]}40;
            `}
          >
            <div css={css`display: flex; align-items: center; gap: ${designTokens.spacing[3]};`}>
              <div
                css={css`
                  width: 40px;
                  height: 40px;
                  border-radius: 50%;
                  background: rgba(255,255,255,0.2);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                `}
              >
                <Sparkles size={20} color="white" />
              </div>
              <div>
                <h3
                  css={css`
                    margin: 0;
                    font-size: ${designTokens.typography.fontSize.md};
                    font-weight: ${designTokens.typography.fontWeight.semibold};
                    color: white;
                  `}
                >
                  {preferences.demoValueSeen
                    ? "You've seen how governance works"
                    : "Explore the control plane"}
                </h3>
                <p
                  css={css`
                    margin: 0;
                    font-size: ${designTokens.typography.fontSize.sm};
                    color: rgba(255,255,255,0.9);
                  `}
                >
                  {preferences.demoValueSeen
                    ? "Connect your wallet to enable real agent governance with your own policies."
                    : "Check out the activity feed above to see governed decisions in action."}
                </p>
              </div>
            </div>
            <div css={css`display: flex; gap: ${designTokens.spacing[2]};`}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/onboarding')}
                css={css`
                  background: white;
                  color: ${designTokens.colors.primary[600]};
                  &:hover {
                    background: rgba(255,255,255,0.9);
                  }
                `}
              >
                <Wallet size={16} />
                Connect Wallet
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/onboarding')}
                css={css`color: rgba(255,255,255,0.9);`}
              >
                Set Up Policies →
              </Button>
            </div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: designTokens.spacing[4],
            flexWrap: 'wrap',
            gap: designTokens.spacing[3],
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: designTokens.spacing[3],
            }}
          >
            <h1
              css={styles.titleStyles}
              style={{
                marginBottom: 0,
                fontSize: isMobile ? '1.5rem' : '1.75rem',
              }}
            >
              Dashboard
            </h1>
            <OwsStatusIndicator />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: designTokens.spacing[2],
            }}
          >
            {isMobile ? (
              <Button variant="primary" size="sm" onClick={() => navigate('/policies')}>
                + Policy
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => void handleRefresh()}>
                  Refresh
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/policies')}>
                  Deploy Policy
                </Button>
              </>
            )}
          </div>
        </div>

        {(stats?.activeAgents === 0 || stats?.totalPolicies === 0) && !isLoading && (
          <div
            css={css`
              background: linear-gradient(
                135deg,
                ${designTokens.colors.primary[50]} 0%,
                ${designTokens.colors.semantic.success[50]} 100%
              );
              border-radius: ${designTokens.borderRadius.lg};
              padding: ${designTokens.spacing[6]};
              margin-bottom: ${designTokens.spacing[6]};
              border: 1px solid ${designTokens.colors.primary[200]};
            `}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: designTokens.spacing[4],
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: designTokens.colors.primary[100],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap size={24} color={designTokens.colors.primary[600]} />
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: `0 0 ${designTokens.spacing[2]} 0`,
                    fontSize: '18px',
                    fontWeight: 600,
                  }}
                >
                  {stats?.activeAgents === 0 ? 'Add Your First Agent' : 'Create Your First Policy'}
                </h3>
                <p
                  style={{
                    margin: `0 0 ${designTokens.spacing[4]} 0`,
                    color: designTokens.colors.neutral[600],
                    fontSize: '14px',
                  }}
                >
                  {stats?.activeAgents === 0
                    ? "Connect an agent to enable governed spend. We'll walk you through the setup."
                    : 'Set spend limits and rules to control what your agents can approve.'}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: designTokens.spacing[3],
                    flexWrap: 'wrap',
                  }}
                >
                  {stats?.activeAgents === 0 && (
                    <Button variant="primary" size="sm" onClick={() => navigate('/agents/connect')}>
                      Connect Agent →
                    </Button>
                  )}
                  {stats?.totalPolicies === 0 && (
                    <Button variant="outline" size="sm" onClick={() => navigate('/policies')}>
                      Create Policy →
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => navigate('/onboarding')}>
                    View Tutorial
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div css={styles.statsGridStyles(isMobile, isTablet)}>
          <StatCard
            label="Agents"
            value={stats?.activeAgents || 0}
            total={stats?.totalAgents}
            icon={<Users size={isMobile ? 18 : 24} />}
            color="primary"
            trend={{ value: `${stats?.totalTrades || 0} actions`, isPositive: true }}
          />
          <StatCard
            label="Policies"
            value={stats?.totalPolicies || 0}
            icon={<ShieldCheck size={isMobile ? 18 : 24} />}
            color="info"
            trend={{
              value: `${openAlerts.length} need action`,
              isPositive: openAlerts.length === 0,
            }}
          />
          <StatCard
            label="Approval Rate"
            value={`${((stats?.avgWinRate || 0) * 100).toFixed(1)}%`}
            icon={<Percent size={24} />}
            color="success"
            trend={{
              value: `${stats?.activeAgents || 0}/${stats?.totalAgents || 0} agents online`,
              isPositive: true,
            }}
          />
          <StatCard
            label="Policy Decisions"
            value={stats?.totalTrades || 0}
            icon={<FileSearch size={24} />}
            color="info"
            trend={{
              value: stats
                ? `${((stats.avgWinRate || 0) * 100).toFixed(1)}% approval rate`
                : 'No policy activity',
              isPositive: true,
            }}
          />
        </div>
      </section>

      <div css={styles.mainGridStyles(isMobile, isTablet)}>
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Governance Alerts</h2>
            <Badge variant="secondary" size="sm">
              {openAlerts.length} OPEN
            </Badge>
          </div>
          <QuestHUD quests={openAlerts} onResolve={handleResolveQuest} />
        </section>

        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <div style={{ display: 'flex', alignItems: 'center', gap: designTokens.spacing[2] }}>
              <h2 css={styles.sectionTitleStyles}>Recent Activity</h2>
              <div css={styles.liveIndicatorStyles}>
                <div css={styles.pulseDotStyles} />
                LIVE
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/audit')}>
              View All <ArrowRight size={16} />
            </Button>
          </div>
          {recentActivity.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: designTokens.spacing[8],
                background: designTokens.colors.neutral[50],
                borderRadius: designTokens.borderRadius.md,
              }}
            >
              <FileSearch
                size={40}
                color={designTokens.colors.neutral[400]}
                style={{ marginBottom: designTokens.spacing[3] }}
              />
              <p
                style={{
                  margin: `0 0 ${designTokens.spacing[3]} 0`,
                  color: designTokens.colors.neutral[600],
                }}
              >
                No activity yet — governed decisions and evidence will appear here as agents begin to operate.
              </p>
            </div>
          ) : (
            <ActivityFeed
              activities={recentActivity}
              compact={isMobile}
              showMore={showMoreActivity}
              onToggleMore={() => setShowMoreActivity(!showMoreActivity)}
            />
          )}
        </section>

        <QuickActions isMobile={isMobile} />

        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Governed Agents</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/agents')}>
              View All <ArrowRight size={16} />
            </Button>
          </div>
          {isLoading ? (
            <div css={styles.loadingStyles}>Loading agents...</div>
          ) : agents.length === 0 ? (
            <EmptyState type="agents" compact onAction={() => navigate('/agents/connect')} />
          ) : (
            <AgentGrid
              agents={agents.slice(0, isMobile ? 4 : isTablet ? 4 : 6)}
              columns={isMobile ? 1 : isTablet ? 2 : 3}
            />
          )}
        </section>
      </div>

      {!isMobile && agents.length > 0 && (
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Agent Performance</h2>
            <span css={styles.systemBadgeStyles('info')}>{agents.length} AGENTS TRACKED</span>
          </div>
          <Card>
            <CardContent>
              <Leaderboard agents={agents} />
            </CardContent>
          </Card>
        </section>
      )}

      <Modal
        isOpen={isThoughtModalOpen}
        onClose={() => setIsThoughtModalOpen(false)}
        title={
          selectedAgentId
            ? `Observing: ${agents.find((a) => a.id === selectedAgentId)?.name || selectedAgentId}`
            : 'Agent Observation'
        }
        size="lg"
      >
        <div style={{ minHeight: '300px', padding: designTokens.spacing[4] }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: designTokens.spacing[3],
              marginBottom: designTokens.spacing[6],
            }}
          >
            <div css={styles.activityIconStyles('info')}>
              <Brain size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Agent Trace</h3>
              <p
                style={{
                  fontSize: '12px',
                  color: designTokens.colors.text.secondary,
                }}
              >
                Recent governance and execution events captured by the control plane.
              </p>
            </div>
          </div>

          {isThoughtsLoading ? (
            <div css={styles.loadingStyles}>Loading agent trace...</div>
          ) : (
            <GenerativeReveal active={!isThoughtsLoading} duration={800}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: designTokens.spacing[4],
                }}
              >
                {agentThoughts.map((thought, i) => (
                  <div
                    key={i}
                    style={{
                      padding: designTokens.spacing[4],
                      background: designTokens.colors.background.secondary,
                      borderRadius: designTokens.borderRadius.md,
                      borderLeft: `4px solid ${designTokens.colors.primary[500]}`,
                      fontSize: '14px',
                      fontFamily: designTokens.typography.fontFamily.mono.join(', '),
                      color: designTokens.colors.text.primary,
                      animation: `slideIn 0.3s ease-out forwards ${i * 0.1}s`,
                      opacity: 0,
                      transform: 'translateX(-10px)',
                    }}
                  >
                    {thought}
                  </div>
                ))}
              </div>
            </GenerativeReveal>
          )}
        </div>
      </Modal>

      <QuickActions isMobile={isMobile} />
    </div>
  );
}
