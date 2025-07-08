import express from "express";
import { AgentController } from "../controllers/AgentController.js";
import { apiKeyMiddleware } from "../../../middleware/apiKeyMiddleware.js";

/**
 * Create agent routes
 * @param agentController Agent controller instance
 * @returns Express router configured with agent routes
 */
export function createAgentRoutes(agentController: AgentController): express.Router {
  const router = express.Router();

  // Apply API key middleware to all agent routes
  router.use(apiKeyMiddleware);

  // Recall Agent Routes
  router.get("/recall/decisions", (req, res) => agentController.getRecallDecisions(req, res));
  router.get("/recall/status", (req, res) => agentController.getRecallStatus(req, res));
  router.post("/recall/start", (req, res) => agentController.startRecallAgent(req, res));
  router.post("/recall/stop", (req, res) => agentController.stopRecallAgent(req, res));

  // Vincent Agent Routes
  router.get("/vincent/decisions", (req, res) => agentController.getVincentDecisions(req, res));
  router.get("/vincent/status", (req, res) => agentController.getVincentStatus(req, res));
  router.post("/vincent/start", (req, res) => agentController.startVincentAgent(req, res));
  router.post("/vincent/stop", (req, res) => agentController.stopVincentAgent(req, res));
  router.post("/vincent/policies", (req, res) => agentController.updateVincentPolicies(req, res));
  router.post("/vincent/consent", (req, res) => agentController.setVincentConsent(req, res));

  return router;
}
