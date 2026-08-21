'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Anchor, Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiClient, type CreditProgramCommitment } from '@/lib/api-client';
import { useCreditProgramCommitments } from '@/hooks/use-credit-programs';
import { explorerTxUrl } from '@cognivern/shared';

/**
 * Verifiable anchoring for the sponsor: freeze the books into a Merkle
 * commitment, see where it landed on public networks, and copy the
 * login-free verification link to share with judges, partners, or a recap.
 * The public page shows aggregates only — per-participant content never
 * leaves through it.
 */
export function CommitmentsPanel({ programId }: { programId: string }) {
  const { data: commitments, isLoading, error, mutate } = useCreditProgramCommitments(programId);
  const [anchoring, setAnchoring] = useState(false);

  async function anchorNow() {
    setAnchoring(true);
    try {
      const res = await apiClient.anchorCreditProgramCommitment(programId);
      if (!res.success) throw new Error(res.error || 'Anchoring failed');
      toast.success(
        res.data?.commitment.status === 'anchored' ? 'Commitment anchored' : 'Commitment recorded (anchors pending)',
      );
      await mutate();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Anchoring failed');
    } finally {
      setAnchoring(false);
    }
  }

  async function copyPublicLink(commitment: CreditProgramCommitment) {
    const url = `${window.location.origin}/verify?id=${commitment.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Public verification link copied');
    } catch {
      toast.error(url);
    }
  }

  return (
    <section aria-label="Verifiable commitments" className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Verifiable snapshots</p>
          <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
            Each snapshot freezes every participant&apos;s balance into a Merkle root anchored on
            0G Storage and Filecoin. The public link proves the books at that moment without
            exposing any individual&apos;s data — share it freely.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void anchorNow()} disabled={anchoring}>
          {anchoring ? <Loader2 className="animate-spin" /> : <Anchor />} Anchor now
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && !commitments && (
          <>
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </>
        )}
        {error && !commitments && (
          <p className="text-xs text-destructive">Could not load commitments: {error.message}</p>
        )}
        {commitments && commitments.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No snapshots yet. Closing the program anchors one automatically; use Anchor now to
            freeze the books at any point (e.g. before judging).
          </p>
        )}
        {commitments?.map((commitment) => {
          const zeroGUrl = commitment.anchors.zerogTxHash
            ? explorerTxUrl('zerog-galileo', commitment.anchors.zerogTxHash)
            : undefined;
          const filecoinUrl = commitment.anchors.filecoinTxHash
            ? explorerTxUrl('filecoin-calibration', commitment.anchors.filecoinTxHash)
            : undefined;
          return (
            <div
              key={commitment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge status={commitment.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(commitment.createdAt).toLocaleString()} ·{' '}
                    {commitment.participantCount} participant(s)
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                  root {commitment.commitmentRoot}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CopyLinkButton onCopy={() => copyPublicLink(commitment)} />
                {zeroGUrl && (
                  <a
                    href={zeroGUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    0G <ExternalLink className="size-3" />
                  </a>
                )}
                {filecoinUrl && (
                  <a
                    href={filecoinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    Filecoin <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CopyLinkButton({ onCopy }: { onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 text-[11px]"
      onClick={() => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      Share link
    </Button>
  );
}
