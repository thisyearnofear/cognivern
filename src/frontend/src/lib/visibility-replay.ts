/**
 * Pure logic for the sealed-bid visibility replay — the frozen Canton
 * sandbox evidence queried as each party before and after close. Amounts
 * are always derived from the evidence rows, never re-typed.
 */

export const SANDBOX_REPLAY_ID = "sandbox-replay";

export const REPLAY_ROLES = [
  "Vendor A",
  "Vendor B",
  "Vendor C",
  "Manager",
] as const;
export type ReplayRole = (typeof REPLAY_ROLES)[number];

export type ReplayPhase = "before" | "after";

/** One row of the frozen `canton-visibility-*.json` evidence file. */
export interface VisibilityEvidenceRow {
  role: string;
  beforeClose: number[];
  afterClose: number[];
  winningAmount: number;
}

const VENDOR_ROLES = ["Vendor A", "Vendor B", "Vendor C"] as const;

/** The winner is not named in the evidence file — it is the party whose
 * quote equals `winningAmount` (Vendor B in this recorded run). */
export const REPLAY_WINNER = "Vendor B";

export interface ReplayView {
  /** Amounts visible to the queried party in the queried phase. */
  visibleQuotes: string[];
  /** The three vendor cards; exactly the derivation the replay renders. */
  quoteCards: { role: string; amount: number; visible: boolean }[];
  winningAmount: number;
  summary: string;
}

export function replayView(
  evidence: VisibilityEvidenceRow[],
  role: ReplayRole,
  phase: ReplayPhase,
): ReplayView {
  const row = evidence.find((e) => e.role === role);
  if (!row) throw new Error(`no evidence row for role ${role}`);
  const amounts = phase === "before" ? row.beforeClose : row.afterClose;
  const quoteCards = VENDOR_ROLES.map((cardRole) => {
    const cardRow = evidence.find((e) => e.role === cardRole);
    const amount = cardRow?.beforeClose[0];
    return {
      role: cardRole,
      amount: amount ?? Number.NaN,
      visible: amount !== undefined && amounts.includes(amount),
    };
  });
  const summary =
    phase === "before"
      ? `${role}, before close: ${amounts.length} of 3 quotes visible.`
      : `${role}, after close: no active bids. Result: ${REPLAY_WINNER} at ${row.winningAmount}.`;
  return {
    visibleQuotes: amounts.map(String),
    quoteCards,
    winningAmount: row.winningAmount,
    summary,
  };
}

export interface ReplayStep {
  label: string;
  role: ReplayRole;
  phase: ReplayPhase;
}

/** The replay's story CTA: viewer → manager → after close → reset. */
export function nextReplayStep(
  role: ReplayRole,
  phase: ReplayPhase,
): ReplayStep {
  if (role !== "Manager") {
    return { label: "View as manager", role: "Manager", phase };
  }
  if (phase === "before") {
    return { label: "Show after close", role: "Manager", phase: "after" };
  }
  return { label: "Reset demo", role: "Vendor A", phase: "before" };
}
