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

/**
 * The sealed-bid visibility replay, folded into /verify's auction mode.
 * It queries the frozen Canton sandbox evidence as each party — same rows
 * the standalone /procure/demo page rendered, now as a proof view.
 */

const evidence = evidenceJson as VisibilityEvidenceRow[];

function Envelope({ body, flap }: { body: string; flap: string }) {
  return (
    <svg
      className="h-10 w-16"
      viewBox="0 0 74 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="1"
        y="1"
        width="72"
        height="46"
        rx="5"
        fill={body}
        stroke="var(--border)"
        strokeWidth="2"
      />
      <path d="M1 1 L37 28 L73 1" fill="none" stroke={flap} strokeWidth="3" />
    </svg>
  );
}

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

      <div className="flex gap-3" aria-hidden="true">
        <Envelope body="var(--card)" flap="var(--primary)" />
        <Envelope body="var(--muted)" flap="var(--foreground)" />
        <Envelope body="var(--primary)" flap="var(--card)" />
      </div>

      <ReplayStatus>{view.summary}</ReplayStatus>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
        <ChipGroup
          label="Query as"
          options={REPLAY_ROLES.map((r) => ({ value: r, label: r }))}
          value={role}
          onChange={setRole}
        />
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

      {phase === "before" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {view.quoteCards.map((card) => (
            <div
              key={card.role}
              className="rounded-xl border border-border bg-card p-4"
            >
              <span className="text-xs text-muted-foreground">
                {card.role}&apos;s quote
              </span>
              {card.visible ? (
                <div
                  key={`${role}-${card.amount}`}
                  className="mt-1 text-2xl font-bold text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
                >
                  {card.amount}
                </div>
              ) : (
                <div className="mt-1 text-sm italic text-muted-foreground">
                  Not visible to this party
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">No active bids.</p>
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
        </>
      )}

      <div id="evidence" className="flex flex-wrap gap-4 text-xs">
        <a
          href="/evidence/canton-visibility-44996498857.json"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          See the actual sandbox output
        </a>
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
