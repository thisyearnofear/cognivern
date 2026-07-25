import { Router } from "express";
import type { ObservabilityController } from "@backend/modules/api/controllers/ObservabilityController.js";

export function createObservabilityRoutes(
  observabilityController: ObservabilityController,
): Router {
  const router = Router();

  router.get("/observability/status", (req, res) =>
    observabilityController.getStatus(req, res),
  );

  return router;
}
