"use client";


import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Animated counters
  const animatedActive = useCountUp(statuses["running"] || 0, 2000, statsVisible);
  const animatedCompleted = useCountUp(statuses["completed"] || 0, 2000, statsVisible);
  const animatedAwaiting = useCountUp(statuses["paused_for_approval"] || 0, 2000, statsVisible);
  const animatedFailed = useCountUp(statuses["failed"] || 0, 2000, statsVisible);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governance evaluation and execution traces
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          <Badge variant="secondary">{runs.length} tracked</Badge>
        </div>
      </div>

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
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <p>Failed to load runs</p>
          <p className="text-xs mt-1">The backend may be unavailable</p>
        </div>
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

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={() => router.push("/governance/check")}
        >
          <PlayCircle className="h-3.5 w-3.5" /> New Evaluation
        </Button>
      </div>

      {/* Run List */}
      {!error && runs.length === 0 && !isLoading ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="p-8 sm:p-10 text-center space-y-4">
            <div className="max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Activity className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="font-medium text-foreground text-base">No runs yet</p>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Runs track every governance evaluation, policy check, and
                on-chain transaction your systems perform. They appear here
                automatically once activity starts.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
              <Button
                onClick={() => router.push("/governance/check")}
              >
                <PlayCircle className="h-3.5 w-3.5" /> Run a Governance Check
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/agents/workshop")}
              >
                Create API Identity
              </Button>
            </div>
            <div className="pt-2">
              <p className="text-[11px] text-muted-foreground/60">
                Already have an agent?{" "}
                <button
                  onClick={() => router.refresh()}
                  className="text-primary hover:underline"
                >
                  Refresh this page
                </button>
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-px bg-border rounded-xl overflow-hidden">
          {runs.map((run) => (
            <div
              key={run.id}
              className="bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/runs/${run.id}`)}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge
                      variant={
                        run.status === "completed"
                          ? "secondary"
                          : run.status === "running"
                            ? "default"
                            : run.status === "failed"
                              ? "destructive"
                              : "outline"
                      }
                    >
                      {run.status.toUpperCase()}
                    </Badge>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
