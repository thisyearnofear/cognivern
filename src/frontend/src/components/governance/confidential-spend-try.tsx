'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Lock,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useConfidentialRail } from '@/hooks/use-confidential-rail';
import {
  confidentialExplorerHref,
  railViewFromEvidence,
} from '@/lib/confidential-rail';

/** Amounts sized to Flare TEE demo limits (approvalThreshold 500, perTx 2000). */
const TRIALS = [
  { amountUsd: 25, label: 'Approve', hint: '$25' },
  { amountUsd: 750, label: 'Hold', hint: '$750' },
  { amountUsd: 2500, label: 'Deny', hint: '$2,500' },
];

type TrialResult = {
  amountUsd: number;
  outcome: string;
  decisionId: string;
  evaluator?: string;
  note?: string;
  confidential?: Record<string, unknown>;
};

/**
 * Judge-facing live Flare confidential spend trial.
 * Hits POST /api/spend/encrypted → FCC TEE on Coston2.
 */
export function ConfidentialSpendTry() {
  const { view: rail } = useConfidentialRail();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrialResult | null>(null);

  const focusRequested = searchParams?.get('confidential') === '1';
  const flareActive = rail.rail === 'flare';

  useEffect(() => {
    if (!focusRequested || !flareActive) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusRequested, flareActive]);

  const runTrial = useCallback(async (amountUsd: number) => {
    setRunning(amountUsd);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.evaluateConfidentialSpend({
        agentId: '0xaa',
        policyId: '0x01',
        amountUsd,
        vendorHash: '0xbb',
      });
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Confidential spend failed');
      }
      setResult({
        amountUsd,
        outcome: res.data.outcome,
        decisionId: res.data.decisionId,
        evaluator: res.data.evaluator,
        note: res.data.note,
        confidential: res.data.confidential as Record<string, unknown> | undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRunning(null);
    }
  }, []);

  if (!flareActive) return null;

  const evidenceView = railViewFromEvidence(result?.confidential, rail);
  const explorerHref = confidentialExplorerHref(evidenceView, result?.decisionId);

  const OutcomeIcon =
    result?.outcome === 'approve'
      ? CheckCircle2
      : result?.outcome === 'hold'
        ? PauseCircle
        : XCircle;

  const outcomeColor =
    result?.outcome === 'approve'
      ? 'text-emerald-600 dark:text-emerald-400'
      : result?.outcome === 'hold'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div
      ref={panelRef}
      id="confidential-spend-try"
      className={`rounded-xl border p-5 space-y-4 ${
        focusRequested
          ? 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-300/40'
          : 'border-amber-200 dark:border-amber-800'
      } bg-amber-50/40 dark:bg-amber-950/20`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Lock className="h-4 w-4 text-amber-600" />
          <h2
            className="text-sm font-semibold text-foreground"
            style={{ fontFamily: 'var(--font-space-grotesk)' }}
          >
            Try confidential spend
          </h2>
          <Badge
            variant="outline"
            className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
          >
            Flare TEE · Coston2
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground max-w-xl">
          Live evaluation inside a Flare Compute Extension. Budget limits stay
          private — only approve, hold, or deny is published on-chain.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TRIALS.map((trial) => (
          <Button
            key={trial.amountUsd}
            type="button"
            variant="outline"
            size="sm"
            disabled={running !== null}
            onClick={() => void runTrial(trial.amountUsd)}
            className="border-amber-300/80 dark:border-amber-700 bg-background/60 gap-1.5"
          >
            {running === trial.amountUsd ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {trial.label}
            <span className="text-muted-foreground font-normal">{trial.hint}</span>
          </Button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-card/80 p-3 space-y-2">
          <div className={`flex items-center gap-2 text-sm font-medium flex-wrap ${outcomeColor}`}>
            <OutcomeIcon className="h-4 w-4" />
            <span className="capitalize">{result.outcome}</span>
            <span className="text-muted-foreground font-normal">
              · ${result.amountUsd.toLocaleString()}
            </span>
            {result.evaluator && (
              <Badge variant="secondary" className="text-[10px] sm:ml-auto">
                {result.evaluator}
              </Badge>
            )}
          </div>
          {result.note && (
            <p className="text-[11px] text-muted-foreground">{result.note}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-mono truncate max-w-[220px] sm:max-w-md">
              {result.decisionId}
            </span>
            {explorerHref && (
              <a
                href={explorerHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 hover:underline"
              >
                Coston2 explorer
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
