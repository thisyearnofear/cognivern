import { Router } from "express";
import type { IngestController } from "../controllers/IngestController.js";
import type { FhenixController } from "../controllers/FhenixController.js";
import type { IntentController } from "../controllers/IntentController.js";
import type { PayrollController } from "../controllers/PayrollController.js";
import type { SealedBidController } from "../controllers/SealedBidController.js";
import type { SpeechController } from "../controllers/SpeechController.js";

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

  // Fhenix routes
  router.get("/fhenix/status", (req, res) =>
    fhenixController.getStatus(req, res),
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

  // Sealed-bid vendor selection routes
  router.post("/vendor/sealed-bid/rounds", (req, res) =>
    sealedBidController.createRound(req, res),
  );
  router.post("/vendor/sealed-bid/rounds/:roundId/bid", (req, res) =>
    sealedBidController.submitBid(req, res),
  );
  router.post("/vendor/sealed-bid/rounds/:roundId/close", (req, res) =>
    sealedBidController.closeRound(req, res),
  );
  router.post("/vendor/sealed-bid/rounds/:roundId/reveal", (req, res) =>
    sealedBidController.revealWinner(req, res),
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
