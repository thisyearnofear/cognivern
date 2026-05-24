"use client";

import { ShieldCheck, Users, FileSearch, Percent, Activity, ArrowRight, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAgents, useAuditLogs, usePolicies } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";

export function Dashboard() {
  const router = useRouter();
  const workspace = useAppStore((s) => s.user.workspace);
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useAgents();
  const { data: logs, isLoading: logsLoading, error: logsError } = useAuditLogs();
  const { data: policies, isLoading: policiesLoading } = usePolicies();

  const agentList = agents || [];
  const activity = (logs || []).map(l => ({
    id: l.id, agent: l.agentId, action: l.action,
    amount: "—", time: new Date(l.timestamp).toLocaleString(), status: l.decision
  }));
  const activeCount = agentList.filter(a => a.status === "active").length;
  const approvalRate = logs && logs.length > 0
    ? Math.round((logs.filter(l => l.decision === "approved").length / logs.length) * 100) : 0;
  const decisions = logs?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          {agentsError && (
            <Badge variant="destructive" className="text-xs">API Error</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push("/governance/check")}>
            Governance Check
          </Button>
        </div>
      </div>

      {/* Getting Started Guide — shown for live workspaces with no agents */}
      {!agentsLoading && workspace?.tier === "live" && agentList.length === 0 && (
        <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50/50 to-sky-50/50 dark:from-purple-950/20 dark:to-sky-950/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <Rocket className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <h2 className="font-semibold">You&apos;re live — let&apos;s set up your first agent</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Follow these steps to start governing your agents with Cognivern.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                onClick={() => router.push("/agents/workshop")}
                className="p-4 rounded-lg border bg-card hover:border-purple-300 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 text-xs font-bold flex items-center justify-center">1</span>
                  <span className="text-sm font-medium">Register an Agent</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Name it, pick a chain, set a budget.
                </p>
              </button>
              <button
                onClick={() => router.push("/settings")}
                className="p-4 rounded-lg border bg-card hover:border-purple-300 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 text-xs font-bold flex items-center justify-center">2</span>
                  <span className="text-sm font-medium">Create an API Key</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your agent uses this to authenticate.
                </p>
              </button>
              <button
                onClick={() => router.push("/policies")}
                className="p-4 rounded-lg border bg-card hover:border-purple-300 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 text-xs font-bold flex items-center justify-center">3</span>
                  <span className="text-sm font-medium">Set Policies</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Define spend limits and allowlists.
                </p>
              </button>
              <button
                onClick={() => router.push("/integrate")}
                className="p-4 rounded-lg border bg-card hover:border-purple-300 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 text-xs font-bold flex items-center justify-center">4</span>
                  <span className="text-sm font-medium">Integrate</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add the governance check to your agent code.
                </p>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            {agentsLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{activeCount}/{agentList.length}</div>
                  <div className="text-xs text-muted-foreground">Agents Online</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {policiesLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950">
                  <ShieldCheck className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{(policies || []).filter(p => p.status === "active").length}</div>
                  <div className="text-xs text-muted-foreground">Active Policies</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {logsLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                  <Percent className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{approvalRate}%</div>
                  <div className="text-xs text-muted-foreground">Approval Rate</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {logsLoading ? (
              <Skeleton className="h-12 w-24" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
                  <FileSearch className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{decisions}</div>
                  <div className="text-xs text-muted-foreground">Policy Decisions</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Governed Agents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Governed Agents</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {agentsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : agentsError ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Failed to load agents</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>Retry</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {agentList.map((agent) => (
              <Card key={agent.id} className="hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer" onClick={() => router.push(`/agents/${agent.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
                      <span className="font-medium text-sm">{agent.name}</span>
                    </div>
                    <Badge variant={agent.status === "active" ? "secondary" : "outline"} className="text-xs">
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{agent.trades} trades</span>
                    <span>{agent.budget}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent Activity</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/audit")}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {logsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : logsError ? (
          <div className="p-8 text-center text-muted-foreground border rounded-xl">
            <p>Failed to load activity</p>
          </div>
        ) : activity.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border rounded-xl">
            <p>No activity yet</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {activity.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-1.5 rounded-md flex-shrink-0 ${
                    item.status === "approved" ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600" :
                    item.status === "denied" ? "bg-red-100 dark:bg-red-950 text-red-600" :
                    "bg-blue-100 dark:bg-blue-950 text-blue-600"
                  }`}>
                    {item.status === "approved" ? <ShieldCheck className="h-3.5 w-3.5" /> :
                     item.status === "denied" ? <Activity className="h-3.5 w-3.5" /> :
                     <FileSearch className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.agent}</div>
                    <div className="text-muted-foreground text-xs truncate">{item.action}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="font-mono text-xs">{item.amount}</span>
                  <Badge variant={
                    item.status === "approved" ? "secondary" :
                    item.status === "denied" ? "destructive" : "outline"
                  } className="text-xs">
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-20 text-right">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => router.push("/governance/check")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <ShieldCheck className="h-5 w-5 text-primary mb-2" />
          <div className="font-medium text-sm">Governance Check</div>
          <div className="text-xs text-muted-foreground mt-1">Test policies live</div>
        </button>
        <button
          onClick={() => router.push("/os")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Rocket className="h-5 w-5 text-violet-500 mb-2" />
          <div className="font-medium text-sm">Open OS Shell</div>
          <div className="text-xs text-muted-foreground mt-1">Try the demo terminal</div>
        </button>
        <button
          onClick={() => router.push("/agents/workshop")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Sparkles className="h-5 w-5 text-sky-500 mb-2" />
          <div className="font-medium text-sm">Add Agent</div>
          <div className="text-xs text-muted-foreground mt-1">Onboard new agents</div>
        </button>
        <button
          onClick={() => router.push("/audit")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <FileSearch className="h-5 w-5 text-amber-500 mb-2" />
          <div className="font-medium text-sm">Audit Trail</div>
          <div className="text-xs text-muted-foreground mt-1">Review all decisions</div>
        </button>
      </div>
    </div>
  );
}
