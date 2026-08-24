'use client';

import { useState } from 'react';
import { ChevronDown, Fingerprint, Lock, Shield } from 'lucide-react';
import { defaultExecutionRail, formatEvidenceAnchorLine } from '@cognivern/shared';
import { useConfidentialRail } from '@/hooks/use-confidential-rail';
import { trackUxEvent } from '@/lib/ux-events';
import { LedgerIntegrityCard } from './ledger-integrity-card';
import { SuspicionOverview } from './suspicion-overview';

interface ProofDetailsProps {
  onChainCount: number;
  total: number;
}

/**
 * Collapsed-by-default disclosure with ledger verification, the security
 * architecture grid, and risk signals. Kept out of the primary investigation
 * flow so the timeline stays the focus.
 */
export function ProofDetails({ onChainCount, total }: ProofDetailsProps) {
  const [expanded, setExpanded] = useState(false);
  const { view: rail } = useConfidentialRail();

  return (
    <section className="border-t pt-5">
      <button
        type="button"
        onClick={() => {
          setExpanded((current) => {
            if (!current) trackUxEvent('disclosure_opened', 'audit_proof_details');
            return !current;
          });
        }}
        aria-expanded={expanded}
        aria-controls="audit-proof-details"
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h2 className="text-sm font-semibold">Proof & security details</h2>
          <p className="text-xs text-muted-foreground">
            Ledger verification, security controls, and risk signals
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div id="audit-proof-details" className="mt-5 space-y-5">
          <LedgerIntegrityCard />
          <div className="rounded-xl border border-border bg-muted/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-emerald-500" />
              <h3
                className="font-semibold text-sm"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Security Architecture
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
              {[
                { icon: Fingerprint, label: 'Auth', value: 'SIWE + JWT with nonce replay' },
                { icon: Lock, label: 'API Keys', value: 'scrypt hashed, scoped permissions' },
                {
                  icon: Shield,
                  label: 'Rate Limiting',
                  value: '3 layers (global, workspace, per-key)',
                },
                {
                  icon: Lock,
                  label: 'Private budgets',
                  value: rail.architectureLine,
                },
                { icon: Shield, label: 'Audit', value: formatEvidenceAnchorLine() },
                { icon: Shield, label: 'Contract Audit', value: 'ChainGPT scan on recipients' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>
                    <span className="font-medium text-foreground">{label}:</span> {value}
                  </span>
                </div>
              ))}
            </div>
            {onChainCount > 0 && (
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                {onChainCount} of {total} decisions have on-chain proof on{' '}
                {defaultExecutionRail().displayName}
              </div>
            )}
          </div>
          <SuspicionOverview />
        </div>
      )}
    </section>
  );
}
