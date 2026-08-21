'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageState } from '@/components/ui/error-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { DecisionReceipt } from '@/components/ui/decision-receipt';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  PlayCircle,
  Activity,
  Loader2,
  ExternalLink,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  LockKeyhole,
  SearchCheck,
} from 'lucide-react';
import { useRun } from '@/hooks/use-api';
import { apiClient } from '@/lib/api-client';
import { buildSignozTraceLink } from '@/lib/signoz';
import { trackUxEvent } from '@/lib/ux-events';
import {
  explorerTxUrl,
  defaultExecutionRail,
  getRailByChainId,
  getRailById,
  type ProofAnchorReceipt,
} from '@cognivern/shared';

type ApprovalResult = Awaited<ReturnType<typeof apiClient.submitRunApproval>>;
type ReconciliationResult = Awaited<ReturnType<typeof apiClient.getRunReconciliation>>;

interface UncertainExecution {
  transferExecutionId?: string;
  transferIdempotencyKey?: string;
  expectedSender?: string;
  expectedRecipient?: string;
  expectedValueWei?: string;
  chainId?: number;
  status?: string;
  recoveryRequired?: boolean;
}

function getUncertainExecution(run: unknown): UncertainExecution | undefined {
  const artifacts = (run as { artifactData?: unknown })?.artifactData;
  if (!Array.isArray(artifacts)) return undefined;
  const artifact = artifacts.find(
    (candidate) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      (candidate as { type?: string }).type === 'error' &&
      ((candidate as { data?: { status?: string } }).data?.status === 'execution_uncertain'),
  ) as { data?: UncertainExecution } | undefined;
  return artifact?.data;
}

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-950',
    label: 'Completed',
  },
  running: {
    icon: Activity,
    color: 'text-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-950',
    label: 'Running',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-100 dark:bg-red-950',
    label: 'Failed',
  },
  paused_for_approval: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-950',
    label: 'Awaiting Approval',
  },
};

const eventLabels: Record<string, string> = {
  policy_loaded: 'Policy Loaded',
  action_parsed: 'Action Parsed',
  policy_evaluated: 'Policy Evaluated',
  decision_made: 'Decision Made',
  audit_logged: 'Audit Logged',
};

interface SourceProvenance {
  sources: Array<{
    id: string;
    kind: string;
    locator?: string;
  }>;
  recipientIntroducedByUntrustedSource?: boolean;
}

function getSpendSourceContext(run: unknown): {
  provenance?: SourceProvenance;
  authorization?: { required?: boolean; authorized?: boolean; reason?: string };
} {
  const artifacts = (run as { artifactData?: unknown })?.artifactData;
  if (!Array.isArray(artifacts)) return {};
  const intentArtifact = artifacts.find(
    (artifact) =>
      typeof artifact === 'object' &&
      artifact !== null &&
      (artifact as { type?: string }).type === 'spend_intent',
  ) as { data?: { metadata?: Record<string, unknown> } } | undefined;
  const metadata = intentArtifact?.data?.metadata;
  return {
    provenance: metadata?.sourceProvenance as SourceProvenance | undefined,
    authorization: metadata?.sourceAuthorization as
      | { required?: boolean; authorized?: boolean; reason?: string }
      | undefined,
  };
}

/** Rails that can carry a GovernanceProofV2 anchor, in display order. */
const PROOF_ANCHOR_KEYS = ['zeroGProofV2', 'xlayerProofV2'] as const;

function getProofAnchors(run: unknown): ProofAnchorReceipt[] {
  const evidence = (run as { evidence?: Record<string, unknown> })?.evidence;
  if (!evidence) return [];
  return PROOF_ANCHOR_KEYS.map((key) => evidence[key]).filter(
    (anchor): anchor is ProofAnchorReceipt =>
      typeof anchor === 'object' && anchor !== null && typeof (anchor as ProofAnchorReceipt).txHash === 'string',
  );
}

function getTransferExplorerUrl(chainId: number | undefined, txHash: string): string | undefined {
  return (
    explorerTxUrl(chainId, txHash) ??
    explorerTxUrl(defaultExecutionRail().id, txHash)
  );
}

function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, duration, start]);

  return count;
}

