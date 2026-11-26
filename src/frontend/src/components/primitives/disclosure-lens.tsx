"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Loader2 } from "lucide-react";
import { SegmentedControl } from "@/components/primitives/segmented-control";
import {
  SealedEnvelope,
  type EnvelopeState,
} from "@/components/primitives/sealed-envelope";
import { MOTION_DURATION } from "@/lib/motion-tokens";

/**
 * `DisclosureLens` — the Canton sub-transaction privacy instrument.
 *
 * Composition: `"Viewing ledger as"` + gliding SegmentedControl over the
 * parties, a responsive row of `SealedEnvelope` cards (one per bid), and a
 * compact status strip with a collapsible ledger-query proof drawer.
 *
 * The component is intentionally dumb about disclosure semantics: the parent
 * passes the full bid set it can see plus a `resolveEnvelopeState` resolver
 * derived from REAL participant responses / replay evidence. A bid the party
 * genuinely cannot see renders `redacted`; when the underlying data is
 * unavailable the parent renders its own honest loading/empty state instead
 * of mounting this lens.
 */

export interface LensBid {
  /** Stable key, e.g. `${bidder}-${index}`. */
  id: string;
  /** Vendor display name — public round metadata. */
  bidder: string;
  amountUsd?: number | null;
  /** Bid index within the round — the join key disclosure resolvers use. */
  index?: number;
  /** Micro-tag for the active party's own bid etc. */
  tag?: string;
}

export interface LensParty<T extends string> {
  value: T;
  label: string;
}

interface DisclosureLensProps<T extends string> {
  /** Unique instance id for the gliding SegmentedControl pill. */
  id: string;
  parties: LensParty<T>[];
  activeParty: T;
  onPartyChange: (party: T) => void;
  bids: LensBid[];
  /**
   * Disclosure resolver — must be derived from the real ledger query /
   * evidence, never from presentation convenience. Returns the envelope
   * state for `(party, bid)`.
   */
  resolveEnvelopeState: (party: T, bid: LensBid) => EnvelopeState;
  /** Count line, e.g. participant-returned contract count. */
  visibleCount: number;
  /** Raw ledger query/proof string tucked behind the disclosure drawer. */
  proofQuery?: string;
  /** Extra content rendered inside the proof drawer (links, evidence ids). */
  proofExtra?: ReactNode;
  loading?: boolean;
  /** Optional note under the header (data provenance explanation). */
  headerNote?: ReactNode;
  className?: string;
}

export function DisclosureLens<T extends string>({
  id,
  parties,
  activeParty,
  onPartyChange,
  bids,
  resolveEnvelopeState,
  visibleCount,
  proofQuery,
  proofExtra,
  loading = false,
  headerNote,
  className,
}: DisclosureLensProps<T>) {
  const [proofOpen, setProofOpen] = useState(false);

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Viewing ledger as
          </div>
          {headerNote ? (
            <div className="max-w-md text-xs text-muted-foreground">
              {headerNote}
            </div>
          ) : null}
        </div>
        <SegmentedControl
          id={id}
          options={parties.map((p) => ({ value: p.value, label: p.label }))}
          value={activeParty}
          onChange={onPartyChange}
        />
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/60">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <motion.div layout className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {bids.map((bid) => {
              const state = resolveEnvelopeState(activeParty, bid);
              return (
                <motion.div
                  key={bid.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: MOTION_DURATION.fast }}
                >
                  <SealedEnvelope
                    state={state}
                    bidder={bid.bidder}
                    amountUsd={bid.amountUsd}
                    tag={bid.tag}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Status strip + collapsible ledger query proof. */}
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">
              {visibleCount}
            </span>{" "}
            of {bids.length} contract{bids.length === 1 ? "" : "s"} visible to
            this party
            {loading ? " …" : ""}
          </span>
          {proofQuery ? (
            <button
              type="button"
              aria-expanded={proofOpen}
              onClick={() => setProofOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${proofOpen ? "rotate-90" : ""}`}
              />
              Inspect ledger query
            </button>
          ) : null}
        </div>
        {proofQuery && proofOpen ? (
          <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
            <code className="block break-all font-mono text-[11px] text-muted-foreground">
              {proofQuery}
            </code>
            {proofExtra}
          </div>
        ) : null}
      </div>
    </div>
  );
}
