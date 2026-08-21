"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  FileSearch,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { explorerTxUrl } from "@cognivern/shared";
import { formatUsd } from "@/lib/budget-format";

/**
 * Public, login-free verification of one anchored credit-ledger commitment.
 *
 * This page is the shareable receipt: an organiser pastes the link into a
 * recap, and anyone can (1) see the aggregate metadata we anchored, (2) jump
 * to the independent anchors on 0G / Filecoin, and (3) check a participant
 * receipt for inclusion in the Merkle root. Every step is checkable without
 * trusting us — the page is a convenience, the anchors are the proof.
 */

interface CommitmentAnchors {
  zerogRootHash: string | null;
  zerogTxHash: string | null;
  filecoinCid: string | null;
  filecoinTxHash: string | null;
  filecoinActionId: string | null;
}

interface PublicCommitment {
  id: string;
  programId: string;
  status: "anchored" | "pending";
  commitmentRoot: string;
  participantCount: number;
  highWaterMark: string | null;
  highWaterMarkUsd: number | null;
  createdAt: string;
  anchors: CommitmentAnchors;
  program: { name: string; sponsorName: string; status: string } | null;
}

/** Accept a raw id, a full URL, or a pasted blob and return the bare id. */
function extractCommitmentId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/cmt_[0-9a-f-]+/i);
  return match ? match[0] : trimmed;
}

