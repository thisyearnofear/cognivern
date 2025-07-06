import { Request, Response } from "express";
import { PolicyApplicationService } from "../../../application/policy/PolicyApplicationService.js";
import {
  CreatePolicyDTO,
  UpdatePolicyDTO,
} from "../../../application/policy/PolicyDTOs.js";

/**
 * Policy REST Controller
 *
 * Handles HTTP requests related to policies
 * Uses the application service to process requests
 */
export class PolicyController {
  constructor(private policyApplicationService: PolicyApplicationService) {}

  /**
   * Create a new policy
   * POST /policies
   */
  async createPolicy(req: Request, res: Response): Promise<void> {
    try {
      const createPolicyDTO: CreatePolicyDTO = req.body;
      const result =
        await this.policyApplicationService.createPolicy(createPolicyDTO);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }

  /**
   * Get a policy by ID
   * GET /policies/:id
   */
  async getPolicy(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const policy = await this.policyApplicationService.getPolicy(id);

      if (!policy) {
        res.status(404).json({ error: `Policy ${id} not found` });
        return;
      }

      res.status(200).json(policy);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * List all policies
   * GET /policies
   */
  async listPolicies(req: Request, res: Response): Promise<void> {
    try {
      // Check if we should filter by status
      const status = req.query.status as string;

      let policies;
      if (status === "active") {
        policies = await this.policyApplicationService.listActivePolicies();
      } else {
        policies = await this.policyApplicationService.listPolicies();
      }

      // Return in format expected by frontend
      res.status(200).json({ policies });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  /**
   * Update a policy
   * PUT /policies/:id
   */
  async updatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const updatePolicyDTO: UpdatePolicyDTO = req.body;

      const updatedPolicy = await this.policyApplicationService.updatePolicy(
        id,
        updatePolicyDTO
      );

      res.status(200).json(updatedPolicy);
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (errorMessage.includes("not found")) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(400).json({ error: errorMessage });
      }
    }
  }

  /**
   * Update policy status
   * PATCH /policies/:id/status
   */
  async updatePolicyStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      const { status } = req.body;

      if (!status || !["active", "draft", "archived"].includes(status)) {
        res.status(400).json({ error: "Invalid status value" });
        return;
      }

      const updatedPolicy =
        await this.policyApplicationService.updatePolicyStatus(id, status);

      res.status(200).json(updatedPolicy);
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (errorMessage.includes("not found")) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(400).json({ error: errorMessage });
      }
    }
  }

  /**
   * Add rule to policy
   * POST /policies/:id/rules
   */
  async addRuleToPolicy(req: Request, res: Response): Promise<void> {
    try {
      const policyId = req.params.id;
      const ruleDTO = req.body;

      const updatedPolicy = await this.policyApplicationService.addRuleToPolicy(
        policyId,
        ruleDTO
      );

      res.status(200).json(updatedPolicy);
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (errorMessage.includes("not found")) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(400).json({ error: errorMessage });
      }
    }
  }

  /**
   * Delete a policy
   * DELETE /policies/:id
   */
  async deletePolicy(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id;
      await this.policyApplicationService.deletePolicy(id);
      res.status(204).end();
    } catch (error) {
      const errorMessage = (error as Error).message;

      if (errorMessage.includes("not found")) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  }
}
