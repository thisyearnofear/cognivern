import { Router } from "express";
import type { CreditProgramController } from "@backend/modules/api/controllers/CreditProgramController.js";

/**
 * Sponsor/organiser routes for sponsored credit programs.
 *
 * Mounted under `/api`, so these inherit workspace auth. Note the ordering:
 * the static `/report`, `/activity`, and `/reconcile` paths are declared before
 * the `/participants/:participantId` family so a literal segment is never
 * captured as an id.
 */
export function createCreditProgramRoutes(controller: CreditProgramController): Router {
  const router = Router();

  router.post("/credit-programs", (req, res) => controller.create(req, res));
  router.get("/credit-programs", (req, res) => controller.list(req, res));
  router.get("/credit-programs/:programId", (req, res) => controller.get(req, res));
  router.patch("/credit-programs/:programId", (req, res) => controller.update(req, res));

  router.get("/credit-programs/:programId/report", (req, res) => controller.report(req, res));
  router.get("/credit-programs/:programId/activity", (req, res) => controller.activity(req, res));
  router.get("/credit-programs/:programId/funding", (req, res) => controller.funding(req, res));
  router.get("/credit-programs/:programId/reconcile", (req, res) => controller.reconcile(req, res));
  router.post("/credit-programs/:programId/top-up", (req, res) => controller.topUp(req, res));
  router.get("/credit-programs/:programId/commitments", (req, res) =>
    controller.listCommitments(req, res),
  );
  router.post("/credit-programs/:programId/commitments", (req, res) =>
    controller.anchorNow(req, res),
  );

  router.post("/credit-programs/:programId/participants", (req, res) =>
    controller.provisionParticipants(req, res),
  );
  router.get("/credit-programs/:programId/participants", (req, res) =>
    controller.listParticipants(req, res),
  );
  router.get("/credit-programs/:programId/participants/:participantId/ledger", (req, res) =>
    controller.participantLedger(req, res),
  );
  router.post("/credit-programs/:programId/participants/:participantId/rotate-key", (req, res) =>
    controller.rotateParticipantKey(req, res),
  );
  router.patch("/credit-programs/:programId/participants/:participantId/status", (req, res) =>
    controller.setParticipantStatus(req, res),
  );
  router.patch("/credit-programs/:programId/participants/:participantId/allocation", (req, res) =>
    controller.setParticipantAllocation(req, res),
  );

  return router;
}
