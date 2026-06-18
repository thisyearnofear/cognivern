import { Router } from "express";
import type { AuditLogController } from "@backend/modules/api/controllers/AuditLogController.js";

export function createAuditRoutes(
  auditLogController: AuditLogController,
): Router {
  const router = Router();

  router.get("/audit/logs", (req, res) => auditLogController.getLogs(req, res));
  router.get("/audit/insights", (req, res) =>
    auditLogController.getInsights(req, res),
  );
  router.post("/audit/insights/:id/resolve", (req, res) =>
    auditLogController.resolveInsight(req, res),
  );
  router.post("/audit/permits", (req, res) =>
    auditLogController.issuePermit(req, res),
  );
  router.get("/audit/logs/:decisionId/decrypt", (req, res) =>
    auditLogController.decryptLog(req, res),
  );
  router.get("/audit/logs/:id/timeline", (req, res) =>
    auditLogController.getTimeline(req, res),
  );

  return router;
}
