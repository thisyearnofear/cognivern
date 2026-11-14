import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import {
  apiClient,
  type FundedMandate,
  type SealedBidRound,
  type SealedBidRoundSummary,
  type SealedBidCapabilities,
  type GovernanceTimeline,
  type CreLedgerVerifyResponse,
} from "@/lib/api-client";
import {
  DEMO_SEALED_BID_ROUNDS,
  DEMO_SEALED_BID_ROUND_SUMMARIES,
} from "@/lib/demo-data";
import { useDemoStore } from "@/stores/demo-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  AGENT_SWR_CONFIG,
  AUDIT_SWR_CONFIG,
  POLICY_SWR_CONFIG,
  RUNS_SWR_CONFIG,
  SWR_DEFAULTS,
} from "@/lib/swr-config";
import type {
  AuditLog,
  Run,
  Policy,
  Agent,
  OwsWallet,
} from "@cognivern/shared";

interface SWRResult<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: (data?: T) => Promise<unknown>;
}

export function useNetworkStatus() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    function handleOnline() {
      mutate(() => true);
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [mutate]);
}

function useApiWithDemo<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  demoData: T,
  config?: Record<string, unknown>,
): SWRResult<T> {
  const isConnected = useAuthStore((s) => s.isConnected);
  // Never make authenticated API requests without an app session. This also
  // covers token expiry during rehydration, before the logout transition has
  // rendered; local sample data keeps the shell stable instead of triggering
  // a cascade of 401 responses.
  const effectiveKey = !isConnected ? null : key;

  const swr = useSWR(effectiveKey, fetcher, { ...SWR_DEFAULTS, ...config });

  if (!isConnected) {
    return {
      data: demoData,
      isLoading: false,
      error: undefined,
      mutate: async () => demoData,
    };
  }
  return swr as SWRResult<T>;
}

/* ── Audit ── */

export function useAuditLogs() {
  const demoLogs = useDemoStore((s) => s.demoData.auditLogs);
  return useApiWithDemo<AuditLog[]>(
    "/api/audit/logs",
    async () => {
      const response = await apiClient.getAuditLogs();
      const data = response.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return ((data as Record<string, unknown>).logs || []) as AuditLog[];
      }
      return (data || []) as AuditLog[];
    },
    demoLogs,
    AUDIT_SWR_CONFIG,
  );
}

export function useAuditInsights() {
  return useApiWithDemo(
    "/api/audit/insights",
    async () => (await apiClient.getAuditInsights()).data,
    { compliance: 94, trends: [] },
  );
}

/* ── Runs ── */

export function useRuns() {
  const demoRuns = useDemoStore((s) => s.demoData.runs);
  return useApiWithDemo<Run[]>(
    "/api/cre/runs",
    async () => {
      const response = await apiClient.getRuns();
      return ((response as unknown as Record<string, unknown>).runs ||
        response.data ||
        []) as Run[];
    },
    demoRuns,
    RUNS_SWR_CONFIG,
  );
}

export function useRun(runId: string) {
  const demoRuns = useDemoStore((s) => s.demoData.runs);
  const demoData = demoRuns.find((r) => r.id === runId);
  return useApiWithDemo<Run | undefined>(
    runId ? `/api/cre/runs/${runId}` : null,
    async () => (await apiClient.getRun(runId)).data as Run,
    demoData,
  );
}

export function useLedgerIntegrity() {
  // Verification requires auth; gate on the token so we don't fetch (and get
  // 401 → logout) when signed out. This is the cheap non-deep check only.
  const token = useAuthStore((s) => s.token);
  return useSWR<CreLedgerVerifyResponse | undefined>(
    token ? "/api/cre/ledger/verify" : null,
    async () => (await apiClient.verifyLedger(false)).data,
    { ...SWR_DEFAULTS, ...RUNS_SWR_CONFIG },
  ) as SWRResult<CreLedgerVerifyResponse | undefined>;
}

/* ── Governance ── */

export function usePolicies() {
  const demoPolicies = useDemoStore((s) => s.demoData.policies);
  return useApiWithDemo<Policy[]>(
    "/api/governance/policies",
    async () => ((await apiClient.getPolicies()).data || []) as Policy[],
    demoPolicies,
    POLICY_SWR_CONFIG,
  );
}

/* ── Agents ── */

