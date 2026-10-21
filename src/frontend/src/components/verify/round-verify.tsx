"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  FileSearch,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hashSealedBidEvent } from "@/lib/cre-hash";

/**
 * Public, login-free verification of a sealed-bid auction round.
 *
 * The page shows exactly what the operator published — the outcome plus the
 * on-ledger contract ids and (for agent-governed rounds) the CRE event
 * hashes. Each event hash is recomputed in the browser so a visitor can
 * confirm the published trail is internally consistent without trusting us.
 * What this does NOT prove is spelled out in the honesty box below — Canton
 * contracts are private to their parties, and the event chain is not yet
 * anchored externally.
 */

interface RoundVerification {
  roundId: string;
  status: string;
  backend?: string;
  description: string;
  serviceCategory: string;
  deadline: string;
  bidCount: number;
  winner: string | null;
  winningBid: number | null;
  winningProposalHash: string | null;
  ledgerRefs: { auction?: string; result?: string; cancelled?: string } | null;
  settledAssetCid: string | null;
  governanceTimeline: {
    runId: string;
    agentId: string;
    events: {
      eventType: string;
      timestamp: string;
      eventHash: string;
      payload: Record<string, unknown>;
    }[];
  } | null;
}

/** Party ids look like "Alice::1220abcd…" — show the friendly prefix. */
function displayPartyName(party: string | null | undefined): string {
  if (!party) return "";
  const [name] = party.split("::");
  return name || party;
}

