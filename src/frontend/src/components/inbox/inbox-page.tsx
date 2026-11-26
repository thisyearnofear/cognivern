"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageState } from "@/components/ui/error-state";
import { Textarea } from "@/components/ui/textarea";
import { MandateReservoir } from "@/components/primitives/mandate-reservoir";
import { DecisionStamp } from "@/components/primitives/decision-stamp";
import { EmptyInboxPlate } from "@/components/illustrations/empty-inbox-plate";
import { playStamp } from "@/lib/tactile-sound";
import { apiClient, type FundedMandate, type SpendAttributionReport } from "@/lib/api-client";
import type { Run as SharedRun } from "@cognivern/shared";
import { useAuthStore } from "@/stores/auth-store";

type ApprovalResponse = Awaited<ReturnType<typeof apiClient.submitRunApproval>>;
type AttributionRecord = SpendAttributionReport["records"][number];

interface PendingItem {
  run: SharedRun;
  reason?: string;
}

function toBigInt(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function toNumber(value: bigint): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface EvidenceContext {
  records: AttributionRecord[];
  /** Program name → utilization + held-sibling count, for context. */
  programs: Array<{ name: string; utilization: number; heldSiblings: number }>;
}

function evidenceForRun(
  runId: string,
  records: AttributionRecord[],
  mandates: Map<string, FundedMandate>,
): EvidenceContext | null {
  const related = records.filter((r) => r.runId === runId);
  if (related.length === 0) return null;
  const mandateIds = [...new Set(related.map((r) => r.mandateId).filter(Boolean))] as string[];
  const programs = mandateIds
    .map((id) => mandates.get(id))
    .filter((m): m is FundedMandate => Boolean(m))
    .map((m) => ({
      name: m.name,
      utilization: mandateUtilization(m),
      heldSiblings: records.filter(
        (r) => r.mandateId === m.id && r.status === "held" && r.runId !== runId,
      ).length,
    }));
  return { records: related, programs };
}

/** Records whose amounts are still in flight — approving moves them. */
const IN_FLIGHT_STATUSES = new Set(["held", "allocated", "uncertain"]);

function recordAmount(record: AttributionRecord): bigint {
  const allocated = toBigInt(record.allocatedAmount);
  if (allocated > BigInt(0)) return allocated;
  return toBigInt(record.requestedAmount);
}

interface ReservoirPreview {
  key: string;
  label: string;
  capacity: number;
  consumed: number;
  pendingOther: number;
  proposedDelta: number;
}

/**
 * Derives before→after treasury previews from real mandate budgets and the
 * run's in-flight attribution records. The run's own held amounts are assumed
 * inside the mandate's pending total, so other-pending is clamped at zero.
 * Returns nothing for records whose mandate or asset budget is unknown —
 * callers render those as plain chips rather than inventing numbers.
 */
function reservoirPreviews(
  context: EvidenceContext,
  mandates: Map<string, FundedMandate>,
): ReservoirPreview[] {
  const byKey = new Map<string, { mandate: FundedMandate; asset: string; delta: bigint }>();
  for (const record of context.records) {
    if (!record.mandateId || !IN_FLIGHT_STATUSES.has(record.status)) continue;
    const mandate = mandates.get(record.mandateId);
    const budget = mandate?.budget.byAsset[record.asset];
    if (!mandate || !budget) continue;
    if (toBigInt(budget.authorizedAmount) === BigInt(0)) continue;
    const key = `${record.mandateId}:${record.asset}`;
    const entry = byKey.get(key) ?? { mandate, asset: record.asset, delta: BigInt(0) };
    entry.delta += recordAmount(record);
    byKey.set(key, entry);
  }
  return [...byKey.entries()].map(([key, { mandate, asset, delta }]) => {
    const budget = mandate.budget.byAsset[asset];
    const pending = toBigInt(budget.pendingAmount);
    const pendingOther = pending - delta > BigInt(0) ? pending - delta : BigInt(0);
    return {
      key,
      label: `${mandate.name} · ${asset}`,
      capacity: toNumber(toBigInt(budget.authorizedAmount)),
      consumed: toNumber(toBigInt(budget.consumedAmount)),
      pendingOther: toNumber(pendingOther),
      proposedDelta: toNumber(delta),
    };
  });
}

/**
 * Reversibility of clicking approve. On-chain when in-flight spend records
 * exist (approving broadcasts the held transfer) or when attribution never
 * loaded — the honest conservative default. Reversible only when the system
 * affirmatively shows no spend attached to the run.
 */
function reversibility(
  attributionLoaded: boolean,
  context: EvidenceContext | null,
): "onchain" | "reversible" {
  if (!attributionLoaded) return "onchain";
  if (!context) return "reversible";
  return context.records.some((r) => IN_FLIGHT_STATUSES.has(r.status)) ? "onchain" : "reversible";
}

/** One-line trigger chip — the reason the run is paused, in plain language. */
function triggerChip(run: SharedRun): string | null {
  if (run.approvalReason) return run.approvalReason;
  if (run.suspicionLabel) return `Flagged: ${run.suspicionLabel}`;
  if (run.suspicionScore != null && run.suspicionScore >= 0.7) return "High suspicion score";
  return null;
}

/** Compact labeled chips for records without mandate budget coverage. */
function RecordChips({ records }: { records: AttributionRecord[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {records.slice(0, 4).map((r) => (
        <Badge key={r.allocationId} variant="outline" className="font-mono text-[10px] font-normal">
          {r.provider ?? r.asset} · {(r.consumedAmount || r.allocatedAmount || r.requestedAmount).slice(0, 12)}{" "}
          {r.asset} · {r.status}
          {r.onBehalfOfAgentId && r.onBehalfOfAgentId !== r.agentId ? " · delegated" : ""}
        </Badge>
      ))}
      {records.length > 4 && (
        <Badge variant="outline" className="text-[10px] font-normal">
          +{records.length - 4} more
        </Badge>
      )}
    </div>
  );
}

/** Worst committed/authorized ratio across a mandate's assets (0..1+). */
function mandateUtilization(mandate: FundedMandate): number {
  let worst = 0;
  for (const budget of Object.values(mandate.budget.byAsset)) {
    const authorized = toBigInt(budget.authorizedAmount);
    if (authorized === BigInt(0)) continue;
    const committed = toBigInt(budget.consumedAmount) + toBigInt(budget.pendingAmount);
    const ratio = Number(committed) / Number(authorized);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

function isPendingApproval(run: SharedRun): boolean {
  return (
    run.status === "paused_for_approval" ||
    (run.requiresApproval === true && run.approvalState === "pending")
  );
}

/** Milliseconds the decision stamp stays visible before the row collapses. */
const STAMP_LINGER_MS = 1500;

/**
 * Escalation inbox — the human-approval queue as a first-class surface.
 *
 * Held spends pause CRE runs; this page aggregates everything waiting on
 * an operator decision with its suspicion context, and resolves it inline
 * through the canonical approval endpoint (which broadcasts held transfers
 * and records operator identity).
 */
export function InboxPage() {
  const router = useRouter();
  const workspaceId = useAuthStore((state) => state.workspace?.id);
  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [attribution, setAttribution] = useState<SpendAttributionReport | null>(null);
  const [mandates, setMandates] = useState<Map<string, FundedMandate>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, "approve" | "reject" | null>>({});
  const [results, setResults] = useState<Record<string, ApprovalResponse>>({});
  const [stamped, setStamped] = useState<Record<string, "approved" | "denied">>({});
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const timer of active.values()) clearTimeout(timer);
    };
  }, []);

  const load = useCallback(async () => {
    const [runsRes, attributionRes, mandatesRes] = await Promise.all([
      apiClient.getRuns(),
      apiClient.getSpendAttribution(),
      apiClient.getMandates(),
    ]);
    if (!runsRes.success || !runsRes.data) {
      throw new Error(runsRes.error || "Could not load runs");
    }
    if (attributionRes.success && attributionRes.data) setAttribution(attributionRes.data);
    if (mandatesRes.success && mandatesRes.data) {
      setMandates(new Map(mandatesRes.data.map((m) => [m.id, m])));
    }
    return (runsRes.data as SharedRun[])
      .filter(isPendingApproval)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((run) => ({ run, reason: run.approvalReason }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchPending() {
      setLoading(true);
      setError(null);
      try {
        const items = await load();
        if (!cancelled) setPending(items);
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Could not load escalations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPending();
    return () => {
      cancelled = true;
    };
  }, [load, workspaceId]);

  const resolve = useCallback(
    async (runId: string, approve: boolean) => {
      setBusy((prev) => ({ ...prev, [runId]: approve ? "approve" : "reject" }));
      try {
        const result = await apiClient.submitRunApproval(runId, {
          approve,
          reason: reasons[runId]?.trim() || undefined,
        });
        setResults((prev) => ({ ...prev, [runId]: result }));
        if (result.success) {
          // Stamp first, then let the row collapse out of the queue.
          setStamped((prev) => ({ ...prev, [runId]: approve ? "approved" : "denied" }));
          playStamp(approve ? "approved" : "stopped");
          const timer = setTimeout(() => {
            setPending((prev) => prev?.filter((item) => item.run.id !== runId) ?? null);
            timers.current.delete(runId);
          }, STAMP_LINGER_MS);
          timers.current.set(runId, timer);
        }
      } finally {
        setBusy((prev) => ({ ...prev, [runId]: null }));
      }
    },
    [reasons],
  );

  const sorted = useMemo(() => pending ?? [], [pending]);

  if (loading) {
    return (
      <PageState variant="empty" title="Loading escalations" message="Checking runs awaiting operator approval." />
    );
  }
  if (error) {
    return <PageState variant="error" title="Inbox unavailable" message={error} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Human-in-the-loop"
        title="Escalation inbox"
        description="Spends held by policy or suspicion scoring wait here for an operator decision. Approving broadcasts the held transfer; rejecting records the decision in the audit ledger."
      />

      {sorted.length === 0 ? (
        <PageState
          variant="empty"
          title="Inbox zero"
          message="Nothing is waiting for approval. Held spends will appear here with their suspicion context."
          illustration={<EmptyInboxPlate />}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {sorted.map(({ run }) => {
              const itemBusy = busy[run.id];
              const result = results[run.id];
              const stamp = stamped[run.id];
              const transferStatus = result?.transfer?.transferStatus;
              const evidence = attribution
                ? evidenceForRun(run.id, attribution.records, mandates)
                : null;
              const previews = evidence ? reservoirPreviews(evidence, mandates) : [];
              const coveredRecordKeys = new Set(
                evidence && previews.length > 0
                  ? evidence.records
                      .filter(
                        (r) =>
                          r.mandateId &&
                          IN_FLIGHT_STATUSES.has(r.status) &&
                          previews.some((p) => p.key === `${r.mandateId}:${r.asset}`),
                      )
                      .map((r) => r.allocationId)
                  : [],
              );
              const uncoveredRecords =
                evidence?.records.filter((r) => !coveredRecordKeys.has(r.allocationId)) ?? [];
              const direction = reversibility(attribution != null, evidence);
              const trigger = triggerChip(run);
              return (
                <motion.div
                  key={run.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
                  transition={{ duration: 0.25 }}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{run.workflow}</p>
                        {run.suspicionScore != null && (
                          <Badge
                            variant={run.suspicionScore >= 0.7 ? "destructive" : "secondary"}
                            className="font-mono text-[10px]"
                          >
                            suspicion {Math.round(run.suspicionScore * 100)}%
                            {run.suspicionLabel ? ` · ${run.suspicionLabel}` : ""}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            direction === "onchain"
                              ? "border-amber-500/60 text-[10px] text-amber-700 dark:text-amber-300"
                              : "border-emerald-500/60 text-[10px] text-emerald-700 dark:text-emerald-300"
                          }
                        >
                          {direction === "onchain" ? "Irreversible on-chain" : "Reversible"}
                        </Badge>
                      </div>
                      {trigger && (
                        <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-amber-600">
                          <Zap className="h-3 w-3 shrink-0" />
                          <span className="truncate">{trigger}</span>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(run.timestamp).toLocaleString()} · {run.steps} steps ·{" "}
                        {run.artifacts} artifacts
                        {run.estimatedCostUsd != null &&
                          ` · est. $${run.estimatedCostUsd.toFixed(2)}`}
                      </p>

                      {previews.length > 0 && (
                        <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                          {previews.map((preview) => (
                            <MandateReservoir
                              key={preview.key}
                              label={preview.label}
                              capacity={preview.capacity}
                              consumed={preview.consumed}
                              pendingOther={preview.pendingOther}
                              proposedDelta={preview.proposedDelta}
                              showLegend
                            />
                          ))}
                        </div>
                      )}
                      {uncoveredRecords.length > 0 && <RecordChips records={uncoveredRecords} />}
                      {evidence && evidence.programs.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {evidence.programs.map((p) => (
                            <p key={p.name} className="text-[11px] text-muted-foreground">
                              Program <span className="font-medium text-foreground">{p.name}</span> —{" "}
                              {Math.round(p.utilization * 100)}% treasury committed
                              {p.heldSiblings > 0 &&
                                ` · ${p.heldSiblings} other held record(s) in this program`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/runs/${run.id}`)}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open run
                    </Button>
                  </div>

                  {stamp ? (
                    <div className="mt-4 flex items-center justify-center py-2">
                      <DecisionStamp decision={stamp} />
                      {result?.transfer?.transferTxHash && (
                        <span className="ml-3 text-xs text-muted-foreground">
                          Transfer sent ({result.transfer.transferTxHash.slice(0, 10)}…)
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <Textarea
                        className="mt-3 min-h-[60px] text-sm"
                        placeholder="Decision note (optional) — recorded in the audit ledger"
                        value={reasons[run.id] ?? ""}
                        onChange={(e) =>
                          setReasons((prev) => ({ ...prev, [run.id]: e.target.value }))
                        }
                        disabled={itemBusy != null}
                      />

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          disabled={itemBusy != null}
                          onClick={() => resolve(run.id, true)}
                        >
                          {itemBusy === "approve" ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          )}
                          Approve &amp; execute
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={itemBusy != null}
                          onClick={() => resolve(run.id, false)}
                        >
                          {itemBusy === "reject" ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                          )}
                          Reject
                        </Button>
                        {result && !result.success && (
                          <span className="text-xs text-destructive">
                            {result.error ?? "Approval failed"}
                            {transferStatus === "uncertain" &&
                              " (transfer outcome uncertain — check run)"}
                          </span>
                        )}
                        {result?.success && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <ShieldAlert className="h-3 w-3" />
                            {result.transfer?.transferTxHash
                              ? `Transfer sent (${result.transfer.transferTxHash.slice(0, 10)}…)`
                              : "Decision recorded"}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Inbox className="h-3 w-3" />
        Approvals execute through the CRE run approval endpoint — held transfers
        are broadcast and the operator identity is recorded in the evidence ledger.
      </p>
    </div>
  );
}
