import { Router } from "express";
import type { MetricsController } from "../controllers/MetricsController.js";

export function createMetricsRoutes(
  metricsController: MetricsController,
): Router {
  const router = Router();

  router.get("/metrics/daily", (req, res) =>
    metricsController.getDailyMetrics(req, res),
  );
  router.post("/metrics/ux-events", (req, res) =>
    metricsController.postUxEvent(req, res),
  );
  router.get("/metrics/ux-summary", (req, res) =>
    metricsController.getUxSummary(req, res),
  );

  return router;
}
