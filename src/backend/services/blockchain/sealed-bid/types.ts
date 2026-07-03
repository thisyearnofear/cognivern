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
}

export interface RevealRequest {
  selectionMethod: "lowest-bid" | "highest-bid" | "specific";
  specificBidder?: string;
}
