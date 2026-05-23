"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Users,
  ShieldCheck,
  Activity,
  Clock,
  Pause,
  Play,
  Trash2,
  ChevronRight,
  FileSearch,
} from "lucide-react";
import { useAgent } from "@/hooks/use-api";
import { useAppStore } from "@/stores/app-store";
import type { Agent } from "@cognivern/shared";

const DEMO_AGENT: Agent = {
  id: "yield-01",
  name: "YieldHunter-01",
  role: "DeFi Yield Optimizer",
  status: "active" as const,
  trades: 142,
  budget: "500 MNT/day",
  chain: "X Layer",
  spendHistory: [
    { amount: 200, currency: "MNT", timestamp: "2026-05-23T10:21:00Z", decision: "approved" },
    { amount: 150, currency: "MNT", timestamp: "2026-05-23T09:15:00Z", decision: "approved" },
    { amount: 600, currency: "MNT", timestamp: "2026-05-23T08:00:00Z", decision: "denied" },
    { amount: 50, currency: "MNT", timestamp: "2026-05-22T22:30:00Z", decision: "approved" },
    { amount: 1000, currency: "MNT", timestamp: "2026-05-22T18:00:00Z", decision: "held" },
  ],
};

function Breadcrumbs({ agentName }: { agentName: string }) {
  const router = useRouter();
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <button onClick={() => router.push("/dashboard")} className="hover:text-foreground transition-colors">
        Dashboard
      </button>
      <ChevronRight className="h-3 w-3" />
      <button onClick={() => router.push("/agents")} className="hover:text-foreground transition-colors">
        Agents
      </button>
      <ChevronRight className="h-3 w-3" />
      <span className="text-foreground font-medium">{agentName}</span>
    </nav>
  );
}

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const router = useRouter();
  const mode = useAppStore((s) => s.mode);
  const { data: liveAgent, isLoading, error } = useAgent(mode === "live" ? agentId : "");

  const agent = mode === "demo" ? DEMO_AGENT : liveAgent;

  if (isLoading && mode === "live") {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/agents")}>
          <ArrowLeft className="h-4 w-4" /> Back to Agents
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Agent Not Found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {error ? error.message : "The agent could not be loaded."}
            </p>
            <Button onClick={() => router.push("/agents")}>Back to Agents</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs agentName={agent.name} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              agent.status === "active"
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600"
                : "bg-amber-100 dark:bg-amber-950 text-amber-600"
            }`}
          >
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/policies")}>
            <ShieldCheck className="h-4 w-4" /> View Policy
          </Button>
          <Button
            variant={agent.status === "active" ? "outline" : "default"}
            size="sm"
          >
            {agent.status === "active" ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Resume
              </>
            )}
          </Button>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4" /> Revoke
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{agent.trades}</div>
                <div className="text-xs text-muted-foreground">Total Trades</div>
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
                <div className="text-lg font-bold">{agent.budget}</div>
                <div className="text-xs text-muted-foreground">Budget Limit</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <div className="text-lg font-bold">{agent.chain}</div>
                <div className="text-xs text-muted-foreground">Chain</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950">
                <div
                  className={`w-3 h-3 rounded-full ${
                    agent.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </div>
              <div>
                <div className="text-lg font-bold capitalize">{agent.status}</div>
                <div className="text-xs text-muted-foreground">Status</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Spend History</h2>
          <Button variant="ghost" size="sm" onClick={() => router.push("/audit")}>
            View Audit Log <FileSearch className="h-3.5 w-3.5" />
          </Button>
        </div>

        {agent.spendHistory && agent.spendHistory.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Amount</TableHead>
                  <TableHead scope="col">Currency</TableHead>
                  <TableHead scope="col">Time</TableHead>
                  <TableHead scope="col">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.spendHistory.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono">{tx.amount}</TableCell>
                    <TableCell>{tx.currency}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(tx.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tx.decision === "approved"
                            ? "secondary"
                            : tx.decision === "denied"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {tx.decision}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No spend history yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
