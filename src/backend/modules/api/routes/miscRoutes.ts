import { Router } from "express";
import type { IngestController } from "@backend/modules/api/controllers/IngestController.js";
import type { FhenixController } from "@backend/modules/api/controllers/FhenixController.js";
import type { IntentController } from "@backend/modules/api/controllers/IntentController.js";
import type { PayrollController } from "@backend/modules/api/controllers/PayrollController.js";
import type { SealedBidController } from "@backend/modules/api/controllers/SealedBidController.js";
import type { SpeechController } from "@backend/modules/api/controllers/SpeechController.js";
import { sealedBidWriteAuth } from "@backend/middleware/sealedBidAuthMiddleware.js";
import { idempotencyMiddleware } from "@backend/middleware/idempotencyMiddleware.js";

export function createMiscRoutes(
  ingestController: IngestController,
  fhenixController: FhenixController,
  intentController: IntentController,
  payrollController: PayrollController,
  sealedBidController: SealedBidController,
  speechController: SpeechController,
): Router {
  const router = Router();

  // Projects (multi-project support)
  router.get("/projects", (req, res) =>
    ingestController.listProjects(req, res),
  );
  router.get("/projects/:projectId/usage", (req, res) =>
    ingestController.getUsage(req, res),
  );
  router.get("/projects/:projectId/tokens", (req, res) =>
    ingestController.listTokens(req, res),
  );

  // Fhenix / Flare confidential routes
  router.get("/fhenix/status", (req, res) =>
    fhenixController.getStatus(req, res),
  );
  router.get("/flare/status", (req, res) =>
    fhenixController.getFlareStatus(req, res),
  );
  router.post("/fhenix/decrypt", (req, res) =>
    fhenixController.decrypt(req, res),
  );
  router.post("/fhenix/encrypt", (req, res) =>
    fhenixController.encrypt(req, res),
  );

  // Intent / Natural Language Processing routes
  router.post("/intent", (req, res) =>
    intentController.processIntent(req, res),
  );
  router.get("/intent/metrics", (_req, res) => {
    res.json({
      success: true,
      data: intentController.getMetrics(),
    });
  });

  // Privara confidential payroll routes
  router.post("/payroll/confidential", (req, res) =>
    payrollController.executeConfidentialPayroll(req, res),
  );

  // Sealed-bid vendor selection routes.
  // Write routes carry `sealedBidWriteAuth`: sandbox mode passes through with
  // demo personas; production mode requires a verified wallet JWT and binds the
  // acting identity to it. GET routes stay open (landing/demo read views).
  // Idempotency-Key replays prior successes so timeout retries do not double-submit.
  router.get("/vendor/sealed-bid/capabilities", (req, res) =>
    sealedBidController.getCapabilities(req, res),
  );
  router.post(
    "/vendor/sealed-bid/rounds",
    sealedBidWriteAuth,
    idempotencyMiddleware,
    (req, res) => sealedBidController.createRound(req, res),
  );
  router.post(
    "/vendor/sealed-bid/rounds/:roundId/bid",
    sealedBidWriteAuth,
    idempotencyMiddleware,
    (req, res) => sealedBidController.submitBid(req, res),
  );
  router.post(
    "/vendor/sealed-bid/rounds/:roundId/close",
    sealedBidWriteAuth,
    idempotencyMiddleware,
    (req, res) => sealedBidController.closeRound(req, res),
  );
  router.post(
    "/vendor/sealed-bid/rounds/:roundId/reveal",
    sealedBidWriteAuth,
    idempotencyMiddleware,
    (req, res) => sealedBidController.revealWinner(req, res),
  );
  router.get("/vendor/sealed-bid/rounds/:roundId/party-view", (req, res) =>
    sealedBidController.getPartyView(req, res),
  );
  router.get(
    "/vendor/sealed-bid/rounds/:roundId/governance-timeline",
    (req, res) => sealedBidController.getGovernanceTimeline(req, res),
  );
  router.get("/vendor/sealed-bid/rounds/:roundId", (req, res) =>
    sealedBidController.getRound(req, res),
  );
  router.get("/vendor/sealed-bid/rounds", (req, res) =>
    sealedBidController.listRounds(req, res),
  );

  // Speech-to-text (ElevenLabs proxy)
  router.post("/speech/transcribe", (req, res) =>
    speechController.transcribe(req, res),
  );

  return router;
}
