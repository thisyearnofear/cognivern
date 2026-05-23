import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';

export function useAuditLogs() {
  return useSWR('/api/audit/logs', async () => {
    const response = await apiClient.getAuditLogs();
    return response.data || [];
  });
}

export function useAuditInsights() {
  return useSWR('/api/audit/insights', async () => {
    const response = await apiClient.getAuditInsights();
    return response.data;
  });
}

export function useRuns() {
  return useSWR('/api/cre/runs', async () => {
    const response = await apiClient.getRuns();
    return response.data || [];
  });
}

export function useRun(runId: string) {
  return useSWR(runId ? `/api/cre/runs/${runId}` : null, async () => {
    const response = await apiClient.getRun(runId);
    return response.data;
  });
}

export function usePolicies() {
  return useSWR('/api/governance/policies', async () => {
    const response = await apiClient.getPolicies();
    return response.data || [];
  });
}

export function useAgents() {
  return useSWR('/api/agents', async () => {
    const response = await apiClient.getAgents();
    return response.data || [];
  });
}

export function useAgent(agentId: string) {
  return useSWR(agentId ? `/api/agents/${agentId}` : null, async () => {
    const response = await apiClient.getAgent(agentId);
    return response.data;
  });
}

export function useIntentMetrics() {
  return useSWR('/api/intent/metrics', async () => {
    const response = await apiClient.getIntentMetrics();
    return response.data;
  });
}

export function useWallets() {
  return useSWR('/api/ows/wallets', async () => {
    const response = await apiClient.getWallets();
    return response.data || [];
  });
}
