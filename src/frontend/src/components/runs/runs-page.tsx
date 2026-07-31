"use client";


import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageState } from "@/components/ui/error-state";
import { useRouter } from "next/navigation";
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlayCircle,
} from "lucide-react";
import { useRuns } from "@/hooks/use-api";

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

export function RunsPage() {
  const router = useRouter();
  const { data: rawRuns, isLoading, error } = useRuns();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 },
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  const runs = Array.isArray(rawRuns)
    ? rawRuns.map((r) => ({
        id: r.id,
        workflow: r.workflow,
        status: r.status,
        mode: r.mode,
        steps: r.steps,
        duration: r.duration,
        artifacts: r.artifacts,
        time: new Date(r.timestamp).toLocaleString(),
      }))
    : [];

  const statuses = runs.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    {} as Record<string, number>,
  );
  const filteredRuns = statusFilter === "all" ? runs : runs.filter((run) => run.status === statusFilter);
  const awaitingCount = statuses["paused_for_approval"] || 0;
  const failedCount = statuses["failed"] || 0;

  // Animated counters
  const animatedActive = useCountUp(statuses["running"] || 0, 2000, statsVisible);
  const animatedCompleted = useCountUp(statuses["completed"] || 0, 2000, statsVisible);
  const animatedAwaiting = useCountUp(statuses["paused_for_approval"] || 0, 2000, statsVisible);
  const animatedFailed = useCountUp(statuses["failed"] || 0, 2000, statsVisible);

  return (
    <div className="space-y-6">
      <PageHeader title="Runs" description={awaitingCount + failedCount > 0
        ? `${awaitingCount + failedCount} execution${awaitingCount + failedCount === 1 ? "" : "s"} need attention.`
        : "Monitor governance evaluations and execution traces."} action={<>
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          <Badge variant="secondary">{runs.length} tracked</Badge>
          <Button size="sm" variant="default" onClick={() => router.push("/governance/check")}>
            <PlayCircle className="h-3.5 w-3.5" /> Run governance check
          </Button>
          </>} />

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card p-4">
              <Skeleton className="h-12 w-24" />
            </div>
          ))}
        </div>
      ) : error ? (
        <PageState variant="error" title="Could not load runs" message="The run history is unavailable right now. Try again in a moment." action={{ label: "Retry", onClick: () => router.refresh() }} />
      ) : (
        <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
          <div className="bg-card p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {statsVisible ? animatedActive : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
          <div className="bg-card p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {statsVisible ? animatedCompleted : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </div>
          <div className="bg-card p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-sky-500" />
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {statsVisible ? animatedAwaiting : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Awaiting</div>
            </div>
          </div>
          <div className="bg-card p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                {statsVisible ? animatedFailed : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Run List */}
      {!error && runs.length === 0 && !isLoading ? (
        <PageState variant="empty" title="No runs yet" message="Runs appear after your first governance evaluation or execution." action={{ label: "Run governance check", onClick: () => router.push("/governance/check") }} secondaryAction={{ label: "Create API identity", onClick: () => router.push("/agents/workshop") }} />
      ) : error ? (
        <PageState variant="error" title="Could not load runs" message="The run history is unavailable right now. Try again in a moment." action={{ label: "Retry", onClick: () => router.refresh() }} />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5" aria-label="Filter runs by status">
              {["all", "running", "paused_for_approval", "failed", "completed"].map((filter) => (
                <Button key={filter} size="sm" variant={statusFilter === filter ? "secondary" : "ghost"} className="h-8 capitalize" onClick={() => setStatusFilter(filter)}>
                  {filter === "paused_for_approval" ? "Awaiting approval" : filter}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" onClick={() => router.refresh()}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
          {filteredRuns.length === 0 ? (
            <PageState variant="no-results" title="No matching runs" message="Try another status filter to see more execution history." action={{ label: "Show all runs", onClick: () => setStatusFilter("all") }} />
          ) : (
            <div className="space-y-px bg-border rounded-xl overflow-hidden">
              {filteredRuns.map((run) => (
            <div
              key={run.id}
              className="bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/runs/${run.id}`)}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status={run.status} />
                    <span className="font-medium text-sm">{run.workflow}</span>
                    <span className="text-xs text-muted-foreground">
                      {run.mode}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span>{run.steps} steps</span>
                    <span>{run.artifacts} artifacts</span>
                    <span>{run.duration}</span>
                    <span>{run.time}</span>
                  </div>
                </div>
                {(run.status === "failed" || run.status === "paused_for_approval") && (
                  <p className="mt-2 text-xs font-medium text-muted-foreground">
                    {run.status === "failed" ? "Open the run to inspect the failure and retry safely." : "Open the run to review and approve or deny the pending action."}
                  </p>
                )}
            </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
