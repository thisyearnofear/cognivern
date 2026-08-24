'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CircleDollarSign, Loader2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient, type SpendAttributionReport } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

function formatWei(value: string): string {
  if (!/^\d+$/.test(value)) return '—';
  try {
    return BigInt(value).toLocaleString();
  } catch {
    return '—';
  }
}

export function AttributionCard({ onOpen }: { onOpen: () => void }) {
  const isConnected = useAuthStore((state) => state.isConnected);
  const [report, setReport] = useState<SpendAttributionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    apiClient
      .getSpendAttribution()
      .then((response) => {
        if (cancelled) return;
        if (response.success && response.data) setReport(response.data);
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
  }, [isConnected]);

  if (!isConnected) return null;

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading spend attribution…
        </div>
      </div>
    );
  }

  const assets = Object.entries(report?.totalsByAsset || {});
  const hasData = assets.length > 0;

  if (failed) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
        <div className="text-sm font-medium">Spend attribution unavailable</div>
        <p className="mt-1 text-xs text-muted-foreground">The ledger could not be loaded. Open Spend &amp; Outcomes to retry.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={onOpen}>Open Spend &amp; Outcomes</Button>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Spend &amp; Outcomes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See what was allocated, consumed, and produced by governed agents.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onOpen}>
          View ledger <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>

      {!hasData ? (
        <div className="mt-5 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No governed spend allocations yet. Run a spend through Governance Check to create the first attribution record.
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {assets.slice(0, 3).map(([asset, totals]) => (
            <div key={asset} className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{asset}</span>
                <Badge variant="outline">{totals.recordCount} records</Badge>
              </div>
              <div className="mt-3 text-xl font-bold">{formatWei(totals.consumedAmount)}</div>
              <div className="text-xs text-muted-foreground">consumed · {formatWei(totals.allocatedAmount)} allocated (base units)</div>
              <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> {report?.counts.consumed || 0} completed outcomes
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
