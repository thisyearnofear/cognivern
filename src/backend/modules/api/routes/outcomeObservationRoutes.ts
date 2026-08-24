import { Router } from "express";
import type { OutcomeObservationController } from "@backend/modules/api/controllers/OutcomeObservationController.js";

export function createOutcomeObservationRoutes(
  controller: OutcomeObservationController,
): Router {
  const router = Router();
  router.get("/mandates/:mandateId/outcomes", (req, res) => controller.list(req, res));
  router.post("/mandates/:mandateId/outcomes", (req, res) => controller.create(req, res));
  router.post("/mandates/:mandateId/outcomes/sync", (req, res) => controller.syncFromSources(req, res));
  return router;
}