export function RunDetail({ runId }: { runId: string }) {
  const router = useRouter();
  const { data: run, isLoading, error, mutate } = useRun(runId);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [submitting, setSubmitting] = useState<'approve' | 'deny' | null>(null);
  const [approval, setApproval] = useState<ApprovalResult | null>(null);
  const [reconciliation, setReconciliation] = useState<ReconciliationResult | null>(null);
  const [reconciling, setReconciling] = useState<'check' | 'resolve' | null>(null);

  const uncertainExecution = getUncertainExecution(run);

  async function handleReconciliation(resolve: boolean) {
    setReconciling(resolve ? 'resolve' : 'check');
    setReconciliation(null);
    try {
      const result = resolve
        ? await apiClient.resolveRunReconciliation(runId)
        : await apiClient.getRunReconciliation(runId);
      setReconciliation(result);
      await mutate();
    } catch (err) {
      setReconciliation({
        success: false,
        recoveryRequired: true,
        message: err instanceof Error ? err.message : 'Reconciliation request failed',
      });
    } finally {
      setReconciling(null);
    }
  }

  async function handleApproval(approve: boolean) {
    setSubmitting(approve ? 'approve' : 'deny');
    setApproval(null);
    try {
      const result = await apiClient.submitRunApproval(runId, { approve });
      setApproval(result);
      // Refresh the run on any state-changing outcome (approved success OR
      // failure that left it paused). On failure the run is still paused; the
      // refresh keeps status correct without flipping the UI to "Completed".
      await mutate();
    } catch (err) {
      setApproval({
        success: false,
        error: err instanceof Error ? err.message : 'Approval request failed',
      });
    } finally {
      setSubmitting(null);
    }
  }

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true);
      },
      { threshold: 0.3 },
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Animated counters (must be before early returns per React rules)
  const animatedSteps = useCountUp(run?.steps || 0, 2000, statsVisible);
  const animatedArtifacts = useCountUp(run?.artifacts || 0, 2000, statsVisible);

  useEffect(() => {
    trackUxEvent('route_viewed', 'run_detail');
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/capital?view=runs')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageState
          variant="error"
          title="Could not load run details"
          message="This execution is unavailable right now. Try again or return to Runs."
          action={{ label: 'Retry', onClick: () => router.refresh() }}
          secondaryAction={{ label: 'Back to Runs', onClick: () => router.push('/capital?view=runs') }}
        />
      </div>
    );
  }

  const status = statusConfig[run.status] || statusConfig.failed;
  const StatusIcon = status.icon;
  const events = run.events || [];
  const sourceContext = getSpendSourceContext(run);
  const traceId = run.evidence?.traceId;
  const proofAnchors = getProofAnchors(run);
  const transferExplorerUrl = approval?.transfer?.transferTxHash
    ? getTransferExplorerUrl(approval.transfer.transferChainId, approval.transfer.transferTxHash)
    : undefined;
  const reconciliationExecution = reconciliation?.execution as
    | { transactionHash?: string; transactionLink?: string; status?: string; sponsored?: boolean }
    | null
    | undefined;
  const canResolveReconciliation =
    reconciliation?.matched === true && reconciliation.recoveryRequired === false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/capital?view=runs')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{run.workflow}</h1>
            <StatusBadge status={run.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Run ID: {run.id}</p>
        </div>
      </div>

      {/* Summary */}
      <div
        ref={statsRef}
        className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden"
      >
        <div className="bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${status.bg} ${status.color}`}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-bold">{status.label}</div>
              <div className="text-xs text-muted-foreground">Status</div>
            </div>
          </div>
        </div>
        <div className="bg-card p-4">
          <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {statsVisible ? animatedSteps : '—'}
          </div>
          <div className="text-xs text-muted-foreground">Steps</div>
        </div>
        <div className="bg-card p-4">
          <div className="text-lg font-bold">{run.duration}</div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </div>
        <div className="bg-card p-4">
          <div className="text-lg font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            {statsVisible ? animatedArtifacts : '—'}
          </div>
          <div className="text-xs text-muted-foreground">Artifacts</div>
        </div>
      </div>

      <DecisionReceipt
        decision={run.status}
        subject={run.workflow}
        summary={
          run.status === 'paused_for_approval'
            ? 'An operator review is required before this action can continue.'
            : run.status === 'failed'
              ? 'The execution stopped before completion. Review the trace before retrying.'
              : 'This governance execution has a recorded operational outcome.'
        }
        reference={`Run ${run.id}`}
        evidence={[
          'Policy evaluation',
          ...(events.length > 0 ? ['Execution trace'] : []),
          ...(sourceContext.provenance ? ['Source authorization'] : []),
          ...(proofAnchors.length > 0 ? ['On-chain proof anchors'] : []),
        ]}
        reviewPath={`/runs/${run.id}`}
      />

      {proofAnchors.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            On-chain governance proofs
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            This decision&apos;s canonical commitments are anchored on{' '}
            {proofAnchors.length > 1 ? `${proofAnchors.length} public chains` : 'a public chain'},
            verifiable independently of Cognivern&apos;s audit store.
          </p>
          <div className="mt-3 space-y-3">
            {proofAnchors.map((anchor) => {
              const rail = getRailByChainId(anchor.chainId) ?? getRailById(anchor.network);
              const txUrl = rail ? explorerTxUrl(rail.id, anchor.txHash) : undefined;
              return (
                <div
                  key={anchor.proofId}
                  className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {rail?.displayName ?? anchor.network}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        Chain {anchor.chainId}
                      </Badge>
                      {anchor.blockNumber !== null && (
                        <span className="text-xs text-muted-foreground">
                          Block {anchor.blockNumber}
                        </span>
                      )}
                    </div>
                    <code className="mt-1 block truncate text-[11px] text-muted-foreground">
                      proof {anchor.proofId.slice(0, 12)}…{anchor.proofId.slice(-8)}
                    </code>
                  </div>
                  {txUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(txUrl, '_blank', 'noopener,noreferrer')}
                    >
                      View proof
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {traceId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="flex min-w-0 items-center gap-3">
            <Activity className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Execution trace available
              </p>
              <code className="block truncate text-[11px] text-muted-foreground">{traceId}</code>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => window.open(await buildSignozTraceLink(traceId), '_blank')}
          >
            View in SigNoz
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Execution Trace */}
      {events.length > 0 && (
        <details
          className="rounded-xl border bg-card p-5"
          onToggle={(event) => {
            if (event.currentTarget.open) trackUxEvent('disclosure_opened', 'run_activity_details');
          }}
        >
          <summary className="cursor-pointer font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Activity details
          </summary>
          <div className="space-y-0 mt-4">
            {events.map((event, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full border-2 ${
                      idx === events.length - 1 && run.status === 'completed'
                        ? 'bg-emerald-500 border-emerald-500'
                        : run.status === 'failed' && idx === events.length - 1
                          ? 'bg-red-500 border-red-500'
                          : 'bg-background border-muted-foreground/30'
                    }`}
                    aria-label={
                      idx === events.length - 1 && run.status === 'completed'
                        ? 'Completed'
                        : run.status === 'failed' && idx === events.length - 1
                          ? 'Failed'
                          : 'Pending'
                    }
                  />
                  {idx < events.length - 1 && <div className="w-0.5 flex-1 bg-border/60 my-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">
                      {eventLabels[event.type] || event.type}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {JSON.stringify(event.data, null, 1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* KeeperHub uncertainty / reconciliation */}
      {uncertainExecution && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-5 dark:border-amber-800 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-amber-900 dark:text-amber-100">
                    KeeperHub execution needs reconciliation
                  </h2>
                  <Badge variant="outline" className="border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                    Retry locked
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
                  Cognivern will not broadcast again until the original execution is verified. Check the provider status first, then resolve only when the receipt matches the original intent.
                </p>
              </div>

              <div className="grid gap-2 text-xs text-amber-950/80 dark:text-amber-100/80 sm:grid-cols-2">
                {uncertainExecution.transferExecutionId && (
                  <div><span className="font-medium">Execution ID:</span> <code className="break-all">{uncertainExecution.transferExecutionId}</code></div>
                )}
                {uncertainExecution.transferIdempotencyKey && (
                  <div><span className="font-medium">Idempotency key:</span> <code className="break-all">{uncertainExecution.transferIdempotencyKey}</code></div>
                )}
                {uncertainExecution.chainId && (
                  <div><span className="font-medium">Chain:</span> {uncertainExecution.chainId}</div>
                )}
                {uncertainExecution.expectedRecipient && (
                  <div><span className="font-medium">Recipient:</span> <code className="break-all">{uncertainExecution.expectedRecipient}</code></div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleReconciliation(false)}
                  disabled={reconciling !== null || !uncertainExecution.transferExecutionId}
                >
                  {reconciling === 'check' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="h-3.5 w-3.5" />}
                  {reconciling === 'check' ? 'Checking…' : 'Check KeeperHub status'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReconciliation(true)}
                  disabled={reconciling !== null || !canResolveReconciliation}
                >
                  {reconciling === 'resolve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {reconciling === 'resolve' ? 'Resolving…' : 'Resolve verified execution'}
                </Button>
              </div>

              {!uncertainExecution.transferExecutionId && (
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                  KeeperHub returned no execution ID. Preserve the idempotency key and contact KeeperHub support or use an approved provider lookup; Cognivern intentionally cannot retry this transfer.
                </p>
              )}

              {reconciliation && (
                <div className={`rounded-lg border p-3 text-sm ${reconciliation.success ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-300 bg-amber-100/60 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'}`}>
                  <div className="flex items-start gap-2">
                    {reconciliation.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium">
                        {reconciliation.resolved ? 'Execution resolved and run unlocked' : reconciliation.matched ? 'Receipt matches the requested transfer' : 'Still recovery-required'}
                      </p>
                      <p className="mt-1 text-xs opacity-80">
                        {reconciliation.message || (reconciliation.matched ? `KeeperHub status: ${reconciliationExecution?.status || 'verified'}${reconciliationExecution?.sponsored ? ' · sponsored' : ''}` : 'The provider response is pending, mismatched, or unavailable. Do not retry.')}
                      </p>
                      {reconciliationExecution?.transactionHash && (
                        <code className="mt-2 block break-all text-[11px]">{reconciliationExecution.transactionHash}</code>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {sourceContext.provenance && (
        <details className="rounded-xl border border-amber-500/30 bg-amber-50/50 p-5 dark:bg-amber-950/20">
          <summary className="flex cursor-pointer items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Source and authorization details
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            {sourceContext.provenance.sources.map((source) => (
              <div
                key={source.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/20 pt-2 first:border-0 first:pt-0"
              >
                <span className="font-mono text-xs break-all">{source.locator || source.id}</span>
                <Badge variant="outline">{source.kind}</Badge>
              </div>
            ))}
          </div>
          {sourceContext.authorization?.required && (
            <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
              {sourceContext.authorization.authorized
                ? 'The proposed spend matches an operator-issued source authorization.'
                : sourceContext.authorization.reason ||
                  'No matching source authorization was presented.'}
            </p>
          )}
        </details>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {run.status === 'failed' && (
          <Button onClick={() => router.push('/governance/check')}>
            <PlayCircle className="h-4 w-4" /> Retry in Governance Check
          </Button>
        )}
        {run.status === 'paused_for_approval' && (
          <>
            <Button onClick={() => handleApproval(true)} disabled={submitting !== null}>
              {submitting === 'approve' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {submitting === 'approve' ? 'Broadcasting…' : 'Approve'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleApproval(false)}
              disabled={submitting !== null}
            >
              {submitting === 'deny' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Deny
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => router.push('/governance/check')}>
          Run governance check
        </Button>
      </div>

      {/* Approval result panel. Shown after submit until dismissed via another
          submit. Surfaces transferTxHash on success, transferError on failure,
          and offers Retry on failure (which mints a fresh idempotency key). */}
      {approval && (
        <div
          className={`rounded-xl border p-4 ${
            approval.success
              ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20'
          }`}
        >
          {approval.success ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {approval.transfer?.transferStatus === 'sent'
                    ? 'Approved & broadcast'
                    : approval.transfer?.transferStatus === 'uncertain'
                      ? 'Execution needs reconciliation'
                      : 'Approval recorded'}
                </div>
                {approval.transfer?.transferStatus === 'uncertain' ? (
                  <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    The provider accepted the execution, but completion could not be verified safely.
                    Do not retry until the KeeperHub execution is reconciled.
                    {approval.transfer.transferExecutionId && (
                      <div className="mt-1 text-xs">
                        KeeperHub execution: <code>{approval.transfer.transferExecutionId}</code>
                      </div>
                    )}
                  </div>
                ) : approval.transfer?.transferTxHash ? (
                  <div className="text-sm text-muted-foreground mt-1 space-y-1">
                    <div>
                      Network transfer reference:{' '}
                      {transferExplorerUrl ? (
                        <a
                          href={approval.transfer.transferTransactionLink || transferExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono underline inline-flex items-center gap-1"
                        >
                          {approval.transfer.transferTxHash.slice(0, 10)}…
                          {approval.transfer.transferTxHash.slice(-8)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <code className="font-mono">
                          {approval.transfer.transferTxHash.slice(0, 10)}…
                          {approval.transfer.transferTxHash.slice(-8)}
                        </code>
                      )}
                    </div>
                    {approval.transfer.transferExecutionId && (
                      <div className="text-xs text-muted-foreground">
                        KeeperHub execution: <code>{approval.transfer.transferExecutionId}</code>
                      </div>
                    )}
                    {approval.transfer.transferReceiptStatus && (
                      <div className="text-xs text-muted-foreground">
                        KeeperHub receipt: <code>{approval.transfer.transferReceiptStatus}</code>
                        {approval.transfer.transferVerified === true
                          ? ' · verified'
                          : ' · not independently verified'}
                        {approval.transfer.transferSponsored === true ? ' · sponsored' : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">
                    No external transfer was made for this run.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {approval.transfer?.transferStatus === 'uncertain'
                    ? 'Transfer needs reconciliation — do not retry'
                    : approval.transfer?.transferStatus === 'failed'
                      ? 'Transfer failed — money did not move'
                      : 'Approval failed'}
                </div>
                <div className="text-sm text-muted-foreground mt-1 break-words">
                  {approval.transfer?.transferError || approval.error || 'Unknown error.'}
                </div>
                {/* Retry re-fires the approve POST with a fresh
                    Idempotency-Key (generated inside submitRunApproval), so
                    the cached failure does not block re-broadcast. */}
                {approval.transfer?.transferStatus !== 'uncertain' && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproval(true)}
                      disabled={submitting !== null}
                    >
                    {submitting === 'approve' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="h-3 w-3" />
                    )}
                      Retry approval
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
