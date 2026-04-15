/**
 * Governance Controller
 */

import { Request, Response } from "express";
import { Logger } from "../../../shared/logging/Logger.js";
import { PolicyService, sharedPolicyService } from "../../../services/PolicyService.js";
import { getWorkerClient } from "../../../services/CloudflareWorkerClient.js";

const logger = new Logger("GovernanceController");
import { PolicyEnforcementService } from "../../../services/PolicyEnforcementService.js";
import { AuditLogService } from "../../../services/AuditLogService.js";
import type { AgentAction } from "../../../types/Agent.js";
import crypto from "node:crypto";

export class GovernanceController {
  private policyService: PolicyService;
  private workerClient = getWorkerClient();
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
      new PolicyEnforcementService(this.policyService);
  }

  /**
   * Get governance health status (local or Worker)
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      // First check Worker if enabled
      const workerHealth = await this.workerClient.getHealth();

      res.json({
        success: true,
        data: {
          worker: workerHealth,
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
   * Evaluate governance action - routes to Worker if enabled
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

      // Try Worker first if enabled
      if (this.workerClient.isEnabled()) {
        const decision = await this.workerClient.evaluateGovernance(agentId, action);
        if (decision) {
          res.json({
            success: true,
            data: decision,
            source: "worker",
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }

      const policyId = await this.resolvePolicyId(req.body.policyId || action.policyId);
      if (!policyId) {
        res.status(503).json({
          success: false,
          error: {
            code: "NO_ACTIVE_POLICY",
            message: "No active governance policy is available for local evaluation",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      await this.policyEnforcementService.loadPolicy(policyId);
      const normalizedAction = this.normalizeAction(agentId, action);
      const decision = await this.policyEnforcementService.evaluateDecision(
        normalizedAction,
      );

      await this.auditLogService.logAction(
        normalizedAction,
        decision.policyChecks,
        decision.allowed,
      );

      const failedChecks = decision.policyChecks.filter((check) => !check.result);
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
      // Try Worker first if enabled
      if (this.workerClient.isEnabled()) {
        try {
          const policies = await this.workerClient.listPolicies();
          res.json({
            success: true,
            data: policies,
            source: "worker",
            timestamp: new Date().toISOString(),
          });
          return;
        } catch (e) {
          logger.warn("Worker listPolicies failed, using local fallback");
        }
      }

      // Fallback to local
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

  async createPolicy(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, rules } = req.body;

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

      const policy = await this.policyService.createPolicy(name, description, rules || []);

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

  private async resolvePolicyId(explicitPolicyId?: string): Promise<string | null> {
    if (explicitPolicyId) {
      const policy = await this.policyService.getPolicy(explicitPolicyId);
      return policy?.status === "active" ? policy.id : null;
    }

    const policies = await this.policyService.listPolicies();
    const activePolicy = policies
      .filter((policy) => policy.status === "active" && policy.rules.length > 0)
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )[0];

    return activePolicy?.id || null;
  }

  private normalizeAction(agentId: string, action: Record<string, any>): AgentAction {
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
