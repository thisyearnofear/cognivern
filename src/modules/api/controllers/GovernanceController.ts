/**
 * Governance Controller
 */

import { Request, Response } from "express";
import { PolicyService } from "../../../services/PolicyService.js";
import { getWorkerClient } from "../../../services/CloudflareWorkerClient.js";

export class GovernanceController {
  private policyService: PolicyService;
  private workerClient = getWorkerClient();

  constructor(policyService?: PolicyService) {
    this.policyService = policyService || new PolicyService();
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

      // Fallback - create simple decision based on action
      const mockDecision = {
        approved: action.type !== "trade" || (action.value || 0) < 10000,
        reason: "Default governance decision (Worker not available)",
        agentId,
        actionType: action.type,
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: mockDecision,
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
          console.warn("Worker listPolicies failed, using local:", e);
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
}
