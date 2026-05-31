import { Router } from "express";
import type { WorkspaceController } from "../controllers/WorkspaceController.js";
import { authMiddleware } from "../../../middleware/authMiddleware.js";

export function createWorkspaceRoutes(
  workspaceController: WorkspaceController,
): Router {
  const router = Router();

  router.get("/workspace", authMiddleware, (req, res) =>
    workspaceController.getWorkspace(req, res),
  );
  router.put("/workspace", authMiddleware, (req, res) =>
    workspaceController.updateWorkspace(req, res),
  );

  // Multi-workspace endpoints
  router.get("/workspaces", authMiddleware, (req, res) =>
    workspaceController.listWorkspaces(req, res),
  );
  router.post("/workspaces", authMiddleware, (req, res) =>
    workspaceController.createWorkspace(req, res),
  );
  router.post("/workspaces/:workspaceId/switch", authMiddleware, (req, res) =>
    workspaceController.switchWorkspace(req, res),
  );

  return router;
}
