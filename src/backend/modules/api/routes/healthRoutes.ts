import { Router } from "express";
import type { HealthController } from "../controllers/HealthController.js";

export function createHealthRoutes(healthController: HealthController): Router {
  const router = Router();

  router.get("/health", (req, res) => healthController.getHealth(req, res));
  router.get("/health/ready", (req, res) =>
    healthController.getReadiness(req, res),
  );
  router.get("/health/live", (req, res) =>
    healthController.getLiveness(req, res),
  );
  router.get("/system/health", (req, res) =>
    healthController.getSystemHealth(req, res),
  );

  return router;
}
