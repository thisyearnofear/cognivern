/**
 * SealedBidController
 *
 * API endpoints for sealed-bid vendor selection.
 * Composes with the Fhenix confidential layer: bids are submitted in
 * encrypted form, and winner selection follows the two-phase pattern
 * (submit encrypted → off-chain decrypt → reveal on-chain).
 */

import { Request, Response } from "express";
import { z } from "zod";
import {
  sharedSealedBidService,
  SealedBidService,
  CreateRoundRequest,
  SubmitBidRequest,
  RevealRequest,
} from "../../../services/blockchain/SealedBidService.js";
import { Logger } from "../../../shared/logging/Logger.js";

const logger = new Logger("SealedBidController");

const createRoundSchema = z.object({
  description: z.string().min(1),
  serviceCategory: z.string().min(1),
  deadline: z.string().min(1),
  maxBids: z.number().int().positive(),
});

const submitBidSchema = z.object({
  bidder: z.string().min(1),
  amountUsd: z.number().positive(),
  proposalDetails: z.string().optional(),
});

const revealSchema = z.object({
  selectionMethod: z.enum(["lowest-bid", "highest-bid", "specific"]),
  specificBidder: z.string().optional(),
});

export class SealedBidController {
  private sealedBidService: SealedBidService;

  constructor(sealedBidService?: SealedBidService) {
    this.sealedBidService = sealedBidService || sharedSealedBidService;
  }

  /**
   * POST /api/vendor/sealed-bid/rounds
   * Create a new sealed-bid round.
   */
  async createRound(req: Request, res: Response) {
    try {
      const parse = createRoundSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid round creation payload",
          details: parse.error.format(),
        });
        return;
      }

      const { description, serviceCategory, deadline, maxBids } = parse.data;
      const manager =
        req.body.manager ||
        (req.headers["x-api-key"] as string) ||
        "demo-manager";

      const request: CreateRoundRequest = {
        description,
        serviceCategory,
        deadline,
        maxBids,
      };
      const round = this.sealedBidService.createRound(request, manager);

      res.status(201).json({
        success: true,
        data: round,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("SealedBid: createRound failed", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create sealed-bid round",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/vendor/sealed-bid/rounds/:roundId/bid
   * Submit an encrypted bid to a round.
   */
  async submitBid(req: Request, res: Response) {
    try {
      const { roundId } = req.params;

      const parse = submitBidSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid bid payload",
          details: parse.error.format(),
        });
        return;
      }

      const { bidder, amountUsd, proposalDetails } = parse.data;
      const request: SubmitBidRequest = { bidder, amountUsd, proposalDetails };
      const bid = await this.sealedBidService.submitBid(roundId, request);

      res.status(201).json({
        success: true,
        data: {
          bidder: bid.bidder,
          encryptedAmount: bid.encryptedAmount,
          proposalHash: bid.proposalHash,
          index: bid.index,
          submittedAt: bid.submittedAt,
          status: bid.status,
          note: "Bid submitted in encrypted form — FHE guarantees amount stays sealed until reveal",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        `SealedBid: submitBid failed for round ${req.params.roundId}`,
        error,
      );
      res.status(error.message?.includes("not found") ? 404 : 400).json({
        success: false,
        error: error.message || "Failed to submit bid",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/vendor/sealed-bid/rounds/:roundId/close
   * Close a round to new bids.
   */
  async closeRound(req: Request, res: Response) {
    try {
      const { roundId } = req.params;
      const caller =
        req.body.manager ||
        (req.headers["x-api-key"] as string) ||
        "demo-manager";

      const round = this.sealedBidService.closeRound(roundId, caller);

      res.status(200).json({
        success: true,
        data: {
          roundId: round.roundId,
          status: round.status,
          bidCount: round.bids.length,
          note: `Round closed with ${round.bids.length} encrypted bids`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        `SealedBid: closeRound failed for ${req.params.roundId}`,
        error,
      );
      res.status(error.message?.includes("not found") ? 404 : 400).json({
        success: false,
        error: error.message || "Failed to close round",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/vendor/sealed-bid/rounds/:roundId/reveal
   * Reveal the winning bid after off-chain "decryption".
   */
  async revealWinner(req: Request, res: Response) {
    try {
      const { roundId } = req.params;

      const parse = revealSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid reveal payload",
          details: parse.error.format(),
        });
        return;
      }

      const { selectionMethod, specificBidder } = parse.data;
      const request: RevealRequest = { selectionMethod, specificBidder };

      const round = await this.sealedBidService.revealWinner(roundId, request);

      res.status(200).json({
        success: true,
        data: {
          roundId: round.roundId,
          winner: round.winner,
          winningBid: round.winningBid,
          winningProposalHash: round.winningProposalHash,
          status: round.status,
          totalBids: round.bids.length,
          note: `Winner revealed: ${round.winner} at $${round.winningBid} — all losing bids remain encrypted`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        `SealedBid: revealWinner failed for ${req.params.roundId}`,
        error,
      );
      res.status(error.message?.includes("not found") ? 404 : 400).json({
        success: false,
        error: error.message || "Failed to reveal winner",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/vendor/sealed-bid/rounds/:roundId
   * Get round details.
   */
  async getRound(req: Request, res: Response) {
    try {
      const { roundId } = req.params;
      const includeDecrypted = req.query.decrypted === "true";

      const round = this.sealedBidService.getRound(roundId, includeDecrypted);
      if (!round) {
        res.status(404).json({
          success: false,
          error: `Round ${roundId} not found`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: round,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        `SealedBid: getRound failed for ${req.params.roundId}`,
        error,
      );
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get round",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/vendor/sealed-bid/rounds
   * List all sealed-bid rounds.
   */
  async listRounds(req: Request, res: Response) {
    try {
      const rounds = this.sealedBidService.listRounds();

      const summary = rounds.map((r) => ({
        roundId: r.roundId,
        description: r.description,
        serviceCategory: r.serviceCategory,
        status: r.status,
        bidCount: r.bids.length,
        maxBids: r.maxBids,
        deadline: r.deadline,
        winner: r.winner,
        winningBid: r.winningBid,
        createdAt: r.createdAt,
      }));

      res.status(200).json({
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("SealedBid: listRounds failed", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list rounds",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default SealedBidController;
