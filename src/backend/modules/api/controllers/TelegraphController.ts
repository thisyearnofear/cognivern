/**
 * TelegraphController
 *
 * API endpoints for Telegraph Protocol integration status and miner discovery.
 */

import { Request, Response } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Logger } from "@backend/shared/logging/Logger.js";
import { telegraphService, telegraphGovernanceHelper, recordTelegraphGovernedCall, recordTelegraphGateDecision, runComplianceScreen, buildTelegraphLedgerReport } from "@backend/services/telegraph/index.js";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";

const logger = new Logger("TelegraphController");
const STATS_FILE = join(process.cwd(), "data", "telegraph-stats.json");

export class TelegraphController {
  /**
   * GET /api/telegraph/status
   *
   * Returns Telegraph integration status, node/engine/daemon health,
   * payment readiness, and available miners count.
   */
  async getStatus(_req: Request, res: Response) {
    try {
      const enabled = telegraphService.getEnabled();

      if (!enabled) {
        res.json({
          success: true,
          data: {
            enabled: false,
            reason: "Telegraph integration disabled or not configured",
            hint: "Set TELEGRAPH_ENABLED=true and TELEGRAPH_EVM_PRIVATE_KEY in environment",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [status, paymentReady, daemonHealth] = await Promise.all([
        telegraphService.getNodeStatus(),
        telegraphService.isReady(),
        telegraphService.getDaemonHealth(),
      ]);

      const config = telegraphService.getConfig();

      res.json({
        success: true,
        data: {
          enabled: true,
          healthy: status.healthy,
          nodeUrl: status.nodeUrl,
          engineUrl: config.engineUrl,
          daemonUrl: config.daemonUrl,
          minersAvailable: status.minersAvailable,
          lastRefresh: status.lastRefresh,
          confidenceThreshold: config.confidenceThreshold,
          network: config.evmNetwork,
          paymentReady,
          paymentError: paymentReady ? null : telegraphService.getPaymentInitError(),
          daemon: daemonHealth,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph status", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get Telegraph status",
      });
    }
  }

  /**
   * GET /api/telegraph/miners
   *
   * Returns list of available Telegraph miners with their details.
   * Optional query param: ?intent=WEATHER_FORECAST to filter by intent
   */
  async getMiners(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const intent = req.query.intent as string | undefined;
      const miners = await telegraphService.getMiners(intent);

      res.json({
        success: true,
        data: {
          miners: miners.map((m) => ({
            id: m.id ?? m.slug ?? m.name,
            slug: m.slug,
            name: m.name,
            description: m.description,
            endpoints: m.endpoints,
            intents: m.supported_intents ?? [],
            protocol: m.protocol,
            minPriceUsdc: m.min_price_usdc,
            minPriceUsd: m.min_price_usdc !== undefined ? (m.min_price_usdc / 1_000_000).toFixed(4) : undefined,
            totalRequestsServed: m.total_requests_served,
            scored: m.scored,
            topScore: m.scores?.[0]?.score,
            status: m.activation_status ?? m.status ?? "active",
          })),
          count: miners.length,
          filteredBy: intent ? { intent } : null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph miners", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get miners",
      });
    }
  }

  /**
   * GET /api/telegraph/intents
   *
   * Returns list of available intents and their miner counts.
   */
  async getIntents(_req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const intents = await telegraphService.getIntents();

      res.json({
        success: true,
        data: {
          intents: intents.map((i) => ({
            name: i.name,
            category: i.category,
            description: i.description,
            minerCount: i.minerCount,
            requestCount: i.requestCount,
          })),
          count: intents.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph intents", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get intents",
      });
    }
  }

  /**
   * GET /api/telegraph/miners/:minerId
   *
   * Returns details about a specific miner.
   */
  async getMiner(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const minerId = req.params.minerId;
      const miner = await telegraphService.getMiner(minerId);

      if (!miner) {
        res.status(404).json({
          success: false,
          error: `Miner ${minerId} not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: miner.id ?? miner.slug ?? miner.name,
          slug: miner.slug,
          name: miner.name,
          description: miner.description,
          endpoints: miner.endpoints,
          intents: miner.supported_intents ?? [],
          protocol: miner.protocol,
          signalMapping: miner.signal_mapping,
          minPriceUsdc: miner.min_price_usdc,
          minPriceUsd: miner.min_price_usdc !== undefined ? (miner.min_price_usdc / 1_000_000).toFixed(4) : undefined,
          totalRequestsServed: miner.total_requests_served,
          scored: miner.scored,
          scores: miner.scores,
          baseUrl: miner.base_url,
          walletAddress: miner.wallet_address,
          status: miner.activation_status ?? miner.status ?? "active",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph miner", { minerId: req.params.minerId, error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get miner",
      });
    }
  }

  /**
   * GET /api/telegraph/daemon/categories
   *
   * Returns daemon signal categories (free — no payment).
   */
  async getDaemonCategories(_req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const categories = await telegraphService.getDaemonCategories();
      res.json({
        success: true,
        data: {
          categories: categories.categories,
          stats: categories.stats.map((s) => ({
            name: s.name,
            count: s.count,
            avgInterest: s.avg_interest,
            maxInterest: s.max_interest,
          })),
          count: categories.categories.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get daemon categories", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get daemon categories",
      });
    }
  }

  /**
   * GET /api/telegraph/daemon/questions
   *
   * Returns daemon-collected signals, filterable by category/source.
   */
  async getDaemonQuestions(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const result = await telegraphService.getDaemonQuestions({
        category: req.query.category as string | undefined,
        source: req.query.source as string | undefined,
        sort: req.query.sort as string | undefined,
        since_hours: req.query.since_hours ? Number(req.query.since_hours) : undefined,
        min_interest: req.query.min_interest ? Number(req.query.min_interest) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      res.json({
        success: true,
        data: { questions: result.results, count: result.results.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get daemon questions", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get daemon questions",
      });
    }
  }

  /**
   * POST /api/telegraph/call
   *
   * Paid direct miner call through the governed path. The miner response is
   * confidence-gated and persisted as a CRE run: approved/failed calls
   * complete immediately, held calls pause for operator approval in the
   * escalation inbox.
   */
  async callMiner(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({ success: false, error: "Telegraph integration is not enabled" });
        return;
      }
      if (!req.workspaceId) {
        res.status(401).json({ success: false, error: "Workspace authentication required" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const minerId = typeof body.minerId === "string" ? body.minerId.trim() : "";
      if (!minerId) {
        res.status(400).json({ success: false, error: "minerId is required" });
        return;
      }
      const params =
        typeof body.params === "object" && body.params !== null
          ? (body.params as Record<string, unknown>)
          : {};
      const agentId =
        (typeof body.agentId === "string" && body.agentId.trim()) ||
        req.userId ||
        `workspace-${req.workspaceId}`;

      const result = await telegraphGovernanceHelper.governedMinerCall({
        agentId,
        workspaceId: req.workspaceId,
        mandateId: typeof body.mandateId === "string" ? body.mandateId : undefined,
        policyId: typeof body.policyId === "string" ? body.policyId : undefined,
        minerRequest: {
          minerId,
          intent: typeof body.intent === "string" ? body.intent : undefined,
          params,
          confidenceThreshold:
            typeof body.confidenceThreshold === "number" ? body.confidenceThreshold : undefined,
        },
        description:
          typeof body.description === "string" ? body.description : undefined,
      });

      const run = await recordTelegraphGovernedCall({
        result,
        projectId: req.workspaceId,
        agentId,
        description: typeof body.description === "string" ? body.description : undefined,
      });

      res.json({
        success: true,
        data: { ...result, runId: run?.runId ?? null, runStatus: run?.status ?? null },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Telegraph governed call endpoint failed", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to execute governed Telegraph call",
      });
    }
  }

  /**
   * POST /api/telegraph/engine-ask
   *
   * Paid engine-routed ask through the governed path (same CRE run
   * persistence as /api/telegraph/call).
   */
  async engineAsk(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({ success: false, error: "Telegraph integration is not enabled" });
        return;
      }
      if (!req.workspaceId) {
        res.status(401).json({ success: false, error: "Workspace authentication required" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) {
        res.status(400).json({ success: false, error: "query is required" });
        return;
      }
      const agentId =
        (typeof body.agentId === "string" && body.agentId.trim()) ||
        req.userId ||
        `workspace-${req.workspaceId}`;

      const result = await telegraphGovernanceHelper.governedEngineAsk({
        agentId,
        workspaceId: req.workspaceId,
        mandateId: typeof body.mandateId === "string" ? body.mandateId : undefined,
        policyId: typeof body.policyId === "string" ? body.policyId : undefined,
        engineRequest: {
          query,
          intent: typeof body.intent === "string" ? body.intent : undefined,
          confidenceThreshold:
            typeof body.confidenceThreshold === "number" ? body.confidenceThreshold : undefined,
        },
        description:
          typeof body.description === "string" ? body.description : undefined,
      });

      const run = await recordTelegraphGovernedCall({
        result,
        projectId: req.workspaceId,
        agentId,
        description: typeof body.description === "string" ? body.description : undefined,
      });

      res.json({
        success: true,
        data: { ...result, runId: run?.runId ?? null, runStatus: run?.status ?? null },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Telegraph governed engine ask failed", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to execute governed engine ask",
      });
    }
  }

  /**
   * POST /api/telegraph/compliant-call
   *
   * Compliance-on-payment (Mission 02): runs a screening call against a
   * compliance miner first, then — only on an explicit "clear" verdict —
   * executes the requested paid miner call. The parent run's
   * telegraph.signal artifact carries a `compliance` block linking the
   * screening run, so each settlement arrives with its proof attached.
   * A hit or inconclusive screen blocks the purchase; the blocked attempt
   * is itself persisted as a failed gate-decision run.
   *
   * Body: same as /api/telegraph/call plus:
   *   compliance: { minerId?, intent?, params: {...} }
   */
  async compliantCall(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({ success: false, error: "Telegraph integration is not enabled" });
        return;
      }
      if (!req.workspaceId) {
        res.status(401).json({ success: false, error: "Workspace authentication required" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const minerId = typeof body.minerId === "string" ? body.minerId.trim() : "";
      const compliance = body.compliance as Record<string, unknown> | undefined;
      const complianceParams =
        compliance && typeof compliance.params === "object" && compliance.params !== null
          ? (compliance.params as Record<string, unknown>)
          : null;

      if (!minerId) {
        res.status(400).json({ success: false, error: "minerId is required" });
        return;
      }
      if (!compliance || !complianceParams || Object.keys(complianceParams).length === 0) {
        res.status(400).json({
          success: false,
          error: "compliance.params is required — the subject to screen (e.g. name, address, tx hash)",
        });
        return;
      }

      const agentId =
        (typeof body.agentId === "string" && body.agentId.trim()) ||
        req.userId ||
        `workspace-${req.workspaceId}`;
      const mandateId = typeof body.mandateId === "string" ? body.mandateId : undefined;
      const description = typeof body.description === "string" ? body.description : undefined;

      const screen = await runComplianceScreen({
        agentId,
        workspaceId: req.workspaceId,
        mandateId,
        policyId: typeof body.policyId === "string" ? body.policyId : undefined,
        screen: {
          minerId: typeof compliance.minerId === "string" ? compliance.minerId : undefined,
          intent: typeof compliance.intent === "string" ? compliance.intent : undefined,
          params: complianceParams,
        },
        description,
      });

      const complianceBlock = {
        gate: "compliance",
        verdict: screen.verdict,
        detail: screen.detail ?? null,
        screeningRunId: screen.runId,
        screeningMinerId: screen.minerId ?? null,
        screeningMinerName: screen.minerName ?? null,
        intent: screen.intent ?? null,
        confidence: screen.confidence,
        costUsd: screen.costUsd ?? null,
      };

      if (screen.blocked) {
        const gateRun = await recordTelegraphGateDecision({
          projectId: req.workspaceId,
          agentId,
          mandateId,
          description,
          gate: "compliance",
          reason: screen.blockReason ?? `screening verdict ${screen.verdict}`,
          compliance: complianceBlock as unknown as Record<string, unknown>,
          intendedCall: { minerId, intent: body.intent ?? null, params: body.params ?? null },
        });
        res.json({
          success: true,
          data: {
            blocked: true,
            status: "denied",
            reason: screen.blockReason,
            compliance: complianceBlock,
            runId: gateRun?.runId ?? null,
            runStatus: gateRun?.status ?? null,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const params =
        typeof body.params === "object" && body.params !== null
          ? (body.params as Record<string, unknown>)
          : {};

      const result = await telegraphGovernanceHelper.governedMinerCall({
        agentId,
        workspaceId: req.workspaceId,
        mandateId,
        policyId: typeof body.policyId === "string" ? body.policyId : undefined,
        minerRequest: {
          minerId,
          intent: typeof body.intent === "string" ? body.intent : undefined,
          params,
          confidenceThreshold:
            typeof body.confidenceThreshold === "number" ? body.confidenceThreshold : undefined,
        },
        description,
      });

      // Attach the compliance proof to the payment's artifact before persisting.
      const artifactData = result.artifact?.data;
      if (artifactData && typeof artifactData === "object") {
        (artifactData as Record<string, unknown>).compliance = complianceBlock;
      }

      const run = await recordTelegraphGovernedCall({
        result,
        projectId: req.workspaceId,
        agentId,
        description,
      });

      res.json({
        success: true,
        data: {
          ...result,
          blocked: false,
          compliance: complianceBlock,
          runId: run?.runId ?? null,
          runStatus: run?.status ?? null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Telegraph compliant call endpoint failed", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to execute compliant Telegraph call",
      });
    }
  }

  /**
   * GET /api/telegraph/ledger
   *
   * Expense-ledger projection over persisted telegraph.signal CRE runs for
   * the requesting workspace: settlement count, burn by intent/miner/
   * mandate, and per-call dispositions including held-signal resolution.
   */
  async getLedger(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({ success: false, error: "Telegraph integration is not enabled" });
        return;
      }
      if (!req.workspaceId) {
        res.status(401).json({ success: false, error: "Workspace authentication required" });
        return;
      }

      const runs = await creRunStore.list();
      const workspaceRuns = runs.filter((run) => run.projectId === req.workspaceId);

      res.json({
        success: true,
        data: buildTelegraphLedgerReport(workspaceRuns),
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to build Telegraph ledger", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to build Telegraph ledger",
      });
    }
  }

  /**
   * GET /api/telegraph/stats
   *
   * Returns governed consumption stats accumulated by the signal digest
   * (real paid miner calls with approve/hold decisions). Read from
   * data/telegraph-stats.json, which the digest writes on the VPS.
   */
  async getStats(_req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      if (!existsSync(STATS_FILE)) {
        res.json({
          success: true,
          data: {
            available: false,
            reason: "No digest run yet — stats accumulate when the signal digest runs",
            totalCalls: 0,
            approved: 0,
            held: 0,
            failed: 0,
            totalSpendUsd: 0,
            lastRun: null,
            calls: [],
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const raw = readFileSync(STATS_FILE, "utf-8");
      const stats = JSON.parse(raw) as {
        totalCalls?: number;
        approved?: number;
        held?: number;
        failed?: number;
        totalSpendUsd?: number;
        lastRun?: string | null;
        calls?: Array<Record<string, unknown>>;
      };

      res.json({
        success: true,
        data: {
          available: true,
          totalCalls: stats.totalCalls ?? 0,
          approved: stats.approved ?? 0,
          held: stats.held ?? 0,
          failed: stats.failed ?? 0,
          totalSpendUsd: stats.totalSpendUsd ?? 0,
          lastRun: stats.lastRun ?? null,
          calls: stats.calls ?? [],
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph stats", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get Telegraph stats",
      });
    }
  }
}
