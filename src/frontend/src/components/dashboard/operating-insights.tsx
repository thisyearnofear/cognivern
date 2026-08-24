'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  Clock,
  Gavel,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageState } from '@/components/ui/error-state';
import { formatBudget } from '@/lib/budget-format';
import type { NormalizedAuditLog } from '@/lib/normalizers';
import type { Agent, AuditLog } from '@cognivern/shared';
import { DecisionChart, type DecisionFilter } from './decision-chart';
import { GovernancePosture } from './governance-posture';
import { AttributionCard } from './attribution-card';
import { AiSpendCard } from './ai-spend-card';
import { ControlScoreCard } from './control-score-card';
import { ObservabilityStrip } from './observability-strip';

const ActivityChart = dynamic(
  () => import('./activity-chart').then((m) => ({ default: m.ActivityChart })),
  {
    ssr: false,
    loading: () => <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />,
  },
);

const AgentStatusChart = dynamic(
  () =>
    import('./agent-status-chart').then((m) => ({
      default: m.AgentStatusChart,
    })),
  {
    ssr: false,
    loading: () => <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />,
  },
);

interface OperatingInsightsProps {
  logs: AuditLog[];
  logsLoading: boolean;
  normalizedLogs: NormalizedAuditLog[];
  agentList: Agent[];
  agentsLoading: boolean;
  agentsError: boolean;
  decisionFilter: DecisionFilter;
  onDecisionFilterChange: (filter: DecisionFilter) => void;
  avgLatency: number | string;
  activeCount: number;
  onChainProofCount: number;
  onRetry: () => void;
}

/**
 * The dashboard's third layer: trends, identities, and technical signals.
 * Collapsed by default (progressive disclosure) so the first screen keeps its
 * single job — "what needs me?" / "is it working?" — and the detailed
 * operating data never competes with it. See docs/UX_IA_REVIEW.md.
 */
export function OperatingInsights({
  logs,
  logsLoading,
  normalizedLogs,
  agentList,
  agentsLoading,
  agentsError,
  decisionFilter,
  onDecisionFilterChange,
  avgLatency,
  activeCount,
  onChainProofCount,
  onRetry,
}: OperatingInsightsProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="border-t pt-5">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls="dashboard-insights"
        className="group flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="text-sm font-semibold">Operating insights</h2>
            <p className="text-xs text-muted-foreground">
              Trends, identities, and technical signals
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id="dashboard-insights" className="mt-5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DecisionChart
              logs={logs}
              loading={logsLoading}
              activeFilter={decisionFilter}
              onFilterChange={onDecisionFilterChange}
            />
            <ActivityChart logs={logs} loading={logsLoading} />
            <AgentStatusChart agents={agentList} loading={agentsLoading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
                <Clock className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {avgLatency}ms
                </div>
                <div className="text-xs text-muted-foreground">Average decision latency</div>
              </div>
            </div>
            <AiSpendCard />
            <ControlScoreCard />

            <div className="md:col-span-2 space-y-6">
              <GovernancePosture
                logs={normalizedLogs}
                activeIdentities={activeCount}
                onChainProofCount={onChainProofCount}
              />
              <AttributionCard onOpen={() => router.push('/spend')} />
            </div>
            <button
              type="button"
              onClick={() => router.push('/sealed-bid')}
              className="rounded-xl border bg-card p-4 text-left hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gavel className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Vendor governance</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage confidential vendor selections.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </button>
            <button
              type="button"
              onClick={() => router.push('/sponsor/credits')}
              className="rounded-xl border bg-card p-4 text-left hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">Sponsored credits</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Fund a cohort and meter its inference.
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </button>
          </div>

          {onChainProofCount > 0 && (
            <button
              type="button"
              onClick={() => router.push('/audit')}
              className="w-full flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-left hover:border-sky-500/40 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 text-sky-500 shrink-0" />
              <span className="text-sm text-foreground/80">
                <span className="font-semibold text-foreground">
                  {onChainProofCount} decision{onChainProofCount === 1 ? '' : 's'}
                </span>{' '}
                recorded on-chain.
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          )}
          <ObservabilityStrip onClick={() => router.push('/observability')} />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Identities</h2>
              <Button variant="ghost" size="sm" onClick={() => router.push('/agents')}>
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {agentsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card p-4 rounded-xl border">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ))}
              </div>
            ) : agentsError ? (
              <PageState
                variant="error"
                title="Could not load identities"
                message="Governed identity data is unavailable right now."
                action={{ label: 'Retry', onClick: onRetry }}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
                {agentList.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => router.push(`/agents/${agent.id}`)}
                    className="bg-card p-4 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${agent.status === 'active' || agent.status === 'connected' ? 'bg-emerald-500' : agent.status === 'registered' ? 'bg-blue-500' : 'bg-amber-500'}`}
                        />
                        <span className="font-medium text-sm">{agent.name}</span>
                      </div>
                      <Badge
                        variant={agent.status === 'active' || agent.status === 'connected' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {agent.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{agent.trades} actions</span>
                      <span className="font-medium">{formatBudget(agent.budget)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
