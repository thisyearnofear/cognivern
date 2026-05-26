'use client';

import {
  ShieldCheck,
  Users,
  FileSearch,
  Percent,
  Activity,
  ArrowRight,
  Sparkles,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { useAgents, useAuditLogs, usePolicies } from '@/hooks/use-api';
import { useAppStore } from '@/stores/app-store';

export function Dashboard() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const demoMode = useAppStore((s) => s.demoMode);
  const workspace = user.workspace;
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useAgents();
  const { data: logs, isLoading: logsLoading, error: logsError } = useAuditLogs();
  const { data: policies, isLoading: policiesLoading } = usePolicies();

  const agentList = agents || [];
  const activity = Array.isArray(logs)
    ? logs.map((l) => ({
        id: l.id,
        agent: l.agent ?? l.agentId,
        action: l.actionType ?? l.action,
        amount: '—',
        time: l.time ?? new Date(l.timestamp).toLocaleString(),
        status: l.outcome ?? l.complianceStatus ?? l.decision,
      }))
    : [];
  const activeCount = agentList.filter((a) => a.status === 'active').length;
  const approvalRate = Array.isArray(logs)
    ? Math.round(
        (logs.filter(
          (l) =>
            l.outcome === 'allowed' ||
            l.complianceStatus === 'compliant' ||
            l.decision === 'approved',
        ).length /
          logs.length) *
          100,
      )
    : 0;
  const decisions = Array.isArray(logs) ? logs.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {demoMode && workspace && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              <span>Exploring <span className="font-medium">{workspace.name}</span> — sample data</span>
            </div>
          )}
          {!demoMode && workspace && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Connected as <span className="font-mono">{useAppStore.getState().user.walletAddress?.slice(0, 6)}...{useAppStore.getState().user.walletAddress?.slice(-4)}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agentsError && (
            <Badge variant="destructive" className="text-xs">
              API Error
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push('/governance/check')}>
            Governance Check
          </Button>
        </div>
      </div>

      {/* Activation Hero — shown for production mode with no agents */}
      {user.workspaceMode === 'production' && !agentsLoading && agentList.length === 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                <Rocket className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  Ready for Production
                </h2>
                <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1 max-w-xl">
                  Your production workspace is ready. Register your first agent to start enforcing governance policies on live data.
                </p>
                <div className="flex gap-3 mt-4">
                  <Button onClick={() => router.push('/agents/workshop')}>
                    Register Your First Agent
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/policies')}>
                    Define Policies
                  </Button>
                </div>
              </div>
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
                  <div className="text-2xl font-bold">
                    {activeCount}/{agentList.length}
                  </div>
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
                  <div className="text-2xl font-bold">
                    {(policies || []).filter((p) => p.status === 'active').length}
                  </div>
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
          <Button variant="ghost" size="sm" onClick={() => router.push('/agents')}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {agentsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : agentsError ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Failed to load agents</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => router.refresh()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {agentList.map((agent) => (
              <Card
                key={agent.id}
                className="hover:border-sky-200 dark:hover:border-sky-800 transition-colors cursor-pointer"
                onClick={() => router.push(`/agents/${agent.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${agent.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      />
                      <span className="font-medium text-sm">{agent.name}</span>
                    </div>
                    <Badge
                      variant={agent.status === 'active' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
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
          <Button variant="ghost" size="sm" onClick={() => router.push('/audit')}>
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {logsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
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
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors gap-2 sm:gap-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-md flex-shrink-0 ${
                      item.status === 'allowed' || item.status === 'compliant'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                        : item.status === 'denied' || item.status === 'non-compliant'
                          ? 'bg-red-100 dark:bg-red-950 text-red-600'
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-600'
                    }`}
                  >
                    {item.status === 'allowed' || item.status === 'compliant' ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : item.status === 'denied' || item.status === 'non-compliant' ? (
                      <Activity className="h-3.5 w-3.5" />
                    ) : (
                      <FileSearch className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.agent}</div>
                    <div className="text-muted-foreground text-xs truncate">{item.action}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 sm:ml-4 pl-8 sm:pl-0">
                  <span className="font-mono text-xs">{item.amount}</span>
                  <Badge
                    variant={
                      item.status === 'allowed' || item.status === 'compliant'
                        ? 'secondary'
                        : item.status === 'denied' || item.status === 'non-compliant'
                          ? 'destructive'
                          : 'outline'
                    }
                    className="text-xs"
                  >
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={() => router.push('/governance/check')}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <ShieldCheck className="h-5 w-5 text-primary mb-2" />
          <div className="font-medium text-sm">Governance Check</div>
          <div className="text-xs text-muted-foreground mt-1">Test policies live</div>
        </button>
        <button
          onClick={() => router.push('/os')}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Rocket className="h-5 w-5 text-violet-500 mb-2" />
          <div className="font-medium text-sm">Open Agent Command Center</div>
          <div className="text-xs text-muted-foreground mt-1">Inspect agents live</div>
        </button>
        <button
          onClick={() => router.push('/agents/workshop')}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Sparkles className="h-5 w-5 text-sky-500 mb-2" />
          <div className="font-medium text-sm">Add Agent</div>
          <div className="text-xs text-muted-foreground mt-1">Onboard new agents</div>
        </button>
        <button
          onClick={() => router.push('/audit')}
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
