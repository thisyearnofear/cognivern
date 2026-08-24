'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import type { AuditLog } from '@cognivern/shared';
import { Button } from '@/components/ui/button';
import { AttentionSummary } from '@/components/ui/attention-summary';
import { useRouter } from 'next/navigation';
import { useAgents, useAuditLogs, usePolicies, useNetworkStatus } from '@/hooks/use-api';
import { useAuthStore } from '@/stores/auth-store';
import { useDemoStore } from '@/stores/demo-store';
import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import { trackUxEvent } from '@/lib/ux-events';
import { QuickCheck } from './quick-check';
import { normalizeAuditLogs, computeAverageLatency } from '@/lib/normalizers';
import { SetupChecklist } from './setup-checklist';
import { DashboardStats } from './dashboard-stats';
import { RecentActivity } from './recent-activity';
import { OperatingInsights } from './operating-insights';
import type { DecisionFilter } from './decision-chart';

/**
 * Dashboard home. The first screen has one job at a time: finish setup,
 * resolve attention, or confirm that governance is steady. Detailed operating
 * data (charts, identities, technical signals) lives behind the Operating
 * insights disclosure so it never competes with that job.
 * See docs/UX_IA_REVIEW.md.
 */
export function Dashboard() {
  const router = useRouter();
  const demoMode = useDemoStore((s) => s.demoMode);
  const workspace = useAuthStore((s) => s.workspace);
  const isAuthenticated = useAuthStore((s) => s.isConnected);
  const [refreshing, setRefreshing] = useState(false);
  useNetworkStatus();

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [router]);
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useAgents();
  const { data: logs, isLoading: logsLoading, error: logsError } = useAuditLogs();
  const { data: policies, isLoading: policiesLoading } = usePolicies();
  const { data: apiKeysResponse, isLoading: apiKeysLoading } = useSWR(
    isAuthenticated ? 'dashboard-api-keys' : null,
    () => apiClient.getApiKeys(),
  );

  // Cross-filtering state (decision donut → recent activity).
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>(null);

  useEffect(() => {
    trackUxEvent('route_viewed', 'dashboard');
  }, []);

  const agentList = agents || [];

  const normalizedLogs = useMemo(() => {
    return normalizeAuditLogs(logs as AuditLog[]);
  }, [logs]);

  const activity = useMemo(() => {
    return normalizedLogs.map((l) => ({
      id: l.id,
      agent: l.agent,
      action: l.action,
      amount: '—',
      time: l.time,
      status: l.decision,
      _normalized: l.decision,
    }));
  }, [normalizedLogs]);

  // Filtered activity based on donut cross-filter
  const filteredActivity = useMemo(() => {
    if (!decisionFilter) return activity;
    return activity.filter((a) => a._normalized === decisionFilter);
  }, [activity, decisionFilter]);

  const activeCount = agentList.filter((a) => a.status === 'active' || a.status === 'connected').length;
  const approvalRate =
    normalizedLogs.length > 0
      ? Math.round(
          (normalizedLogs.filter((l) => l.decision === 'approved').length / normalizedLogs.length) *
            100,
        )
      : 0;
  const decisions = normalizedLogs.length;
  const blockedCount = normalizedLogs.filter((l) => l.decision === 'denied').length;
  const heldCount = normalizedLogs.filter((l) => l.decision === 'held').length;
  const attentionCount = blockedCount + heldCount;
  const avgLatency = computeAverageLatency(normalizedLogs);
  const hasActivePolicy = (policies || []).some((policy) => policy.status === 'active');
  const hasActiveAgent = agentList.some((agent) => agent.status !== 'inactive');
  const hasApiKey = (apiKeysResponse?.data || []).some((key) => !key.revokedAt);
  const setupLoading = agentsLoading || policiesLoading || logsLoading || apiKeysLoading;
  // Setup is the primary journey only until the workspace has proved the
  // loop end-to-end. Once policy, identity, key, and first decision exist,
  // hand the first screen back to operating status and the next useful review.
  // This prevents the checklist and WorkspaceNextAction from competing.
  const showSetup =
    isAuthenticated &&
    !setupLoading &&
    (!hasActivePolicy || !hasActiveAgent || !hasApiKey || normalizedLogs.length === 0);
  const workspaceState = showSetup
    ? 'setup'
    : attentionCount > 0
      ? 'attention'
      : 'operating';

  // Count decisions carrying a real on-chain governance-record tx (mirrors the
  // audit page's getOnChainTxHash: top-level or nested data.txHash). Real data
  // only — 0 for demo sample logs, which is accurate, so the strip stays hidden.
  const onChainProofCount = useMemo(() => {
    if (!Array.isArray(logs)) return 0;
    return logs.filter((l) => {
      const r = l as unknown as Record<string, unknown>;
      if (typeof r.txHash === 'string' && r.txHash.length > 10) return true;
      const data = r.data as Record<string, unknown> | undefined;
      const dataTx = data?.txHash;
      return typeof dataTx === 'string' && dataTx.length > 10;
    }).length;
  }, [logs]);

  // Stat deltas (compare first half vs second half of logs for trend)
  const approvalDelta = useMemo(() => {
    if (normalizedLogs.length < 4) return 0;
    const mid = Math.floor(normalizedLogs.length / 2);
    const recentHalf = normalizedLogs.slice(0, mid);
    const olderHalf = normalizedLogs.slice(mid);
    const recentApproval = Math.round(
      (recentHalf.filter((l) => l.decision === 'approved').length / recentHalf.length) * 100,
    );
    const olderApproval = Math.round(
      (olderHalf.filter((l) => l.decision === 'approved').length / olderHalf.length) * 100,
    );
    return recentApproval - olderApproval;
  }, [normalizedLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {!demoMode && !showSetup && (
            <p className="text-sm text-muted-foreground">
              {blockedCount > 0
                ? `${blockedCount} decision${blockedCount === 1 ? '' : 's'} needs your attention.`
                : 'Your governed activity at a glance.'}
            </p>
          )}
          {demoMode && workspace && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              <span>Sample data — explore freely, nothing here is real</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agentsError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <span className="font-medium">Unable to reach API</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {showSetup && (
        <SetupChecklist
          hasPolicy={hasActivePolicy}
          hasAgent={hasActiveAgent}
          hasApiKey={hasApiKey}
          hasGovernedRequest={normalizedLogs.length > 0}
        />
      )}

      {/* The first screen has one job at a time: finish setup, resolve
          attention, or confirm that governance is steady. */}
      {workspaceState !== 'setup' && (
        <AttentionSummary
          tone={workspaceState === 'attention' ? 'attention' : 'healthy'}
          title={workspaceState === 'attention' ? 'Governance needs attention' : 'Governance is steady'}
          description={
            workspaceState === 'attention'
              ? 'Review held decisions and investigate stopped outcomes before they become operational surprises.'
              : 'No decisions are waiting for operator action. Run a Quick Check or review recent activity below.'
          }
          items={
            workspaceState === 'attention'
              ? [
                  ...(heldCount > 0 ? [{ label: 'held', count: heldCount }] : []),
                  ...(blockedCount > 0 ? [{ label: 'stopped', count: blockedCount }] : []),
                ]
              : []
          }
          action={
            workspaceState === 'attention'
              ? {
                  label: 'Review decisions',
                  onClick: () => router.push('/audit?status=needs_attention'),
                }
              : undefined
          }
        />
      )}

      {/* Operational overview */}
      <DashboardStats
        loading={agentsLoading || logsLoading || policiesLoading}
        activeCount={activeCount}
        totalIdentities={agentList.length}
        approvalRate={approvalRate}
        approvalDelta={approvalDelta}
        blockedCount={blockedCount}
        decisions={decisions}
        logs={Array.isArray(logs) ? logs : []}
      />

      {/* The sole primary task: run a spend through governance. */}
      <QuickCheck />

      {/* Recent Activity */}
      <RecentActivity
        loading={logsLoading}
        error={!!logsError}
        items={filteredActivity}
        totalCount={activity.length}
        decisionFilter={decisionFilter}
        onClearFilter={() => setDecisionFilter(null)}
        onRetry={handleRefresh}
      />

      {/* Third layer: trends, identities, and technical signals */}
      <OperatingInsights
        logs={Array.isArray(logs) ? logs : []}
        logsLoading={logsLoading}
        normalizedLogs={normalizedLogs}
        agentList={agentList}
        agentsLoading={agentsLoading}
        agentsError={!!agentsError}
        decisionFilter={decisionFilter}
        onDecisionFilterChange={setDecisionFilter}
        avgLatency={avgLatency}
        activeCount={activeCount}
        onChainProofCount={onChainProofCount}
        onRetry={handleRefresh}
      />
    </div>
  );
}
