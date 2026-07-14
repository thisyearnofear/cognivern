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
} from "@backend/services/blockchain/SealedBidService.js";
import { AuditLogService } from "@backend/services/governance/AuditLogService.js";
import { Logger } from "@backend/shared/logging/Logger.js";
import { sharedWalletPartyRegistry } from "@backend/canton/WalletPartyRegistry.js";

const logger = new Logger("SealedBidController");

// Fire-and-forget so audit anchoring never blocks the HTTP response. If the
// CRE store or its downstream anchoring layers throw, we log and move on —
// the auction lifecycle itself is authoritative on Canton, not in cognivern.
function fireAndForgetAudit(
  audit: AuditLogService,
  eventType: string,
  details: Record<string, unknown>,
): void {
  audit
    .logEvent({
      eventType,
      agentType: "sealed_bid",
      timestamp: new Date(),
      details,
    })
    .catch((err) => logger.warn(`Audit anchor failed for ${eventType}`, err));
}

// The SIWE-verified wallet (set by sealedBidWriteAuth) in production workspace
// mode, else undefined. In production a bid is submitted as the Canton pool
// party this wallet maps to (see sharedWalletPartyRegistry) rather than a
// client-supplied persona — closing the impersonation gap on the real ledger.
// The auctioneer/manager role is NOT tied to the wallet; it stays the platform
// auctioneer.
function productionWallet(req: Request): string | undefined {
  const mode = (req.headers["x-workspace-mode"] as string)?.toLowerCase();
  return mode === "production" ? req.walletAddress : undefined;
}

const createRoundSchema = z.object({
  description: z.string().min(1),
  serviceCategory: z.string().min(1),
  deadline: z.string().min(1),
  maxBids: z.number().int().positive(),
  backend: z.enum(["fhe", "canton"]).optional(),
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
  private auditLog: AuditLogService;

  constructor(
    sealedBidService?: SealedBidService,
    auditLog?: AuditLogService,
  ) {
    this.sealedBidService = sealedBidService || sharedSealedBidService;
    this.auditLog = auditLog || new AuditLogService();
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

      const { description, serviceCategory, deadline, maxBids, backend } =
        parse.data;
      const manager =
        req.body.manager ||
        (backend === "canton"
          ? process.env.CANTON_DEMO_MANAGER_NAME || "Auctioneer"
          : undefined) ||
        (req.headers["x-api-key"] as string) ||
        "demo-manager";

      const request: CreateRoundRequest = {
        description,
        serviceCategory,
        deadline,
        maxBids,
        backend,
      };
      const round = await this.sealedBidService.createRound(request, manager);

      fireAndForgetAudit(this.auditLog, "sealed_bid.round_created", {
        roundId: round.roundId,
        backend: round.backend,
        manager: round.manager,
        description: round.description,
        serviceCategory: round.serviceCategory,
        deadline: round.deadline,
        maxBids: round.maxBids,
      });

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

      const { amountUsd, proposalDetails } = parse.data;
      // In production the bidder is the Canton pool party assigned to the
      // SIWE-verified wallet (custodial mapping); in sandbox it's the demo
      // persona from the request body.
      const wallet = productionWallet(req);
      const bidder = wallet
        ? await sharedWalletPartyRegistry.assign(wallet)
        : parse.data.bidder;
      const request: SubmitBidRequest = { bidder, amountUsd, proposalDetails };
      const bid = await this.sealedBidService.submitBid(roundId, request);

      // Note: amountUsd is intentionally excluded from the audit record — for
      // Canton rounds only the auctioneer should ever see it, and the audit
      // trail is fetched by anyone with an API key. proposalHash is a safe
      // commitment; ratcheting up transparency happens at reveal time.
      fireAndForgetAudit(this.auditLog, "sealed_bid.bid_submitted", {
        roundId,
        bidder: bid.bidder,
        proposalHash: bid.proposalHash,
        index: bid.index,
        submittedAt: bid.submittedAt,
      });

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
        (await this.sealedBidService.getRound(roundId))?.manager ||
        (req.headers["x-api-key"] as string) ||
        "demo-manager";

      const round = await this.sealedBidService.closeRound(roundId, caller);

      fireAndForgetAudit(this.auditLog, "sealed_bid.round_closed", {
        roundId: round.roundId,
        backend: round.backend,
        bidCount: round.bids.length,
        closedBy: caller,
      });

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

      // The reveal is the point where transparency is legitimate: the winning
      // amount and identity are meant to be public. Losing bids are already
      // archived on-ledger without disclosure — we don't fabricate their
      // amounts into the audit trail.
      fireAndForgetAudit(this.auditLog, "sealed_bid.winner_revealed", {
        roundId: round.roundId,
        backend: round.backend,
        selectionMethod: request.selectionMethod,
        winner: round.winner,
        winningBid: round.winningBid,
        winningProposalHash: round.winningProposalHash,
        totalBids: round.bids.length,
      });

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

      // includeDecrypted is a legacy toggle from the FHE flow; ciphertext
      // handles are always returned as-is regardless of the flag.
      void includeDecrypted;
      const round = await this.sealedBidService.getRound(roundId);
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
      const rounds = await this.sealedBidService.listRounds();

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
        backend: r.backend,
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
