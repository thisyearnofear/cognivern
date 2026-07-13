import type {
  BackendName,
  BidRecord,
  CreateRoundRequest,
  RevealRequest,
  SealedBidRound,
  SubmitBidRequest,
} from "./types.js";

// Contract every sealed-bid backend must satisfy. The dispatcher
// (SealedBidService) routes each round to its owning backend based on the
// `backend` field chosen at createRound time.
export interface SealedBidBackend {
  readonly name: BackendName;

  createRound(request: CreateRoundRequest, manager: string): Promise<SealedBidRound>;
  submitBid(roundId: string, request: SubmitBidRequest): Promise<BidRecord>;
  closeRound(roundId: string, caller: string): Promise<SealedBidRound>;
  revealWinner(roundId: string, request: RevealRequest): Promise<SealedBidRound>;
  getRound(roundId: string): Promise<SealedBidRound | null>;
  listRounds(): Promise<SealedBidRound[]>;

  // Optional — admit a new eligible bidder into an already-open round. Only
  // backends with an on-ledger allow-list implement this (Canton). The FHE
  // backend has no eligibility gate, so it leaves this undefined and the
  // dispatcher reports it as unsupported for FHE rounds.
  addEligibleBidder?(
    roundId: string,
    newBidder: string,
    caller: string,
  ): Promise<SealedBidRound>;
}
