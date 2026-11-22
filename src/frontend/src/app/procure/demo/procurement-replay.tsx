"use client";

import { useState } from "react";
import Link from "next/link";
import evidence from "../../../../public/evidence/canton-visibility-44996498857.json";
import styles from "./procurement-replay.module.css";

const roles = ["Vendor A", "Vendor B", "Vendor C", "Manager"] as const;
type Role = (typeof roles)[number];

// Each vendor's own quote is the single entry in its beforeClose row — the
// amounts are derived from the frozen evidence, never re-typed here.
const vendorRoles = ["Vendor A", "Vendor B", "Vendor C"] as const;
const quoteCards = vendorRoles.map((role) => {
  const row = evidence.find((e) => e.role === role)!;
  return { role, amount: row.beforeClose[0] };
});

function Envelope({ body, flap }: { body: string; flap: string }) {
  return (
    <svg
      className={styles.envelope}
      viewBox="0 0 74 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="72" height="46" rx="5" fill={body} stroke="#152a24" strokeWidth="2" />
      <path d="M1 1 L37 28 L73 1" fill="none" stroke={flap} strokeWidth="3" />
    </svg>
  );
}

export function ProcurementReplay() {
  const [role, setRole] = useState<Role>("Vendor A");
  const [phase, setPhase] = useState<"before" | "after">("before");

  const view = evidence.find((row) => row.role === role)!;
  const visible = phase === "before" ? view.beforeClose : view.afterClose;

  const cta =
    role !== "Manager"
      ? { label: "View as manager", action: () => setRole("Manager") }
      : phase === "before"
        ? { label: "Show after close", action: () => setPhase("after") }
        : {
            label: "Reset demo",
            action: () => {
              setRole("Vendor A");
              setPhase("before");
            },
          };

  const liveSummary =
    phase === "before"
      ? `${role}, before close: ${visible.length} of 3 quotes visible.`
      : `${role}, after close: no active bids. Result: Vendor B at ${view.winningAmount}.`;

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <p className={styles.kicker}>Cognivern Field Notes / 01</p>
        <h1 className={styles.title}>Sealed from whom?</h1>
        <p className={styles.provenance}>
          Interactive replay of a verified Canton sandbox run. Synthetic
          amounts; no wallet, no funds, no live writes.
        </p>

        <div className={styles.envelopes} aria-hidden="true">
          <Envelope body="#fbf6ea" flap="#15654f" />
          <Envelope body="#efbb64" flap="#152a24" />
          <Envelope body="#15654f" flap="#efbb64" />
        </div>

        <p className={styles.live} role="status" aria-live="polite">
          {liveSummary}
        </p>

        <div className={styles.controls}>
          <div className={styles.group}>
            <span className={styles.groupLabel} id="role-label">
              Query as
            </span>
            <div className={styles.buttons} role="group" aria-labelledby="role-label">
              {roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={styles.chip}
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.groupLabel} id="phase-label">
              Phase
            </span>
            <div className={styles.buttons} role="group" aria-labelledby="phase-label">
              <button
                type="button"
                className={styles.chip}
                aria-pressed={phase === "before"}
                onClick={() => setPhase("before")}
              >
                Before close
              </button>
              <button
                type="button"
                className={styles.chip}
                aria-pressed={phase === "after"}
                onClick={() => setPhase("after")}
              >
                After close
              </button>
            </div>
          </div>
          <button type="button" className={styles.cta} onClick={cta.action}>
            {cta.label}
          </button>
        </div>

        {phase === "before" ? (
          <div className={styles.cards}>
            {quoteCards.map((card) => (
              <div key={card.role} className={styles.card}>
                <span className={styles.cardRole}>{card.role}&apos;s quote</span>
                {visible.includes(card.amount) ? (
                  <span className={styles.amount} key={`${role}-${card.amount}`}>
                    {card.amount}
                  </span>
                ) : (
                  <span className={styles.missing}>
                    Not visible to this party
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className={styles.noBids}>No active bids.</p>
            <div className={styles.receipt} key={role}>
              <span className={styles.receiptLabel}>Auction result</span>
              <p className={styles.receiptWinner}>Vendor B</p>
              <p className={styles.receiptAmount}>{view.winningAmount}</p>
              <p className={styles.receiptNote}>
                The manager had already seen the losing prices. They are not
                included in this result.
              </p>
            </div>
          </>
        )}

        <div className={styles.proofLinks} id="evidence">
          <a href="/evidence/canton-visibility-44996498857.json">
            See the actual sandbox output
          </a>
          <a
            href="https://github.com/thisyearnofear/cognivern/blob/caa6e29c201b428c8a6713e66019218bb876de41/daml/README.md#local-workflow"
            target="_blank"
            rel="noreferrer"
          >
            Run it yourself on GitHub
          </a>
          <a
            href="https://dev.to/papajams/sealed-from-whom-what-each-party-can-see-in-a-canton-procurement-auction-442b"
            target="_blank"
            rel="noreferrer"
          >
            Read the field note
          </a>
        </div>

        <p className={styles.secondary}>
          <Link href="/sealed-bid">Open the procurement app</Link> — sign in to
          create real rounds. A wallet is required for a Canton bidding
          identity.
        </p>
      </div>
    </main>
  );
}
