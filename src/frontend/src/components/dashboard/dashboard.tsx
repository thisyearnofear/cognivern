"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Users,
  FileSearch,
  Percent,
  Activity,
  ArrowRight,
  Sparkles,
  Rocket,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  CheckCircle2,
  ShieldX,
  Clock,
  AlertTriangle,
  Gavel,
} from "lucide-react";
import type { AuditLog } from "@cognivern/shared";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { useAgents, useAuditLogs, usePolicies, useNetworkStatus } from "@/hooks/use-api";
import { useAuthStore } from "@/stores/auth-store";
import { useDemoStore } from "@/stores/demo-store";
import dynamic from "next/dynamic";
import { DecisionChart, type DecisionFilter } from "./decision-chart";
import { ApprovalSparkline } from "./approval-sparkline";
import { GetStartedPanel } from "./get-started-panel";

const ActivityChart = dynamic(
  () => import("./activity-chart").then((m) => ({ default: m.ActivityChart })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
    ),
  },
);

const AgentStatusChart = dynamic(
  () =>
    import("./agent-status-chart").then((m) => ({
      default: m.AgentStatusChart,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
    ),
  },
);
import { QuickCheck } from "./quick-check";
import { formatBudget } from "@/lib/budget-format";
import { normalizeAuditLogs, computeAverageLatency } from "@/lib/normalizers";
import { authFetch } from "@/lib/auth-fetch";

/* ─── Animated counter hook ────────────────────────────────── */

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

function AiSpendCard() {
  const [aiSpend, setAiSpend] = useState<{
    totalCostUsd: number;
    totalTokens: number;
    totalCalls: number;
    byProvider: Record<string, { costUsd: number; tokens: number; calls: number }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/audit/insights?dimension=ai_spend")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setAiSpend(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-card p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950 flex-shrink-0">
        <Sparkles className="h-5 w-5 text-violet-500" />
      </div>
      <div>
        <div
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {typeof aiSpend?.totalCostUsd === "number"
            ? `$${aiSpend.totalCostUsd.toFixed(4)}`
            : "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          AI Spend ({aiSpend?.totalCalls || 0} calls)
        </div>
      </div>
    </div>
  );
}

function ControlScoreCard() {
  const [data, setData] = useState<{
    totalScored: number;
    averageScore: number;
    escalationRate: number;
    distribution: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/audit/insights?dimension=suspicion")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setData(json.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Render only when the backend actually supplied the suspicion shape.
  // Demo-tier responses can come back as {compliance, trends} with neither
  // totalScored nor averageScore populated; rendering then crashes the
  // dashboard at `data.averageScore.toFixed(2)`.
  if (
    !data ||
    typeof data.averageScore !== "number" ||
    !data.totalScored
  ) {
    return null;
  }

  return (
    <div className="bg-card p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950 flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
      </div>
      <div>
        <div
          className="text-2xl font-bold"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          {data.averageScore.toFixed(2)}
        </div>
        <div className="text-xs text-muted-foreground">
          Control Score ({data.escalationRate}% escalated)
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_PAGE_SIZE = 5;

export function Dashboard() {
  const router = useRouter();
  const demoMode = useDemoStore((s) => s.demoMode);
  const workspace = useAuthStore((s) => s.workspace);
  const walletAddress = useAuthStore((s) => s.walletAddress);
  const isAuthenticated = useAuthStore((s) => s.isConnected);
  const workspaceMode = useAuthStore((s) => s.workspaceMode);
  useNetworkStatus();
  const {
    data: agents,
    isLoading: agentsLoading,
    error: agentsError,
  } = useAgents();
  const {
    data: logs,
    isLoading: logsLoading,
    error: logsError,
  } = useAuditLogs();
  const { data: policies, isLoading: policiesLoading } = usePolicies();

  // Cross-filtering state
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>(null);
  // Progressive disclosure state
  const [activityExpanded, setActivityExpanded] = useState(false);
  // Focus mode — reduces dashboard density for new users
  const [focusMode, setFocusMode] = useState(false);
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

  const agentList = agents || [];

  const normalizedLogs = useMemo(() => {
    return normalizeAuditLogs(logs as AuditLog[]);
  }, [logs]);

  const activity = useMemo(() => {
    return normalizedLogs.map((l) => ({
      id: l.id,
      agent: l.agent,
      action: l.action,
      amount: "—",
      time: l.time,
      status: l.decision,
      _normalized: l.decision,
    }));
  }, [normalizedLogs]);

  // Filtered activity based on donut cross-filter
  const filteredActivity = useMemo(() => {
    if (!decisionFilter) return activity;
    return activity.filter((a) => a._normalized === decisionFilter);
  }, [activity, decisionFilter]);

  // Progressive disclosure slice
  const visibleActivity = activityExpanded
    ? filteredActivity
    : filteredActivity.slice(0, ACTIVITY_PAGE_SIZE);

  const activeCount = agentList.filter((a) => a.status === "active").length;
  const approvalRate = normalizedLogs.length > 0
    ? Math.round(
        (normalizedLogs.filter((l) => l.decision === "approved").length /
          normalizedLogs.length) *
          100,
      )
    : 0;
  const decisions = normalizedLogs.length;
  const blockedCount = normalizedLogs.filter((l) => l.decision === "denied").length;
  const avgLatency = computeAverageLatency(normalizedLogs);

  // Count decisions carrying a real on-chain governance-record tx (mirrors the
  // audit page's getOnChainTxHash: top-level or nested data.txHash). Real data
  // only — 0 for demo sample logs, which is accurate, so the strip stays hidden.
  const onChainProofCount = useMemo(() => {
    if (!Array.isArray(logs)) return 0;
    return logs.filter((l) => {
      const r = l as unknown as Record<string, unknown>;
      if (typeof r.txHash === "string" && r.txHash.length > 10) return true;
      const data = r.data as Record<string, unknown> | undefined;
      const dataTx = data?.txHash;
      return typeof dataTx === "string" && dataTx.length > 10;
    }).length;
  }, [logs]);

  // Animated counters
  const animatedApprovalRate = useCountUp(approvalRate, 2000, statsVisible);
  const animatedDecisions = useCountUp(decisions, 2000, statsVisible);
  const animatedBlocked = useCountUp(blockedCount, 2000, statsVisible);
  const animatedActive = useCountUp(activeCount, 2000, statsVisible);

  // Stat deltas (compare first half vs second half of logs for trend)
  const { approvalDelta, decisionsDelta } = useMemo(() => {
    if (normalizedLogs.length < 4)
      return { approvalDelta: 0, decisionsDelta: 0 };
    const mid = Math.floor(normalizedLogs.length / 2);
    const recentHalf = normalizedLogs.slice(0, mid);
    const olderHalf = normalizedLogs.slice(mid);
    const recentApproval = Math.round(
      (recentHalf.filter((l) => l.decision === "approved").length /
        recentHalf.length) *
        100,
    );
    const olderApproval = Math.round(
      (olderHalf.filter((l) => l.decision === "approved").length /
        olderHalf.length) *
        100,
    );
    return {
      approvalDelta: recentApproval - olderApproval,
      decisionsDelta: recentHalf.length - olderHalf.length,
    };
  }, [normalizedLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          {demoMode && workspace && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <Sparkles className="h-3 w-3" />
              <span>
                Exploring <span className="font-medium">{workspace.name}</span>{" "}
                — sample data
              </span>
            </div>
          )}
          {!demoMode && workspace && walletAddress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Connected as{" "}
                <span className="font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agentsError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <span className="font-medium">Unable to reach API</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => router.refresh()}
              >
                Retry
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setFocusMode(!focusMode)}
            className="text-xs"
          >
            {focusMode ? "Expand" : "Focus"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.refresh()}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => router.push("/governance/check")}>
            Governance Check
          </Button>
        </div>
      </div>

      {/* New or returning user with no activity yet. With backend seeding,
          every workspace starts with 1 agent + 1 policy, so we show this
          panel when there are no audit logs (i.e. the tester hasn't run
          any governance checks yet). The QuickCheck card inside gives them
          an immediate "aha moment". */}
      {isAuthenticated &&
        workspaceMode === "production" &&
        !agentsLoading &&
        !policiesLoading &&
        !logsLoading &&
        normalizedLogs.length === 0 && (
          <GetStartedPanel />
        )}

      {/* Returning user, partial setup. Keeps the existing checklist UI
          because its checkmarks meaningfully signal progress. Only renders
          when one of (agents, active policies) exists but not both — the
          fully-empty case is handled by GetStartedPanel above. */}
      {isAuthenticated &&
        workspaceMode === "production" &&
        !agentsLoading &&
        !policiesLoading &&
        (agentList.length > 0
          ? (policies || []).filter((p) => p.status === "active").length === 0
          : (policies || []).filter((p) => p.status === "active").length > 0) && (
          <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-sky-500/5 p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold">Get Started</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Set up your governance in 3 steps
                  </p>
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={() => router.push("/policies")}
                      className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {(policies || []).filter((p) => p.status === "active")
                        .length > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-medium">Create a policy</div>
                        <div className="text-xs text-muted-foreground">
                          Set spending limits and rules for your API identities
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => router.push("/agents/workshop")}
                      className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {agentList.length > 0 ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-medium">Create an API identity</div>
                        <div className="text-xs text-muted-foreground">
                          Give your external system governed access to Cognivern
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => router.push("/settings")}
                      className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Get your API key</div>
                        <div className="text-xs text-muted-foreground">
                          Connect the governance API to your external system
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => router.push("/demo/spend")}
                      className="flex items-center gap-3 w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      <div>
                        <div className="text-sm font-medium">Watch how it works</div>
                        <div className="text-xs text-muted-foreground">
                          See the governed vs ungoverned spend flow demo
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
        )}

      {/* Vendor spend governance — links agent spend to sealed-bid */}
      <button
        type="button"
        onClick={() => router.push("/sealed-bid")}
        className="w-full rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-emerald-500/5 p-5 text-left hover:border-primary/40 transition-colors group"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 shrink-0">
            <Gavel className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold">Vendor spend governance</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Agent spend policies govern day-to-day wallet activity. Sealed-bid
              rounds govern confidential vendor selection — same control plane,
              Canton structural privacy for RFPs and OTC.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary shrink-0 mt-1 transition-colors" />
        </div>
      </button>

      {/* Stat Bar — Animated */}
      <div ref={statsRef}>
        {agentsLoading || logsLoading || policiesLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[72px] rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border rounded-xl overflow-hidden">
            <div className="bg-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950 flex-shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {statsVisible ? `${animatedActive}/${agentList.length}` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Identities Online</div>
              </div>
            </div>

            <div className="bg-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950 flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-sky-500" />
              </div>
              <div>
                <div
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {(policies || []).filter((p) => p.status === "active").length}
                </div>
                <div className="text-xs text-muted-foreground">Active Policies</div>
              </div>
            </div>

            <div className="bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex-shrink-0">
                  <Percent className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-2xl font-bold"
                      style={{ fontFamily: "var(--font-space-grotesk)" }}
                    >
                      {statsVisible ? `${animatedApprovalRate}%` : "—"}
                    </span>
                    {approvalDelta !== 0 && (
                      <span
                        className={`flex items-center text-[11px] font-medium ${
                          approvalDelta > 0
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
                      >
                        {approvalDelta > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-0.5" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-0.5" />
                        )}
                        {approvalDelta > 0 ? "+" : ""}
                        {approvalDelta}%
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Approval Rate</div>
                </div>
              </div>
              <ApprovalSparkline logs={Array.isArray(logs) ? logs : []} />
            </div>

            <div className="bg-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 flex-shrink-0">
                <FileSearch className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                  >
                    {statsVisible ? animatedDecisions : "—"}
                  </span>
                  {decisionsDelta !== 0 && (
                    <span
                      className={`flex items-center text-[11px] font-medium ${
                        decisionsDelta > 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {decisionsDelta > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-0.5" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-0.5" />
                      )}
                      {decisionsDelta > 0 ? "+" : ""}
                      {decisionsDelta}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Policy Decisions</div>
              </div>
            </div>

            <div className="bg-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950 flex-shrink-0">
                <ShieldX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <div
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {statsVisible ? animatedBlocked : "—"}
                </div>
                <div className="text-xs text-muted-foreground">Blocked</div>
              </div>
            </div>

            <div className="bg-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950 flex-shrink-0">
                <Clock className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div
                  className="text-2xl font-bold"
                  style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                  {avgLatency}ms
                </div>
                <div className="text-xs text-muted-foreground">Avg Latency</div>
              </div>
            </div>

            <AiSpendCard />
            <ControlScoreCard />
          </div>
        )}
      </div>

      {/* On-chain proof strip — threads the differentiator; real data only */}
      {onChainProofCount > 0 && (
        <button
          type="button"
          onClick={() => router.push("/audit")}
          className="w-full flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-left hover:border-sky-500/40 transition-colors"
        >
          <ShieldCheck className="h-4 w-4 text-sky-500 shrink-0" />
          <span className="text-sm text-foreground/80">
            <span className="font-semibold text-foreground">
              {onChainProofCount} decision{onChainProofCount === 1 ? "" : "s"}
            </span>{" "}
            recorded on-chain via GovernanceContract — anchored on X Layer, with
            the same contracts live on Arbitrum + Robinhood.
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        </button>
      )}

      {/* Charts Row — hidden in focus mode */}
      {!focusMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DecisionChart
            logs={Array.isArray(logs) ? logs : []}
            loading={logsLoading}
            activeFilter={decisionFilter}
            onFilterChange={setDecisionFilter}
          />
          <ActivityChart
            logs={Array.isArray(logs) ? logs : []}
            loading={logsLoading}
          />
          <AgentStatusChart agents={agentList} loading={agentsLoading} />
        </div>
      )}

      {/* Quick Check */}
      <QuickCheck />

      {/* Governed Identities — hidden in focus mode */}
      {!focusMode && <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Governed Identities</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/agents")}
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        {agentsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-card p-4 rounded-xl border">
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : agentsError ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>Failed to load agents</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.refresh()}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
            {agentList.map((agent) => (
              <div
                key={agent.id}
                className="bg-card p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/agents/${agent.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/agents/${agent.id}`)}
              >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${agent.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`}
                        aria-label={agent.status === "active" ? "Active" : "Inactive"}
                      />
                      <span className="font-medium text-sm">{agent.name}</span>
                    </div>
                    <Badge
                      variant={
                        agent.status === "active" ? "secondary" : "outline"
                      }
                      className="text-xs"
                    >
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{agent.trades} actions</span>
                    <span className="font-medium">{formatBudget(agent.budget)}</span>
                  </div>
              </div>
            ))}
          </div>
        )}
      </div>}

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Recent Activity</h2>
            {decisionFilter && (
              <Badge variant="secondary" className="text-xs capitalize">
                {decisionFilter} only
              </Badge>
            )}
            {filteredActivity.length !== activity.length && (
              <span className="text-xs text-muted-foreground">
                {filteredActivity.length} of {activity.length}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/audit")}
          >
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
        ) : filteredActivity.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground border rounded-xl">
            <p>
              {decisionFilter
                ? `No ${decisionFilter} decisions`
                : "No activity yet"}
            </p>
            {decisionFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setDecisionFilter(null)}
              >
                Clear filter
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border divide-y divide-border">
            {visibleActivity.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors gap-2 sm:gap-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-md flex-shrink-0 ${
                      item.status === "approved"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600"
                        : item.status === "denied"
                          ? "bg-red-100 dark:bg-red-950 text-red-600"
                          : "bg-blue-100 dark:bg-blue-950 text-blue-600"
                    }`}
                    aria-label={`Decision: ${item.status}`}
                  >
                    {item.status === "approved" ? (
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : item.status === "denied" ? (
                      <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.agent}</div>
                    <div className="text-muted-foreground text-xs truncate">
                      {item.action}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 sm:ml-4 pl-8 sm:pl-0">
                  <span className="font-mono text-xs">{item.amount}</span>
                  <Badge
                    variant={
                      item.status === "approved"
                        ? "secondary"
                        : item.status === "denied"
                          ? "destructive"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </div>
              </div>
            ))}
            {filteredActivity.length > ACTIVITY_PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setActivityExpanded(!activityExpanded)}
                className="w-full p-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${activityExpanded ? "rotate-180" : ""}`}
                />
                {activityExpanded
                  ? "Show less"
                  : `Show ${filteredActivity.length - ACTIVITY_PAGE_SIZE} more`}
              </button>
            )}
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
          <div className="text-xs text-muted-foreground mt-1">
            Test policies live
          </div>
        </button>
        <button
          onClick={() => router.push("/integrate")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Rocket className="h-5 w-5 text-violet-500 mb-2" />
          <div className="font-medium text-sm">Connect your system</div>
          <div className="text-xs text-muted-foreground mt-1">
            Get an API key + quickstart
          </div>
        </button>
        <button
          onClick={() => router.push("/agents/workshop")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <Sparkles className="h-5 w-5 text-sky-500 mb-2" />
          <div className="font-medium text-sm">Create API Identity</div>
          <div className="text-xs text-muted-foreground mt-1">
            Create a governed API slot
          </div>
        </button>
        <button
          onClick={() => router.push("/audit")}
          className="p-4 rounded-xl border border-border bg-card hover:border-sky-200 hover:bg-muted/50 transition-all text-left"
        >
          <FileSearch className="h-5 w-5 text-amber-500 mb-2" />
          <div className="font-medium text-sm">Audit Trail</div>
          <div className="text-xs text-muted-foreground mt-1">
            Review all decisions
          </div>
        </button>
      </div>
    </div>
  );
}
