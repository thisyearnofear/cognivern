/**
 * TelegraphController
 *
 * API endpoints for Telegraph Protocol integration status and miner discovery.
 */

import { Request, Response } from "express";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Logger } from "@backend/shared/logging/Logger.js";
import {
  telegraphService,
  telegraphGovernanceHelper,
  recordTelegraphGovernedCall,
  recordTelegraphGateDecision,
  runComplianceScreen,
  buildTelegraphLedgerReport,
  buildTelegraphEvidenceBundle,
  evaluateParentSpendGuard,
  evaluatePostScreenSpendGuard,
  minerEstimatedCostUsd,
  normalizeSpendGuard,
  sha256CanonicalJson,
  subjectTerms,
  telegraphArtifactDataHash,
  TelegraphSpendGuardError,
} from "@backend/services/telegraph/index.js";
import { anjomanService } from "@backend/services/anjoman/index.js";
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
      // Anjoman is a separate rail (API key, not the node): report it even
      // when the direct-miner integration is disabled.
      const anjoman = await anjomanService.getStatus();

      if (!enabled) {
        res.json({
          success: true,
          data: {
            enabled: false,
            reason: "Telegraph integration disabled or not configured",
            hint: "Set TELEGRAPH_ENABLED=true and TELEGRAPH_EVM_PRIVATE_KEY in environment",
            anjoman,
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
          anjoman,
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
            minPriceUsd:
              m.min_price_usdc !== undefined
                ? (m.min_price_usdc / 1_000_000).toFixed(4)
                : undefined,
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
          minPriceUsd:
            miner.min_price_usdc !== undefined
              ? (miner.min_price_usdc / 1_000_000).toFixed(4)
              : undefined,
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
        description: typeof body.description === "string" ? body.description : undefined,
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
        description: typeof body.description === "string" ? body.description : undefined,
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
   * A hit, provider review, or uninterpretable screen blocks the purchase;
   * the blocked attempt is itself persisted as a failed gate-decision run.
   *
   * Body: same as /api/telegraph/call plus:
   *   compliance: { minerId?, intent?, params: {...} }
   *   spendGuard?: { maxScreeningCostUsd?, maxTotalCostUsd?, allowedMiners?,
   *     allowedIntents?, allowedScreenMiners?, allowedScreenIntents?,
   *     subjectAllowlist?, subjectDenylist?, consensusScreens?, budgetId? }
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
          error:
            "compliance.params is required — the subject to screen (e.g. name, address, tx hash)",
        });
        return;
      }

      let spendGuard;
      try {
        spendGuard = normalizeSpendGuard(body.spendGuard);
      } catch (error) {
        if (error instanceof TelegraphSpendGuardError) {
          res.status(400).json({ success: false, error: error.message });
          return;
        }
        throw error;
      }

      const agentId =
        (typeof body.agentId === "string" && body.agentId.trim()) ||
        req.userId ||
        `workspace-${req.workspaceId}`;
      const mandateId = typeof body.mandateId === "string" ? body.mandateId : undefined;
      const policyId = typeof body.policyId === "string" ? body.policyId : undefined;
      const description = typeof body.description === "string" ? body.description : undefined;
      const parentIntent = typeof body.intent === "string" ? body.intent : undefined;
      const parentParams =
        typeof body.params === "object" && body.params !== null
          ? (body.params as Record<string, unknown>)
          : {};

      const needsParentMiner = Boolean(
        spendGuard && (spendGuard.allowedMiners || spendGuard.maxTotalCostUsd !== null),
      );
      let parentMiner = null;
      let parentLookupError: string | null = null;
      if (needsParentMiner) {
        try {
          parentMiner = await telegraphService.getMiner(minerId);
        } catch (error) {
          parentLookupError = error instanceof Error ? error.message : String(error);
        }
      }
      const parentEstimatedCostUsd = minerEstimatedCostUsd(parentMiner);
      const parentPolicyViolations = evaluateParentSpendGuard({
        policy: spendGuard,
        requestedMinerId: minerId,
        miner: parentMiner,
        intent: parentIntent,
        subjectParams: complianceParams,
        minerLookupRequired: needsParentMiner,
        minerLookupError: parentLookupError,
      });

      const attemptId = randomUUID();
      const complianceSubject = subjectTerms(complianceParams);
      const parentParamTerms = subjectTerms(parentParams);
      const spendGuardEvidence = spendGuard
        ? {
            ...spendGuard,
            subjectAllowlist:
              spendGuard.subjectAllowlist?.map((value) => sha256CanonicalJson(value)) ?? null,
            subjectDenylist:
              spendGuard.subjectDenylist?.map((value) => sha256CanonicalJson(value)) ?? null,
          }
        : null;
      const requestEvidence = {
        bodyHash: sha256CanonicalJson(body),
        intendedCall: {
          minerId,
          minerName: parentMiner?.name ?? null,
          intent: parentIntent,
          paramsHash: sha256CanonicalJson(parentParams),
          paramFields: parentParamTerms.fields,
          estimatedCostUsd: parentEstimatedCostUsd,
        },
        compliance: {
          minerId: typeof compliance.minerId === "string" ? compliance.minerId : undefined,
          intent: typeof compliance.intent === "string" ? compliance.intent : undefined,
          paramsHash: sha256CanonicalJson(complianceParams),
          subjectFields: complianceSubject.fields,
        },
      };
      const replay = {
        endpoint: "POST /api/telegraph/compliant-call",
        cliCommand:
          "pnpm exec tsx tooling/scripts/agents/telegraph-demo.ts compliant-call '<json body>'",
      };
      const usdNumber = (value: unknown): number | null => {
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };
      const formatUsd = (value: number | null): string | null =>
        value === null ? null : value.toFixed(4);
      const costsFor = (screenCostUsd: unknown, parentCostUsd?: unknown) => {
        const screenUsd = typeof screenCostUsd === "string" ? screenCostUsd : null;
        const parentUsd = typeof parentCostUsd === "string" ? parentCostUsd : null;
        const screenNumber = usdNumber(screenCostUsd);
        const parentNumber = usdNumber(parentCostUsd);
        return {
          currency: "USD" as const,
          screeningUsd: screenUsd,
          parentEstimatedUsd: parentEstimatedCostUsd,
          parentUsd,
          totalUsd: formatUsd(
            screenNumber !== null || parentNumber !== null
              ? (screenNumber ?? 0) + (parentNumber ?? 0)
              : null,
          ),
        };
      };
      const complianceBlockFor = (
        gate: string,
        screen: Awaited<ReturnType<typeof runComplianceScreen>> | null,
        violations: string[],
        detailOverride?: string,
      ) => ({
        gate,
        verdict: screen?.verdict ?? "unknown",
        providerVerdict: screen?.providerVerdict ?? null,
        verdictSource: screen?.verdictSource ?? "none",
        detail: detailOverride ?? screen?.detail ?? null,
        screeningRunId: screen?.runId ?? null,
        screeningMinerId: screen?.minerId ?? null,
        screeningMinerName: screen?.minerName ?? null,
        intent: screen?.intent ?? null,
        confidence: screen?.confidence ?? null,
        costUsd: screen?.costUsd ?? null,
        estimatedCostUsd: screen?.estimatedCostUsd ?? null,
        latencyMs: screen?.latencyMs ?? null,
        paymentNetwork: screen?.paymentNetwork ?? null,
        rawResponseHash: screen?.rawResponseHash ?? null,
        source: screen?.source ?? null,
        listVersion: screen?.listVersion ?? null,
        subjectHash: screen?.subjectHash ?? sha256CanonicalJson(complianceParams),
        subjectFields: screen?.subjectFields ?? complianceSubject.fields,
        policyViolations: violations,
      });
      const screeningEvidence = (
        screen: Awaited<ReturnType<typeof runComplianceScreen>> | null,
      ) => {
        if (!screen) return null;
        const artifact = screen.run?.artifacts.find((item) => item.type === "telegraph.signal");
        return {
          status: screen.screeningSkipped
            ? ("skipped" as const)
            : screen.status === "failed"
              ? ("failed" as const)
              : ("completed" as const),
          runId: screen.runId,
          artifactId: artifact?.id ?? null,
          artifactHash: artifact ? telegraphArtifactDataHash(artifact.data) : null,
          artifactEvidenceHash: artifact?.evidence?.hash ?? null,
          minerId: screen.minerId ?? null,
          minerName: screen.minerName ?? null,
          intent: screen.intent ?? null,
          verdict: screen.verdict,
          providerVerdict: screen.providerVerdict ?? null,
          verdictSource: screen.verdictSource,
          detail: screen.detail ?? null,
          confidence: screen.confidence,
          costUsd: screen.costUsd ?? null,
          latencyMs: screen.latencyMs ?? null,
          paymentNetwork: screen.paymentNetwork ?? null,
          rawResponseHash: screen.rawResponseHash ?? null,
          source: screen.source ?? null,
          listVersion: screen.listVersion ?? null,
        };
      };
      const denyAttempt = async (params: {
        gate: "compliance" | "spend_guard";
        reason: string;
        screen: Awaited<ReturnType<typeof runComplianceScreen>> | null;
        violations: string[];
      }) => {
        const gateRunId = randomUUID();
        const gateArtifactId = randomUUID();
        const timestamp = new Date().toISOString();
        const complianceBlock = complianceBlockFor(
          params.gate,
          params.screen,
          params.violations,
          params.reason,
        );
        const intendedCall = {
          minerId,
          intent: parentIntent ?? null,
          params: parentParams,
        };
        const gateArtifactCore = {
          agentId,
          mandateId,
          description,
          gate: {
            name: params.gate,
            decision: "blocked",
            reason: params.reason,
          },
          compliance: complianceBlock,
          intendedCall,
          cost: { usd: "0", paymentMethod: "x402", paid: false },
          timestamp,
        };
        const evidenceBundle = buildTelegraphEvidenceBundle({
          attemptId,
          workspaceId: req.workspaceId!,
          agentId,
          mandateId,
          policyId,
          description,
          request: requestEvidence,
          screening: screeningEvidence(params.screen),
          gate: {
            decision: "deny",
            name: params.gate,
            reason: params.reason,
            runId: gateRunId,
            artifactId: gateArtifactId,
            artifactHash: telegraphArtifactDataHash(gateArtifactCore),
          },
          settlement: { status: "not_attempted" },
          spendGuard: spendGuardEvidence,
          policyViolations: params.violations,
          costs: costsFor(params.screen?.costUsd),
          replay,
        });
        const gateRun = await recordTelegraphGateDecision({
          projectId: req.workspaceId,
          agentId,
          mandateId,
          runId: gateRunId,
          artifactId: gateArtifactId,
          timestamp,
          description,
          gate: params.gate,
          reason: params.reason,
          compliance: complianceBlock as unknown as Record<string, unknown>,
          intendedCall,
          evidenceBundle,
        });
        res.json({
          success: true,
          data: {
            blocked: true,
            status: "denied",
            reason: params.reason,
            compliance: complianceBlock,
            spendGuard,
            policyViolations: params.violations,
            evidenceBundle,
            runId: gateRun?.runId ?? null,
            runStatus: gateRun?.status ?? null,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        });
      };

      if (parentPolicyViolations.length > 0) {
        await denyAttempt({
          gate: "spend_guard",
          reason: parentPolicyViolations.join("; "),
          screen: null,
          violations: parentPolicyViolations,
        });
        return;
      }

      const screen = await runComplianceScreen({
        agentId,
        workspaceId: req.workspaceId,
        mandateId,
        policyId,
        screen: {
          minerId: typeof compliance.minerId === "string" ? compliance.minerId : undefined,
          intent: typeof compliance.intent === "string" ? compliance.intent : undefined,
          params: complianceParams,
        },
        description,
        spendGuard,
        parentEstimatedCostUsd,
      });
      const screenViolations = screen.policyViolations ?? [];

      if (screen.blocked) {
        await denyAttempt({
          gate: screenViolations.length > 0 ? "spend_guard" : "compliance",
          reason: screen.blockReason ?? `screening verdict ${screen.verdict}`,
          screen,
          violations: screenViolations,
        });
        return;
      }

      const postScreenViolations = evaluatePostScreenSpendGuard({
        policy: spendGuard,
        actualScreenCostUsd: screen.costUsd,
        parentEstimatedCostUsd,
      });
      if (postScreenViolations.length > 0) {
        await denyAttempt({
          gate: "spend_guard",
          reason: postScreenViolations.join("; "),
          screen,
          violations: postScreenViolations,
        });
        return;
      }

      const result = await telegraphGovernanceHelper.governedMinerCall({
        agentId,
        workspaceId: req.workspaceId,
        mandateId,
        policyId,
        minerRequest: {
          minerId,
          intent: parentIntent,
          params: parentParams,
          confidenceThreshold:
            typeof body.confidenceThreshold === "number" ? body.confidenceThreshold : undefined,
        },
        description,
      });

      const parentRunId = randomUUID();
      const parentArtifactId = result.artifact?.id ?? randomUUID();
      const complianceBlock = complianceBlockFor("compliance", screen, []);
      const meta = result.response?.metadata;
      const artifactData =
        result.artifact?.data &&
        typeof result.artifact.data === "object" &&
        result.artifact.data !== null
          ? (result.artifact.data as Record<string, unknown>)
          : ({
              agentId,
              workspaceId: req.workspaceId,
              mandateId,
              policyId,
              description,
              miner: {
                id: meta?.minerId ?? minerId,
                name: meta?.minerName ?? parentMiner?.name ?? null,
                intent: meta?.intent ?? parentIntent,
              },
              signal: {
                data: result.response?.data ?? null,
                confidence: meta?.confidence ?? null,
                confidenceThreshold: result.decision?.threshold ?? null,
                confidenceMet: result.decision?.confidenceMet ?? false,
              },
              cost: {
                usd: meta?.costUsd ?? "0",
                paymentMethod: "x402",
                paid: meta?.paid ?? false,
                paymentNetwork: meta?.paymentNetwork,
              },
              latencyMs: meta?.latencyMs,
              timestamp: meta?.timestamp ?? new Date().toISOString(),
              error: result.error,
            } as Record<string, unknown>);

      artifactData.compliance = complianceBlock;
      const parentArtifactHash = telegraphArtifactDataHash(artifactData);
      const parentCostUsd = meta?.costUsd ?? null;
      const evidenceBundle = buildTelegraphEvidenceBundle({
        attemptId,
        workspaceId: req.workspaceId,
        agentId,
        mandateId,
        policyId,
        description,
        request: requestEvidence,
        screening: screeningEvidence(screen),
        gate: {
          decision: "allow",
          name: "compliance",
          runId: parentRunId,
          artifactId: parentArtifactId,
          artifactHash: parentArtifactHash,
        },
        settlement: {
          status:
            result.status === "approved" ? "settled" : result.status === "held" ? "held" : "failed",
          runId: parentRunId,
          artifactId: parentArtifactId,
          artifactHash: parentArtifactHash,
          minerId: meta?.minerId ?? minerId,
          minerName: meta?.minerName ?? parentMiner?.name ?? null,
          intent: meta?.intent ?? parentIntent ?? null,
          costUsd: parentCostUsd,
          paid: meta?.paid ?? false,
          paymentNetwork: meta?.paymentNetwork ?? null,
          latencyMs: meta?.latencyMs ?? null,
        },
        spendGuard: spendGuardEvidence,
        policyViolations: [],
        costs: costsFor(screen.costUsd, parentCostUsd),
        replay,
      });
      artifactData.evidenceBundle = evidenceBundle;

      const run = await recordTelegraphGovernedCall({
        result,
        projectId: req.workspaceId,
        agentId,
        description,
        runId: parentRunId,
        artifactId: parentArtifactId,
        artifactExtras: artifactData,
      });

      res.json({
        success: true,
        data: {
          ...result,
          blocked: false,
          compliance: complianceBlock,
          spendGuard,
          policyViolations: [],
          evidenceBundle,
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
   * GET /api/telegraph/evidence/:runId
   *
   * Returns the shareable evidence bundle attached to a compliant-call gate
   * or settlement artifact. The bundle contains hashes, run linkage, policy
   * checks, costs, and replay metadata — not the screened subject.
   */
  async getEvidence(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({ success: false, error: "Telegraph integration is not enabled" });
        return;
      }
      if (!req.workspaceId) {
        res.status(401).json({ success: false, error: "Workspace authentication required" });
        return;
      }

      const runId = req.params.runId;
      await creRunStore.refresh();
      const run = await creRunStore.get(runId);
      if (!run || run.projectId !== req.workspaceId) {
        res.status(404).json({ success: false, error: `Run ${runId} not found` });
        return;
      }
      const artifact = [...run.artifacts]
        .reverse()
        .find((item) => item.type === "telegraph.signal");
      const data =
        artifact?.data && typeof artifact.data === "object" && artifact.data !== null
          ? (artifact.data as Record<string, unknown>)
          : null;
      const evidenceBundle = data?.evidenceBundle;
      if (!artifact || !data || !evidenceBundle || typeof evidenceBundle !== "object") {
        res.status(404).json({
          success: false,
          error: `Run ${runId} does not carry a Telegraph evidence bundle`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          runId,
          artifactId: artifact.id,
          artifactHash: telegraphArtifactDataHash(data),
          artifactEvidenceHash: artifact.evidence?.hash ?? null,
          evidenceBundle,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph evidence bundle", { error, runId: req.params.runId });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get Telegraph evidence bundle",
      });
    }
  }

  /**
   * POST /api/telegraph/anjoman-task
   *
   * Delegated multi-specialist task through the Anjoman agent API. Anjoman
   * plans the request, fans out to ranked Telegraph specialists, retries
   * failures, and returns one combined answer with `sources` and `costUsd` —
   * paid from the account's API-key balance rather than per-call x402.
   *
   * Same governed persistence as /api/telegraph/call: the task is recorded as
   * a CRE run carrying a telegraph.signal artifact. Anjoman answers carry no
   * per-miner confidence, so completed tasks hold for operator review — the
   * same fail-safe contract as miners without a confidence field.
   *
   * Body: { message | intent + params, maxSpendUsd?, conversationId?,
   *         agentId?, mandateId?, policyId?, description? }
   */
  async anjomanTask(req: Request, res: Response) {
    try {
      if (!anjomanService.isEnabled()) {
        res.status(503).json({
          success: false,
          error: "Anjoman integration is not enabled — set ANJOMAN_API_KEY",
        });
        return;
      }
      if (!req.workspaceId) {
        res.status(401).json({ success: false, error: "Workspace authentication required" });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const intent = typeof body.intent === "string" ? body.intent : undefined;
      const params =
        typeof body.params === "object" && body.params !== null
          ? (body.params as Record<string, unknown>)
          : undefined;

      if (!message && !intent) {
        res.status(400).json({
          success: false,
          error: "message is required — or pass intent + params for a canonical ask",
        });
        return;
      }
      if (intent && !params) {
        res.status(400).json({
          success: false,
          error: "params is required when calling an intent directly",
        });
        return;
      }

      const agentId =
        (typeof body.agentId === "string" && body.agentId.trim()) ||
        req.userId ||
        `workspace-${req.workspaceId}`;
      const description = typeof body.description === "string" ? body.description : undefined;

      const result = await telegraphGovernanceHelper.governedAnjomanTask({
        agentId,
        workspaceId: req.workspaceId,
        mandateId: typeof body.mandateId === "string" ? body.mandateId : undefined,
        policyId: typeof body.policyId === "string" ? body.policyId : undefined,
        task: {
          message: message || undefined,
          intent,
          params,
          conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
          maxSpendUsd: typeof body.maxSpendUsd === "number" ? body.maxSpendUsd : undefined,
          timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        },
        description,
      });

      const run = await recordTelegraphGovernedCall({
        result,
        projectId: req.workspaceId,
        agentId,
        description,
      });

      res.json({
        success: true,
        data: { ...result, runId: run?.runId ?? null, runStatus: run?.status ?? null },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Anjoman governed task endpoint failed", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to execute Anjoman task",
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

      // Digest and other processes append runs out-of-process; refresh the
      // shared snapshot so the ledger reflects them, not a stale load.
      await creRunStore.refresh();
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
