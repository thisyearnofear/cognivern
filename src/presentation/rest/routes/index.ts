import express from "express";
import { createPolicyRoutes } from "./policyRoutes.js";
import { PolicyController } from "../controllers/PolicyController.js";

/**
 * Configure all API routes
 * @param controllers Object containing controller instances
 * @returns Express router configured with all API routes
 */
export function configureRoutes(controllers: {
  policyController: PolicyController;
}): express.Router {
  const router = express.Router();

  // Mount policy routes at /api/policies
  router.use("/policies", createPolicyRoutes(controllers.policyController));

  // Other domain routes would be mounted here
  // Example: router.use('/users', createUserRoutes(controllers.userController));

  return router;
}
