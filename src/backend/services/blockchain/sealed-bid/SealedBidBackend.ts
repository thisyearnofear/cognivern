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
}