export function useAgents() {
  const demoAgents = useDemoStore((s) => s.demoData.agents);
  return useApiWithDemo<Agent[]>(
    "/api/agents",
    async () => ((await apiClient.getAgents()).data || []) as Agent[],
    demoAgents,
    AGENT_SWR_CONFIG,
  );
}

export function useAgent(agentId: string) {
  const demoAgents = useDemoStore((s) => s.demoData.agents);
  const demoData = demoAgents.find((a) => a.id === agentId);
  return useApiWithDemo<Agent | undefined>(
    agentId ? `/api/agents/${agentId}` : null,
    async () => (await apiClient.getAgent(agentId)).data as Agent,
    demoData,
  );
}

/* ── Funded mandates ── */

export function useMandates() {
  return useApiWithDemo<FundedMandate[]>(
    "/api/mandates",
    async () => ((await apiClient.getMandates()).data || []) as FundedMandate[],
    [],
  );
}

/* ── Intent / OWS ── */

export function useIntentMetrics() {
  return useApiWithDemo(
    "/api/intent/metrics",
    async () => (await apiClient.getIntentMetrics()).data,
    {
      totalIntents: 12,
      successRate: 0.92,
      averageLatency: 120,
      topActions: [],
    },
  );
}

/* ── Sealed-bid vendor selection ── */

export function useSealedBidCapabilities() {
  return useApiWithDemo<SealedBidCapabilities>(
    "/api/vendor/sealed-bid/capabilities",
    async () => {
      const response = await apiClient.getSealedBidCapabilities();
      return response.data as SealedBidCapabilities;
    },
    {
      workspaceMode: "sandbox",
      backend: "canton",
      backendConfigured: false,
      settlementSupported: false,
      settlementReason: "Demo workspace — no funds are reserved.",
    },
  );
}

/**
 * Canton party for the signed-in wallet. Pass `enabled=false` until SIWE has
 * completed; the endpoint answers 401 for anonymous callers.
 */
