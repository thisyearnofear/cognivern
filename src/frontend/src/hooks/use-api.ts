import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import type { AuditLog, Run, Policy, Agent } from '@cognivern/shared';

function useDemoFallback<T>(key: string, demoSelector: (state: ReturnType<typeof useAppStore.getState>) => T) {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoData = useAppStore(demoSelector);

  const swr = useSWR(demoMode ? null : key, async () => {
    // This fetcher is never called in demo mode because key is null
    return [] as unknown as T;
  });

  if (demoMode) {
    return { data: demoData, isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function useAuditLogs() {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoLogs = useAppStore((s) => s.demoData.auditLogs);

  const swr = useSWR(demoMode ? null : '/api/audit/logs', async () => {
    const response = await apiClient.getAuditLogs();
    const data = response.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      return (data as Record<string, unknown>).logs || [];
    }
    return data || [];
  });

  if (demoMode) {
    return { data: demoLogs as AuditLog[], isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function useAuditInsights() {
  const demoMode = useAppStore((s) => s.demoMode);

  const swr = useSWR(demoMode ? null : '/api/audit/insights', async () => {
    const response = await apiClient.getAuditInsights();
    return response.data;
  });

  if (demoMode) {
    return {
      data: { compliance: 94, trends: [] },
      isLoading: false,
      error: undefined,
      mutate: async () => ({}),
    };
  }
  return swr;
}

export function useRuns() {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoRuns = useAppStore((s) => s.demoData.runs);

  const swr = useSWR(demoMode ? null : '/api/cre/runs', async () => {
    const response = await apiClient.getRuns();
    return (response as unknown as Record<string, unknown>).runs || response.data || [];
  });

  if (demoMode) {
    return { data: demoRuns as Run[], isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function useRun(runId: string) {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoRuns = useAppStore((s) => s.demoData.runs);

  const swr = useSWR(runId && !demoMode ? `/api/cre/runs/${runId}` : null, async () => {
    const response = await apiClient.getRun(runId);
    return response.data;
  });

  if (demoMode && runId) {
    const run = demoRuns.find((r) => r.id === runId);
    return { data: run, isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function usePolicies() {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoPolicies = useAppStore((s) => s.demoData.policies);

  const swr = useSWR(demoMode ? null : '/api/governance/policies', async () => {
    const response = await apiClient.getPolicies();
    return response.data || [];
  });

  if (demoMode) {
    return { data: demoPolicies as Policy[], isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function useAgents() {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoAgents = useAppStore((s) => s.demoData.agents);

  const swr = useSWR(demoMode ? null : '/api/agents', async () => {
    const response = await apiClient.getAgents();
    return response.data || [];
  });

  if (demoMode) {
    return { data: demoAgents as Agent[], isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function useAgent(agentId: string) {
  const demoMode = useAppStore((s) => s.demoMode);
  const demoAgents = useAppStore((s) => s.demoData.agents);

  const swr = useSWR(agentId && !demoMode ? `/api/agents/${agentId}` : null, async () => {
    const response = await apiClient.getAgent(agentId);
    return response.data;
  });

  if (demoMode && agentId) {
    const agent = demoAgents.find((a) => a.id === agentId);
    return { data: agent, isLoading: false, error: undefined, mutate: async () => ({}) };
  }
  return swr;
}

export function useIntentMetrics() {
  const demoMode = useAppStore((s) => s.demoMode);

  const swr = useSWR(demoMode ? null : '/api/intent/metrics', async () => {
    const response = await apiClient.getIntentMetrics();
    return response.data;
  });

  if (demoMode) {
    return {
      data: { totalIntents: 12, successRate: 0.92, averageLatency: 120, topActions: [] },
      isLoading: false,
      error: undefined,
      mutate: async () => ({}),
    };
  }
  return swr;
}

export function useWallets() {
  const demoMode = useAppStore((s) => s.demoMode);

  const swr = useSWR(demoMode ? null : '/api/ows/wallets', async () => {
    const response = await apiClient.getWallets();
    return response.data || [];
  });

  if (demoMode) {
    return {
      data: [
        { id: 'w-001', name: 'Demo Hot Wallet', chain: 'Ethereum', address: '0x742d...8fA3', createdAt: new Date().toISOString() },
        { id: 'w-002', name: 'Demo Cold Wallet', chain: 'Arbitrum', address: '0x9a8b...2C4d', createdAt: new Date().toISOString() },
      ],
      isLoading: false,
      error: undefined,
      mutate: async () => ({}),
    };
  }
  return swr;
}
