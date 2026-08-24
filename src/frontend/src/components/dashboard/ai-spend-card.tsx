'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { authFetch } from '@/lib/auth-fetch';

/**
 * AI inference spend for the workspace from the audit insights endpoint.
 * Lives on the dashboard's Operating insights disclosure, so it never
 * competes with the first screen's "do I need to act?" job.
 */
export function AiSpendCard() {
  const [aiSpend, setAiSpend] = useState<{
    totalCostUsd: number;
    totalTokens: number;
    totalCalls: number;
    byProvider: Record<string, { costUsd: number; tokens: number; calls: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authFetch('/api/audit/insights?dimension=ai_spend')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return;
        if (json?.success) setAiSpend(json.data);
        else setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
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
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950 flex-shrink-0">
          <Sparkles className="h-5 w-5 text-violet-500" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="bg-card p-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950 flex-shrink-0">
          <Sparkles className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <div className="text-sm font-medium text-muted-foreground">AI Spend unavailable</div>
          <div className="text-xs text-muted-foreground/70">Could not load spend data</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950 flex-shrink-0">
        <Sparkles className="h-5 w-5 text-violet-500" />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
          {typeof aiSpend?.totalCostUsd === 'number' ? `$${aiSpend.totalCostUsd.toFixed(4)}` : '—'}
        </div>
        <div className="text-xs text-muted-foreground">
          AI Spend ({aiSpend?.totalCalls || 0} calls)
        </div>
      </div>
    </div>
  );
}
