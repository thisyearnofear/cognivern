import { Router } from "express";
import type { MandateController } from "@backend/modules/api/controllers/MandateController.js";

export function createMandateRoutes(controller: MandateController): Router {
  const router = Router();
  router.post("/mandates", (req, res) => controller.create(req, res));
  router.get("/mandates", (req, res) => controller.list(req, res));
  router.get("/mandates/context/sync-health", (req, res) => controller.getSyncHealth(req, res));
  router.get("/mandates/:mandateId", (req, res) => controller.get(req, res));
  router.get("/mandates/:mandateId/statement", (req, res) => controller.getStatement(req, res));
  router.get("/mandates/:mandateId/recommendation", (req, res) => controller.getRecommendation(req, res));
  router.get("/mandates/:mandateId/context", (req, res) => controller.getContext(req, res));
  router.post("/mandates/:mandateId/context/sync", (req, res) => controller.syncContext(req, res));
  router.post("/mandates/:mandateId/statements", (req, res) => controller.publishStatement(req, res));
  router.get("/mandates/:mandateId/statements", (req, res) => controller.listStatements(req, res));
  router.get("/mandates/:mandateId/statements/:statementId", (req, res) => controller.getPublishedStatement(req, res));
  router.get("/mandates/:mandateId/statements/:statementId/export", (req, res) => controller.exportStatement(req, res));
  router.patch("/mandates/:mandateId", (req, res) => controller.update(req, res));
  return router;
}
