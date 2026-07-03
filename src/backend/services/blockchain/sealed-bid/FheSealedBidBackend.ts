import crypto from "node:crypto";
import logger from "@backend/utils/logger.js";
import type { SealedBidBackend } from "./SealedBidBackend.js";
import type {
  BackendName,
  BidRecord,
  CreateRoundRequest,
  RevealRequest,
  SealedBidRound,
  SubmitBidRequest,
} from "./types.js";

export type EncryptFn = (
  value: bigint,
) => Promise<{ ctHash: string; utype: number }>;

// Fhenix CoFHE-backed sealed-bid backend. Bid amounts are held as ciphertext
// handles; the round metadata lives in memory. Reveal is not wired: threshold
// decryption of live CoFHE ciphertexts must go through
// FhenixPolicyService.unsealValue on the operator side, which the demo has
// never implemented. The Canton backend supersedes this for the reveal path.
export class FheSealedBidBackend implements SealedBidBackend {
  readonly name: BackendName = "fhe";
  private rounds = new Map<string, SealedBidRound>();

  constructor(private readonly encryptFn: EncryptFn | null = null) {}

  async createRound(
    request: CreateRoundRequest,
    manager: string,
  ): Promise<SealedBidRound> {
    const roundId = "0x" + crypto.randomBytes(32).toString("hex");
    const round: SealedBidRound = {
      roundId,
      description: request.description,
      serviceCategory: request.serviceCategory,
      manager,
      deadline: request.deadline,
      maxBids: request.maxBids,
      status: "open",
      bids: [],
      winner: null,
      winningBid: null,
      winningProposalHash: null,
      createdAt: new Date().toISOString(),
      backend: this.name,
    };
    this.rounds.set(roundId, round);
    logger.info(`SealedBid[fhe]: round created ${roundId} — ${request.description}`);
    return round;
  }

  async submitBid(
    roundId: string,
    request: SubmitBidRequest,
  ): Promise<BidRecord> {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Round ${roundId} not found`);
    if (round.status !== "open") throw new Error("Round is not open for bids");
    if (new Date(round.deadline) < new Date())
      throw new Error("Past round deadline");
    if (round.bids.length >= round.maxBids)
      throw new Error("Max bids reached for this round");
    if (round.bids.some((b) => b.bidder === request.bidder))
      throw new Error("Bidder already submitted a bid");
    if (!this.encryptFn)
      throw new Error(
        "SealedBid[fhe]: CoFHE encryption not configured — cannot accept bids",
      );

    const scaledAmount = BigInt(Math.round(request.amountUsd * 1e6));
    const ct = await this.encryptFn(scaledAmount);
    const encryptedAmount = JSON.stringify({
      ctHash: ct.ctHash,
      utype: ct.utype,
    });
    const proposalHash = request.proposalDetails
      ? "0x" +
        crypto
          .createHash("sha256")
          .update(request.proposalDetails)
          .digest("hex")
      : "0x" + crypto.randomBytes(32).toString("hex");

    const bid: BidRecord = {
      bidder: request.bidder,
      encryptedAmount,
      proposalHash,
      status: "pending",
      submittedAt: new Date().toISOString(),
      index: round.bids.length,
    };
    round.bids.push(bid);
    logger.info(
      `SealedBid[fhe]: bid submitted for round ${roundId} by ${request.bidder} (index ${bid.index})`,
    );
    return bid;
  }

  async closeRound(roundId: string, caller: string): Promise<SealedBidRound> {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Round ${roundId} not found`);
    if (round.manager !== caller)
      throw new Error("Only the round manager can close the round");
    if (round.status !== "open") throw new Error("Round is already closed");
    round.status = "closed";
    logger.info(
      `SealedBid[fhe]: round ${roundId} closed with ${round.bids.length} bids`,
    );
    return round;
  }

  async revealWinner(
    roundId: string,
    _request: RevealRequest,
  ): Promise<SealedBidRound> {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Round ${roundId} not found`);
    if (round.status !== "closed")
      throw new Error("Round must be closed before revealing winner");
    if (round.bids.length === 0)
      throw new Error("No bids submitted in this round");
    throw new Error(
      "SealedBid[fhe]: threshold decryption of real CoFHE bids is not wired — " +
        "use the canton backend for a working reveal, or wire " +
        "FhenixPolicyService.unsealValue for the FHE path",
    );
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async listRounds(): Promise<SealedBidRound[]> {
    return Array.from(this.rounds.values());
  }
}
