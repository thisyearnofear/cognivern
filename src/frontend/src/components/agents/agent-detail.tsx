"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Volume2,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Brain,
  RotateCcw,
  Eye,
  Sparkles,
  Code2,
  Copy,
  Check,
} from "lucide-react";
import { useAgent, usePolicies } from "@/hooks/use-api";
import { apiClient } from "@/lib/api-client";
import { authFetch } from "@/lib/auth-fetch";
import { mutate } from "swr";

function Breadcrumbs({ agentName }: { agentName: string }) {
  const router = useRouter();
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <button
        onClick={() => router.push("/dashboard")}
        className="hover:text-foreground transition-colors"
      >
        Dashboard
      </button>
      <ChevronRight className="h-3 w-3" />
      <button
        onClick={() => router.push("/agents")}
        className="hover:text-foreground transition-colors"
      >
        Identities
      </button>
      <ChevronRight className="h-3 w-3" />
      <span className="text-foreground font-medium">{agentName}</span>
    </nav>
  );
}

interface AgentPreferences {
  agentId: string;
  style: "conservative" | "aggressive" | "balanced";
  preferredModels: string[];
  preferredChains: string[];
  riskTolerance: number;
  customRules: Array<{ condition: string; action: string }>;
  learnedAt: string;
}

function AgentPersonalityCard({ agentId }: { agentId: string }) {
  const [prefs, setPrefs] = useState<AgentPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/agents/${agentId}/preferences`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setPrefs(json.data || null);
      })
      .catch(() => {
        if (!cancelled) setPrefs(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [agentId]);

  const handleReset = useCallback(async () => {
    setResetting(true);
    try {
      await authFetch(`/api/agents/${agentId}/preferences`, { method: "DELETE" });
      setPrefs(null);
      mutate(`/api/agents/${agentId}`);
    } finally {
      setResetting(false);
    }
  }, [agentId]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-40 mb-3" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!prefs) return null;

  const styleColors = {
    conservative: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
    balanced: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
    aggressive: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300",
  };

  const tolerancePercent = Math.round(prefs.riskTolerance * 100);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-violet-500" />
          Agent Profile
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={resetting}
          className="h-7 text-xs gap-1.5"
        >
          <RotateCcw className={`h-3 w-3 ${resetting ? "animate-spin" : ""}`} />
          Reset
        </Button>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Style</div>
          <Badge className={`${styleColors[prefs.style]} border-0 capitalize`}>
            {prefs.style}
          </Badge>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Risk Tolerance</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  tolerancePercent < 40
                    ? "bg-blue-500"
                    : tolerancePercent < 70
                      ? "bg-emerald-500"
                      : "bg-orange-500"
                }`}
                style={{ width: `${tolerancePercent}%` }}
              />
            </div>
            <span className="text-xs font-mono tabular-nums w-8 text-right">
              {tolerancePercent}%
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Learned</div>
          <div className="text-xs text-muted-foreground">
            {new Date(prefs.learnedAt).toLocaleDateString()}
          </div>
        </div>
        {prefs.preferredChains.length > 0 && (
          <div className="sm:col-span-1">
            <div className="text-xs text-muted-foreground mb-1.5">Preferred Chains</div>
            <div className="flex flex-wrap gap-1">
              {prefs.preferredChains.map((chain) => (
                <Badge key={chain} variant="outline" className="text-[10px]">
                  {chain}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {prefs.preferredModels.length > 0 && (
          <div className="sm:col-span-2">
            <div className="text-xs text-muted-foreground mb-1.5">Preferred Models</div>
            <div className="flex flex-wrap gap-1">
              {prefs.preferredModels.map((model) => (
                <Badge key={model} variant="outline" className="text-[10px] font-mono">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { data: agent, isLoading, error } = useAgent(agentId);
  const { data: policies } = usePolicies();
  const [toggling, setToggling] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<Array<{
    id: string;
    agentId: string;
    action: string;
    amount?: number;
    timestamp: string;
    reason?: string;
  }>>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // First-spend onboarding state. When the agent has no spend history yet,
  // we surface a code snippet alongside the "test in governance check"
  // button. `snippetTab` tracks curl vs JS; `snippetCopied` flashes "Copied".
  const [snippetTab, setSnippetTab] = useState<"curl" | "js">("curl");
  const [snippetCopied, setSnippetCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchHeld = async () => {
      try {
        const res = await authFetch(`/api/audit/logs?outcome=held&agent=${agentId}`);
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data?.logs)) {
          setPendingApprovals(
            json.data.logs.map((log: Record<string, unknown>) => ({
              id: log.id || log.runId || String(Math.random()),
              agentId: log.agentId || agentId,
              action: log.action || log.actionType || "spend",
              amount: typeof log.amount === "number" ? log.amount : undefined,
              timestamp: log.timestamp || log.createdAt || new Date().toISOString(),
              reason: typeof log.reason === "string" ? log.reason : undefined,
            })),
          );
        }
      } catch {
        // ignore
      }
    };
    fetchHeld();
    const interval = setInterval(fetchHeld, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [agentId]);

  const handleConfirmTrade = useCallback(async (decisionId: string, action: "confirm" | "reject") => {
    setConfirmingId(decisionId);
    try {
      const res = await authFetch(`/api/spend/${decisionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        setPendingApprovals((prev) => prev.filter((a) => a.id !== decisionId));
        mutate(`/api/agents/${agentId}`);
        mutate("/api/audit/logs");
      }
    } finally {
      setConfirmingId(null);
    }
  }, [agentId]);

  const linkedPolicy = useMemo(() => {
    if (!agent || !Array.isArray(policies)) return null;
    return policies.find(
      (p) => p.agents > 0 && p.status === "active",
    ) || null;
  }, [agent, policies]);

  const spendChartData = useMemo(() => {
    if (!agent?.spendHistory?.length) return [];
    return agent.spendHistory
      .slice()
      .reverse()
      .map((tx) => ({
        amount: tx.amount,
        approved: tx.decision === "approved",
      }));
  }, [agent]);

  const totalSpend = useMemo(() => {
    if (!agent?.spendHistory?.length) return 0;
    // tx.amount can be undefined for partial records — guard so the reduce
    // doesn't produce NaN, which renders as "NaN USDC" in the header.
    return agent.spendHistory
      .filter((tx) => tx.decision === "approved")
      .reduce(
        (sum, tx) => sum + (typeof tx.amount === "number" ? tx.amount : 0),
        0,
      );
  }, [agent]);

  const handleSpeak = useCallback(() => {
    if (!agent) return;
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    const text = [
      `Agent ${agent.name}, ${agent.role}. Status: ${agent.status}.`,
      `${agent.trades} actions taken. Budget: ${agent.budget}. Chain: ${agent.chain}.`,
    ].join(" ");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    window.speechSynthesis?.cancel();
    window.speechSynthesis?.speak(utterance);
    setSpeaking(true);
  }, [agent, speaking]);

  const handleToggleStatus = useCallback(async () => {
    if (!agent) return;
    setToggling(true);
    try {
      const newStatus = agent.status === "active" ? "paused" : "active";
      await apiClient.updateAgentStatus(agentId, newStatus);
      mutate(`/api/agents/${agentId}`);
      mutate("/api/agents");
    } finally {
      setToggling(false);
    }
  }, [agent, agentId]);

  const handleRevoke = useCallback(async () => {
    if (!agent) return;
    await apiClient.updateAgentStatus(agentId, "inactive");
    mutate(`/api/agents/${agentId}`);
    mutate("/api/agents");
    router.push("/agents");
  }, [agent, agentId, router]);

  if (isLoading) {
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/agents")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to API Identities
        </Button>
        <div className="rounded-xl border bg-card">
          <div className="p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Identity not found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {error ? error.message : "The agent could not be loaded."}
            </p>
            <Button onClick={() => router.push("/agents")}>
              Back to API Identities
            </Button>
          </div>
        </div>
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
            <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-space-grotesk)" }}>{agent.name}</h1>
            <p className="text-sm text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={speaking ? "default" : "outline"}
            size="sm"
            onClick={handleSpeak}
            className={speaking ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <Volume2 className="h-4 w-4" />{" "}
            {speaking ? "Speaking..." : "Listen"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/policies")}
          >
            <ShieldCheck className="h-4 w-4" /> View Policy
          </Button>
          <Button
            variant={agent.status === "active" ? "outline" : "default"}
            size="sm"
            onClick={handleToggleStatus}
            disabled={toggling || agent.status === "inactive"}
          >
            {agent.status === "active" ? (
              <>
                <Pause className="h-4 w-4" />{" "}
                {toggling ? "Pausing..." : "Pause"}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />{" "}
                {toggling ? "Resuming..." : "Resume"}
              </>
            )}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRevoke}
            disabled={agent.status === "inactive"}
          >
            <Trash2 className="h-4 w-4" /> Revoke
          </Button>
        </div>
      </div>

      {/* Agent type info box */}
      {agent.source === "demo" ? (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/30 p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900 flex-shrink-0">
            <Eye className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-violet-800 dark:text-violet-200">Showcase Agent (Demo)</div>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              This is a demo agent showing what Cognivern can govern. It&apos;s not configurable and doesn&apos;t represent a real external system. Create your own API identity to govern your systems.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/30 p-4 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900 flex-shrink-0">
            <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-sky-800 dark:text-sky-200">Governed API Identity</div>
            <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
              External systems authenticated with this identity&apos;s API key are governed by your Cognivern policies. Give your API key (from Settings) to your external system — it calls Cognivern before every transaction.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden">
        <div className="bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{agent.trades}</div>
              <div className="text-xs text-muted-foreground">
                Total Actions
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950">
              <ShieldCheck className="h-5 w-5 text-sky-500" />
            </div>
            <div>
              <div className="text-lg font-bold">{agent.budget}</div>
              <div className="text-xs text-muted-foreground">
                Budget Limit
              </div>
            </div>
          </div>
        </div>
        <div className="bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950">
              <Clock className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="text-lg font-bold">{agent.chain}</div>
              <div className="text-xs text-muted-foreground">Chain</div>
            </div>
          </div>
        </div>
        <div className="bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <div
                className={`w-3 h-3 rounded-full ${
                  agent.status === "active"
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                }`}
                aria-label={agent.status === "active" ? "Active" : "Inactive"}
              />
            </div>
            <div>
              <div className="text-lg font-bold capitalize">
                {agent.status}
              </div>
              <div className="text-xs text-muted-foreground">Status</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-sm text-amber-800 dark:text-amber-200">
              {pendingApprovals.length} Pending {pendingApprovals.length === 1 ? "Approval" : "Approvals"}
            </span>
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 ml-auto">
              Requires operator action
            </Badge>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-800/50">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    <span className="font-medium text-sm text-foreground capitalize">{approval.action}</span>
                    {approval.amount && (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        ${approval.amount.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  {approval.reason && (
                    <div className="text-xs text-muted-foreground mb-1">{approval.reason}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground/70">
                    {new Date(approval.timestamp).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmTrade(approval.id, "confirm")}
                    disabled={confirmingId === approval.id}
                    className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  >
                    {confirmingId === approval.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Confirm
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfirmTrade(approval.id, "reject")}
                    disabled={confirmingId === approval.id}
                    className="h-8 text-xs gap-1.5 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    {confirmingId === approval.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spend Chart + Policy Link */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
        <div className="bg-card p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Spend Trend
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Total approved: {totalSpend.toLocaleString()} USDC
              </div>
            </div>
            {spendChartData.length > 0 ? (
              <div className="flex items-end gap-1 h-24">
                {spendChartData.map((d, i) => {
                  const max = Math.max(
                    ...spendChartData.map((x) => x.amount),
                    1,
                  );
                  const height = Math.max(8, (d.amount / max) * 100);
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          d.approved
                            ? "bg-emerald-400 dark:bg-emerald-600"
                            : "bg-red-400 dark:bg-red-600"
                        }`}
                        style={{ height: `${height}%` }}
                        title={`${d.amount} — ${d.approved ? "approved" : "denied"}`}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                No spend data yet
              </div>
            )}
        </div>
        <div className="bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              Linked Policy
            </h3>
            {linkedPolicy ? (
              <div className="space-y-2">
                <div className="font-medium text-sm">{linkedPolicy.name}</div>
                <div className="text-xs text-muted-foreground">
                  {linkedPolicy.description || linkedPolicy.type}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {linkedPolicy.type}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {linkedPolicy.status}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/policies")}
                  className="w-full mt-1"
                >
                  View Policy
                </Button>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-2">
                  No active policy linked
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/policies")}
                  className="text-xs"
                >
                  Create Policy
                </Button>
              </div>
            )}
        </div>
      </div>

      {/* Agent Personality Card */}
      <AgentPersonalityCard agentId={agentId} />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ fontFamily: "var(--font-space-grotesk)" }}>Spend History</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/audit")}
          >
            View Audit Log <FileSearch className="h-3.5 w-3.5" />
          </Button>
        </div>

        {agent.spendHistory && agent.spendHistory.length > 0 ? (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
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
                      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
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
            </div>
          </div>
        ) : (
          (() => {
            // First-spend guidance — same pattern as Create Policy / Governance
            // Check: never an empty state; always a click-to-try shortcut and
            // a paste-ready snippet so the user knows what to do next.
            const apiBase =
              typeof window !== "undefined"
                ? window.location.origin
                : "https://your-cognivern-host";
            const curl = `curl -X POST '${apiBase}/api/governance/evaluate' \\
  -H 'Authorization: Bearer YOUR_JWT' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "agentId": "${agent.id}",
    "action": {
      "type": "swap",
      "description": "Swap $50 USDC for ETH",
      "amount": 50,
      "currency": "USDC"
    }
  }'`;
            const js = `// Test your first spend from JavaScript
const res = await fetch('${apiBase}/api/governance/evaluate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + jwt,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    agentId: '${agent.id}',
    action: {
      type: 'swap',
      description: 'Swap $50 USDC for ETH',
      amount: 50,
      currency: 'USDC',
    },
  }),
});
const { data } = await res.json();
// data.decision === "approved" | "held" | "denied"`;
            const snippet = snippetTab === "curl" ? curl : js;
            const copySnippet = async () => {
              try {
                await navigator.clipboard.writeText(snippet);
                setSnippetCopied(true);
                setTimeout(() => setSnippetCopied(false), 1500);
              } catch {
                // clipboard not available — fail silently
              }
            };
            return (
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="p-5 border-b">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-950 shrink-0">
                      <Sparkles className="h-5 w-5 text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">
                        Fire your first spend
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This identity is ready. Test a spend in the
                        Governance Check page, or wire the call directly
                        from your own code.
                      </p>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <Button
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/governance/check?agent=${encodeURIComponent(agent.id)}`,
                            )
                          }
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Test in
                          Governance Check
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push("/policies")}
                        >
                          Attach a policy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">
                        Wire it from your own code
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSnippetTab("curl")}
                        className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                          snippetTab === "curl"
                            ? "bg-background border border-border text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        curl
                      </button>
                      <button
                        type="button"
                        onClick={() => setSnippetTab("js")}
                        className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                          snippetTab === "js"
                            ? "bg-background border border-border text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        JavaScript
                      </button>
                      <button
                        type="button"
                        onClick={copySnippet}
                        className="ml-1 text-[11px] flex items-center gap-1 px-2 py-0.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {snippetCopied ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-500" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <pre className="text-[11px] font-mono bg-background border rounded-md p-3 overflow-x-auto leading-relaxed">
                    <code>{snippet}</code>
                  </pre>
                  <p className="text-[10px] text-muted-foreground">
                    The response carries{" "}
                    <code className="font-mono">data.decision</code> —{" "}
                    <span className="text-emerald-600 dark:text-emerald-400">
                      approved
                    </span>
                    {", "}
                    <span className="text-amber-600 dark:text-amber-400">
                      held
                    </span>
                    {", or "}
                    <span className="text-red-600 dark:text-red-400">
                      denied
                    </span>
                    . Held spends pause until an operator approves them.
                  </p>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
