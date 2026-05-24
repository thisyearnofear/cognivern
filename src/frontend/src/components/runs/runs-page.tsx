"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Activity, RefreshCw, CheckCircle2, Clock, AlertTriangle, PlayCircle } from "lucide-react";
import { useRuns } from "@/hooks/use-api";

export function RunsPage() {
  const router = useRouter();
  const { data: rawRuns, isLoading, error } = useRuns();

  const runs = Array.isArray(rawRuns) ? rawRuns.map(r => ({
    id: r.id, workflow: r.workflow, status: r.status, mode: r.mode,
    steps: r.steps, duration: r.duration, artifacts: r.artifacts,
    time: new Date(r.timestamp).toLocaleString()
  })) : [];

  const statuses = runs.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">Agent workflow execution traces</p>
        </div>
        <div className="flex items-center gap-2">
          {error && <Badge variant="destructive" className="text-xs">Error</Badge>}
          <Badge variant="secondary">{runs.length} tracked</Badge>
        </div>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-24" /></CardContent></Card>)}
        </div>
      ) : error ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <p>Failed to load runs</p>
          <p className="text-xs mt-1">The backend may be unavailable</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xl font-bold">{statuses["running"] || 0}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-xl font-bold">{statuses["completed"] || 0}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-sky-500" />
              <div>
                <div className="text-xl font-bold">{statuses["paused_for_approval"] || 0}</div>
                <div className="text-xs text-muted-foreground">Awaiting</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <div className="text-xl font-bold">{statuses["failed"] || 0}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button size="sm" variant="default" onClick={() => router.push("/governance/check")}>
          <PlayCircle className="h-3.5 w-3.5" /> New Evaluation
        </Button>
      </div>

      {/* Run List */}
      {!error && runs.length === 0 && !isLoading ? (
        <div className="p-12 text-center text-muted-foreground border rounded-xl">
          <Activity className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No runs yet</p>
          <p className="text-sm mt-1">Run a governance check to see execution traces here</p>
          <Button className="mt-4" onClick={() => router.push("/governance/check")}>
            <PlayCircle className="h-3.5 w-3.5" /> Run a Check
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
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
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
