'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Fingerprint,
  ExternalLink,
  ChevronDown,
  Shield,
  Link as LinkIcon,
  Activity,
  AlertTriangle,
  KeyRound,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';
import NextLink from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DecisionReceipt } from '@/components/ui/decision-receipt';
import { decisionLabel } from '@/lib/decision-language';
import { PermitDialog } from './permit-dialog';
import { EventTimeline, type TimelineEvent } from '@/components/shared/event-timeline';
import { defaultExecutionRail, explorerTxUrl } from '@cognivern/shared';
import {
  confidentialExplorerHref,
  railViewFromEvidence,
} from '@/lib/confidential-rail';
import type { NormalizedAuditLog } from '@/lib/normalizers';
import {
  hasConfidentialFhe,
  hasChainGptAudit,
  hasLedgerSigning,
  getOnChainTxHash,
  getOnChainChainId,
  getPolicyId,
  getAnchoringData,
  getSuspicionData,
  getRunIdForAuditLog,
} from './audit-evidence';

/* ─── Helper: CheckItem ──────────────────────────────────────── */

function CheckItem({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {passed ? (
        <CheckCircle2
          className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0"
          aria-label="Passed"
        />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" aria-label="Failed" />
      )}
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

/* ─── Timeline Node ──────────────────────────────────────────── */

/**
 * One decision in the audit timeline. Collapsed rows stay scannable (agent,
 * action, decision, evidence count); expanding reveals the full evidence
 * chain: per-rule checks, on-chain record, confidential evaluation, anchoring,
 * suspicion analysis, and the decision replay timeline.
 */
export function TimelineNode({
  log,
  rawLog,
  index,
  highlighted = false,
}: {
  log: NormalizedAuditLog;
  rawLog: unknown;
  index: number;
  /** True when the URL deep-linked to this specific decision (?id=…). */
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [permitOpen, setPermitOpen] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const isFhe = hasConfidentialFhe(rawLog);
  const isChainGpt = hasChainGptAudit(rawLog);
  const isLedger = hasLedgerSigning(rawLog);
  const hasChecks = log.policyChecks.length > 0;
  const txHash = getOnChainTxHash(rawLog);
  const onChainChainId = getOnChainChainId(rawLog);
  const executionRail = defaultExecutionRail();
  const onChainExplorerHref =
    txHash
      ? explorerTxUrl(onChainChainId, txHash) ??
        explorerTxUrl(executionRail.id, txHash)
      : undefined;
  const policyId = getPolicyId(rawLog);
  const anchoring = getAnchoringData(rawLog);
  const suspicion = getSuspicionData(rawLog);
  const evidence = [
    'Policy evaluated',
    ...(txHash ? ['On-chain record'] : []),
    ...(isFhe ? ['Encrypted evaluation'] : []),
    ...(isLedger ? ['Hardware signed'] : []),
  ];
  // The CRE run behind this decision, when it is a real run-mapped log
  // (CRE-unified mode: audit log id = run id). Demo logs return null.
  const runId = getRunIdForAuditLog(rawLog);

  useEffect(() => {
    if (!expanded || timelineEvents.length > 0 || timelineLoading) return;
    const id = window.setTimeout(() => setTimelineLoading(true), 0);
    fetch(`/api/audit/logs/${log.id}/timeline`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.events) {
          setTimelineEvents(json.data.events);
        }
      })
      .catch(() => {})
      .finally(() => setTimelineLoading(false));
    return () => window.clearTimeout(id);
  }, [expanded, log.id, timelineEvents.length, timelineLoading]);

  const statusColor =
    log.decision === 'approved'
      ? 'bg-emerald-500'
      : log.decision === 'denied'
        ? 'bg-red-500'
        : 'bg-amber-500';

  const statusRingColor =
    log.decision === 'approved'
      ? 'ring-emerald-500/30'
      : log.decision === 'denied'
        ? 'ring-red-500/30'
        : 'ring-amber-500/30';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      className="relative pl-10 sm:pl-12 pb-4"
    >
      {/* Vertical line */}
      <div className="absolute left-[15px] sm:left-[19px] top-3 bottom-0 w-px bg-border" />

      {/* Status dot */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`absolute left-[9px] sm:left-[13px] top-[5px] w-[13px] h-[13px] rounded-full ring-4 ${statusRingColor} ring-background z-10 cursor-pointer ${statusColor}`}
        aria-label={`${decisionLabel(log.decision)} decision`}
        aria-expanded={expanded}
      />

      {/* Content */}
      <div
        className={`rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors cursor-pointer ${
          highlighted ? 'border-primary/40 ring-2 ring-primary/20' : ''
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Agent + action row — keep collapsed state scannable.
                  Detail badges (FHE, On-Chain, Suspicion, etc.) appear
                  in the expanded section below. */}
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-medium text-sm text-foreground">{log.agent}</span>
                <Badge variant="outline" className="text-xs">
                  {log.action}
                </Badge>
                {/* Compact evidence indicator so expanded detail is discoverable
                    without crowding the collapsed row. */}
                {(isFhe ||
                  isChainGpt ||
                  isLedger ||
                  txHash ||
                  (suspicion && suspicion.label !== 'normal')) && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
                    title="Has additional evidence — expand for details"
                  >
                    <ShieldCheck className="h-2.5 w-2.5" />+
                    {
                      [
                        isFhe,
                        isChainGpt,
                        isLedger,
                        !!txHash,
                        suspicion && suspicion.label !== 'normal',
                      ].filter(Boolean).length
                    }
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="text-xs text-muted-foreground mb-2">
                {log.description || log.action}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
                <span className="font-mono">{log.id.slice(0, 8)}</span>
                <span>{log.chain}</span>
                <span>{log.time}</span>
                {log.latency !== '—' && <span className="font-mono">{log.latency}</span>}
                {/* Fast path to the execution record without expanding.
                    stopPropagation keeps the node from toggling. */}
                {runId && (
                  <NextLink
                    href={`/runs/${encodeURIComponent(runId)}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                    aria-label={`Open run ${runId} for this decision`}
                  >
                    <PlayCircle className="h-3 w-3" />
                    run {runId.slice(0, 8)}…
                  </NextLink>
                )}
              </div>
            </div>

            {/* Decision badge + expand */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge
                variant={
                  log.decision === 'approved'
                    ? 'secondary'
                    : log.decision === 'denied'
                      ? 'destructive'
                      : 'outline'
                }
                className="text-xs capitalize"
              >
                {decisionLabel(log.decision)}
              </Badge>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-4 pt-3 border-t border-border space-y-3">
              {/* Decision metadata */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  Decision ID: <code className="font-mono text-foreground/70">{log.id}</code>
                </span>
                <span>
                  Timestamp: <span className="text-foreground/70">{log.timestamp}</span>
                </span>
              </div>

              {/* Evidence badges — full detail now lives here instead of the
                  collapsed row, keeping the timeline scannable. */}
              {(isFhe ||
                isChainGpt ||
                isLedger ||
                txHash ||
                (suspicion && suspicion.label !== 'normal')) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {isFhe && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      FHE
                    </span>
                  )}
                  {isChainGpt && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Audit
                    </span>
                  )}
                  {isLedger && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                      <Fingerprint className="h-2.5 w-2.5" />
                      Hardware
                    </span>
                  )}
                  {txHash && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700">
                      <ExternalLink className="h-2.5 w-2.5" />
                      On-Chain
                    </span>
                  )}
                  {suspicion && suspicion.label !== 'normal' && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        suspicion.label === 'critical'
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
                          : suspicion.label === 'high'
                            ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700'
                            : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700'
                      }`}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {suspicion.label === 'critical'
                        ? 'Critical'
                        : suspicion.label === 'high'
                          ? 'Suspicious'
                          : 'Score'}
                      : {suspicion.composite.toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              <DecisionReceipt
                decision={log.decision}
                subject={`${log.agent} · ${log.action}`}
                summary={log.description || 'Governance decision recorded for review.'}
                reference={`Decision ${log.id}`}
                evidence={evidence}
                timestamp={log.timestamp}
              />

              {/* Execution run deep link — only for run-backed decisions.
                  stopPropagation keeps the node from collapsing when the
                  operator navigates to the run record. */}
              {runId && (
                <div className="rounded-lg border border-primary/20 bg-primary/[.04] p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-primary">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Execution run
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This decision was produced by a governed execution run. Open
                    the run record for the step timeline, artifacts,
                    reconciliation, and settlement evidence.
                  </p>
                  <NextLink
                    href={`/runs/${encodeURIComponent(runId)}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    View run {runId.slice(0, 8)}…
                    <ArrowRight className="h-3 w-3" />
                  </NextLink>
                </div>
              )}

              {/* On-chain tx link */}
              {txHash && (
                <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-sky-700 dark:text-sky-300">
                    <ExternalLink className="h-3.5 w-3.5" />
                    On-Chain Governance Record
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    This decision was recorded on {executionRail.displayName} via{' '}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono">
                      GovernanceContract.evaluateAction()
                    </code>
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-[11px] font-mono text-foreground/70 truncate">
                      {txHash.slice(0, 18)}...{txHash.slice(-6)}
                    </code>
                    <a
                      href={onChainExplorerHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:underline shrink-0"
                    >
                      View on {executionRail.displayName}{' '}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* SigNoz distributed trace card — visual peer of the on-chain record */}
              {(() => {
                const raw = rawLog as Record<string, unknown>;
                const ev = raw.evidence as Record<string, unknown> | undefined;
                const traceId = ev?.traceId as string | undefined;
                if (!traceId) return null;
                return (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Activity className="h-3.5 w-3.5" />
                      Distributed Trace
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Full execution trace of this governance decision in SigNoz: LLM calls, policy
                      evaluation, and audit logging as nested spans.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono text-foreground/70 truncate">
                        {traceId.slice(0, 18)}...{traceId.slice(-6)}
                      </code>
                      <a
                        href={`https://us.signoz.cloud/trace/${traceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
                        onClick={async (e) => {
                          // Prevent default immediately to avoid double-open,
                          // then resolve the real URL. If resolution fails,
                          // open the fallback URL from the href attribute.
                          e.preventDefault();
                          try {
                            const { buildSignozTraceLink } = await import('@/lib/signoz');
                            window.open(await buildSignozTraceLink(traceId), '_blank');
                          } catch {
                            window.open(`https://us.signoz.cloud/trace/${traceId}`, '_blank');
                          }
                        }}
                      >
                        View trace in SigNoz <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Confidential evaluation detail */}
              {isFhe && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5">
                  {(() => {
                    const raw = rawLog as Record<string, unknown>;
                    const conf = raw.confidential as Record<string, unknown> | undefined;
                    const view = railViewFromEvidence(conf);
                    const ids = conf?.decisionIds as string[] | undefined;
                    const href = confidentialExplorerHref(view, ids?.[0]);
                    return (
                      <>
                        <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {view.evalTitle}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {view.evalBody}
                        </p>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            {view.rail === 'flare' ? 'View on Coston2 →' : 'View on explorer →'}
                          </a>
                        )}
                        {policyId && view.rail === 'fhenix' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPermitOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors border border-amber-200 dark:border-amber-700"
                          >
                            <KeyRound className="h-3 w-3" />
                            Request Auditor Permit
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ChainGPT detail */}
              {isChainGpt && (
                <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-purple-700 dark:text-purple-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Contract Audited by ChainGPT
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The target contract was scanned at runtime. Vulnerabilities would have triggered
                    a deny or hold decision.
                  </p>
                </div>
              )}

              {/* Per-rule breakdown */}
              {hasChecks && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Policy Checks
                  </div>
                  <div className="space-y-1">
                    {log.policyChecks.map((check) => (
                      <CheckItem
                        key={check.policyId}
                        label={check.policyId}
                        passed={check.result}
                        detail={check.reason}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Cross-Chain Anchoring */}
              {anchoring && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Cross-Chain Anchoring
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    {anchoring.confidentialStatus && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <ShieldCheck
                          className={`h-3 w-3 flex-shrink-0 ${anchoring.confidentialStatus === 'resolved' ? 'text-emerald-500' : 'text-amber-500'}`}
                        />
                        <span className="text-muted-foreground">{anchoring.confidentialLabel}:</span>
                        <Badge
                          variant={anchoring.confidentialStatus === 'resolved' ? 'secondary' : 'outline'}
                          className="text-[10px] capitalize"
                        >
                          {anchoring.confidentialStatus}
                        </Badge>
                      </div>
                    )}
                    {anchoring.filecoinCid && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <LinkIcon className="h-3 w-3 text-blue-500 flex-shrink-0" />
                        <span className="text-muted-foreground">Filecoin:</span>
                        <code className="font-mono text-foreground/70 truncate">
                          {anchoring.filecoinCid.slice(0, 20)}...
                        </code>
                        {anchoring.filecoinTxHash && (
                          <a
                            href={`https://calibration.filfox.info/en/tx/${anchoring.filecoinTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                    {anchoring.zeroGRootHash && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Shield className="h-3 w-3 text-teal-500 flex-shrink-0" />
                        <span className="text-muted-foreground">0G Storage:</span>
                        <code className="font-mono text-foreground/70 truncate">
                          {anchoring.zeroGRootHash.slice(0, 20)}...
                        </code>
                      </div>
                    )}
                    {anchoring.evidenceHash && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <Fingerprint className="h-3 w-3 text-slate-400 flex-shrink-0" />
                        <span className="text-muted-foreground">Evidence Hash:</span>
                        <code className="font-mono text-foreground/70 truncate">
                          {anchoring.evidenceHash.slice(0, 16)}...{anchoring.evidenceHash.slice(-6)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Suspicion Analysis */}
              {suspicion && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Suspicion Analysis
                  </div>
                  <div
                    className={`rounded-lg border p-3 space-y-2 ${
                      suspicion.escalated
                        ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                        : 'border-border bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-xs">
                        <AlertTriangle
                          className={`h-3.5 w-3.5 flex-shrink-0 ${
                            suspicion.label === 'critical'
                              ? 'text-red-500'
                              : suspicion.label === 'high'
                                ? 'text-orange-500'
                                : suspicion.label === 'elevated'
                                  ? 'text-amber-500'
                                  : 'text-muted-foreground'
                          }`}
                        />
                        <span className="font-medium capitalize">{suspicion.label}</span>
                        <span className="text-muted-foreground">
                          ({suspicion.composite.toFixed(3)})
                        </span>
                      </div>
                      {suspicion.escalated && (
                        <Badge variant="destructive" className="text-[10px]">
                          Escalated
                        </Badge>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          suspicion.label === 'critical'
                            ? 'bg-red-500'
                            : suspicion.label === 'high'
                              ? 'bg-orange-500'
                              : suspicion.label === 'elevated'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, suspicion.composite * 100)}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      {Object.entries(suspicion.dimensions).map(([dim, val]) => (
                        <div key={dim} className="flex items-center justify-between">
                          <span className="text-muted-foreground capitalize">
                            {dim.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="font-mono">
                            {typeof val === 'number' ? val.toFixed(2) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {suspicion.reasoning.length > 0 && (
                      <ul className="space-y-0.5">
                        {suspicion.reasoning.map((r, i) => (
                          <li
                            key={i}
                            className="text-[11px] text-muted-foreground flex items-start gap-1.5"
                          >
                            <span className="text-amber-500 mt-0.5">•</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Decision Replay Timeline */}
              {timelineEvents.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                    Decision Replay
                  </div>
                  <EventTimeline events={timelineEvents} title="Decision steps" compact />
                </div>
              )}

              {!hasChecks &&
                !isFhe &&
                !isChainGpt &&
                !txHash &&
                !anchoring &&
                !suspicion &&
                timelineEvents.length === 0 && (
                  <div className="text-xs text-muted-foreground py-1">
                    No additional decision details available.
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {policyId && (
        <PermitDialog
          open={permitOpen}
          onOpenChange={setPermitOpen}
          decisionId={log.id}
          policyId={policyId}
        />
      )}
    </motion.div>
  );
}
