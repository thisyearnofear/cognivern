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
import logger from "../utils/logger.js";

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
   * The bid amount is "encrypted" using a deterministic noise function
   * (simulating FHE encryption — in production this uses CoFHE SDK).
   */
  submitBid(roundId: string, request: SubmitBidRequest): BidRecord {
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

    // "Encrypt" the bid amount — in production this uses CoFHE SDK encrypt
    const encryptedAmount = this.simulateEncrypt(request.amountUsd);

    // Hash proposal details if provided
    const proposalHash = request.proposalDetails
      ? "0x" + crypto.createHash("sha256").update(request.proposalDetails).digest("hex")
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
   * Reveal the winning bid after "decrypting" all bids off-chain.
   *
   * Simulates the two-phase pattern:
   *   Agent submits encrypted bid → operator decrypts off-chain →
   *   revealWinner publishes the result on-chain
   */
  revealWinner(roundId: string, request: RevealRequest): SealedBidRound {
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

    // "Decrypt" all bids off-chain and pick winner
    const decryptedBids = round.bids.map((bid) => ({
      bidder: bid.bidder,
      amount: this.simulateDecrypt(bid.encryptedAmount),
      proposalHash: bid.proposalHash,
      index: bid.index,
    }));

    let winnerIdx: number;

    switch (request.selectionMethod) {
      case "lowest-bid":
        winnerIdx = decryptedBids.reduce((best, current, idx) =>
          current.amount < decryptedBids[best].amount ? idx : best,
        0);
        break;
      case "highest-bid":
        winnerIdx = decryptedBids.reduce((best, current, idx) =>
          current.amount > decryptedBids[best].amount ? idx : best,
        0);
        break;
      case "specific": {
        if (!request.specificBidder) {
          throw new Error("specificBidder required for 'specific' selection");
        }
        const found = decryptedBids.findIndex(
          (b) => b.bidder.toLowerCase() === request.specificBidder!.toLowerCase(),
        );
        if (found === -1) {
          throw new Error(`Bidder ${request.specificBidder} not found in round`);
        }
        winnerIdx = found;
        break;
      }
      default:
        throw new Error(`Unknown selection method: ${request.selectionMethod}`);
    }

    const winner = decryptedBids[winnerIdx];

    // Update round state
    round.winner = winner.bidder;
    round.winningBid = winner.amount;
    round.winningProposalHash = winner.proposalHash;
    round.status = "revealed";

    // Mark winning bid as selected, rest as rejected
    for (const bid of round.bids) {
      bid.status = bid.index === winnerIdx ? "selected" : "rejected";
    }

    logger.info(
      `SealedBid: winner revealed for round ${roundId} — ${winner.bidder} at $${winner.amount}`,
    );

    return round;
  }

  /**
   * Get a round by ID (with or without decrypted bid values).
   * When includeDecrypted is false, bids show encrypted amounts (privacy preserved).
   * When includeDecrypted is true (owner/manager only), bids show decrypted amounts.
   */
  getRound(roundId: string, includeDecrypted: boolean = false): SealedBidRound | null {
    const round = this.rounds.get(roundId);
    if (!round) return null;

    if (!includeDecrypted) {
      // Return a sanitized copy — encrypted amounts stay as handles
      return round;
    }

    // Return with decrypted amounts for authorized viewers
    return {
      ...round,
      bids: round.bids.map((bid) => ({
        ...bid,
        encryptedAmount: this.simulateDecrypt(bid.encryptedAmount).toString(),
      })),
    };
  }

  /**
   * List all rounds.
   */
  listRounds(): SealedBidRound[] {
    return Array.from(this.rounds.values());
  }

  // ── Simulation helpers ─────────────────────────────────────────────────────

  /**
   * Simulate FHE encryption of a uint128 value.
   * Returns a hex string that looks like a CoFHE ciphertext handle.
   * In production, this uses the CoFHE SDK's client.encryptInputs().
   */
  private simulateEncrypt(value: number): string {
    const prefix = "0x08"; // ctHash prefix matching CoFHE format
    const payload = value.toString(16).padStart(16, "0");
    const noise = crypto.randomBytes(16).toString("hex");
    return `${prefix}${payload}${noise}`;
  }

  /**
   * Simulate CoFHE threshold decryption of a ciphertext handle.
   * Extracts the original value from our simulation format.
   * In production, this uses the CoFHE SDK's client.decryptForView().
   */
  private simulateDecrypt(ctHash: string): number {
    // Our simulation format: 0x08{16 hex chars of value}{32 hex chars of noise}
    const valueHex = ctHash.slice(4, 20); // After "0x08", 16 hex chars = 8 bytes
    return parseInt(valueHex, 16);
  }
}

/** Shared singleton instance */
export const sharedSealedBidService = new SealedBidService();
