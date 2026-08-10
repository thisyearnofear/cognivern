'use client';

import useSWR from 'swr';
import { apiClient } from '@/lib/api-client';
import {
  railViewFromFlareStatus,
  type ConfidentialRailView,
  type FlareStatusPayload,
} from '@/lib/confidential-rail';

/**
 * Active confidential-compute rail for product copy.
 * Defaults to Fhenix view until Flare status loads (fail-soft).
 */
export function useConfidentialRail(): {
  view: ConfidentialRailView;
  loading: boolean;
} {
  const { data, isLoading } = useSWR(
    '/api/flare/status',
    async () => {
      const res = await apiClient.getFlareStatus();
      if (!res.success || !res.data) return null;
      return res.data as FlareStatusPayload;
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  return {
    view: railViewFromFlareStatus(data),
    loading: isLoading,
  };
}
