'use client';

import { AlertTriangle, CheckCircle2, Info, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatUsd } from '@/lib/budget-format';
import type { CreditProgramFunding } from '@/lib/api-client';

/**
 * The Layer 1 vs Layer 2 banner. Shows the sponsor's real upstream balance
 * next to the ledger pool and the worst-case commitment, and every warning the
 * reconciliation produced. This is the surface that turns a silent mid-event
 * 402 into something a sponsor can act on beforehand.
 */
export function FundingBanner({
  funding,
  onRefresh,
}: {
  funding: CreditProgramFunding | undefined;
  onRefresh: () => void;
}) {
  const tone =
    funding?.warnings.length === 0
      ? 'ok'
      : funding?.upstream.status === 'ok'
        ? 'warning'
        : funding?.upstream.status === 'not_supported'
          ? 'muted'
          : 'warning';

  return (
    <div
      className={`rounded-xl border p-4 ${
        tone === 'ok'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : tone === 'muted'
            ? 'border-border bg-muted/30'
            : 'border-amber-500/40 bg-amber-500/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {tone === 'ok' ? (
            <CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />
          ) : tone === 'muted' ? (
            <Info className="mt-0.5 size-4 text-muted-foreground" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 text-amber-500" />
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="size-3.5 text-muted-foreground" />
              Funding reconciliation
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Your ledger pool is bookkeeping. The upstream balance is the real money. Neither
              enforces the other — this is the check that keeps a shortfall from becoming a
              mid-event 402.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh funding">
          <RefreshCw />
        </Button>
      </div>

      {funding ? (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FundingStat
            label="Ledger pool"
            value={formatUsd(funding.poolUsd)}
            hint="what you configured"
          />
          <FundingStat
            label="Committed (worst case)"
            value={formatUsd(funding.committedUsd)}
            hint="all participants at the highest tier"
          />
          <FundingStat
            label="Allocated today"
            value={formatUsd(funding.allocatedUsd)}
            hint="multiplier-applied, spent + available"
          />
          <FundingStat
            label="Upstream balance"
            value={
              funding.upstream.status === 'ok'
                ? formatUsd(funding.upstream.balanceUsd)
                : funding.upstream.status === 'not_configured'
                  ? 'Not checked'
                  : funding.upstream.status === 'unavailable'
                    ? 'Unavailable'
                    : 'Not supported'
            }
            hint={
              funding.upstream.status === 'ok'
                ? funding.upstream.balanceUsd === null
                  ? `${Number(funding.upstream.balanceNative) / 1e18} 0G — set ZEROG_ZG_USD_RATE for USD`
                  : 'real spendable deposit'
                : funding.upstream.status === 'not_configured'
                  ? 'set ZEROG_ROUTER_MANAGEMENT_KEY (mk-, account:read)'
                  : funding.upstream.status === 'unavailable'
                    ? 'balance endpoint unreachable'
                    : 'this backend exposes no balance'
            }
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Loading funding…</p>
      )}

      {funding && funding.warnings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {funding.warnings.map((warning, index) => (
            <li
              key={index}
              className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FundingStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-background/60 p-2.5">
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
      <p className="mt-0.5 truncate text-[0.65rem] text-muted-foreground" title={hint}>
        {hint}
      </p>
    </div>
  );
}
