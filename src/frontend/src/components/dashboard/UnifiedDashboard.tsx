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
import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { css } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import {
  Percent,
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
  Users,
} from 'lucide-react';
import { designTokens } from '../../styles/design-system';
import { useBreakpoint } from '../../hooks/useMediaQuery';
import { agentApi, owsApi } from '../../services/apiService';
import { getApiKey, getApiUrl } from '../../utils/api';
import { copyTextToClipboard } from '../../utils/clipboard';
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
  EmptyState,
} from '../ui';
import ConfidentialSpendForm from '../trading/ConfidentialSpendForm';
import { Node } from '../ui/EcosystemVisualizer';
import Tooltip from '../ui/Tooltip';
import * as styles from './UnifiedDashboard.styles';
import { Column } from '../ui/DataTable';
import { ChartDataPoint } from '../ui/Chart';
import { QuestHUD } from './QuestHUD';
import { Leaderboard, AgentGrid, AgentCarousel } from './Leaderboard';
import { ActivityFeed, TrustSignals } from './ActivityFeed';
import { QuickActions } from './QuickActions';

// OWS Status Indicator - Shows wallet, API key, and agent status
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
      } catch (error) {
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
    fetchOwsStatus();
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

// Lazy load heavy components for performance
const EcosystemVisualizer = lazy(() =>
  import('../ui/EcosystemVisualizer').then((module) => ({
    default: module.EcosystemVisualizer,
  })),
);

interface DashboardProps {
  mode?: 'full' | 'minimal'; // minimal for agent-to-agent
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
  performance24h?: {
    trades: number;
    winRate: number;
    return: number;
    sharpeRatio: number;
  };
}

interface PolicySummary {
  id: string;
  name: string;
  status: string;
}

interface ActivityItem {
  id: string;
  agentId?: string;
  agentName?: string;
  type?: string;
  severity?: 'success' | 'warning' | 'error' | 'info';
  description?: string;
  timestamp?: string;
  sourceType?: 'audit' | 'run';
  sourceId?: string;
  runId?: string;
  targetPath?: string;
  evidenceLabel?: string;
  policyIds?: string[];
  projectId?: string;
  workflow?: string;
  artifactCount?: number;
  citations?: string[];
  model?: string;
  workflowVersion?: string;
  evidenceHash?: string;
  cid?: string;
  artifactIds?: string[];
}

interface QuestItem {
  id: string;
  type: 'pattern' | 'recommendation' | 'trend' | 'alert';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: boolean;
}

interface DashboardBundlePayload {
  stats?: {
    totalAgents?: number;
    avgWinRate?: number;
    avgReturn?: number;
    totalTrades?: number;
    totalPolicies?: number;
  };
  agents?: Array<
    AgentSummary & {
      ecosystem?: string;
      uptime?: number;
      performance24h?: {
        trades: number;
        winRate: number;
        return: number;
        sharpeRatio: number;
      };
    }
  >;
  activity?: Array<Record<string, unknown>>;
  policies?: PolicySummary[];
  quests?: QuestItem[];
}

interface UnifiedDashboardPayload {
  workerThoughts?: string[];
}

interface LiveFeedItem {
  id: string;
  sourceLabel: string;
  body: string;
  timestampLabel: string;
  agentId?: string;
  targetPath?: string;
  evidenceLabel?: string;
  evidenceFacts?: string[];
  evidenceHash?: string;
  cid?: string;
}

const buildAuditPath = (activity: {
  agentId?: string;
  type?: string;
  severity?: string;
  sourceId?: string;
}): string => {
  const params = new URLSearchParams();
  if (activity.agentId) {
    params.set('agentId', activity.agentId);
  }
  if (activity.type) {
    params.set('actionType', activity.type);
  }
  if (activity.severity === 'error') {
    params.set('complianceStatus', 'non-compliant');
  }
  if (activity.sourceId) {
    params.set('eventId', activity.sourceId);
  }
  const query = params.toString();
  return query ? `/audit?${query}` : '/audit';
};

const unwrapApiPayload = <T,>(result: { success: boolean; data?: any }): T | null => {
  if (!result.success || !result.data?.data) {
    return null;
  }

  return result.data.data as T;
};

const toUiSeverity = (value?: string): ActivityItem['severity'] => {
  switch (value) {
    case 'compliant':
    case 'success':
    case 'low':
      return 'success';
    case 'warning':
    case 'medium':
      return 'warning';
    case 'non-compliant':
    case 'high':
    case 'critical':
    case 'error':
      return 'error';
    default:
      return 'info';
  }
};

const mapQuestSeverity = (s: QuestItem['severity']): 'success' | 'warning' | 'error' | 'info' => {
  switch (s) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'info';
  }
};

