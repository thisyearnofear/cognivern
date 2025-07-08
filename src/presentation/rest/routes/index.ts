import express from "express";
import { createPolicyRoutes } from "./policyRoutes.js";
import { createAgentRoutes } from "./agentRoutes.js";
import { createVincentRoutes } from "./vincentRoutes.js";
import { PolicyController } from "../controllers/PolicyController.js";
import { AgentController } from "../controllers/AgentController.js";

/**
 * Configure all API routes
 * @param controllers Object containing controller instances
 * @returns Express router configured with all API routes
 */
export function configureRoutes(controllers: {
  policyController: PolicyController;
  agentController: AgentController;
}): express.Router {
  const router = express.Router();

  // Mount policy routes at /api/policies
  router.use("/policies", createPolicyRoutes(controllers.policyController));

  // Mount agent routes at /api/agents
  router.use("/agents", createAgentRoutes(controllers.agentController));

  // Mount Vincent routes at /api/vincent
  router.use("/vincent", createVincentRoutes(controllers.agentController));

  // Other domain routes would be mounted here
  // Example: router.use('/users', createUserRoutes(controllers.userController));

  return router;
}
