'use client';

import { motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { DisclosureSection } from '@/components/ui/disclosure-section';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import {
  PlusCircle,
  Key,
  Eye,
  Pause,
  Play,
  Trash2,
  Loader2,
  SquareCheckBig,
  X,
  Bot,
} from 'lucide-react';
import { useAgents } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { mutate } from 'swr';
import { useMemo, useState } from 'react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function AgentCard({
  agent,
  selectionMode,
  selected,
  onToggle,
}: {
  agent: {
    id: string;
    name: string;
    role: string;
    status: string;
    trades: number;
    budget: string;
    chain: string;
    source?: string;
  };
  selectionMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const router = useRouter();
  const isDemo = agent.source === 'demo';
  const selectable = !isDemo;

  return (
    <motion.div
      variants={itemVariants}
      className={`bg-card p-5 transition-colors relative ${
        selectionMode
          ? selected
            ? 'ring-2 ring-primary bg-primary/5'
            : selectable
              ? 'hover:bg-accent/40 cursor-pointer'
              : ''
          : 'hover:bg-accent/50 cursor-pointer'
      }`}
      onClick={() => {
        if (selectionMode && selectable) onToggle(agent.id);
        else if (!selectionMode) router.push(`/agents/${agent.id}`);
      }}
      onKeyDown={(event) => {
        if (!selectionMode && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          router.push(`/agents/${agent.id}`);
        }
      }}
      role={!selectionMode ? 'button' : undefined}
      tabIndex={!selectionMode ? 0 : undefined}
      aria-label={
        !selectionMode
          ? `${agent.name}, ${isDemo ? 'demo identity' : `${agent.status} API identity`}`
          : undefined
      }
    >
      {selectionMode && selectable && (
        <label
          className="absolute left-3 top-3 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded border bg-background"
          onClick={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(agent.id)}
            aria-label={`Select ${agent.name}`}
            className="h-3.5 w-3.5 accent-primary"
          />
        </label>
      )}
      <div className={`flex items-start justify-between mb-4 ${selectionMode ? 'pl-6' : ''}`}>
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isDemo
                ? 'bg-violet-100 dark:bg-violet-950 text-violet-600'
                : agent.status === 'active' || agent.status === 'connected'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                  : agent.status === 'registered'
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-600'
                    : agent.status === 'paused'
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-400'
            }`}
          >
            {isDemo ? <Eye className="h-5 w-5" /> : <Key className="h-5 w-5" />}
          </div>
          <div>
            <div className="font-semibold">{agent.name}</div>
            <div className="text-xs text-muted-foreground">{agent.role}</div>
          </div>
        </div>
        {isDemo ? (
          <Badge
            variant="outline"
            className="text-violet-600 border-violet-300 dark:border-violet-700 dark:text-violet-400"
          >
            demo
          </Badge>
        ) : (
          <>
            <Badge
              variant={
                agent.status === 'active' || agent.status === 'connected'
                  ? 'secondary'
                  : agent.status === 'paused'
                    ? 'outline'
                    : 'outline'
              }
            >
              {agent.status}
            </Badge>
            {agent.source === 'sample' && (
              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                Sample
              </Badge>
            )}
          </>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Trades</div>
          <div className="font-medium">{agent.trades}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Budget</div>
          <div className="font-medium text-xs">{agent.budget}</div>
        </div>
        <div className="col-span-2">
          <div className="text-xs text-muted-foreground">Chain</div>
          <div className="font-medium text-xs">{agent.chain}</div>
        </div>
      </div>
    </motion.div>
  );
}

export function AgentsPage() {
  const router = useRouter();
  const { data: agents, isLoading, error } = useAgents();
  // Selection mode reveals per-card checkboxes + a batch action bar so
  // operators can pause/resume/revoke several governed identities at once.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);

  const agentList = useMemo(() => agents || [], [agents]);

  const { showcase, user } = useMemo(() => {
    const showcase: typeof agentList = [];
    const user: typeof agentList = [];
    for (const agent of agentList) {
      if (agent.source === 'demo') showcase.push(agent);
      else user.push(agent);
    }
    return { showcase, user };
  }, [agentList]);

  const selectedAgents = agentList.filter((agent) => selectedIds.has(agent.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBatchError(null);
    setRevokeConfirmOpen(false);
  };

  // Batch status change: apply the target status to every selected identity.
  // Status is changed per agent (there is no multi-resource endpoint), so we
  // fan out and revalidate once at the end.
  const runBatchStatus = async (target: 'connected' | 'paused' | 'inactive') => {
    const actionable = selectedAgents.filter((a) => a.source !== 'demo' && a.status !== target);
    if (actionable.length === 0) return;
    setBatchBusy(true);
    setBatchError(null);

    try {
      const settled = await Promise.allSettled(
        actionable.map((agent) => apiClient.updateAgentStatus(agent.id, target)),
      );
      const failures = settled.filter(
        (result) =>
          result.status === 'rejected' || !result.value.success || Boolean(result.value.error),
      );
      const succeededIds = settled.flatMap((result, index) =>
        result.status === 'fulfilled' && result.value.success ? [actionable[index].id] : [],
      );

      if (failures.length > 0) {
        setSelectedIds((current) => {
          const next = new Set(current);
          succeededIds.forEach((id) => next.delete(id));
          return next;
        });
        setBatchError(`${failures.length} of ${actionable.length} updates failed. Please retry.`);
      } else {
        setSelectionMode(false);
        setSelectedIds(new Set());
      }

      try {
        await mutate('/api/agents');
      } catch {
        setBatchError((current) => current ?? 'Updates completed, but the list could not refresh.');
      }
    } catch (error) {
      setBatchError(
        error instanceof Error ? error.message : 'The batch update failed. Please retry.',
      );
    } finally {
      setBatchBusy(false);
    }
  };

  const hasActionableAgents = agentList.some((a) => a.source !== 'demo');
  const revokeCount = selectedAgents.filter((a) => a.source !== 'demo').length;
  const canRevoke = selectedAgents.some((a) => a.source !== 'demo' && a.status !== 'inactive');
  const canPause = selectedAgents.some((a) => a.source !== 'demo' && (a.status === 'active' || a.status === 'connected'));
  const canResume = selectedAgents.some(
    (a) => a.source !== 'demo' && a.status !== 'active' && a.status !== 'connected' && a.status !== 'inactive',
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identities"
        description="Connect the bots, scripts, and workflows that may act through Cognivern."
        action={
          <>
            {error && <Badge variant="destructive" className="text-xs">Error</Badge>}
            {!selectionMode && (
              <Button variant="ghost" size="sm" onClick={() => router.push('/copilot')}>
                <Bot className="h-4 w-4" /> Copilot
              </Button>
            )}
            {hasActionableAgents && !selectionMode && (
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                <SquareCheckBig className="h-4 w-4" /> Select
              </Button>
            )}
            {!selectionMode ? (
              <Button onClick={() => router.push('/agents/workshop')}>
                <PlusCircle className="h-4 w-4" /> Create API identity
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={exitSelection}>
                <X className="h-4 w-4" /> Exit select
              </Button>
            )}
          </>
        }
      />

      {batchError && !selectionMode && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {batchError}
        </div>
      )}

      {/* Batch action bar — visible while in selection mode. */}
      {selectionMode && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium">
            <SquareCheckBig className="h-4 w-4 text-primary" />
            {selectedAgents.length} selected
          </span>
          {batchError && (
            <span className="text-xs text-red-600 dark:text-red-400">{batchError}</span>
          )}
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={batchBusy || !canPause}
              onClick={() => void runBatchStatus('paused')}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              disabled={batchBusy || !canResume}
              onClick={() => void runBatchStatus('connected')}
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5 text-xs"
              disabled={batchBusy || !canRevoke}
              onClick={() => setRevokeConfirmOpen(true)}
            >
              {batchBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Revoke
            </Button>
          </div>
        </div>
      )}

      <Dialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke selected API identities?</DialogTitle>
            <DialogDescription>
              This will deactivate {revokeCount} selected{' '}
              {revokeCount === 1 ? 'identity' : 'identities'}. Their credentials will no longer be
              accepted for governed actions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={batchBusy}
              onClick={() => setRevokeConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={batchBusy || !canRevoke}
              onClick={() => {
                setRevokeConfirmOpen(false);
                void runBatchStatus('inactive');
              }}
            >
              {batchBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Revoke identities
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card p-5">
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <PageState
          variant="error"
          title="Could not load identities"
          message={error?.message || 'Your identities are unavailable right now.'}
          action={{ label: 'Retry', onClick: () => router.refresh() }}
        />
      ) : agentList.length === 0 ? (
        <PageState
          variant="empty"
          title="No API identities yet"
          message="Give your first external system governed access to Cognivern."
          action={{ label: 'Create API identity', onClick: () => router.push('/agents/workshop') }}
        />
      ) : (
        <div className="space-y-8">
          {showcase.length > 0 && (
            <DisclosureSection
              title="Example identities"
              description="Demo-only systems showing what Cognivern can govern."
            >
              <motion.div
                id="example-identities"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-b-xl overflow-hidden"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {showcase.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(agent.id)}
                    onToggle={toggleSelected}
                  />
                ))}
              </motion.div>
            </DisclosureSection>
          )}

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Your API Identities
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                External systems you&apos;ve given governed access to Cognivern.
              </p>
            </div>
            {user.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-8 text-center">
                <Key className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No API identities yet. Create one to get started.
                </p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {user.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selectionMode={selectionMode}
                    selected={selectedIds.has(agent.id)}
                    onToggle={toggleSelected}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
