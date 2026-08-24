'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageState } from '@/components/ui/error-state';
import { AttentionSummary } from '@/components/ui/attention-summary';
import { PageHeader } from '@/components/ui/page-header';
import { trackUxEvent } from '@/lib/ux-events';
import {
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  SquareCheckBig,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api-client';
import { mutate } from 'swr';
import {
  normalizeAuditLogs,
  computeComplianceRate,
  computeAverageLatency,
  type NormalizedAuditLog,
} from '@/lib/normalizers';
import { useAuditLogs } from '@/hooks/use-api';
import { getOnChainTxHash } from './audit-evidence';
import { TimelineNode } from './timeline-node';
import { EmptyAuditState } from './empty-audit-state';
import { AuditMetrics } from './audit-metrics';
import { ProofDetails } from './proof-details';

/**
 * Audit page — investigate decisions and proof. The timeline is the focus;
 * metrics sit above it and the proof/security detail is a collapsed
 * disclosure below. Filter state syncs to the URL so investigation views are
 * shareable.
 */
export function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { data: rawLogs, isLoading, error } = useAuditLogs();

  // Keyboard shortcut: press "/" to focus the audit search input.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      if (event.key === '/' && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter state synced to URL search params so investigation views are
  // shareable. Reads initial values from the URL, writes back on change.
  type AuditFilter = 'all' | 'needs_attention' | NormalizedAuditLog['decision'];
  type GroupBy = 'none' | 'decision' | 'agent' | 'chain';
  const rawFilter = searchParams.get('status') ?? 'all';
  const rawGroup = searchParams.get('group') ?? 'none';
  const [decisionFilter, setDecisionFilter] = useState<AuditFilter>(
    (['all', 'needs_attention', 'approved', 'held', 'denied'] as string[]).includes(rawFilter)
      ? (rawFilter as AuditFilter)
      : 'all',
  );
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [groupBy, setGroupBy] = useState<GroupBy>(
    (['none', 'decision', 'agent', 'chain'] as string[]).includes(rawGroup)
      ? (rawGroup as GroupBy)
      : 'none',
  );

  const updateUrl = useCallback(
    (updates: { status?: string; q?: string; group?: string }) => {
      const params = new URLSearchParams(window.location.search);
      if (updates.status !== undefined) {
        if (updates.status === 'all') params.delete('status');
        else params.set('status', updates.status);
      }
      if (updates.q !== undefined) {
        if (updates.q === '') params.delete('q');
        else params.set('q', updates.q);
      }
      if (updates.group !== undefined) {
        if (updates.group === 'none') params.delete('group');
        else params.set('group', updates.group);
      }
      const qs = params.toString();
      router.replace(qs ? `/audit?${qs}` : '/audit', { scroll: false });
    },
    [router],
  );

  const handleFilterChange = useCallback(
    (filter: AuditFilter) => {
      setDecisionFilter(filter);
      updateUrl({ status: filter });
    },
    [updateUrl],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      updateUrl({ q: value });
    },
    [updateUrl],
  );

  const handleGroupChange = useCallback(
    (value: GroupBy) => {
      setGroupBy(value);
      updateUrl({ group: value });
    },
    [updateUrl],
  );

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reviewBriefCopied, setReviewBriefCopied] = useState(false);
  // Batch operator action: approve or reject all selected *held* decisions
  // through the canonical CRE run approval endpoint (releases real funds on
  // approve, so we gate it behind an explicit confirmation dialog).
  const [batchAction, setBatchAction] = useState<'approve' | 'reject' | null>(null);
  const [batchReason, setBatchReason] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    trackUxEvent('route_viewed', 'audit');
  }, []);

  const logs = normalizeAuditLogs(rawLogs);
  const total = logs.length;
  const compliance = computeComplianceRate(logs);
  const avgLatency = computeAverageLatency(logs);
  const critical = logs.filter((l) => l.decision === 'denied').length;
  const heldCount = logs.filter((l) => l.decision === 'held').length;
  const deniedCount = critical;
  const onChainCount = Array.isArray(rawLogs)
    ? rawLogs.filter((r) => getOnChainTxHash(r) !== null).length
    : 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    const matchesDecision =
      decisionFilter === 'all' ||
      (decisionFilter === 'needs_attention'
        ? log.decision === 'held' || log.decision === 'denied'
        : log.decision === decisionFilter);
    const matchesSearch =
      !normalizedQuery ||
      [log.agent, log.action, log.description, log.chain].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    return matchesDecision && matchesSearch;
  });
  const groupedLogs = (() => {
    if (groupBy === 'none') return [['All decisions', filteredLogs] as const];
    const groups = new Map<string, NormalizedAuditLog[]>();
    for (const log of filteredLogs) {
      const key =
        groupBy === 'decision' ? log.decision : groupBy === 'agent' ? log.agent : log.chain;
      groups.set(key, [...(groups.get(key) || []), log]);
    }
    return Array.from(groups.entries());
  })();
  const selectedLogs = filteredLogs.filter((log) => selectedIds.has(log.id));
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = filteredLogs.length > 0 && filteredLogs.every((log) => next.has(log.id));
      filteredLogs.forEach((log) => (allSelected ? next.delete(log.id) : next.add(log.id)));
      return next;
    });
  };
  const exportSelected = () => {
    if (selectedLogs.length === 0) return;
    const headers = ['id', 'api_identity', 'action', 'decision', 'chain', 'timestamp', 'latency'];
    const csvValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = selectedLogs.map((log) =>
      [log.id, log.agent, log.action, log.decision, log.chain, log.timestamp, log.latency]
        .map(csvValue)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cognivern-audit-selection.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyReviewBrief = async () => {
    if (selectedLogs.length === 0) return;
    const outcomes = selectedLogs.reduce<Record<string, number>>(
      (counts, log) => ({ ...counts, [log.decision]: (counts[log.decision] || 0) + 1 }),
      {},
    );
    const summary = Object.entries(outcomes)
      .map(([outcome, count]) => `${count} ${outcome}`)
      .join(', ');
    await navigator.clipboard.writeText(
      `Cognivern audit review\n${selectedLogs.length} selected decision${selectedLogs.length === 1 ? '' : 's'}: ${summary}.\nOpen the protected audit trail: ${window.location.origin}/audit`,
    );
    setReviewBriefCopied(true);
    trackUxEvent('proof_shared', 'audit_review_brief', String(selectedLogs.length));
    window.setTimeout(() => setReviewBriefCopied(false), 1800);
  };

  // Only *held* decisions are operator-actionable in a batch. Approved and
  // denied decisions represent a final outcome and must not be re-decided
  // here — that would be a fabricated override of a recorded decision.
  const selectedHeldLogs = selectedLogs.filter((log) => log.decision === 'held');
  const selectedNonActionable = selectedLogs.length - selectedHeldLogs.length;

  const handleBatchAction = async () => {
    if (!batchAction || selectedHeldLogs.length === 0) return;
    setBatchBusy(true);
    setBatchError(null);
    const approve = batchAction === 'approve';
    const reason = batchReason.trim();

    try {
      const settled = await Promise.allSettled(
        selectedHeldLogs.map((log) => apiClient.submitRunApproval(log.id, { approve, reason })),
      );
      const failures = settled.filter(
        (result) => result.status === 'rejected' || !result.value.success,
      );
      const succeededIds = settled.flatMap((result, index) =>
        result.status === 'fulfilled' && result.value.success ? [selectedHeldLogs[index].id] : [],
      );

      if (failures.length > 0) {
        setSelectedIds((current) => {
          const next = new Set(current);
          succeededIds.forEach((id) => next.delete(id));
          return next;
        });
        const firstError =
          failures[0]?.status === 'rejected'
            ? failures[0].reason instanceof Error
              ? failures[0].reason.message
              : 'One or more approvals failed.'
            : failures[0]?.value.error || 'One or more approvals failed.';
        setBatchError(
          failures.length === 1
            ? firstError
            : `${failures.length} of ${settled.length} failed. ${firstError}`,
        );
      } else {
        setBatchAction(null);
        setBatchReason('');
        setSelectedIds(new Set());
        trackUxEvent('batch_action_completed', 'audit', approve ? 'approve' : 'reject');
      }

      // Refresh the audit trail after both complete and partial batches so
      // successful decisions leave the held queue immediately.
      try {
        await mutate('/api/audit/logs');
      } catch {
        setBatchError(
          (current) => current ?? 'Updates completed, but the audit list could not refresh.',
        );
      }
    } catch (error) {
      setBatchError(
        error instanceof Error ? error.message : 'The batch action failed. Please retry.',
      );
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Audit logs"
        description="Review governance decisions, investigate exceptions, and export selected evidence."
      />

      {!isLoading && !error && (
        <AttentionSummary
          tone={heldCount + deniedCount > 0 ? 'attention' : 'healthy'}
          title={heldCount + deniedCount > 0 ? 'Decisions need attention' : 'Audit trail is clear'}
          description={
            heldCount + deniedCount > 0
              ? 'Start with held decisions that need action, then investigate stopped outcomes; approved history remains available below.'
              : 'No held decisions are waiting for action, and there are no stopped outcomes to investigate.'
          }
          items={
            heldCount + deniedCount > 0
              ? [
                  ...(heldCount > 0 ? [{ label: 'held', count: heldCount }] : []),
                  ...(deniedCount > 0 ? [{ label: 'stopped', count: deniedCount }] : []),
                ]
              : []
          }
          action={
            heldCount + deniedCount > 0
              ? {
                  label: 'Show needs attention',
                  onClick: () => {
                    setSearchQuery('');
                    setDecisionFilter('needs_attention');
                    updateUrl({ q: '', status: 'needs_attention' });
                  },
                }
              : undefined
          }
        />
      )}

      {batchError && selectedHeldLogs.length === 0 && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
        >
          {batchError}
        </div>
      )}

      {/* Metrics */}
      {error ? null : (
        <AuditMetrics
          loading={isLoading}
          total={total}
          compliance={compliance}
          avgLatency={avgLatency}
          critical={critical}
        />
      )}

      {/* Decision Timeline */}
      {error ? (
        <PageState
          variant="error"
          title="Could not load audit history"
          message="Governance decisions are unavailable right now."
          action={{ label: 'Retry', onClick: () => router.refresh() }}
        />
      ) : logs.length === 0 && !isLoading ? (
        <EmptyAuditState onRunCheck={() => router.push('/governance/check')} />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search identity, action, or chain ( / )"
              aria-label="Search audit decisions"
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Filter audit decisions">
              {(['all', 'needs_attention', 'approved', 'held', 'denied'] as const).map((filter) => (
                <Button
                  key={filter}
                  type="button"
                  size="sm"
                  variant={decisionFilter === filter ? 'secondary' : 'ghost'}
                  onClick={() => handleFilterChange(filter)}
                  className="h-8 capitalize"
                >
                  {filter === 'needs_attention' ? 'Needs attention' : filter}
                </Button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground sm:ml-auto">
              Group by
              <select
                value={groupBy}
                onChange={(event) => handleGroupChange(event.target.value as typeof groupBy)}
                className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
              >
                <option value="none">None</option>
                <option value="decision">Decision</option>
                <option value="agent">API identity</option>
                <option value="chain">Chain</option>
              </select>
            </label>
            <span className="text-xs text-muted-foreground">
              {filteredLogs.length} of {total} decisions
            </span>
            <div className="flex items-center gap-1.5 border-l pl-3">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs"
                onClick={toggleAllVisible}
              >
                {filteredLogs.length > 0 && filteredLogs.every((log) => selectedIds.has(log.id))
                  ? 'Clear selection'
                  : 'Select visible'}
              </Button>
              {selectedLogs.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  onClick={exportSelected}
                >
                  <Download className="h-3.5 w-3.5" /> Export {selectedLogs.length}
                </Button>
              )}
              {selectedLogs.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => void copyReviewBrief()}
                >
                  {reviewBriefCopied ? 'Brief copied' : 'Copy review brief'}
                </Button>
              )}
            </div>
          </div>

          {/* Batch operator action bar — appears once held decisions are
              selected. Approving releases real funds via the CRE run approval
              endpoint, so both actions are gated behind a confirmation. */}
          {selectedHeldLogs.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <SquareCheckBig className="h-4 w-4 text-primary" />
                {selectedHeldLogs.length} held decision{selectedHeldLogs.length === 1 ? '' : 's'}{' '}
                selected
              </span>
              {selectedNonActionable > 0 && (
                <span className="text-xs text-muted-foreground">
                  {selectedNonActionable} selected decision{selectedNonActionable === 1 ? '' : 's'}{' '}
                  already final
                </span>
              )}
              <div className="flex items-center gap-2 sm:ml-auto">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setBatchReason('');
                    setBatchError(null);
                    setBatchAction('approve');
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => {
                    setBatchReason('');
                    setBatchError(null);
                    setBatchAction('reject');
                  }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </div>
          )}

          {filteredLogs.length === 0 ? (
            <PageState
              variant="no-results"
              title="No matching decisions"
              message="Clear the saved view or search to see more of the audit trail."
              action={{
                label: 'Clear filters',
                onClick: () => {
                  handleFilterChange('all');
                  handleSearchChange('');
                },
              }}
            />
          ) : (
            <div className="space-y-5 pt-2">
              {groupedLogs.map(([group, groupLogs]) => (
                <div key={group} className="space-y-1">
                  {groupBy !== 'none' && (
                    <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group} <span className="font-normal">({groupLogs.length})</span>
                    </h3>
                  )}
                  {groupLogs.map((log, index) => {
                    const rawLogIndex = logs.findIndex((item) => item.id === log.id);
                    return (
                      <div key={log.id} className="relative">
                        <label
                          className="absolute left-0 top-4 z-20 flex h-5 w-5 items-center justify-center rounded border bg-background"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(log.id)}
                            onChange={() => toggleSelected(log.id)}
                            aria-label={`Select ${log.agent} ${log.action} decision`}
                            className="h-3.5 w-3.5 accent-primary"
                          />
                        </label>
                        <TimelineNode
                          log={log}
                          rawLog={Array.isArray(rawLogs) ? rawLogs[rawLogIndex] : log}
                          index={index}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <ProofDetails onChainCount={onChainCount} total={total} />

      {/* Batch approval confirmation — approve releases real funds, so both
          approve and reject are explicit, reviewable operator actions. */}
      <Dialog
        open={batchAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBatchAction(null);
            setBatchError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {batchAction === 'approve' ? 'Approve' : 'Reject'} {selectedHeldLogs.length} held
              decision{selectedHeldLogs.length === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              {batchAction === 'approve'
                ? "Approving broadcasts the held transfers and records your operator identity on each decision's audit trail."
                : 'Rejecting marks each decision as denied. The held transfers will not execute.'}
            </DialogDescription>
          </DialogHeader>

          <label className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Reason (optional)</span>
            <Textarea
              value={batchReason}
              onChange={(event) => setBatchReason(event.target.value)}
              placeholder="Why are you approving or rejecting this batch?"
              rows={3}
              maxLength={500}
            />
          </label>

          {batchError && (
            <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              {batchError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={batchBusy}
              onClick={() => setBatchAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={batchAction === 'reject' ? 'destructive' : 'default'}
              size="sm"
              disabled={batchBusy}
              onClick={() => void handleBatchAction()}
            >
              {batchBusy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                </>
              ) : batchAction === 'approve' ? (
                'Approve'
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