const normalizeActivity = (entry: Record<string, any>): ActivityItem => ({
  id: String(entry.id || crypto.randomUUID()),
  agentId:
    typeof entry.agent === 'string'
      ? entry.agent
      : typeof entry.details?.agentId === 'string'
        ? entry.details.agentId
        : undefined,
  agentName:
    typeof entry.agent === 'string'
      ? entry.agent
      : typeof entry.details?.agent?.name === 'string'
        ? entry.details.agent.name
        : undefined,
  type: typeof entry.actionType === 'string' ? entry.actionType : entry.type,
  severity: toUiSeverity(entry.severity || entry.complianceStatus),
  description:
    typeof entry.description === 'string'
      ? entry.description
      : typeof entry.action === 'string'
        ? entry.action
        : 'Activity',
  timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : undefined,
  sourceType: 'audit',
  sourceId: typeof entry.id === 'string' ? entry.id : undefined,
  targetPath: buildAuditPath({
    agentId:
      typeof entry.agent === 'string'
        ? entry.agent
        : typeof entry.details?.agentId === 'string'
          ? entry.details.agentId
          : undefined,
    type: typeof entry.actionType === 'string' ? entry.actionType : entry.type,
    severity: toUiSeverity(entry.severity || entry.complianceStatus),
    sourceId: typeof entry.id === 'string' ? entry.id : undefined,
  }),
  evidenceLabel: typeof entry.id === 'string' ? `Audit ${entry.id}` : undefined,
  policyIds: Array.isArray(entry.policyChecks)
    ? entry.policyChecks
        .map((check: Record<string, unknown>) =>
          typeof check.policyId === 'string' ? check.policyId : null,
        )
        .filter((value: string | null): value is string => Boolean(value))
    : [],
  artifactIds: Array.isArray(entry.evidence?.artifactIds)
    ? entry.evidence.artifactIds.filter(
        (value: unknown): value is string => typeof value === 'string',
      )
    : [],
  projectId: typeof entry.details?.projectId === 'string' ? entry.details.projectId : undefined,
  citations: Array.isArray(entry.details?.citations)
    ? entry.details.citations.filter((value: unknown): value is string => typeof value === 'string')
    : [],
  evidenceHash: typeof entry.evidence?.hash === 'string' ? entry.evidence.hash : undefined,
  cid: typeof entry.evidence?.cid === 'string' ? entry.evidence.cid : undefined,
});

const normalizeRunStreamActivity = (entry: Record<string, any>): ActivityItem => ({
  id: String(entry.id || crypto.randomUUID()),
  agentId: typeof entry.runId === 'string' ? entry.runId : undefined,
  agentName: typeof entry.workflow === 'string' ? entry.workflow : 'CRE Run',
  type: typeof entry.type === 'string' ? entry.type : 'run_event',
  severity:
    entry.type === 'run_failed'
      ? 'error'
      : entry.type === 'run_paused_for_approval'
        ? 'warning'
        : 'info',
  description:
    typeof entry.summary === 'string' && entry.summary.trim().length > 0
      ? entry.summary
      : `${entry.workflow || 'workflow'} emitted ${entry.type || 'run_event'}`,
  timestamp: typeof entry.timestamp === 'string' ? entry.timestamp : undefined,
  sourceType: 'run',
  sourceId: typeof entry.id === 'string' ? entry.id : undefined,
  runId: typeof entry.runId === 'string' ? entry.runId : undefined,
  targetPath: typeof entry.runId === 'string' ? `/runs/${entry.runId}` : '/runs',
  evidenceLabel: typeof entry.runId === 'string' ? `Run ${entry.runId}` : undefined,
  projectId: typeof entry.projectId === 'string' ? entry.projectId : undefined,
  workflow: typeof entry.workflow === 'string' ? entry.workflow : undefined,
  artifactCount: typeof entry.artifactCount === 'number' ? entry.artifactCount : undefined,
  artifactIds: Array.isArray(entry.evidence?.artifactIds)
    ? entry.evidence.artifactIds.filter(
        (value: unknown): value is string => typeof value === 'string',
      )
    : Array.isArray(entry.runEvidence?.artifactIds)
      ? entry.runEvidence.artifactIds.filter(
          (value: unknown): value is string => typeof value === 'string',
        )
      : [],
  citations: Array.isArray(entry.citationLabels)
    ? entry.citationLabels.filter((value: unknown): value is string => typeof value === 'string')
    : [],
  model: typeof entry.model === 'string' ? entry.model : undefined,
  workflowVersion: typeof entry.workflowVersion === 'string' ? entry.workflowVersion : undefined,
  evidenceHash:
    typeof entry.evidence?.hash === 'string'
      ? entry.evidence.hash
      : typeof entry.runEvidence?.hash === 'string'
        ? entry.runEvidence.hash
        : undefined,
  cid:
    typeof entry.evidence?.cid === 'string'
      ? entry.evidence.cid
      : typeof entry.runEvidence?.cid === 'string'
        ? entry.runEvidence.cid
        : undefined,
});

