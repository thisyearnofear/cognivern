/**
 * Governance Controller
 */

import { Request, Response } from "express";
import { Logger } from "../../../shared/logging/Logger.js";
import {
  PolicyService,
  sharedPolicyService,
} from "../../../services/PolicyService.js";

const logger = new Logger("GovernanceController");
import { PolicyEnforcementService } from "../../../services/PolicyEnforcementService.js";
import { sharedFhenixPolicyService } from "../../../services/FhenixPolicyService.js";
import { AuditLogService } from "../../../services/AuditLogService.js";
import type { AgentAction } from "../../../types/Agent.js";
import { creRunStore } from "../../../cre/storage/CreRunStore.js";
import { startGovernanceEvaluation } from "../../../cre/workflows/governance.js";
import crypto from "node:crypto";

export class GovernanceController {
  private policyService: PolicyService;
  private policyEnforcementService: PolicyEnforcementService;
  private auditLogService: AuditLogService;

  constructor(
    policyService?: PolicyService,
    auditLogService?: AuditLogService,
    policyEnforcementService?: PolicyEnforcementService,
  ) {
    this.policyService = policyService || sharedPolicyService;
    this.auditLogService = auditLogService || new AuditLogService();
    this.policyEnforcementService =
      policyEnforcementService ||
      new PolicyEnforcementService(
        this.policyService,
        sharedFhenixPolicyService,
      );
  }

  /**
   * Get governance health status.
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          local: {
            status: "healthy",
            timestamp: new Date().toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Evaluate governance action.
   */
  async evaluateAction(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, action } = req.body;

