"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, XCircle, Clock, AlertTriangle, PlayCircle, Activity } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { useRun } from "@/hooks/use-api";

const DEMO_RUN = {
  id: "run-1",
  workflow: "Spend Governance Check",
  status: "completed" as const,
  mode: "forecast",
  steps: 5,
  duration: "3.2s",
  artifacts: 2,
  timestamp: new Date().toISOString(),
  events: [
    { type: "policy_loaded", data: { policies: 3 }, timestamp: new Date(Date.now() - 5000).toISOString() },
    { type: "action_parsed", data: { agent: "YieldHunter-01", amount: 200 }, timestamp: new Date(Date.now() - 4000).toISOString() },
    { type: "policy_evaluated", data: { results: { p1: true, p2: true, p3: true } }, timestamp: new Date(Date.now() - 3000).toISOString() },
    { type: "decision_made", data: { allowed: true, reasoning: "All policy checks passed" }, timestamp: new Date(Date.now() - 2000).toISOString() },
    { type: "audit_logged", data: { logId: "log-123" }, timestamp: new Date(Date.now() - 1000).toISOString() },
  ],
};

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-950", label: "Completed" },
  running: { icon: Activity, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950", label: "Running" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-950", label: "Failed" },
  paused_for_approval: { icon: Clock, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-950", label: "Awaiting Approval" },
};

const eventLabels: Record<string, string> = {
  policy_loaded: "Policy Loaded",
  action_parsed: "Action Parsed",
  policy_evaluated: "Policy Evaluated",
  decision_made: "Decision Made",
  audit_logged: "Audit Logged",
};

export function RunDetail({ runId }: { runId: string }) {
  const router = useRouter();
  const mode = useAppStore((s) => s.mode);
  const { data: liveRun, isLoading, error } = useRun(runId);
  const isLive = mode === "live";

  const run = isLive && liveRun ? liveRun : DEMO_RUN;
  const status = statusConfig[run.status] || statusConfig.failed;
  const StatusIcon = status.icon;
  const events = run.events || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/runs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{run.workflow}</h1>
            <Badge variant={
              run.status === "completed" ? "secondary" :
              run.status === "failed" ? "destructive" :
              run.status === "running" ? "default" : "outline"
            }>
              {status.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Run ID: {run.id}</p>
        </div>
      </div>

      {isLoading && isLive ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : error && isLive ? (
        <div className="p-8 text-center text-muted-foreground border rounded-xl">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>Failed to load run details</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>Retry</Button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${status.bg} ${status.color}`}>
                    <StatusIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-lg font-bold">{status.label}</div>
                    <div className="text-xs text-muted-foreground">Status</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-lg font-bold">{run.steps}</div>
                <div className="text-xs text-muted-foreground">Steps</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-lg font-bold">{run.duration}</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-lg font-bold">{run.artifacts}</div>
                <div className="text-xs text-muted-foreground">Artifacts</div>
              </CardContent>
            </Card>
          </div>

          {/* Execution Trace */}
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Execution Trace
              </h2>
              <div className="space-y-0">
                {events.map((event, idx) => (
                  <div key={idx} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full border-2 ${
                        idx === events.length - 1 && run.status === "completed"
                          ? "bg-emerald-500 border-emerald-500"
                          : run.status === "failed" && idx === events.length - 1
                          ? "bg-red-500 border-red-500"
                          : "bg-background border-muted-foreground/30"
                      }`} />
                      {idx < events.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border/60 my-1" />
                      )}
                    </div>
                    {/* Event content */}
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
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {run.status === "failed" && (
              <Button>
                <PlayCircle className="h-4 w-4" /> Retry Run
              </Button>
            )}
            {run.status === "paused_for_approval" && (
              <Button>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push("/governance/check")}>
              New Evaluation
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
