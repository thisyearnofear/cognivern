import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { apiClient } from "@/lib/api-client";
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
  const demoMode = useDemoStore((s) => s.demoMode);
  const isConnected = useAuthStore((s) => s.isConnected);
  const effectiveKey = demoMode || !isConnected ? null : key;

  const swr = useSWR(effectiveKey, fetcher, { ...SWR_DEFAULTS, ...config });

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
