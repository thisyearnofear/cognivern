import { Router } from "express";
import type { MandateController } from "@backend/modules/api/controllers/MandateController.js";

export function createMandateRoutes(controller: MandateController): Router {
  const router = Router();
  router.post("/mandates", (req, res) => controller.create(req, res));
  router.get("/mandates", (req, res) => controller.list(req, res));
  router.get("/mandates/:mandateId", (req, res) => controller.get(req, res));
  router.get("/mandates/:mandateId/statement", (req, res) => controller.getStatement(req, res));
  router.patch("/mandates/:mandateId", (req, res) => controller.update(req, res));
  return router;
}
