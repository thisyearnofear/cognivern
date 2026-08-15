import useSWR from 'swr';
import {
  apiClient,
  type CreditProgramSummary,
  type CreditProgramParticipant,
  type CreditProgramReport,
  type CreditProgramFunding,
  type CreditProgramActivity,
  type CreditProgramReconcile,
} from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { SWR_DEFAULTS } from '@/lib/swr-config';

// All keys are nulled when there is no app session so an anonymous shell never
// fires authenticated requests. (These views have no demo data — a sponsor
// dashboard with fabricated participants would be worse than none.)

async function unwrap<T>(
  promise: Promise<{ success: boolean; error?: string; data?: T }>,
): Promise<T> {
  const response = await promise;
  if (!response.success) throw new Error(response.error || 'Request failed');
  return (response.data ?? {}) as T;
}

export function useCreditPrograms() {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR<CreditProgramSummary[]>(
    isConnected ? '/api/credit-programs' : null,
    async () => {
      const res = await apiClient.listCreditPrograms();
      if (!res.success) throw new Error(res.error || 'Failed to load credit programs');
      return res.data?.programs ?? [];
    },
    { ...SWR_DEFAULTS, refreshInterval: 60000 },
  );
}

export function useCreditProgram(programId: string) {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR(
    isConnected ? `/api/credit-programs/${programId}` : null,
    async () => {
      const res = await apiClient.getCreditProgram(programId);
      if (!res.success) throw new Error(res.error || 'Failed to load program');
      return res.data;
    },
    SWR_DEFAULTS,
  );
}

export function useCreditProgramReport(programId: string) {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR<CreditProgramReport>(
    isConnected ? `/api/credit-programs/${programId}/report` : null,
    async () => unwrap(apiClient.getCreditProgramReport(programId)),
    { ...SWR_DEFAULTS, refreshInterval: 30000 },
  );
}

export function useCreditProgramFunding(programId: string) {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR<CreditProgramFunding>(
    isConnected ? `/api/credit-programs/${programId}/funding` : null,
    async () => {
      const res = await apiClient.getCreditProgramFunding(programId);
      if (!res.success) throw new Error(res.error || 'Failed to load funding');
      return res.data?.funding as CreditProgramFunding;
    },
    { ...SWR_DEFAULTS, refreshInterval: 30000 },
  );
}

export function useCreditProgramActivity(programId: string) {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR<CreditProgramActivity>(
    isConnected ? `/api/credit-programs/${programId}/activity?limit=100` : null,
    async () => unwrap(apiClient.getCreditProgramActivity(programId, { limit: 100 })),
    { ...SWR_DEFAULTS, refreshInterval: 30000 },
  );
}

export function useCreditProgramParticipants(programId: string) {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR<CreditProgramParticipant[]>(
    isConnected ? `/api/credit-programs/${programId}/participants` : null,
    async () => {
      const res = await apiClient.listCreditParticipants(programId);
      if (!res.success) throw new Error(res.error || 'Failed to load participants');
      return res.data?.participants ?? [];
    },
    { ...SWR_DEFAULTS, refreshInterval: 30000 },
  );
}

export function useCreditProgramReconcile(programId: string) {
  const isConnected = useAuthStore((s) => s.isConnected);
  return useSWR<CreditProgramReconcile>(
    isConnected ? `/api/credit-programs/${programId}/reconcile` : null,
    async () => unwrap(apiClient.reconcileCreditProgram(programId)),
    SWR_DEFAULTS,
  );
}
