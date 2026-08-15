'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, RefreshCw, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreditProgramReconcile } from '@/hooks/use-credit-programs';
import { apiClient } from '@/lib/api-client';
import { mutate } from 'swr';

export function ReconcileView({ programId }: { programId: string }) {
  const { data: reconcile, isLoading, error } = useCreditProgramReconcile(programId);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const res = await apiClient.reconcileCreditProgram(programId);
      if (!res.success) throw new Error(res.error || 'Reconcile failed');
      await mutate(`/api/credit-programs/${programId}/reconcile`);
      toast.success(
        res.data?.ok
          ? 'Books agree — every balance re-derives from the append-only ledger.'
          : `${res.data?.drifted.length ?? 0} participant(s) drifted.`,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Reconcile failed');
    } finally {
      setRunning(false);
    }
  }, [programId]);

  if (isLoading && !reconcile) {
    return <p className="text-sm text-muted-foreground">Running reconciliation…</p>;
  }

  if (error && !reconcile) {
    return <p className="text-sm text-muted-foreground">Could not reconcile: {error.message}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Re-derives every participant&apos;s balance from the append-only ledger and reports drift. The
          point is that the sponsor can audit the books themselves — the ledger is the evidence, not
          a claim.
        </p>
        <Button variant="outline" size="sm" onClick={run} disabled={running}>
          {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Re-run
        </Button>
      </div>

      {reconcile && reconcile.ok ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
          <div>
            <p className="text-sm font-medium">Books agree</p>
            <p className="text-xs text-muted-foreground">
              {reconcile.checked} participant{reconcile.checked === 1 ? '' : 's'} checked, zero
              drift.
            </p>
          </div>
        </div>
      ) : (
        reconcile && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
              <ShieldAlert className="mt-0.5 size-4 text-amber-500" />
              <div>
                <p className="text-sm font-medium">
                  {reconcile.drifted.length} of {reconcile.checked} drifted
                </p>
                <p className="text-xs text-muted-foreground">
                  A drifted balance means the denormalised counters disagree with the ledger — treat
                  it as a bug to investigate, not a rounding error.
                </p>
              </div>
            </div>
            {reconcile.drifted.map((d) => (
              <div key={d.handle} className="rounded-lg border px-3 py-2 text-xs">
                <span className="font-medium">{d.handle}</span>{' '}
                <span className="text-muted-foreground">— {d.reason ?? 'balance mismatch'}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