/** Accept a raw roundId or a pasted link containing ?round=<id>. */
function extractRoundId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/[?&]round=([^&#\s]+)/);
  if (urlMatch) return decodeURIComponent(urlMatch[1]);
  return trimmed;
}

function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span title={value}>{`${value.slice(0, 12)}…${value.slice(-8)}`}</span>
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

export function RoundVerify({ initialRoundId }: { initialRoundId: string }) {
  const router = useRouter();
  const [idInput, setIdInput] = useState(initialRoundId);
  const [round, setRound] = useState<RoundVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-event browser recomputation results, keyed by index.
  const [hashChecks, setHashChecks] = useState<Record<number, boolean | null>>({});

  const [savedHash, setSavedHash] = useState("");
  const [savedResult, setSavedResult] = useState<
    | { kind: "verified" }
    | { kind: "mismatch" }
    | { kind: "not-found" }
    | null
  >(null);

  const load = useCallback(async (rawId: string) => {
    const id = extractRoundId(rawId);
    if (!id) return;
    setLoading(true);
    setError(null);
    setRound(null);
    setHashChecks({});
    setSavedResult(null);
    try {
      const res = await fetch(
        `/api/vendor/sealed-bid/rounds/${encodeURIComponent(id)}/verify`,
      );
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        setError(
          res.status === 404
            ? "No round with that id."
            : "Could not load the round.",
        );
        return;
      }
      setRound(body.data as RoundVerification);
    } catch {
      setError("Could not reach the verification API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialRoundId) queueMicrotask(() => void load(initialRoundId));
  }, [initialRoundId, load]);

  // Recompute every event hash in the browser and compare to the published
  // eventHash. Runs whenever a new round (and its timeline) loads.
  useEffect(() => {
    const timeline = round?.governanceTimeline;
    // hashChecks is reset by `load` when a new round is fetched, so nothing
    // to do here when the round has no timeline.
    if (!timeline) return;
    let cancelled = false;
    void (async () => {
      const results: Record<number, boolean> = {};
      for (let i = 0; i < timeline.events.length; i++) {
        const event = timeline.events[i];
        try {
          const recomputed = await hashSealedBidEvent({
            runId: timeline.runId,
            eventType: event.eventType,
            timestamp: event.timestamp,
            payload: event.payload,
          });
          results[i] = recomputed === event.eventHash;
        } catch {
          results[i] = false;
        }
      }
      if (!cancelled) setHashChecks(results);
    })();
    return () => {
      cancelled = true;
    };
  }, [round]);

  const checkSavedHash = useCallback(async () => {
    const needle = savedHash.trim().toLowerCase();
    if (!needle || !round?.governanceTimeline) return;
    const timeline = round.governanceTimeline;
    const index = timeline.events.findIndex(
      (e) => e.eventHash.toLowerCase() === needle,
    );
    if (index === -1) {
      setSavedResult({ kind: "not-found" });
      return;
    }
    const event = timeline.events[index];
    try {
      const recomputed = await hashSealedBidEvent({
        runId: timeline.runId,
        eventType: event.eventType,
        timestamp: event.timestamp,
        payload: event.payload,
      });
      setSavedResult(
        recomputed === event.eventHash ? { kind: "verified" } : { kind: "mismatch" },
      );
    } catch {
      setSavedResult({ kind: "mismatch" });
    }
  }, [savedHash, round]);

  const deadlineMs = round?.deadline ? new Date(round.deadline).getTime() : NaN;
  const deadlineText = Number.isNaN(deadlineMs)
    ? null
    : new Date(deadlineMs).toUTCString();

  const statusLabel =
    round?.status === "revealed"
      ? "Decided"
      : round?.status === "closed"
        ? "Closed"
        : round?.status === "cancelled"
          ? "Cancelled"
          : "Open";

  return (
    <div>
      {/* ── Lookup ── */}
      <div className="mt-8 flex gap-2">
        <Input
          value={idInput}
          onChange={(e) => setIdInput(e.target.value)}
          placeholder="Paste a round link or round id"
          className="font-mono text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const id = extractRoundId(idInput);
              router.push(`/verify?round=${encodeURIComponent(id)}`);
              void load(idInput);
            }
          }}
        />
        <Button
          onClick={() => {
            const id = extractRoundId(idInput);
            router.push(`/verify?round=${encodeURIComponent(id)}`);
            void load(idInput);
          }}
          disabled={loading || !idInput.trim()}
        >
          <FileSearch className="mr-1.5 h-4 w-4" /> Look up
        </Button>
      </div>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Loading round…</p>}
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

      {round && (
        <div className="mt-8 space-y-6">
          {/* ── Outcome card ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-foreground">{round.description}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {round.serviceCategory}
                  {deadlineText ? ` · deadline ${deadlineText}` : ""}
                </div>
              </div>
              <Badge
                variant={round.status === "open" ? "default" : "secondary"}
                className={
                  round.status === "revealed"
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    : undefined
                }
              >
                {statusLabel}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Bids received
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {round.bidCount}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Winner
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {round.winner ? displayPartyName(round.winner) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Winning bid
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {round.winningBid !== null
                    ? `$${round.winningBid.toLocaleString()}`
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* ── Ledger anchors ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="font-semibold text-foreground">Ledger anchors</div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Canton contract ids the operator published for this round. They are
              resolvable on the ledger by the round&apos;s participants.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {round.ledgerRefs &&
                Object.entries(round.ledgerRefs)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground capitalize">{k} contract</span>
                      <Copyable value={v as string} />
                    </div>
                  ))}
              {round.settledAssetCid && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">Settled deposit</span>
                  <Copyable value={round.settledAssetCid} />
                </div>
              )}
              {!round.settledAssetCid &&
                (!round.ledgerRefs || !Object.values(round.ledgerRefs).some(Boolean)) && (
                  <p className="text-xs text-muted-foreground">
                    This backend does not publish on-ledger anchors.
                  </p>
                )}
            </div>
          </div>

          {/* ── Governance timeline ── */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="font-semibold text-foreground">Governance timeline</div>
            {round.governanceTimeline ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Agent-governed round — every lifecycle event carries a SHA-256
                  hash over its contents. We recompute each hash in your browser.
                </p>
                <div className="mt-3 space-y-2">
                  {round.governanceTimeline.events.map((event, i) => (
                    <div
                      key={`${event.eventType}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-foreground/80">{event.eventType}</span>
                        <span className="ml-2 text-muted-foreground">
                          {new Date(event.timestamp).toUTCString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Copyable value={event.eventHash} />
                        {hashChecks[i] === undefined || hashChecks[i] === null ? (
                          <span className="text-muted-foreground">checking…</span>
                        ) : hashChecks[i] ? (
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <ShieldCheck className="h-3.5 w-3.5" /> hash matches contents
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <ShieldX className="h-3.5 w-3.5" /> mismatch
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Saved-hash check */}
                <div className="mt-5 border-t border-border pt-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Check a hash you saved
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    If you saved an event hash earlier — e.g. at bid time — paste
                    it here to confirm it is still in this trail and still
                    recomputes.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Input
                      value={savedHash}
                      onChange={(e) => {
                        setSavedHash(e.target.value);
                        setSavedResult(null);
                      }}
                      placeholder="64-char hex hash"
                      className="font-mono text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void checkSavedHash();
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => void checkSavedHash()}
                      disabled={!savedHash.trim()}
                    >
                      Check
                    </Button>
                  </div>
                  {savedResult?.kind === "verified" && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-500">
                      <ShieldCheck className="h-4 w-4" /> Present in the trail and
                      recomputes unchanged
                    </p>
                  )}
                  {savedResult?.kind === "mismatch" && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
                      <ShieldX className="h-4 w-4" /> Found, but it no longer
                      matches the event contents
                    </p>
                  )}
                  {savedResult?.kind === "not-found" && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
                      <ShieldX className="h-4 w-4" /> Not present in this round&apos;s
                      trail
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                This round was not agent-governed, so it has no governance event
                trail.
              </p>
            )}
          </div>

          {/* ── Honesty box ── */}
          <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
            <div className="font-semibold text-foreground">What this proves</div>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                The outcome and contract ids the operator published for this round.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                Each governance event&apos;s hash matches its contents — recomputed
                in your browser, not on our server.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-500" />
                A hash you saved earlier (e.g. at bid time) is still present and
                unchanged.
              </li>
            </ul>
            <ul className="mt-3 space-y-1.5 text-muted-foreground">
              <li className="flex gap-2">
                <ShieldX className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                Not proven here: Canton contracts are private to their parties, so
                the contract ids can only be resolved on the ledger by the
                round&apos;s participants.
              </li>
              <li className="flex gap-2">
                <ShieldX className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                Event hashes are not yet chained or anchored externally — this
                page cannot rule out the operator rewriting the whole trail.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
