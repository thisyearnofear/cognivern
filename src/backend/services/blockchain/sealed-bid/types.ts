export type RoundStatus = "open" | "closed" | "revealed";
export type BidStatus = "pending" | "selected" | "rejected";
export type BackendName = "fhe" | "canton";

export interface BidRecord {
  bidder: string;
  encryptedAmount: string;
  proposalHash: string;
  status: BidStatus;
  submittedAt: string;
  index: number;
}

export interface SealedBidRound {
  roundId: string;
  description: string;
  serviceCategory: string;
  manager: string;
  deadline: string;
  maxBids: number;
  status: RoundStatus;
  bids: BidRecord[];
  winner: string | null;
  winningBid: number | null;
  winningProposalHash: string | null;
  createdAt: string;
  backend?: BackendName;
}

// A bid as returned by the ledger when queried AS a specific party — the
// amount is present because that party is authorized to see it (signatory of
// its own bid, or observer/manager of all). Competitors' bids simply do not
// appear in the query result at all — this is Canton's disclosure model, not a
// UI filter.
export interface PartyVisibleBid {
  bidder: string;
  amountUsd: number;
  proposalHash: string;
  index: number;
}

// The result of querying the ledger acting as `party`: exactly the bid
// contracts that party can read on-ledger for this round.
export interface PartyView {
  party: string; // the requested name (e.g. "Alice")
  partyId: string; // resolved Daml party id
  visibleBids: PartyVisibleBid[];
}

export interface CreateRoundRequest {
  description: string;
  serviceCategory: string;
  deadline: string;
  maxBids: number;
  backend?: BackendName;
}

export interface SubmitBidRequest {
  bidder: string;
  amountUsd: number;
  proposalDetails?: string;
  // Optional explicit override for the proposalHash written into the Canton
  // Bid contract. Production flows leave this unset and the backend derives
  // a SHA-256 of `proposalDetails`; tests pin a known literal so a future
  // Daml model change (e.g. proposalHash widened to a tagged union, or the
  // CloseAndReveal mapping dropping winningProposal) fails the relevant
  // assertion at typecheck or runtime rather than silently passing.
  proposalHash?: string;
}

// A single decrypted bid — the manager decrypts each bid amount off-chain
// via CoFHE decryptForView (permit-gated), then submits the plaintexts back
// to the backend as a decryption-proof bundle. Each entry maps a bidder to
// its post-decrypt plaintext, scaled to 1e6 to match how submitBid encoded
// the encrypted amount. The FHE backend uses this to pick a winner; the
// Canton backend ignores it (Daml CloseAndReveal handles atomic settlement
// via its disclosure model instead).
export interface BidPlaintext {
  bidder: string;
  plaintext: bigint;
}

export interface RevealRequest {
  selectionMethod: "lowest-bid" | "highest-bid" | "specific";
  specificBidder?: string;
  // Required for the FHE backend's reveal path (manager-decrypt-and-publish
  // flow). Ignored by the Canton backend. If the caller never collected
  // plaintexts, the FHE backend raises "decryption proof required" — the
  // coarser "not wired" error no longer exists.
  decryptionProof?: BidPlaintext[];
}
