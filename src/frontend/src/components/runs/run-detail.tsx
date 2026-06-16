"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { useRun } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";

type ApprovalResult = Awaited<
  ReturnType<typeof apiClient.submitRunApproval>
>;

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-100 dark:bg-emerald-950",
    label: "Completed",
  },
  running: {
    icon: Activity,
    color: "text-blue-500",
    bg: "bg-blue-100 dark:bg-blue-950",
    label: "Running",
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-100 dark:bg-red-950",
    label: "Failed",
  },
  paused_for_approval: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-100 dark:bg-amber-950",
    label: "Awaiting Approval",
  },
};

const eventLabels: Record<string, string> = {
  policy_loaded: "Policy Loaded",
  action_parsed: "Action Parsed",
  policy_evaluated: "Policy Evaluated",
  decision_made: "Decision Made",
  audit_logged: "Audit Logged",
};

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
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target, duration, start]);

  return count;
}

export function RunDetail({ runId }: { runId: string }) {
  const router = useRouter();
  const { data: run, isLoading, error, mutate } = useRun(runId);
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [approval, setApproval] = useState<ApprovalResult | null>(null);

  async function handleApproval(approve: boolean) {
    setSubmitting(approve ? "approve" : "deny");
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
        error: err instanceof Error ? err.message : "Approval request failed",
      });
    } finally {
      setSubmitting(null);
    }
  }

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 },
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Animated counters (must be before early returns per React rules)
  const animatedSteps = useCountUp(run?.steps || 0, 2000, statsVisible);
  const animatedArtifacts = useCountUp(run?.artifacts || 0, 2000, statsVisible);

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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/runs")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="p-8 text-center text-muted-foreground border rounded-xl">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>Failed to load run details</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => router.refresh()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const status = statusConfig[run.status] || statusConfig.failed;
  const StatusIcon = status.icon;
  const events = run.events || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/runs")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {run.workflow}
            </h1>
            <Badge
              variant={
                run.status === "completed"
                  ? "secondary"
                  : run.status === "failed"
                    ? "destructive"
                    : run.status === "running"
                      ? "default"
                      : "outline"
              }
            >
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Run ID: {run.id}</p>
        </div>
      </div>

      {/* Summary */}
      <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
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
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>{statsVisible ? animatedSteps : "—"}</div>
          <div className="text-xs text-muted-foreground">Steps</div>
        </div>
        <div className="bg-card p-4">
          <div className="text-lg font-bold">{run.duration}</div>
          <div className="text-xs text-muted-foreground">Duration</div>
        </div>
        <div className="bg-card p-4">
          <div className="text-lg font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>{statsVisible ? animatedArtifacts : "—"}</div>
          <div className="text-xs text-muted-foreground">Artifacts</div>
        </div>
      </div>

      {/* Execution Trace */}
      {events.length > 0 && (
        <div className="rounded-xl border bg-card p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Execution Trace
            </h2>
            <div className="space-y-0">
              {events.map((event, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        idx === events.length - 1 && run.status === "completed"
                          ? "bg-emerald-500 border-emerald-500"
                          : run.status === "failed" && idx === events.length - 1
                            ? "bg-red-500 border-red-500"
                            : "bg-background border-muted-foreground/30"
                      }`}
                      aria-label={
                        idx === events.length - 1 && run.status === "completed"
                          ? "Completed"
                          : run.status === "failed" && idx === events.length - 1
                            ? "Failed"
                            : "Pending"
                      }
                    />
                    {idx < events.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border/60 my-1" />
                    )}
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
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {run.status === "failed" && (
          <Button>
            <PlayCircle className="h-4 w-4" /> Retry Run
          </Button>
        )}
        {run.status === "paused_for_approval" && (
          <>
            <Button
              onClick={() => handleApproval(true)}
              disabled={submitting !== null}
            >
              {submitting === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {submitting === "approve" ? "Broadcasting…" : "Approve"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleApproval(false)}
              disabled={submitting !== null}
            >
              {submitting === "deny" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Deny
            </Button>
          </>
        )}
        <Button
          variant="outline"
          onClick={() => router.push("/governance/check")}
        >
          New Evaluation
        </Button>
      </div>

      {/* Approval result panel. Shown after submit until dismissed via another
          submit. Surfaces transferTxHash on success, transferError on failure,
          and offers Retry on failure (which mints a fresh idempotency key). */}
      {approval && (
        <div
          className={`rounded-xl border p-4 ${
            approval.success
              ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
              : "border-red-500/30 bg-red-50/50 dark:bg-red-950/20"
          }`}
        >
          {approval.success ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {approval.transfer?.transferStatus === "sent"
                    ? "Approved & broadcast"
                    : "Approval recorded"}
                </div>
                {approval.transfer?.transferTxHash ? (
                  <div className="text-sm text-muted-foreground mt-1">
                    Transfer hash:{" "}
                    <a
                      href={`https://www.oklink.com/xlayer-testnet/tx/${approval.transfer.transferTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono underline inline-flex items-center gap-1"
                    >
                      {approval.transfer.transferTxHash.slice(0, 10)}…
                      {approval.transfer.transferTxHash.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mt-1">
                    No on-chain transfer for this run.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {approval.transfer?.transferStatus === "failed"
                    ? "Transfer failed — money did not move"
                    : "Approval failed"}
                </div>
                <div className="text-sm text-muted-foreground mt-1 break-words">
                  {approval.transfer?.transferError ||
                    approval.error ||
                    "Unknown error."}
                </div>
                {/* Retry re-fires the approve POST with a fresh
                    Idempotency-Key (generated inside submitRunApproval), so
                    the cached failure does not block re-broadcast. */}
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproval(true)}
                    disabled={submitting !== null}
                  >
                    {submitting === "approve" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="h-3 w-3" />
                    )}
                    Retry approval
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
