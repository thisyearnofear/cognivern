"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Activity, PlayCircle, RefreshCw, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

const DEMO_RUNS = [
  { id: "run-1", workflow: "Spend Governance Check", status: "completed", mode: "forecast", steps: 5, duration: "3.2s", artifacts: 2, time: "5 min ago" },
  { id: "run-2", workflow: "Policy Evaluation", status: "running", mode: "live", steps: 3, duration: "In progress", artifacts: 1, time: "12 min ago" },
  { id: "run-3", workflow: "Audit Trail Attestation", status: "failed", mode: "forecast", steps: 4, duration: "1.8s", artifacts: 0, time: "45 min ago" },
  { id: "run-4", workflow: "Portfolio Rebalance Check", status: "completed", mode: "forecast", steps: 6, duration: "5.1s", artifacts: 3, time: "1 h ago" },
  { id: "run-5", workflow: "Compliance Scan", status: "paused_for_approval", mode: "live", steps: 2, duration: "Awaiting", artifacts: 0, time: "2 h ago" },
];

export function RunsPage() {
  const router = useRouter();

  const statuses = DEMO_RUNS.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">Agent workflow execution traces</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{DEMO_RUNS.length} tracked</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <div className="text-xl font-bold">{statuses["running"] || 1}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-xl font-bold">{statuses["completed"] || 2}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-sky-500" />
            <div>
              <div className="text-xl font-bold">{statuses["paused_for_approval"] || 1}</div>
              <div className="text-xs text-muted-foreground">Awaiting</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <div className="text-xl font-bold">{statuses["failed"] || 1}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button size="sm" variant="default">
          <PlayCircle className="h-3.5 w-3.5" /> Forecast
        </Button>
        <Button size="sm" variant="secondary">
          Require approval
        </Button>
        <Button size="sm" variant="default">
          Run + Attest
        </Button>
      </div>

      {/* Run List */}
      <div className="space-y-3">
        {DEMO_RUNS.map((run) => (
          <Card
            key={run.id}
            className="hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer"
            onClick={() => router.push(`/runs/${run.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Badge variant={
                    run.status === "completed" ? "secondary" :
                    run.status === "running" ? "default" :
                    run.status === "failed" ? "destructive" : "outline"
                  }>
                    {run.status.toUpperCase()}
                  </Badge>
                  <span className="font-medium text-sm">{run.workflow}</span>
                  <span className="text-xs text-muted-foreground">{run.mode}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{run.steps} steps</span>
                  <span>{run.artifacts} artifacts</span>
                  <span>{run.duration}</span>
                  <span>{run.time}</span>
                  <span className="text-primary font-medium">Open →</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
