import { Router } from "express";
import type { CreController } from "../controllers/CreController.js";

export function createCreRoutes(creController: CreController): Router {
  const router = Router();

  router.get("/cre/runs", (req, res) => creController.listRuns(req, res));
  router.get("/cre/runs/:runId", (req, res) => creController.getRun(req, res));
  router.get("/cre/runs/:runId/events", (req, res) =>
    creController.getRunEvents(req, res),
  );
  router.get("/cre/runs/:runId/events/stream", (req, res) =>
    creController.streamRunEvents(req, res),
  );
  router.post("/cre/runs/:runId/cancel", (req, res) =>
    creController.cancelRun(req, res),
  );
  router.post("/cre/runs/:runId/retry", (req, res) =>
    creController.retryRun(req, res),
  );
  router.post("/cre/runs/:runId/approval", (req, res) =>
    creController.submitApproval(req, res),
  );
  router.post("/cre/runs/:runId/plan", (req, res) =>
    creController.updateRunPlan(req, res),
  );
  router.post("/cre/forecast", (req, res) =>
    creController.triggerForecast(req, res),
  );

  return router;
}
