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
        { name: "security", count: 24, avgInterest: 0.74, maxInterest: 0.92 },
        { name: "compliance", count: 18, avgInterest: 0.68, maxInterest: 0.85 },
        { name: "market", count: 31, avgInterest: 0.82, maxInterest: 0.97 },
        { name: "operations", count: 12, avgInterest: 0.55, maxInterest: 0.71 },
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
          question: { text: "Is the Audius protocol vulnerable to a sybil attack on its staking mechanism?", category: "security", interest_score: 0.88 },
          routing: { subnet_id: "subnet-1", miner_slug: "miner-alpha" },
        },
        {
          id: "q-2",
          source: "eigen8",
          status: "unread",
          created_at: new Date().toISOString(),
          question: { text: "What is the current regulatory stance on AI-generated content disclosure in the EU AI Act?", category: "compliance", interest_score: 0.76 },
          routing: { subnet_id: "subnet-2", miner_slug: "miner-beta" },
        },
      ],
      count: 2,
    },
  );
}
