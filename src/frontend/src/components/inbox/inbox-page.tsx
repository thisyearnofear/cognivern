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
import { apiClient } from "@/lib/api-client";
import type { Run as SharedRun } from "@cognivern/shared";
import { useAuthStore } from "@/stores/auth-store";

type ApprovalResponse = Awaited<ReturnType<typeof apiClient.submitRunApproval>>;

interface PendingItem {
  run: SharedRun;
  reason?: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, "approve" | "reject" | null>>({});
  const [results, setResults] = useState<Record<string, ApprovalResponse>>({});

  const load = useCallback(async () => {
    const res = await apiClient.getRuns();
    if (!res.success || !res.data) {
      throw new Error(res.error || "Could not load runs");
    }
    return (res.data as SharedRun[])
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
