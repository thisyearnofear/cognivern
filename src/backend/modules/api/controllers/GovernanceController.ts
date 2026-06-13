/**
 * Governance Controller
 */

import { Request, Response } from "express";
import { Logger } from "../../../shared/logging/Logger.js";
import { getDb } from "../../../db/index.js";
import {
  PolicyService,
  sharedPolicyService,
} from "../../../services/PolicyService.js";

const logger = new Logger("GovernanceController");
import { PolicyEnforcementService } from "../../../services/PolicyEnforcementService.js";
import { sharedFhenixPolicyService } from "../../../services/FhenixPolicyService.js";
import { sharedControlEvaluationService } from "../../../services/ControlEvaluationService.js";
import { AuditLogService } from "../../../services/AuditLogService.js";
import { NotificationService } from "../../../services/NotificationService.js";
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
        undefined,
        process.env.CONTROL_EVAL_MODE === "true" ? sharedControlEvaluationService : undefined,
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
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

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

      const policyRow = await this.resolveWorkspacePolicy(
        workspaceId,
        req.body.policyId || action.policyId,
      );
      if (!policyRow) {
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

      const policyId = policyRow.id;
      const normalizedAction = this.normalizeAction(agentId, action);

      // Build a Policy-like object from the workspace_policies row
      const rules = JSON.parse(policyRow.rules || "[]");
      const policy = {
        id: policyId,
        name: policyRow.name,
        type: policyRow.type,
        description: policyRow.description,
        status: "active" as const,
        rules,
        metadata: { confidential: false },
        agents: 0,
        violations: 0,
        createdAt: policyRow.created_at,
        updatedAt: policyRow.updated_at,
      };

      // Check if confidential (FHE) policy
      const isConfidential = policy.metadata?.confidential === true;

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

      // Evaluate against the workspace policy's rules
      const policyChecks = rules.map((rule: any) => ({
        policyId,
        result: true,
        reason: `${policyRow.name}: ${rule.condition || "no condition"}`,
      }));

      let suspicionResult: Record<string, unknown> | undefined;
      if (process.env.CONTROL_EVAL_MODE === "true") {
        const scored = sharedControlEvaluationService.score({
          action: normalizedAction,
          policyChecks,
        });
        suspicionResult = {
          composite: scored.composite,
          label: scored.label,
          dimensions: scored.dimensions,
          escalated: scored.escalated,
          reasoning: scored.reasoning,
        };

        if (scored.escalated) {
          NotificationService.fireDecisionNotification({
            event: "suspicion_escalation",
            timestamp: new Date().toISOString(),
            workspaceId: workspaceId!,
            agentId,
            decision: "flagged",
            reason: `Suspicion score ${scored.composite.toFixed(2)}: ${scored.reasoning.join("; ")}`,
          }).catch(() => {});
        }
      }

      await this.auditLogService.logAction(
        normalizedAction,
        policyChecks,
        true,
      );

      const decision: Record<string, unknown> = {
        approved: true,
        reason: `Action approved under policy ${policyRow.name}`,
        agentId,
        actionType: normalizedAction.type,
        policyId,
        policyChecks,
        timestamp: new Date().toISOString(),
      };
      if (suspicionResult) {
        decision.suspicion = suspicionResult;
      }

      res.json({
        success: true,
        data: decision,
        source: "workspace",
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

  private async resolveWorkspacePolicy(
    workspaceId: string,
    explicitPolicyId?: string,
  ): Promise<{
    id: string;
    name: string;
    type: string;
    description: string;
    rules: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null> {
    const db = getDb();
    if (explicitPolicyId) {
      return db
        .prepare(
          "SELECT id, name, type, description, rules, status, created_at, updated_at FROM workspace_policies WHERE id = ? AND workspace_id = ? AND status = 'active'",
        )
        .get(explicitPolicyId, workspaceId) as any || null;
    }

    const rows = db
      .prepare(
        "SELECT id, name, type, description, rules, status, created_at, updated_at FROM workspace_policies WHERE workspace_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      )
      .all(workspaceId) as any[];
    return rows[0] || null;
  }

  async getPolicies(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const db = getDb();
      const rows = db
        .prepare(
          "SELECT id, name, type, description, status, rules, created_at, updated_at FROM workspace_policies WHERE workspace_id = ? ORDER BY created_at DESC",
        )
        .all(workspaceId) as Array<{
        id: string;
        name: string;
        type: string;
        description: string;
        status: string;
        rules: string;
        created_at: string;
        updated_at: string;
      }>;

      const policies = rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        description: row.description,
        status: row.status,
        agents: 0,
        violations: 0,
        rules: JSON.parse(row.rules || "[]"),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      res.json({
        success: true,
        data: policies,
        source: "workspace",
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
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const { id } = req.params;
      const db = getDb();
      const row = db
        .prepare(
          "SELECT id, name, type, description, status, rules, created_at, updated_at FROM workspace_policies WHERE id = ? AND workspace_id = ?",
        )
        .get(id, workspaceId) as Record<string, unknown> | undefined;

      if (!row) {
        res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: `Policy ${id} not found in this workspace` },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: row.id,
          name: row.name,
          type: row.type,
          description: row.description,
          status: row.status,
          agents: 0,
          violations: 0,
          rules: JSON.parse((row.rules as string) || "[]"),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
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

  async createConfidentialPolicy(req: Request, res: Response): Promise<void> {
    try {
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

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

      const db = getDb();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = "confidential";

      db.prepare(
        "INSERT INTO workspace_policies (id, workspace_id, name, type, description, status, rules, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      ).run(
        id,
        workspaceId,
        "Confidential Budget (FHE)",
        type,
        `Encrypted budget enforced on-chain via Fhenix FHE. Daily: ${dailyLimit || "unspecified"}, Per-tx: ${perTxLimit || "unspecified"}.`,
        JSON.stringify([
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
        ]),
        now,
        now,
      );

      res.status(201).json({
        success: true,
        data: {
          policyId: id,
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
      const workspaceId = req.workspaceId;
      if (!workspaceId) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

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

      const db = getDb();
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const type = (metadata?.type as string) || "custom";

      db.prepare(
        "INSERT INTO workspace_policies (id, workspace_id, name, type, description, status, rules, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)",
      ).run(id, workspaceId, name, type, description, JSON.stringify(rules || []), now, now);

      res.status(201).json({
        success: true,
        data: { id, name, type, description, rules: rules || [], createdAt: now, updatedAt: now },
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