      if (!agentId || !action) {
        res.status(400).json({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing agentId or action",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const policyId = await this.resolvePolicyId(
        req.body.policyId || action.policyId,
      );
      if (!policyId) {
        res.status(503).json({
          success: false,
          error: {
            code: "NO_ACTIVE_POLICY",
            message:
              "No active governance policy is available for local evaluation",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const normalizedAction = this.normalizeAction(agentId, action);

      // Check if the active policy is confidential → route to async FHE evaluation
      const policy = await this.policyService.getPolicy(policyId);
      const isConfidential = policy?.metadata?.confidential === true;

      if (isConfidential) {
        const { runId } = await startGovernanceEvaluation({
          agentId,
          normalizedAction,
          policyId,
          policyEnforcementService: this.policyEnforcementService,
          auditLogService: this.auditLogService,
        });

        res.status(202).json({
          success: true,
          data: {
            runId,
            status: "running",
            type: "fhe_evaluation",
            message:
              "Confidential policy evaluation in progress via Fhenix FHE. Subscribe to GET /api/cre/runs/${runId}/events/stream for progress.",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.policyEnforcementService.loadPolicy(policyId);
      const decision =
        await this.policyEnforcementService.evaluateDecision(normalizedAction);

      await this.auditLogService.logAction(
        normalizedAction,
        decision.policyChecks,
        decision.allowed,
      );

      const failedChecks = decision.policyChecks.filter(
        (check) => !check.result,
      );
      const reason = failedChecks.length
        ? failedChecks.map((check) => check.reason || check.policyId).join("; ")
        : `Action approved under policy ${policyId}`;

      const localDecision = {
        approved: decision.allowed,
        reason,
        agentId,
        actionType: normalizedAction.type,
        policyId,
        policyChecks: decision.policyChecks,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: localDecision,
        source: "local",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getPolicies(req: Request, res: Response): Promise<void> {
    try {
      const policies = await this.policyService.listPolicies();

      res.json({
        success: true,
        data: policies,
        source: "local",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const policy = await this.policyService.getPolicy(id);

      if (!policy) {
        res.status(404).json({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: `Policy with id ${id} not found`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: policy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async createConfidentialPolicy(req: Request, res: Response): Promise<void> {
    try {
      const {
        agentId,
        dailyLimit,
        perTxLimit,
        approvalThreshold,
        confidential,
      } = req.body;

      if (!agentId) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: "Missing agentId" },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const policy = await this.policyService.createPolicy(
        "Confidential Budget (FHE)",
        `Encrypted budget enforced on-chain via Fhenix FHE. Daily: ${dailyLimit || "unspecified"}, Per-tx: ${perTxLimit || "unspecified"}.`,
        [
          {
            id: "fhe-budget-check",
            type: "deny",
            condition: "true",
            action: {
              type: "block",
              parameters: { reason: "FHE evaluation required" },
            },
            metadata: { confidential: true },
          },
        ],
        {
          confidential: confidential !== false,
          chain:
            process.env.FHENIX_CHAIN_ID === "84532"
              ? "fhenix-base-sepolia"
              : "fhenix-arbitrum-sepolia",
          fheProvider: "cofhe-sdk",
          dailyLimit,
          perTxLimit,
          approvalThreshold,
          agentId,
          category: "spend",
        },
      );

      res.status(201).json({
        success: true,
        data: {
          policyId: policy.id,
          note: "dailyLimit, perTxLimit, approvalThreshold encrypted as euint128 on Fhenix",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async createPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, rules, metadata } = req.body;

      if (!name || !description) {
        res.status(400).json({
          success: false,
          error: {
            code: "BAD_REQUEST",
            message: "Missing name or description",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const policy = await this.policyService.createPolicy(
        name,
        description,
        rules || [],
        metadata,
      );

      res.status(201).json({
        success: true,
        data: policy,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async resolvePolicyId(
    explicitPolicyId?: string,
  ): Promise<string | null> {
    if (explicitPolicyId) {
      const policy = await this.policyService.getPolicy(explicitPolicyId);
      return policy?.status === "active" ? policy.id : null;
    }

    const policies = await this.policyService.listPolicies();
    const activePolicy = policies
      .filter((policy) => policy.status === "active" && policy.rules.length > 0)
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      )[0];

    return activePolicy?.id || null;
  }

  async getDecision(req: Request, res: Response): Promise<void> {
    try {
      const { decisionId } = req.params;
      if (!decisionId) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: "Missing decisionId" },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const allRuns = await creRunStore.list();
      const matchingRun = allRuns.find((run) =>
        run.artifacts?.some(
          (a: any) =>
            a.data?.decisionId === decisionId ||
            a.data?.txHash === decisionId,
        ),
      );

      if (matchingRun) {
        const attestation = matchingRun.artifacts?.find(
          (a) =>
            (a.data as Record<string, unknown> | undefined)?.decisionId === decisionId ||
            (a.data as Record<string, unknown> | undefined)?.txHash === decisionId,
        );
        const artifactData = (attestation?.data as Record<string, unknown>) || {};
        res.json({
          success: true,
          data: {
            decisionId,
            runId: matchingRun.runId,
            outcome: (artifactData.status as string) || "unknown",
            txHash: (artifactData.txHash as string) || null,
            onChainStatus: (artifactData.onChainStatus as string) || null,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No governance decision found for ${decisionId}`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get the result of a previously submitted async FHE evaluation.
   * The frontend hits this after the SSE stream signals run_finished.
   */
  async getEvaluationResult(req: Request, res: Response): Promise<void> {
    try {
      const { runId } = req.params;
      if (!runId) {
        res.status(400).json({
          success: false,
          error: { code: "BAD_REQUEST", message: "Missing runId" },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const run = await creRunStore.get(runId);
      if (!run) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Evaluation run ${runId} not found` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (run.status !== "completed" && run.status !== "failed") {
        res.status(200).json({
          success: true,
          data: {
            runId,
            status: run.status || "running",
            message: "Evaluation still in progress",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Extract the result from the final event payload
      const events = run.events || [];
      const finalEvent = events.find(
        (e) => e.type === "run_finished" || e.type === "run_failed",
      );
      const resultPayload = finalEvent?.payload?.result as Record<string, unknown> | undefined;

      if (resultPayload) {
        res.json({
          success: run.ok,
          data: {
            runId,
            status: run.ok ? "completed" : "failed",
            result: resultPayload,
          },
          timestamp: new Date().toISOString(),
        });
      } else {
        // Run finished but no result payload — return what we have
        res.json({
          success: run.ok,
          data: {
            runId,
            status: run.ok ? "completed" : "failed",
            ok: run.ok,
            stepCount: run.steps.length,
            artifactCount: run.artifacts.length,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private normalizeAction(
    agentId: string,
    action: Record<string, any>,
  ): AgentAction {
    const actionType = String(action.type || action.actionType || "unknown");
    const metadata = {
      ...(action.metadata || {}),
      ...(action.data || {}),
      agentId,
    };

    return {
      id: String(action.id || crypto.randomUUID()),
      timestamp: String(action.timestamp || new Date().toISOString()),
      type: actionType,
      description: String(
        action.description || `Governance evaluation for ${actionType}`,
      ),
      metadata,
      policyChecks: [],
    };
  }
}
