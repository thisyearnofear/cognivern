'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/auth-fetch';

/**
 * Average control score (suspicion dimension) across scored decisions.
 * Renders only when the backend actually supplied the suspicion shape —
 * demo-tier responses can come back as {compliance, trends} with neither
 * totalScored nor averageScore populated, and rendering then would crash at
 * `data.averageScore.toFixed(2)`.
 */
export function ControlScoreCard() {
  const [data, setData] = useState<{
    totalScored: number;
    averageScore: number;
    escalationRate: number;
    distribution: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/audit/insights?dimension=suspicion')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json?.success) setData(json.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-card p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950 flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
    );
  }

  if (!data || typeof data.averageScore !== 'number' || !data.totalScored) {
    return null;
  }

  return (
    <div className="bg-card p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950 flex-shrink-0">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          {data.averageScore.toFixed(2)}
        </div>
        <div className="text-xs text-muted-foreground">
          Control Score ({data.escalationRate}% escalated)
        </div>
      </div>
    </div>
  );
}
