/**
 * SealedBidService
 *
 * Manages sealed-bid vendor selection rounds.
 * Composes with Fhenix: bids are encrypted (simulated with CoFHE-like handles),
 * and winner selection happens via off-chain "decryption" then on-chain reveal.
 *
 * In production, this interacts with SealedBidVendorSelection.sol on Fhenix.
 * In demo/dev mode, it uses an in-memory store with simulated encryption.
 */

import crypto from "node:crypto";
import logger from "../../utils/logger.js";
import { sharedFhenixPolicyService } from "./FhenixPolicyService.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type RoundStatus = "open" | "closed" | "revealed";
export type BidStatus = "pending" | "selected" | "rejected";

export interface BidSubmission {
  /** Agent/vendor identifier */
  bidder: string;
  /** FHE-encrypted bid amount (simulated ctHash string) */
  encryptedAmount: string;
  /** Commitment hash of the full proposal */
  proposalHash: string;
}

export interface BidRecord {
  bidder: string;
  encryptedAmount: string;
  proposalHash: string;
  status: BidStatus;
  submittedAt: string;
  /** Index within the round */
  index: number;
}

export interface SealedBidRound {
  roundId: string;
  description: string;
  serviceCategory: string;
  manager: string;
  deadline: string; // ISO timestamp
  maxBids: number;
  status: RoundStatus;
  bids: BidRecord[];
  winner: string | null;
  winningBid: number | null;
  winningProposalHash: string | null;
  createdAt: string;
}

export interface CreateRoundRequest {
  description: string;
  serviceCategory: string;
  deadline: string; // ISO timestamp
  maxBids: number;
}

export interface SubmitBidRequest {
  /** Agent/vendor wallet address */
  bidder: string;
  /** Plaintext bid amount (will be "encrypted" by the service) */
  amountUsd: number;
  /** Optional proposal details (will be hashed into proposalHash) */
  proposalDetails?: string;
}

export interface RevealRequest {
  /** How to select winner: "lowest-bid", "highest-bid", or a specific bidder address */
  selectionMethod: "lowest-bid" | "highest-bid" | "specific";
  /** If selectionMethod is "specific", the bidder address to select */
  specificBidder?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class SealedBidService {
  private rounds: Map<string, SealedBidRound> = new Map();
  private encryptFn:
    | ((value: bigint) => Promise<{ ctHash: string; utype: number }>)
    | null;

  constructor(
    encryptFn?: (value: bigint) => Promise<{ ctHash: string; utype: number }>,
  ) {
    this.encryptFn = encryptFn ?? null;
  }

  /**
   * Create a new sealed-bid round.
   */
  createRound(request: CreateRoundRequest, manager: string): SealedBidRound {
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
    };

    this.rounds.set(roundId, round);
    logger.info(`SealedBid: round created ${roundId} — ${request.description}`);

    return round;
  }

  /**
   * Submit a bid to an open round.
   * The bid amount is encrypted via CoFHE SDK (through the injected encryptFn).
   */
  async submitBid(roundId: string, request: SubmitBidRequest): Promise<BidRecord> {
    const round = this.rounds.get(roundId);
    if (!round) {
      throw new Error(`Round ${roundId} not found`);
    }
    if (round.status !== "open") {
      throw new Error("Round is not open for bids");
    }
    if (new Date(round.deadline) < new Date()) {
      throw new Error("Past round deadline");
    }
    if (round.bids.length >= round.maxBids) {
      throw new Error("Max bids reached for this round");
    }
    if (round.bids.some((b) => b.bidder === request.bidder)) {
      throw new Error("Bidder already submitted a bid");
    }

    if (!this.encryptFn) {
      throw new Error(
        "SealedBid: CoFHE encryption not configured — cannot accept bids",
      );
    }

    const scaledAmount = BigInt(Math.round(request.amountUsd * 1e6));
    const ct = await this.encryptFn(scaledAmount);
    const encryptedAmount = JSON.stringify({
      ctHash: ct.ctHash,
      utype: ct.utype,
    });

    // Hash proposal details if provided
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
      `SealedBid: bid submitted for round ${roundId} by ${request.bidder} (index ${bid.index})`,
    );

    return bid;
  }

  /**
   * Close a round to further bids.
   */
  closeRound(roundId: string, caller: string): SealedBidRound {
    const round = this.rounds.get(roundId);
    if (!round) {
      throw new Error(`Round ${roundId} not found`);
    }
    if (round.manager !== caller) {
      throw new Error("Only the round manager can close the round");
    }
    if (round.status !== "open") {
      throw new Error("Round is already closed");
    }

    round.status = "closed";
    logger.info(
      `SealedBid: round ${roundId} closed with ${round.bids.length} bids`,
    );

    return round;
  }

  /**
   * Reveal the winning bid after off-chain decryption.
   *
   * With real CoFHE encryption, revealing requires threshold decryption
   * of all bids. This is not yet wired — the method throws a clear error
   * rather than simulating decryption and pretending it's real.
   */
  async revealWinner(
    roundId: string,
    request: RevealRequest,
  ): Promise<SealedBidRound> {
    const round = this.rounds.get(roundId);
    if (!round) {
      throw new Error(`Round ${roundId} not found`);
    }
    if (round.status !== "closed") {
      throw new Error("Round must be closed before revealing winner");
    }
    if (round.bids.length === 0) {
      throw new Error("No bids submitted in this round");
    }

    throw new Error(
      "SealedBid: threshold decryption of real CoFHE bids is not yet wired — " +
        "reveal requires operator-side decrypt via FhenixPolicyService.unsealValue",
    );
  }

  /**
   * Get a round by ID.
   * Encrypted amounts are always returned as-is (CoFHE ciphertext handles).
   * Decryption requires the operator to call the /api/fhenix/decrypt endpoint
   * with a valid permit.
   */
  getRound(roundId: string, _includeDecrypted: boolean = false): SealedBidRound | null {
    return this.rounds.get(roundId) ?? null;
  }

  /**
   * List all rounds.
   */
  listRounds(): SealedBidRound[] {
    return Array.from(this.rounds.values());
  }

}

/** Shared singleton instance — wired to FhenixPolicyService for real CoFHE encryption */
export const sharedSealedBidService = new SealedBidService(
  async (value: bigint) => {
    const ct = await sharedFhenixPolicyService.encryptValue(value);
    return { ctHash: ct.ctHash.toString(), utype: ct.utype };
  },
);