export function useCantonIdentity(enabled: boolean) {
  return useSWR(
    enabled ? "/api/vendor/sealed-bid/canton-identity" : null,
    async () => (await apiClient.getCantonIdentity()).data ?? null,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
}

export function useSealedBidRounds() {
  return useApiWithDemo<SealedBidRoundSummary[]>(
    "/api/vendor/sealed-bid/rounds",
    async () =>
      ((await apiClient.getSealedBidRounds()).data ||
        []) as SealedBidRoundSummary[],
    DEMO_SEALED_BID_ROUND_SUMMARIES,
  );
}

export function useSealedBidRound(roundId: string | null) {
  return useApiWithDemo<SealedBidRound | null>(
    roundId ? `/api/vendor/sealed-bid/rounds/${roundId}` : null,
    async () => {
      if (!roundId) return null;
      const res = await apiClient.getSealedBidRound(roundId);
      return (res.data ?? null) as SealedBidRound | null;
    },
    // Fallback for demo mode: find the round in the demo collection.
    roundId
      ? (DEMO_SEALED_BID_ROUNDS.find((r) => r.roundId === roundId) ?? null)
      : null,
  );
}

// Fetch the tamper-evident governance timeline for an agent-governed round.
// Pass `null` for roundId or a round without governanceRunId to skip the
// fetch (SWR null-key pattern). Returns { data, isLoading, error } where
// data is undefined for non-agent-governed rounds.
export function useGovernanceTimeline(
  roundId: string | null,
  governanceRunId?: string | null,
) {
  return useApiWithDemo<GovernanceTimeline | null>(
    roundId && governanceRunId
      ? `/api/vendor/sealed-bid/rounds/${roundId}/governance-timeline`
      : null,
    async () => {
      if (!roundId) return null;
      const res = await apiClient.getGovernanceTimeline(roundId);
      // 404 for non-agent-governed rounds — treat as no timeline.
      if (!res.success) return null;
      return (res.data ?? null) as GovernanceTimeline | null;
    },
    null,
  );
}

export function useWallets() {
  return useApiWithDemo<OwsWallet[]>(
    "/api/ows/wallets",
    async () =>
      ((await apiClient.getWallets()).data || []) as unknown as OwsWallet[],
    [
      {
        id: "w-001",
        name: "Demo Hot Wallet",
        chain: "Ethereum",
        address: "0x742d...8fA3",
        createdAt: new Date().toISOString(),
      },
      {
        id: "w-002",
        name: "Demo Cold Wallet",
        chain: "Arbitrum",
        address: "0x9a8b...2C4d",
        createdAt: new Date().toISOString(),
      },
    ],
  );
}

/* ── Telegraph / Verified Intelligence Signals ── */

export function useTelegraphStatus() {
  return useApiWithDemo(
    "/api/telegraph/status",
    async () => (await apiClient.getTelegraphStatus()).data,
    {
      enabled: true,
      healthy: true,
      nodeUrl: "http://localhost:7044",
      engineUrl: "http://localhost:7044/engine",
      daemonUrl: "http://localhost:7044/daemon",
      minersAvailable: 129,
      lastRefresh: new Date().toISOString(),
      confidenceThreshold: 0.35,
      network: "base-sepolia",
      paymentReady: true,
      paymentError: null,
      daemon: { healthy: true, status: "ok", time: new Date().toISOString() },
    },
  );
}

export function useTelegraphCategories() {
  return useApiWithDemo(
    "/api/telegraph/daemon/categories",
    async () => (await apiClient.getTelegraphDaemonCategories()).data,
    {
      categories: ["security", "compliance", "market", "operations"],
      stats: [
        { name: "security", count: 24, avgInterest: 7.4, maxInterest: 9.2 },
        { name: "compliance", count: 18, avgInterest: 6.8, maxInterest: 8.5 },
        { name: "market", count: 31, avgInterest: 8.2, maxInterest: 9.7 },
        { name: "operations", count: 12, avgInterest: 5.5, maxInterest: 7.1 },
      ],
      count: 4,
    },
  );
}

export function useTelegraphQuestions(params: {
  category?: string;
  source?: string;
  sort?: string;
  since_hours?: number;
  min_interest?: number;
  limit?: number;
} = {}) {
  const key = `/api/telegraph/daemon/questions?${JSON.stringify(params)}`;
  return useApiWithDemo(
    key,
    async () => (await apiClient.getTelegraphDaemonQuestions(params)).data,
    {
      questions: [
        {
          id: "q-1",
          source: "eigen8",
          status: "unread",
          created_at: new Date().toISOString(),
          question: { text: "Is the Audius protocol vulnerable to a sybil attack on its staking mechanism?", category: "security", interest_score: 8.8 },
          routing: { subnet_id: "subnet-1", miner_slug: "miner-alpha" },
        },
        {
          id: "q-2",
          source: "eigen8",
          status: "unread",
          created_at: new Date().toISOString(),
          question: { text: "What is the current regulatory stance on AI-generated content disclosure in the EU AI Act?", category: "compliance", interest_score: 7.6 },
          routing: { subnet_id: "subnet-2", miner_slug: "miner-beta" },
        },
      ],
      count: 2,
    },
  );
}

export function useTelegraphStats() {
  return useApiWithDemo(
    "/api/telegraph/stats",
    async () => (await apiClient.getTelegraphStats()).data,
    {
      available: true,
      totalCalls: 0,
      approved: 0,
      held: 0,
      failed: 0,
      totalSpendUsd: 0,
      lastRun: null,
      calls: [],
    },
  );
}

export function useTelegraphLedger() {
  // Fixed timestamps: demo data must stay render-pure (no Date.now() in render).
  const iso = (minsAgo: number) =>
    new Date(Date.UTC(2026, 10, 14, 12, 0) - minsAgo * 60_000).toISOString();
  return useApiWithDemo(
    "/api/telegraph/ledger",
    async () => (await apiClient.getTelegraphLedger()).data,
    {
      generatedAt: "2026-11-14T12:00:00.000Z",
      totals: {
        calls: 7,
        paidCalls: 5,
        spendUsd: 0.05,
        approved: 2,
        heldPending: 2,
        released: 1,
        quarantined: 0,
        blocked: 2,
        failed: 0,
      },
      byIntent: [
        { intent: "SANCTIONS_SCREENING_MATCH", calls: 2, spendUsd: 0.02, approved: 2, held: 0, failed: 0 },
        { intent: "GAS_PRICE", calls: 1, spendUsd: 0.01, approved: 1, held: 0, failed: 0 },
        { intent: "LLM_OUTPUT_EVALUATION", calls: 1, spendUsd: 0.01, approved: 0, held: 1, failed: 0 },
        { intent: "FACT_CHECK", calls: 2, spendUsd: 0.01, approved: 0, held: 1, failed: 0 },
        { intent: "CHAT_COMPLETION", calls: 1, spendUsd: 0.01, approved: 0, held: 0, failed: 0 },
      ],
      byMiner: [
        { minerId: "710637", minerName: "Sanctions Name Evidence", calls: 1, spendUsd: 0.01, avgConfidence: 0.95 },
        { minerId: "9002", minerName: "TxLens", calls: 1, spendUsd: 0.01, avgConfidence: 1 },
        { minerId: "7441", minerName: "AssistWire LLM Output Evaluation", calls: 1, spendUsd: 0.01, avgConfidence: 0.95 },
        { minerId: "901", minerName: "Telegraph Groq LPU Miner", calls: 1, spendUsd: 0.01, avgConfidence: 0.5 },
        { minerId: "717190", minerName: "Qarinah ProofPack", calls: 2, spendUsd: 0.01, avgConfidence: 0.44 },
        { minerId: "compliance-gate", minerName: "compliance gate", calls: 2, spendUsd: 0, avgConfidence: null },
      ],
      byMandate: [
        { mandateId: "mission-02-stablecoin", calls: 3, spendUsd: 0.02 },
        { mandateId: "mission-10-model-economy", calls: 1, spendUsd: 0.01 },
        { mandateId: "unscoped", calls: 3, spendUsd: 0.02 },
      ],
      records: [
        {
          runId: "demo-bb8cfa02", timestamp: iso(12), agentId: "ops-demo",
          mandateId: "mission-02-stablecoin", minerId: "9002", minerName: "TxLens",
          intent: "GAS_PRICE", confidence: 1, confidenceMet: true, costUsd: 0.01,
          paid: true, paymentNetwork: "eip155:*", latencyMs: 2558,
          disposition: "approved", complianceVerdict: "clear",
          complianceRunId: "demo-793b6d40",
        },
        {
          runId: "demo-793b6d40", timestamp: iso(13), agentId: "ops-demo",
          mandateId: "mission-02-stablecoin", minerId: "710637", minerName: "Sanctions Name Evidence",
          intent: "SANCTIONS_SCREENING_MATCH", confidence: 0.95, confidenceMet: true,
          costUsd: 0.01, paid: true, paymentNetwork: "eip155:*", latencyMs: 1900,
          disposition: "approved",
        },
        {
          runId: "demo-gate-01", timestamp: iso(40), agentId: "ops-demo",
          mandateId: "mission-02-stablecoin", minerName: "compliance gate",
          confidence: null, confidenceMet: null, costUsd: 0, paid: false,
          disposition: "blocked", gateBlocked: true, complianceVerdict: "hit",
        },
        {
          runId: "demo-eval-01", timestamp: iso(90), agentId: "verifier:prog-demo",
          mandateId: "mission-10-model-economy", minerId: "7441",
          minerName: "AssistWire LLM Output Evaluation", intent: "LLM_OUTPUT_EVALUATION",
          confidence: 0.95, confidenceMet: true, costUsd: 0.01, paid: true,
          paymentNetwork: "eip155:*", latencyMs: 3200,
          disposition: "held_pending", approvalState: "pending",
        },
        {
          runId: "demo-chat-01", timestamp: iso(180), agentId: "telegraph-digest",
          minerId: "901", minerName: "Telegraph Groq LPU Miner",
          intent: "CHAT_COMPLETION", confidence: 0.5, confidenceMet: false,
          costUsd: 0.01, paid: true, paymentNetwork: "eip155:*",
          disposition: "released", approvalState: "approved",
        },
        {
          runId: "demo-fact-01", timestamp: iso(240), agentId: "telegraph-digest",
          minerId: "717190", minerName: "Qarinah ProofPack",
          intent: "FACT_CHECK", confidence: 0.44, confidenceMet: false,
          costUsd: 0.01, paid: true, paymentNetwork: "eip155:*",
          disposition: "held_pending", approvalState: "pending",
        },
        {
          runId: "demo-fact-02", timestamp: iso(300), agentId: "telegraph-digest",
          minerId: "717190", minerName: "Qarinah ProofPack",
          intent: "FACT_CHECK", confidence: 0.44, confidenceMet: false,
          costUsd: 0, paid: false,
          disposition: "blocked", gateBlocked: true, complianceVerdict: "unknown",
        },
      ],
    },
  );
}
