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
// handles; the round metadata lives in memory.
//
// Reveal flow (Option B trust model):
//   1. Caller (manager's coFHE permit holder) decrypts each bid amount
//      off-chain via @cofhe/sdk decryptForView with their permit.
//   2. Caller submits revealWinner(roundId, { selectionMethod, decryptionProof })
//      with the plaintexts in the bundle.
//   3. This backend trusts the plaintexts (the in-memory backend has nothing
//      to verify against), selects the winner per selectionMethod, marks
//      losers rejected + winner selected, and commits the round state.
//   4. The on-chain SealedBidVendorSelection.publishWinner is the contract
//      counterpart; in this in-memory backend no chain call is made — the
//      `submitBid` roundId space here is not the contract's.
//
// The Canton backend supersedes the FHE backend for canonical workflows
// (atomic Daml CloseAndReveal). The FHE backend supports the manager-
// decrypt-and-publish flow as an alternative for cases where Daml isn't
// available, mirroring the contract surface 1-to-1 in spirit.
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

  /**
   * Reveal the winner of a closed round via the manager-decrypt-and-publish
   * flow. Each bid amount was encrypted by submitBid at 1e6 scale; the
   * decryption-proof entries carry the same scale and the backend divides by
   * 1e6 for the public-facing winningBid.
   *
   * Errors with named reasons so callers can differentiate "manager has not
   * yet decrypted" from "missing bid plaintext". The legacy 'not wired'
   * error is gone.
   */
  async revealWinner(
    roundId: string,
    request: RevealRequest,
  ): Promise<SealedBidRound> {
    const round = this.rounds.get(roundId);
    if (!round) throw new Error(`Round ${roundId} not found`);
    if (round.status !== "closed")
      throw new Error("Round must be closed before revealing winner");
    if (round.bids.length === 0)
      throw new Error("No bids submitted in this round");
    if (!request.decryptionProof || request.decryptionProof.length === 0)
      throw new Error(
        "SealedBid[fhe]: decryption proof required — manager-decrypt-and-publish flow needs decryptionProof with each bid's plaintext reverted from CoFHE decryptForView",
      );

    // Build bidder -> plaintext map. The proof MUST cover every bid; we
    // cannot encrypt-side cross-check without the coFHE library surface
    // beyond what's available in this in-memory backend, but missing-bidder
    // detection below is a structural guard.
    const plaintextByBidder = new Map<string, bigint>();
    for (const entry of request.decryptionProof) {
      if (plaintextByBidder.has(entry.bidder))
        throw new Error(
          `SealedBid[fhe]: decryptionProof has duplicate entry for bidder ${entry.bidder}`,
        );
      plaintextByBidder.set(entry.bidder, entry.plaintext);
    }
    for (const bid of round.bids) {
      if (!plaintextByBidder.has(bid.bidder))
        throw new Error(
          `SealedBid[fhe]: decryptionProof missing plaintext for bidder ${bid.bidder}`,
        );
    }

    // Select winner per selectionMethod.
    let winnerBid: BidRecord | null = null;
    let winningScaled: bigint | null = null;

    switch (request.selectionMethod) {
      case "lowest-bid": {
        for (const bid of round.bids) {
          const amount = plaintextByBidder.get(bid.bidder)!;
          if (winningScaled === null || amount < winningScaled) {
            winningScaled = amount;
            winnerBid = bid;
          }
        }
        break;
      }
      case "highest-bid": {
        for (const bid of round.bids) {
          const amount = plaintextByBidder.get(bid.bidder)!;
          if (winningScaled === null || amount > winningScaled) {
            winningScaled = amount;
            winnerBid = bid;
          }
        }
        break;
      }
      case "specific": {
        if (!request.specificBidder)
          throw new Error(
            "SealedBid[fhe]: selectionMethod=specific requires specificBidder",
          );
        for (const bid of round.bids) {
          if (bid.bidder === request.specificBidder) {
            winnerBid = bid;
            winningScaled = plaintextByBidder.get(bid.bidder)!;
            break;
          }
        }
        if (!winnerBid)
          throw new Error(
            `SealedBid[fhe]: specificBidder ${request.specificBidder} did not submit a bid`,
          );
        break;
      }
    }

    if (!winnerBid || winningScaled === null)
      throw new Error("SealedBid[fhe]: no winner determined");

    // Mark losers rejected + winner selected; commit round state.
    for (const bid of round.bids) {
      bid.status =
        bid.bidder === winnerBid.bidder ? "selected" : "rejected";
    }
    round.winner = winnerBid.bidder;
    round.winningBid = Number(winningScaled) / 1e6;
    round.winningProposalHash = winnerBid.proposalHash;
    round.status = "revealed";
    logger.info(
      `SealedBid[fhe]: round ${roundId} revealed — winner ${winnerBid.bidder} at $${round.winningBid}`,
    );
    return round;
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async listRounds(): Promise<SealedBidRound[]> {
    return Array.from(this.rounds.values());
  }
}
