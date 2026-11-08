"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageState } from "@/components/ui/error-state";
import { Textarea } from "@/components/ui/textarea";
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

function EvidencePacket({ context }: { context: EvidenceContext }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed bg-muted/30 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Evidence packet
      </p>
      <div className="mt-1.5 space-y-1">
        {context.records.slice(0, 4).map((r) => (
          <p key={r.allocationId} className="font-mono text-[11px] text-muted-foreground">
            {r.agentId} · {r.provider ?? r.asset} · {r.consumedAmount || r.allocatedAmount}{" "}
            {r.asset} · {r.status}
            {r.onBehalfOfAgentId && r.onBehalfOfAgentId !== r.agentId
              ? ` · on behalf of ${r.onBehalfOfAgentId}`
              : ""}
          </p>
        ))}
        {context.records.length > 4 && (
          <p className="text-[11px] text-muted-foreground">
            +{context.records.length - 4} more record(s)
          </p>
        )}
      </div>
      {context.programs.map((p) => (
        <p key={p.name} className="mt-1.5 text-[11px] text-muted-foreground">
          Program <span className="font-medium text-foreground">{p.name}</span> —{" "}
          {Math.round(p.utilization * 100)}% treasury committed
          {p.heldSiblings > 0 && ` · ${p.heldSiblings} other held record(s) in this program`}
        </p>
      ))}
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
          // Optimistically drop resolved items; reload confirms server state.
          setPending((prev) => prev?.filter((item) => item.run.id !== runId) ?? null);
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
        />
      ) : (
        <div className="space-y-3">
          {sorted.map(({ run }) => {
            const itemBusy = busy[run.id];
            const result = results[run.id];
            const transferStatus = result?.transfer?.transferStatus;
            const evidence = attribution
              ? evidenceForRun(run.id, attribution.records, mandates)
              : null;
            return (
              <div key={run.id} className="rounded-xl border bg-card p-4">
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
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(run.timestamp).toLocaleString()} · {run.steps} steps ·{" "}
                      {run.artifacts} artifacts
                      {run.estimatedCostUsd != null &&
                        ` · est. $${run.estimatedCostUsd.toFixed(2)}`}
                    </p>
                    {run.approvalReason && (
                      <p className="mt-1.5 text-xs text-amber-600">{run.approvalReason}</p>
                    )}
                    {evidence && <EvidencePacket context={evidence} />}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/runs/${run.id}`)}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open run
                  </Button>
                </div>

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
                      {transferStatus === "uncertain" && " (transfer outcome uncertain — check run)"}
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
              </div>
            );
          })}
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
