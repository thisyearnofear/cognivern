import { Router } from "express";
import type { CopilotController } from "@backend/modules/api/controllers/CopilotController.js";

export function createCopilotRoutes(copilotController: CopilotController): Router {
  const router = Router();

  router.post("/copilot/runs", (req, res) =>
    copilotController.startRun(req, res),
  );
  router.get("/copilot/runs", (req, res) =>
    copilotController.listRuns(req, res),
  );
  router.get("/copilot/runs/:runId", (req, res) =>
    copilotController.getRun(req, res),
  );
  router.get("/copilot/runs/:runId/events/stream", (req, res) =>
    copilotController.streamRunEvents(req, res),
  );
  router.post("/copilot/runs/:runId/confirm", (req, res) =>
    copilotController.confirmRun(req, res),
  );

  return router;
}