const buildEvidenceFacts = (activity: ActivityItem): string[] => {
  const facts: string[] = [];

  if (activity.projectId) {
    facts.push(`Project ${activity.projectId}`);
  }
  if (activity.workflow) {
    facts.push(`Workflow ${activity.workflow}`);
  }
  if (activity.policyIds && activity.policyIds.length > 0) {
    facts.push(`Policies ${activity.policyIds.slice(0, 2).join(', ')}`);
  }
  if (typeof activity.artifactCount === 'number') {
    facts.push(`${activity.artifactCount} artifacts`);
  }
  if (activity.model) {
    facts.push(`Model ${activity.model}`);
  }
  if (activity.workflowVersion) {
    facts.push(`Version ${activity.workflowVersion}`);
  }
  if (activity.cid) {
    facts.push(`CID ${activity.cid.slice(0, 12)}…`);
  }
  if (activity.evidenceHash) {
    facts.push(`Hash ${activity.evidenceHash.slice(0, 12)}…`);
  }
  if (activity.artifactIds && activity.artifactIds.length > 0) {
    facts.push(`Artifacts ${activity.artifactIds.slice(0, 2).join(', ')}`);
  }
  if (activity.citations && activity.citations.length > 0) {
    facts.push(`Citations ${activity.citations.slice(0, 2).join(', ')}`);
  }

  return facts;
};

const buildTrustSignals = (activity: ActivityItem) => {
  const signals: Array<{
    label: string;
    variant: 'success' | 'secondary' | 'warning' | 'outline';
    hint: string;
  }> = [];

  if (activity.evidenceHash) {
    signals.push({
      label: 'hash-backed',
      variant: 'success',
      hint: 'Stable evidence hash is present for this event.',
    });
  }
  if (activity.cid) {
    signals.push({
      label: 'cid-linked',
      variant: 'secondary',
      hint: 'Event points to content-addressed evidence or artifact storage.',
    });
  }
  if (activity.policyIds && activity.policyIds.length > 0) {
    signals.push({
      label: 'policy-enforced',
      variant: 'warning',
      hint: `Mapped to ${activity.policyIds.length} policy check${activity.policyIds.length > 1 ? 's' : ''}.`,
    });
  }
  if (activity.sourceType === 'run' && activity.runId) {
    signals.push({
      label: 'run-linked',
      variant: 'outline',
      hint: 'Trace links back to a persisted run record.',
    });
  }

  return signals.slice(0, 3);
};

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
        <Tooltip key={signal.label} content={signal.hint}>
          <span>
            <Badge variant={signal.variant} size="sm">
              {signal.label}
            </Badge>
          </span>
        </Tooltip>
      ))}
    </div>
  );
};

