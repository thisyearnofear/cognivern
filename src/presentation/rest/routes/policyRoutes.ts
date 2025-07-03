import express from "express";
import { PolicyController } from "../controllers/PolicyController.js";

/**
 * Create and configure policy routes
 * @param policyController Policy controller instance
 * @returns Express router configured with policy routes
 */
export function createPolicyRoutes(policyController: PolicyController) {
  const router = express.Router();

  // GET /policies - List all policies
  router.get("/", (req, res) => policyController.listPolicies(req, res));

  // POST /policies - Create a new policy
  router.post("/", (req, res) => policyController.createPolicy(req, res));

  // GET /policies/:id - Get a specific policy
  router.get("/:id", (req, res) => policyController.getPolicy(req, res));

  // PUT /policies/:id - Update a policy
  router.put("/:id", (req, res) => policyController.updatePolicy(req, res));

  // PATCH /policies/:id/status - Update policy status
  router.patch("/:id/status", (req, res) =>
    policyController.updatePolicyStatus(req, res)
  );

  // POST /policies/:id/rules - Add a rule to a policy
  router.post("/:id/rules", (req, res) =>
    policyController.addRuleToPolicy(req, res)
  );

  // DELETE /policies/:id - Delete a policy
  router.delete("/:id", (req, res) => policyController.deletePolicy(req, res));

  return router;
}
