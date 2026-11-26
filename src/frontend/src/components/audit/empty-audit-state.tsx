'use client';

import { useState } from 'react';
import { ChevronDown, PlayCircle, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyAuditPlate } from '@/components/illustrations/empty-audit-plate';

const CURL_SNIPPET = `curl -X POST https://api.cognivern.persidian.com/api/governance/evaluate \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $KEY" \\
  -d '{"agentId":"demo","action":{"type":"spend","amount":50,"currency":"USDC"}}'`;

/**
 * Shown when the audit trail has no decisions yet. The plate explains the
 * missing evidence chain instantly; the API path stays available behind a
 * compact disclosure instead of making operators wait through a terminal demo.
 */
export function EmptyAuditState({ onRunCheck }: { onRunCheck: () => void }) {
  const [showCurl, setShowCurl] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="space-y-4 p-6 text-center sm:p-8">
        <div className="mx-auto max-w-md space-y-3">
          <EmptyAuditPlate className="mx-auto" />
          <div>
            <p className="font-medium text-foreground">No audit logs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Activity will appear here as governed systems execute spends.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="default" size="sm" onClick={onRunCheck}>
            <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> Run a check
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open('/agents/workshop', '_self')}
          >
            <Terminal className="mr-1.5 h-3.5 w-3.5" /> Create API identity
          </Button>
        </div>

        <div className="mx-auto max-w-xl text-left">
          <button
            type="button"
            aria-expanded={showCurl}
            onClick={() => setShowCurl((open) => !open)}
            className="mx-auto flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Or send via curl
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCurl ? 'rotate-180' : ''}`} />
          </button>
          {showCurl && (
            <pre
              className="mt-3 overflow-x-auto rounded-lg border border-border bg-muted/45 p-3 text-xs leading-relaxed text-foreground"
              style={{ fontFamily: 'var(--font-jetbrains-mono, var(--font-geist-mono))' }}
            >
              {CURL_SNIPPET}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
