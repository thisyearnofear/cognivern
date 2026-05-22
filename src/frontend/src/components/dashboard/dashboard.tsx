"use client";

import { ShieldCheck, Users, FileSearch, Percent, Activity, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

const DEMO_AGENTS = [
  { id: "yield-01", name: "YieldHunter-01", status: "active", trades: 142, return: "+12.4%" },
  { id: "rebal-03", name: "Rebalancer-03", status: "active", trades: 89, return: "+8.1%" },
  { id: "arb-07", name: "Arbitrage-07", status: "paused", trades: 56, return: "-2.3%" },
  { id: "gov-01", name: "GovChecker-01", status: "active", trades: 31, return: "—" },
];

const DEMO_ACTIVITY = [
  { id: "1", agent: "YieldHunter-01", action: "Spend request approved", amount: "200 MNT", time: "2m ago", status: "approved" },
  { id: "2", agent: "Arbitrage-07", action: "Spend request denied", amount: "500 MNT", time: "14m ago", status: "denied" },
  { id: "3", agent: "Rebalancer-03", action: "Policy check passed", amount: "50 MNT", time: "28m ago", status: "passed" },
  { id: "4", agent: "YieldHunter-01", action: "Audit trail recorded", amount: "200 MNT", time: "45m ago", status: "audited" },
  { id: "5", agent: "GovChecker-01", action: "Manual approval completed", amount: "1,000 MNT", time: "1h ago", status: "approved" },
];

const DEMO_ALERTS = [
  { id: "a1", text: "Arbitrage-07 exceeded daily spend limit (500/500 MNT)", variant: "warning" as const },
  { id: "a2", text: "YieldHunter-01 near limit — 450/500 MNT spent today", variant: "secondary" as const },
];

export function Dashboard() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push("/governance/check")}>
            Deploy Policy
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{DEMO_AGENTS.filter(a => a.status === "active").length}/{DEMO_AGENTS.length}</div>
                <div className="text-xs text-muted-foreground">Agents Online</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950">
                <ShieldCheck className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">3</div>
                <div className="text-xs text-muted-foreground">Active Policies</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <Percent className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">78.3%</div>
                <div className="text-xs text-muted-foreground">Approval Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
                <FileSearch className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">318</div>
                <div className="text-xs text-muted-foreground">Policy Decisions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Governance Alerts */}
      {DEMO_ALERTS.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              Governance Alerts
            </h2>
            <Badge variant="secondary">{DEMO_ALERTS.length} open</Badge>
          </div>
          <div className="space-y-2">
            {DEMO_ALERTS.map((alert) => (
              <div key={alert.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                {alert.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Governed Agents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Governed Agents</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEMO_AGENTS.map((agent) => (
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
                  <span className={agent.return.startsWith("+") ? "text-emerald-500" : agent.return.startsWith("-") ? "text-red-500" : ""}>
                    {agent.return}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Recent Activity</h2>
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/audit")}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="rounded-xl border border-border divide-y divide-border">
          {DEMO_ACTIVITY.map((item) => (
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
                <span className="text-xs text-muted-foreground w-12 text-right">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
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
          onClick={() => router.push("/agents/workshop")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Sparkles className="h-5 w-5 text-sky-500 mb-2" />
          <div className="font-medium text-sm">Add Agent</div>
          <div className="text-xs text-muted-foreground mt-1">Onboard new agents</div>
        </button>
        <button
          onClick={() => router.push("/demo/spend")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Activity className="h-5 w-5 text-emerald-500 mb-2" />
          <div className="font-medium text-sm">Spend Flow Demo</div>
          <div className="text-xs text-muted-foreground mt-1">See spend evaluation</div>
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
