import { Router } from "express";
import type { CreController } from "@backend/modules/api/controllers/CreController.js";
import type { IngestController } from "@backend/modules/api/controllers/IngestController.js";

export function createCreRoutes(
  creController: CreController,
  ingestController?: IngestController,
): Router {
  const router = Router();

  router.get("/cre/runs", (req, res) => creController.listRuns(req, res));
  router.get("/capital/attribution", (req, res) => creController.getSpendAttribution(req, res));
  router.get("/cre/ledger/verify", (req, res) =>
    creController.verifyLedger(req, res),
  );
  router.get("/cre/runs/:runId", (req, res) => creController.getRun(req, res));
  router.get("/cre/runs/:runId/events", (req, res) =>
    creController.getRunEvents(req, res),
  );
  router.get("/cre/runs/:runId/reconcile", (req, res) =>
    creController.reconcileRun(req, res),
  );
  // POST resolves an uncertain spend only after the controller proves the
  // local or KeeperHub execution and receipt match the original intent.
  router.post("/cre/runs/:runId/reconcile/resolve", (req, res) =>
    creController.reconcileRun(req, res),
  );
  router.get("/cre/runs/:runId/events/stream", (req, res) =>
    creController.streamRunEvents(req, res),
  );
  router.post("/cre/runs/:runId/cancel", (req, res) =>
    creController.cancelRun(req, res),
  );
  router.post("/cre/runs/:runId/approval", (req, res) =>
    creController.submitApproval(req, res),
  );
  router.post("/cre/runs/:runId/plan", (req, res) =>
    creController.updateRunPlan(req, res),
  );
  // Project discovery routes — aliased under /cre/projects for the CRE
  // namespace. These delegate to IngestController which owns the project
  // registry. Listed in PUBLIC_API_PATHS as /cre/projects.
  if (ingestController) {
    router.get("/cre/projects", (req, res) =>
      ingestController.listProjects(req, res),
    );
    router.get("/cre/projects/:projectId/usage", (req, res) =>
      ingestController.getUsage(req, res),
    );
    router.get("/cre/projects/:projectId/tokens", (req, res) =>
      ingestController.listTokens(req, res),
    );
  }

  return router;
}
