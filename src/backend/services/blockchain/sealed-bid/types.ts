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

export interface RevealRequest {
  selectionMethod: "lowest-bid" | "highest-bid" | "specific";
  specificBidder?: string;
}