export default function UnifiedDashboard({ mode = 'full' }: DashboardProps) {
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
  const [workerThoughts, setWorkerThoughts] = useState<string[]>([]);

  // Agent Thought Observation State (Intelligent Layer)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [agentThoughts, setAgentThoughts] = useState<string[]>([]);
  const [isThoughtModalOpen, setIsThoughtModalOpen] = useState(false);
  const [isThoughtsLoading, setIsThoughtsLoading] = useState(false);

  // Transform agents and policies into Map Nodes (DRY & PERFORMANT)
  const ecosystemNodes = useMemo<Node[]>(() => {
    const nodes: Node[] = [
      {
        id: 'kernel',
        type: 'system',
        label: 'Kernel',
        status: 'active',
        x: 50,
        y: 50,
      },
    ];

    agents.forEach((agent) => {
      nodes.push({
        id: agent.id,
        type: 'agent',
        label: agent.name,
        status: agent.status,
        pulse: agent.status === 'active',
        x: 0,
        y: 0,
      });
    });

    policies.forEach((policy) => {
      nodes.push({
        id: policy.id,
        type: 'policy',
        label: policy.name,
        status: policy.status === 'active' ? 'active' : 'idle',
        x: 0,
        y: 0,
      });
    });

    return nodes;
  }, [agents, policies]);

  // Pull-to-refresh state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  const performanceTrendData = useMemo<ChartDataPoint[]>(() => {
    return agents.slice(0, 6).map((agent) => ({
      x: agent.name,
      y: Number(((agent.performance24h?.return ?? agent.totalReturn) * 100).toFixed(2)),
      label: agent.name,
    }));
  }, [agents]);

  const distributionData = useMemo<ChartDataPoint[]>(() => {
    const counts = agents.reduce<Record<string, number>>((acc, agent) => {
      acc[agent.type] = (acc[agent.type] || 0) + 1;
      return acc;
    }, {});

    const colors = [
      designTokens.colors.primary[500],
      designTokens.colors.secondary[500],
      designTokens.colors.semantic.success[500],
      designTokens.colors.semantic.warning[500],
    ];

    return Object.entries(counts).map(([type, count], index) => ({
      x: type,
      y: count,
      label: type,
      color: colors[index % colors.length],
    }));
  }, [agents]);

  const liveFeedItems = useMemo<LiveFeedItem[]>(() => {
    const thoughtItems = workerThoughts.slice(0, 5).map((thought, index) => ({
      id: `worker-thought-${index}`,
      sourceLabel: 'Governance Kernel',
      body: thought,
      timestampLabel: 'live',
      targetPath: '/audit',
      evidenceLabel: 'Worker thought',
      evidenceFacts: ['Worker telemetry'],
      evidenceHash: undefined,
      cid: undefined,
    }));

    const activityItems = recentActivity.slice(0, 5).map((activity) => ({
      id: `activity-${activity.id}`,
      sourceLabel: activity.agentName || activity.agentId || 'Agent Event',
      body: activity.description || 'Activity observed',
      timestampLabel: activity.timestamp
        ? new Date(activity.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : 'recent',
      agentId: activity.agentId,
      targetPath: activity.targetPath,
      evidenceLabel: activity.evidenceLabel,
      evidenceFacts: buildEvidenceFacts(activity),
      evidenceHash: activity.evidenceHash,
      cid: activity.cid,
    }));

    return [...thoughtItems, ...activityItems].slice(0, 10);
  }, [recentActivity, workerThoughts]);

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

    source.addEventListener('audit_log', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        prependActivity(normalizeActivity(payload));
      } catch (error) {
        console.warn('Failed to parse dashboard audit stream event', error);
      }
    });

    source.addEventListener('run_event', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
        prependActivity(normalizeRunStreamActivity(payload));
      } catch (error) {
        console.warn('Failed to parse dashboard run stream event', error);
      }
    });

    source.onerror = () => {
      console.warn('Dashboard event stream temporarily unavailable');
    };

    return () => {
      source.close();
    };
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

    container.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    container.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
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
      const [bundleResult, unifiedResult] = await Promise.all([
        agentApi.getDashboardBundle(),
        agentApi.getUnifiedDashboard(),
      ]);

      const bundle = unwrapApiPayload<DashboardBundlePayload>(bundleResult);
      const unified = unwrapApiPayload<UnifiedDashboardPayload>(unifiedResult);

      if (!bundle) {
        throw new Error(bundleResult.error || 'Failed to fetch dashboard bundle');
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
      setRecentActivity((bundle.activity || []).map(normalizeActivity));
      setPolicies(bundle.policies || []);
      setQuests(bundle.quests || []);
      setWorkerThoughts(unified?.workerThoughts || []);
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
        // Refresh dashboard to show updated quests
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Failed to resolve quest:', error);
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

  const handleNodeClick = async (node: Node) => {
    if (node.type === 'agent') {
      await handleViewThoughts(node.id);
    }
  };

  // Minimal mode for agent-to-agent (JSON-like display)
  if (mode === 'minimal') {
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
          {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      {/* Refreshing indicator */}
      {isRefreshing && <div css={styles.refreshingIndicatorStyles}>Refreshing...</div>}

      {/* Quick Stats Header - Simplified */}
      <section css={styles.statsHeaderStyles}>
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
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                  Refresh
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/policies')}>
                  Deploy Policy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Getting Started Hero - Show when no agents/policies */}
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

        {/* Compact stats row for mobile, grid for desktop */}
        <div css={styles.statsGridStyles(isMobile, isTablet)}>
          <StatCard
            label="Agents"
            value={stats?.activeAgents || 0}
            total={stats?.totalAgents}
            icon={<Users size={isMobile ? 18 : 24} />}
            color="primary"
            trend={{
              value: `${stats?.totalTrades || 0} actions`,
              isPositive: true,
            }}
          />
          <StatCard
            label="Policies"
            value={stats?.totalPolicies || 0}
            icon={<ShieldCheck size={isMobile ? 18 : 24} />}
            color="info"
            trend={{
              value: `${quests.filter((quest) => quest.actionRequired).length} need action`,
              isPositive: quests.filter((quest) => quest.actionRequired).length === 0,
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

      {/* Live Ecosystem - Collapsible, shown by default */}
      <section css={styles.sectionStyles}>
        <div css={styles.sectionHeaderStyles}>
          <h2 css={styles.sectionTitleStyles}>Network</h2>
        </div>
        <Card
          css={css`
            overflow: hidden;
          `}
        >
          <Suspense
            fallback={
              <div css={styles.loadingStyles}>
                <LoadingSpinner size="lg" />
              </div>
            }
          >
            <EcosystemVisualizer
              nodes={ecosystemNodes}
              loading={isLoading}
              onNodeClick={handleNodeClick}
            />
          </Suspense>
        </Card>
      </section>

      {/* Performance Trends - Hidden on mobile */}
      {!isMobile && (
        <section css={styles.sectionStyles}>
          <div css={styles.chartsGridStyles(isMobile, isTablet)}>
            <Card>
              <CardContent>
                <h3
                  css={styles.sectionTitleStyles}
                  style={{ fontSize: '14px', marginBottom: '20px' }}
                >
                  24H Return
                </h3>
                <Chart
                  type="area"
                  data={performanceTrendData}
                  height={200}
                  yAxisLabel="Return %"
                  animate
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h3
                  css={styles.sectionTitleStyles}
                  style={{ fontSize: '14px', marginBottom: '20px' }}
                >
                  Agent Distribution
                </h3>
                <div
                  style={{
                    height: '200px',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <Chart type="pie" data={distributionData} height={200} animate />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <div css={styles.mainGridStyles(isMobile, isTablet)}>
        {/* Agent Overview */}
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Top Performing Agents</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/agents')}>
              View All <ArrowRight size={16} />
            </Button>
          </div>

          {isLoading ? (
            <div css={styles.loadingStyles}>Loading agents...</div>
          ) : agents.length === 0 ? (
            <EmptyState type="agents" compact onAction={() => navigate('/agents/connect')} />
          ) : isMobile ? (
            <AgentCarousel agents={agents} />
          ) : (
            <AgentGrid agents={agents} columns={isTablet ? 2 : 3} />
          )}
        </section>

        {/* Privacy-Native Operations - Fhenix Integration */}
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 css={styles.sectionTitleStyles}>Privacy-Native Operations</h2>
              <Badge variant="success" size="sm">
                FHENIX POWERED
              </Badge>
            </div>
          </div>
          <ConfidentialSpendForm />
        </section>

        {/* Recent Activity */}
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Recent Activity</h2>
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
                No activity yet - actions will appear here once agents start making decisions
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

        {/* Quest HUD - Governance Quests - Only show if there are active quests */}
        {quests.filter((q) => q.actionRequired).length > 0 && (
          <section css={styles.sectionStyles}>
            <div css={styles.sectionHeaderStyles}>
              <h2 css={styles.sectionTitleStyles}>Governance Quests</h2>
              <Badge variant="secondary" size="sm">
                {quests.filter((q) => q.actionRequired).length} ACTIVE
              </Badge>
            </div>
            <QuestHUD quests={quests} onResolve={handleResolveQuest} />
          </section>
        )}
      </div>

      {/* Global Leaderboard - Only show if there are agents */}
      {!isMobile && agents.length > 0 && (
        <section css={styles.sectionStyles}>
          <div css={styles.sectionHeaderStyles}>
            <h2 css={styles.sectionTitleStyles}>Autonomous Leaderboard</h2>
            <span css={styles.systemBadgeStyles('info')}>{agents.length} AGENTS TRACKED</span>
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

      {/* Quick Actions (Mobile: Bottom, Desktop: Floating) */}
      <QuickActions isMobile={isMobile} />

      {/* Live Thought Stream - Delight & Intuitive Feedback */}
      <div
        css={css`
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
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      >
        <div
          style={{
            padding: designTokens.spacing[3],
            background: designTokens.colors.primary[500],
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={16} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>Live Governance Feed</span>
          </div>
          <Badge
            variant="secondary"
            size="sm"
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none' }}
          >
            {liveFeedItems.length} ACTIVE
          </Badge>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: designTokens.spacing[3],
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {liveFeedItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: designTokens.colors.text.secondary,
                padding: '20px',
                fontSize: '13px',
              }}
            >
              Waiting for live governance events...
            </div>
          ) : (
            liveFeedItems.map((t) => (
              <div
                key={t.id}
                style={{
                  fontSize: '12px',
                  borderLeft: `2px solid ${designTokens.colors.primary[300]}`,
                  paddingLeft: '8px',
                  paddingBottom: '4px',
                  animation: 'slideInRight 0.3s ease-out',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '2px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: designTokens.colors.primary[600],
                    }}
                  >
                    {t.sourceLabel}
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      color: designTokens.colors.text.secondary,
                    }}
                  >
                    {t.timestampLabel}
                  </div>
                </div>
                <div
                  style={{
                    color: designTokens.colors.text.primary,
                    lineHeight: 1.4,
                  }}
                >
                  {t.body}
                </div>
                {t.evidenceHash || t.cid ? (
                  <TrustSignals
                    activity={{
                      id: t.id,
                      sourceType: t.agentId ? 'run' : 'audit',
                      runId: t.agentId,
                      evidenceHash: t.evidenceHash,
                      cid: t.cid,
                    }}
                  />
                ) : null}
                {t.evidenceFacts && t.evidenceFacts.length > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    {t.evidenceFacts.slice(0, 3).map((fact) => (
                      <span
                        key={fact}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '999px',
                          background: designTokens.colors.neutral[100],
                          color: designTokens.colors.text.secondary,
                        }}
                      >
                        {fact}
                      </span>
                    ))}
                  </div>
                )}
                {(t.agentId || t.targetPath) && (
                  <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                    <span
                      onClick={() => {
                        if (t.targetPath) {
                          navigate(t.targetPath);
                          return;
                        }
                        if (t.agentId) {
                          void handleViewThoughts(t.agentId);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        color: designTokens.colors.primary[500],
                        fontSize: '10px',
                        textDecoration: 'underline',
                        fontWeight: 600,
                      }}
                    >
                      {t.evidenceLabel || 'Inspect Trace'}
                    </span>
                    {t.evidenceHash && (
                      <span
                        onClick={() => {
                          void copyTextToClipboard(t.evidenceHash as string);
                        }}
                        style={{
                          cursor: 'pointer',
                          color: designTokens.colors.text.secondary,
                          fontSize: '10px',
                          textDecoration: 'underline',
                          fontWeight: 600,
                        }}
                      >
                        Copy Hash
                      </span>
                    )}
                    {t.cid && (
                      <span
                        onClick={() => {
                          void copyTextToClipboard(t.cid as string);
                        }}
                        style={{
                          cursor: 'pointer',
                          color: designTokens.colors.text.secondary,
                          fontSize: '10px',
                          textDecoration: 'underline',
                          fontWeight: 600,
                        }}
                      >
                        Copy CID
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
