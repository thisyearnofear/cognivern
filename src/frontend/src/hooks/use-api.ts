import useSWR from "swr";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/stores/app-store";
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

function useApiWithDemo<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  demoData: T,
): SWRResult<T> {
  const demoMode = useAppStore((s) => s.demoMode);
  const effectiveKey = demoMode ? null : key;

  const swr = useSWR(effectiveKey, fetcher);

  if (demoMode) {
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
  const demoLogs = useAppStore((s) => s.demoData.auditLogs);
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
  const demoRuns = useAppStore((s) => s.demoData.runs);
  return useApiWithDemo<Run[]>(
    "/api/cre/runs",
    async () => {
      const response = await apiClient.getRuns();
      return ((response as unknown as Record<string, unknown>).runs ||
        response.data ||
        []) as Run[];
    },
    demoRuns,
  );
}

export function useRun(runId: string) {
  const demoRuns = useAppStore((s) => s.demoData.runs);
  const demoData = demoRuns.find((r) => r.id === runId);
  return useApiWithDemo<Run | undefined>(
    runId ? `/api/cre/runs/${runId}` : null,
    async () => (await apiClient.getRun(runId)).data as Run,
    demoData,
  );
}

/* ── Governance ── */

export function usePolicies() {
  const demoPolicies = useAppStore((s) => s.demoData.policies);
  return useApiWithDemo<Policy[]>(
    "/api/governance/policies",
    async () => ((await apiClient.getPolicies()).data || []) as Policy[],
    demoPolicies,
  );
}

/* ── Agents ── */

export function useAgents() {
  const demoAgents = useAppStore((s) => s.demoData.agents);
  return useApiWithDemo<Agent[]>(
    "/api/agents",
    async () => ((await apiClient.getAgents()).data || []) as Agent[],
    demoAgents,
  );
}

export function useAgent(agentId: string) {
  const demoAgents = useAppStore((s) => s.demoData.agents);
  const demoData = demoAgents.find((a) => a.id === agentId);
  return useApiWithDemo<Agent | undefined>(
    agentId ? `/api/agents/${agentId}` : null,
    async () => (await apiClient.getAgent(agentId)).data as Agent,
    demoData,
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
