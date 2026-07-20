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
import {
  startAgentRoundCreation,
  evaluateClosePolicy,
  recordSealedBidEvent,
  getGovernanceTimeline,
} from "@backend/cre/workflows/sealedBidGovernance.js";

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
  settlementAmount: z.number().positive().optional(),
  settlementAssetTag: z.string().optional(),
  agentId: z.string().min(1).optional(),
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
   * Called once by ApiModule during startup. Rebuilds the in-memory
   * round→governance mapping from persisted CRE runs so that agent-governed
   * rounds survive a process restart.
   */
  async initialize(): Promise<void> {
    try {
      await sharedSealedBidService.bootstrapGovernance();
    } catch (error) {
      logger.warn(
        "Failed to bootstrap sealed-bid governance mapping; continuing without it",
        error,
      );
    }
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

      const {
        description,
        serviceCategory,
        deadline,
        maxBids,
        backend,
        settlementAmount,
        settlementAssetTag,
        agentId,
      } = parse.data;
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
        settlementAmount,
        settlementAssetTag,
      };
      const round = await this.sealedBidService.createRound(request, manager);

      // If an agent initiated this round, create the off-ledger governance run
      // and attach its metadata to the round record. The Daml contract itself
      // is unchanged — agent governance is an off-ledger layer.
      if (agentId) {
        const { runId } = await startAgentRoundCreation({
          agentId,
          roundId: round.roundId,
          roundParams: {
            description,
            serviceCategory,
            maxBids,
            deadline,
            settlementAmount,
            settlementAssetTag,
          },
        });
        this.sealedBidService.setGovernance(round.roundId, {
          createdByAgent: agentId,
          governanceRunId: runId,
        });
      }

      // Re-fetch so the response includes any governance metadata attached above.
      const roundWithGovernance = await this.sealedBidService.getRound(
        round.roundId,
      );

      fireAndForgetAudit(this.auditLog, "sealed_bid.round_created", {
        roundId: round.roundId,
        backend: round.backend,
        manager: round.manager,
        description: round.description,
        serviceCategory: round.serviceCategory,
        deadline: round.deadline,
        maxBids: round.maxBids,
        createdByAgent: agentId ?? null,
      });

      res.status(201).json({
        success: true,
        data: roundWithGovernance,
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
      const { bid, governanceRunId } = await this.sealedBidService.submitBid(
        roundId,
        request,
      );

      // Note: amountUsd is intentionally excluded from the audit record — for
      // Canton rounds only the auctioneer should ever see it, and the audit
      // trail is fetched by anyone with an API key. proposalHash is a safe
      // commitment; ratcheting up transparency happens at reveal time.
      const bidAuditDetails: Record<string, unknown> = {
        roundId,
        bidder: bid.bidder,
        proposalHash: bid.proposalHash,
        index: bid.index,
        submittedAt: bid.submittedAt,
      };
      fireAndForgetAudit(this.auditLog, "sealed_bid.bid_submitted", bidAuditDetails);

      // For agent-governed rounds, also record a hash-signed event in the CRE
      // run ledger. amountUsd is intentionally excluded — same privacy rule.
      // The service returns the governance run id alongside the bid, so we avoid
      // an extra round-trip to look it up.
      if (governanceRunId) {
        recordSealedBidEvent({
          runId: governanceRunId,
          eventType: "bid_submitted",
          payload: {
            roundId,
            bidder: bid.bidder,
            proposalHash: bid.proposalHash,
            index: bid.index,
          },
        }).catch((err) =>
          logger.warn("Failed to record bid_submitted governance event", err),
        );
      }

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
      const roundBefore = await this.sealedBidService.getRound(roundId);
      if (!roundBefore) {
        res.status(404).json({
          success: false,
          error: `Round ${roundId} not found`,
        });
        return;
      }

      const caller =
        req.body.manager ||
        roundBefore.manager ||
        (req.headers["x-api-key"] as string) ||
        "demo-manager";

      // For agent-governed rounds, policy must pass before the close is
      // allowed. Non-agent rounds skip this gate entirely.
      let policyChecks;
      if (roundBefore.governanceRunId) {
        const result = await evaluateClosePolicy({
          runId: roundBefore.governanceRunId,
          roundId,
          bidCount: roundBefore.bids.length,
          deadline: roundBefore.deadline,
        });
        if (!result.allowed) {
          res.status(403).json({
            success: false,
            error: "Policy gate failed",
            policyChecks: result.checks,
            reason: result.reason,
            timestamp: new Date().toISOString(),
          });
          return;
        }
        policyChecks = result.checks;
      }

      const round = await this.sealedBidService.closeRound(roundId, caller);

      // Record the round_closed event in the CRE run ledger for agent-governed
      // rounds after the close succeeds.
      if (round.governanceRunId) {
        recordSealedBidEvent({
          runId: round.governanceRunId,
          eventType: "round_closed",
          payload: {
            roundId: round.roundId,
            bidCount: round.bids.length,
            closedBy: caller,
          },
        }).catch((err) =>
          logger.warn("Failed to record round_closed governance event", err),
        );
      }

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
          policyChecks,
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

      // For agent-governed rounds, record the winner_revealed event in the CRE
      // run ledger. The winning amount is public at reveal time via AuctionResult.
      if (round.governanceRunId) {
        recordSealedBidEvent({
          runId: round.governanceRunId,
          eventType: "winner_revealed",
          payload: {
            roundId: round.roundId,
            winner: round.winner,
            winningBid: round.winningBid,
            winningProposalHash: round.winningProposalHash,
            totalBids: round.bids.length,
          },
        }).catch((err) =>
          logger.warn(
            "Failed to record winner_revealed governance event",
            err,
          ),
        );
      }

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
   * GET /api/vendor/sealed-bid/rounds/:roundId/governance-timeline
   * Return the tamper-evident CRE run ledger timeline for an agent-governed
   * round. 404 if the round is not agent-governed.
   */
  async getGovernanceTimeline(req: Request, res: Response) {
    try {
      const { roundId } = req.params;
      const round = await this.sealedBidService.getRound(roundId);
      if (!round) {
        res.status(404).json({
          success: false,
          error: `Round ${roundId} not found`,
        });
        return;
      }

      if (!round.governanceRunId) {
        res.status(404).json({
          success: false,
          error: "Round is not agent-governed",
        });
        return;
      }

      const timeline = await getGovernanceTimeline(round.governanceRunId);
      res.status(200).json({
        success: true,
        data: timeline,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        `SealedBid: getGovernanceTimeline failed for ${req.params.roundId}`,
        error,
      );
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get governance timeline",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/vendor/sealed-bid/rounds/:roundId/party-view?party=<name>
   * Query the ledger AS the given party and return exactly the bids that party
   * can read on-ledger — real per-party disclosure, not a client-side filter.
   */
  async getPartyView(req: Request, res: Response) {
    try {
      const { roundId } = req.params;
      const party = (req.query.party as string)?.trim();
      if (!party) {
        res.status(400).json({
          success: false,
          error: "party query parameter is required",
        });
        return;
      }

      const view = await this.sealedBidService.partyView(roundId, party);
      res.status(200).json({
        success: true,
        data: view
          ? { supported: true, ...view }
          : { supported: false, party },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        `SealedBid: getPartyView failed for ${req.params.roundId}`,
        error,
      );
      res.status(error.message?.includes("not found") ? 404 : 400).json({
        success: false,
        error: error.message || "Failed to get party view",
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
        createdByAgent: r.createdByAgent,
        governanceRunId: r.governanceRunId,
      }));

      // Curated demo state: when CANTON_FEATURED_ROUNDS is set, the default
      // list shows only those rounds, in the listed order — keeping the live
      // product clean instead of surfacing every test/scratch round that ever
      // hit the ledger. Non-featured rounds still exist and stay reachable by
      // direct id; pass ?all=true to bypass the filter (admin/debug).
      const featured = (process.env.CANTON_FEATURED_ROUNDS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const showAll = req.query.all === "true";
      let data = summary;
      if (featured.length && !showAll) {
        const byId = new Map(summary.map((s) => [s.roundId, s]));
        data = featured
          .map((id) => byId.get(id))
          .filter((s): s is (typeof summary)[number] => Boolean(s));
      }

      res.status(200).json({
        success: true,
        data,
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
