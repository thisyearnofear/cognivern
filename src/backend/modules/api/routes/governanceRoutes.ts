import { Router } from "express";
import type { GovernanceController } from "../controllers/GovernanceController.js";
import type { McpGovernanceController } from "../controllers/McpGovernanceController.js";

export function createGovernanceRoutes(
  governanceController: GovernanceController,
  mcpGovernanceController: McpGovernanceController,
): Router {
  const router = Router();

  router.get("/governance/policies", (req, res) =>
    governanceController.getPolicies(req, res),
  );
  router.post("/governance/policies", (req, res) =>
    governanceController.createPolicy(req, res),
  );
  router.post("/governance/policies/confidential", (req, res) =>
    governanceController.createConfidentialPolicy(req, res),
  );
  router.get("/governance/decisions/:decisionId", (req, res) =>
    governanceController.getDecision(req, res),
  );
  router.get("/governance/health", (req, res) =>
    governanceController.getHealth(req, res),
  );
  router.post("/governance/evaluate", (req, res) =>
    governanceController.evaluateAction(req, res),
  );

  // MCP tool endpoints
  router.get("/mcp/governance-check", (req, res) =>
    mcpGovernanceController.getManifest(req, res),
  );
  router.post("/mcp/governance-check", (req, res) =>
    mcpGovernanceController.governanceCheck(req, res),
  );

  return router;
}
