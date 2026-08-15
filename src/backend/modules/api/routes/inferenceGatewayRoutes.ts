import { Router } from "express";
import type { InferenceGatewayController } from "@backend/modules/api/controllers/InferenceGatewayController.js";

/**
 * Participant-facing gateway routes.
 *
 * Mounted at the app root (NOT under `/api`) so the paths are exactly
 * `/v1/chat/completions` and `/v1/models` — that is what makes
 * `OpenAI(base_url="https://…/v1")` work unmodified. Auth is the `cvk_` gateway
 * key in the Authorization header, handled inside the controller; these routes
 * intentionally sit outside the workspace JWT/API-key middleware stack.
 */
export function createInferenceGatewayRoutes(controller: InferenceGatewayController): Router {
  const router = Router();

  // OpenAI-compatible surface.
  router.post("/v1/chat/completions", (req, res) => controller.chatCompletions(req, res));
  router.get("/v1/models", (req, res) => controller.models(req, res));

  // Cognivern additions, same credential.
  router.get("/v1/credits", (req, res) => controller.credits(req, res));
  router.get("/v1/credits/activity", (req, res) => controller.activity(req, res));
  router.get("/v1/credits/verification", (req, res) => controller.verification(req, res));
  router.put("/v1/credits/disclosure", (req, res) => controller.setDisclosure(req, res));

  return router;
}
