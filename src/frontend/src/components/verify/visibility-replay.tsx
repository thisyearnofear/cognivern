"use client";

import { useState } from "react";
import Link from "next/link";
import evidenceJson from "../../../public/evidence/canton-visibility-44996498857.json";
import {
  nextReplayStep,
  REPLAY_ROLES,
  replayView,
  REPLAY_WINNER,
  type ReplayPhase,
  type ReplayRole,
  type VisibilityEvidenceRow,
} from "@/lib/visibility-replay";
import { proofFromVisibilityReplay } from "@/lib/proof";
import { Button } from "@/components/ui/button";
import { ChipGroup, ProofSummary, ReplayStatus } from "./proof-replay";
import { DisclosureLens } from "@/components/primitives/disclosure-lens";

/**
 * The sealed-bid visibility replay, folded into /verify's auction mode.
 * It queries the frozen Canton sandbox evidence as each party — same rows
 * the standalone /procure/demo page rendered, now as a proof view.
 *
 * Disclosure honesty: an envelope renders `open` only when the queried
 * party's evidence row actually contains that quote; the amount is passed
 * to the card only in that case. Everything else is `redacted` (before
 * close) or `archived` (after close — no active bids remain).
 */

const evidence = evidenceJson as VisibilityEvidenceRow[];

export function VisibilityReplay() {
  const [role, setRole] = useState<ReplayRole>("Vendor A");
  const [phase, setPhase] = useState<ReplayPhase>("before");

  const view = replayView(evidence, role, phase);
  const step = nextReplayStep(role, phase);

  return (
    <div className="mt-8 space-y-6">
      <ProofSummary proof={proofFromVisibilityReplay(evidence)} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Cognivern Field Notes / 01
        </p>
        <h2 className="mt-2 text-xl font-bold text-foreground">
          Sealed from whom?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Interactive replay of a verified Canton sandbox run. Synthetic
          amounts; no wallet, no funds, no live writes.
        </p>
      </div>

      <ReplayStatus>{view.summary}</ReplayStatus>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
        <ChipGroup
          label="Phase"
          options={[
            { value: "before" as const, label: "Before close" },
            { value: "after" as const, label: "After close" },
          ]}
          value={phase}
          onChange={setPhase}
        />
        <Button
          onClick={() => {
            setRole(step.role);
            setPhase(step.phase);
          }}
        >
          {step.label}
        </Button>
      </div>

      <DisclosureLens
        id="party-lens"
        parties={REPLAY_ROLES.map((r) => ({ value: r, label: r }))}
        activeParty={role}
        onPartyChange={setRole}
        bids={view.quoteCards.map((card) => ({
          id: card.role,
          bidder: card.role,
          // The amount reaches the card only when this party's evidence row
          // discloses it — redacted envelopes carry no price at all.
          amountUsd: card.visible ? card.amount : null,
          tag: card.role === role ? "your bid" : undefined,
        }))}
        resolveEnvelopeState={(_party, bid) => {
          if (phase === "after") return "archived";
          const card = view.quoteCards.find((c) => c.role === bid.bidder);
          return card?.visible ? "open" : "redacted";
        }}
        visibleCount={phase === "before" ? view.visibleQuotes.length : 0}
        proofQuery={`GET /evidence/canton-visibility-44996498857.json — frozen sandbox rows queried as ${role}`}
        proofExtra={
          <a
            href="/evidence/canton-visibility-44996498857.json"
            className="text-primary hover:underline"
          >
            See the actual sandbox output
          </a>
        }
      />

      {phase === "after" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <span className="text-xs text-muted-foreground">
            Auction result
          </span>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {REPLAY_WINNER}
          </p>
          <p className="text-3xl font-bold text-foreground">
            {view.winningAmount}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The manager had already seen the losing prices. They are not
            included in this result.
          </p>
        </div>
      )}

      <div id="evidence" className="flex flex-wrap gap-4 text-xs">
        <a
          href="https://github.com/thisyearnofear/cognivern/blob/caa6e29c201b428c8a6713e66019218bb876de41/daml/README.md#local-workflow"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Run it yourself on GitHub
        </a>
        <a
          href="https://dev.to/papajams/sealed-from-whom-what-each-party-can-see-in-a-canton-procurement-auction-442b"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Read the field note
        </a>
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href="/sealed-bid" className="text-primary hover:underline">
          Open the procurement app
        </Link>{" "}
        — sign in to create real rounds. A wallet is required for a Canton
        bidding identity.
      </p>
    </div>
  );
}
