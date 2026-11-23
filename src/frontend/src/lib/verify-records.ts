/**
 * Source-record types for the /verify modes — the public shapes each mode's
 * endpoint (or static file) returns. Adapters in lib/proof.ts and the mode
 * components share these so the summary and the detail view read the same
 * fields.
 */

export interface CommitmentAnchors {
  zerogRootHash: string | null;
  zerogTxHash: string | null;
  filecoinCid: string | null;
  filecoinTxHash: string | null;
  filecoinActionId: string | null;
}

export interface PublicCommitment {
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

export interface RoundVerification {
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
export function displayPartyName(party: string | null | undefined): string {
  if (!party) return "";
  const [name] = party.split("::");
  return name || party;
}

/**
 * Honesty-box copy shown on the round detail view. The proves/limit strings
 * are shared with the proof-envelope adapter so the summary never states
 * different caveats than the detail view.
 */
export const ROUND_PROOF_PROVES = [
  "The outcome and contract ids the operator published for this round.",
  "Each governance event's hash matches its contents — recomputed in your browser, not on our server.",
  "A hash you saved earlier (e.g. at bid time) is still present and unchanged.",
];

export const ROUND_PROOF_LIMITS = [
  "Not proven here: Canton contracts are private to their parties, so the contract ids can only be resolved on the ledger by the round's participants.",
  "Event hashes are not yet chained or anchored externally — this page cannot rule out the operator rewriting the whole trail.",
];