function Copyable({ value, truncate = true }: { value: string; truncate?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span title={value}>{truncate ? `${value.slice(0, 12)}…${value.slice(-8)}` : value}</span>
      <button
        type="button"
        aria-label="Copy"
        className="text-muted-foreground hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}

export function VerifyClient({ initialId }: { initialId: string }) {
  const router = useRouter();
  const [idInput, setIdInput] = useState(initialId);
  const [commitment, setCommitment] = useState<PublicCommitment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [receiptInput, setReceiptInput] = useState("");
  const [receiptResult, setReceiptResult] = useState<{ valid: boolean } | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

  const load = useCallback(async (rawId: string) => {
    const id = extractCommitmentId(rawId);
    if (!id) return;
    setLoading(true);
    setError(null);
    setCommitment(null);
    setReceiptResult(null);
    setReceiptError(null);
    try {
      const res = await fetch(`/verify/credit-commitment/${encodeURIComponent(id)}`);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(res.status === 404 ? "No commitment with that id." : "Could not load the commitment.");
        return;
      }
      setCommitment(body.data.commitment as PublicCommitment);
    } catch {
      setError("Could not reach the verification API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred one tick so the initial fetch is async from the effect's
    // point of view (react lint: no synchronous setState in effects).
    if (initialId) queueMicrotask(() => void load(initialId));
  }, [initialId, load]);

  const checkReceipt = useCallback(async () => {
    setReceiptResult(null);
    setReceiptError(null);
    if (!commitment) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(receiptInput);
    } catch {
      setReceiptError("That does not parse as JSON. Paste the receipt exactly as you received it.");
      return;
    }
    const leaf = typeof parsed.leaf === "string" ? parsed.leaf : null;
    const index = parsed.index;
    const path = parsed.path;
    const root = typeof parsed.root === "string" ? parsed.root : commitment.commitmentRoot;
    if (!leaf || !Number.isInteger(index) || !Array.isArray(path)) {
      setReceiptError("The receipt needs at least leaf, index and path fields.");
      return;
    }
    setReceiptBusy(true);
    try {
      const res = await fetch("/verify/credit-commitment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root, leaf, index, path }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setReceiptError("Verification request failed.");
        return;
      }
      setReceiptResult({ valid: Boolean(body.data.valid) });
    } catch {
      setReceiptError("Could not reach the verification API.");
    } finally {
      setReceiptBusy(false);
    }
  }, [commitment, receiptInput]);

  const anchors = commitment?.anchors;
  const zeroGTxUrl = anchors?.zerogTxHash ? explorerTxUrl("zerog-galileo", anchors.zerogTxHash) : undefined;
  const filecoinTxUrl = anchors?.filecoinTxHash
    ? explorerTxUrl("filecoin-calibration", anchors.filecoinTxHash)
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold text-foreground">
            Cognivern
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <ShieldCheck className="h-4 w-4" /> Public verification
        </div>
        <h1 className="mt-3 text-2xl font-bold text-foreground">
          Verify a sponsored-inference commitment
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          When a sponsor meters an inference budget through Cognivern, snapshots of the ledger are
          committed to a Merkle root and anchored on public networks. Anyone with this link can
          check that the books said what we say they said — no account, no request to us required.
        </p>

        {/* ── Lookup ── */}
        <div className="mt-8 flex gap-2">
          <Input
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="Paste a commitment link or id (cmt_…)"
            className="font-mono text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                router.push(`/verify?id=${encodeURIComponent(extractCommitmentId(idInput))}`);
                load(idInput);
              }
            }}
          />
          <Button
            onClick={() => {
              router.push(`/verify?id=${encodeURIComponent(extractCommitmentId(idInput))}`);
              load(idInput);
            }}
            disabled={loading || !idInput.trim()}
          >
            <FileSearch className="mr-1.5 h-4 w-4" /> Look up
          </Button>
        </div>

        {loading && <p className="mt-6 text-sm text-muted-foreground">Loading commitment…</p>}
        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {commitment && (
          <div className="mt-8 space-y-6">
            {/* ── Commitment card ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-foreground">
                    {commitment.program?.name ?? "Sponsored credit program"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Sponsored by {commitment.program?.sponsorName ?? "organiser"} ·{" "}
                    {new Date(commitment.createdAt).toUTCString()}
                  </div>
                </div>
                <Badge variant={commitment.status === "anchored" ? "default" : "secondary"}>
                  {commitment.status === "anchored" ? "Anchored" : "Anchor pending"}
                </Badge>
              </div>

              <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Participants
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {commitment.participantCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    High-water mark
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {commitment.highWaterMarkUsd !== null
                      ? formatUsd(commitment.highWaterMarkUsd)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Commitment root
                  </dt>
                  <dd className="mt-0.5 text-sm text-foreground">
                    <Copyable value={commitment.commitmentRoot} />
                  </dd>
                </div>
              </dl>

              {/* Anchors */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Independent anchors
                </div>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">0G Storage (Galileo)</span>
                    {anchors?.zerogTxHash && zeroGTxUrl ? (
                      <span className="flex items-center gap-3">
                        <Copyable value={anchors.zerogTxHash} />
                        <a
                          href={zeroGTxUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View tx <ExternalLink className="h-3 w-3" />
                        </a>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">not yet received</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">Filecoin (Calibration)</span>
                    {anchors?.filecoinTxHash && filecoinTxUrl ? (
                      <span className="flex items-center gap-3">
                        <Copyable value={anchors.filecoinTxHash} />
                        <a
                          href={filecoinTxUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View tx <ExternalLink className="h-3 w-3" />
                        </a>
                      </span>
                    ) : anchors?.filecoinCid ? (
                      <Copyable value={anchors.filecoinCid} />
                    ) : (
                      <span className="text-xs text-muted-foreground">not yet received</span>
                    )}
                  </div>
                </div>
                {commitment.status === "pending" && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Anchoring has not completed yet. We report it as pending rather than calling it
                    proof — the ledger itself is unaffected either way.
                  </p>
                )}
              </div>
            </div>

            {/* ── Receipt inclusion check ── */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="font-semibold text-foreground">Check a participant receipt</div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Participants can fetch their receipt from{" "}
                <code className="font-mono">GET /v1/credits/verification</code> with their access
                key. Paste it here to confirm their balance leaf is inside this anchored root. You
                can also recompute by hand: sha256 over the leaf and each path sibling (ordered by
                index parity) must reproduce the root above.
              </p>
              <Textarea
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                rows={5}
                className="mt-3 font-mono text-xs"
                placeholder='{"leaf": "…", "index": 0, "path": ["…", "…"]}'
              />
              <div className="mt-3 flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void checkReceipt()}
                  disabled={receiptBusy || !receiptInput.trim()}
                >
                  {receiptBusy ? "Verifying…" : "Verify inclusion"}
                </Button>
                {receiptResult && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                      receiptResult.valid ? "text-emerald-500" : "text-destructive"
                    }`}
                  >
                    {receiptResult.valid ? (
                      <>
                        <ShieldCheck className="h-4 w-4" /> Included in this commitment
                      </>
                    ) : (
                      <>
                        <ShieldX className="h-4 w-4" /> Does NOT reproduce this root
                      </>
                    )}
                  </span>
                )}
                {receiptError && <span className="text-sm text-destructive">{receiptError}</span>}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
