import { Request, Response } from "express";
import { setWorkspaceTier, getWorkspaceTier } from "../../../middleware/workspaceMiddleware.js";

export class WorkspaceController {
  async getWorkspace(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const tier = getWorkspaceTier(workspaceId);
    res.json({
      success: true,
      data: { id: workspaceId, tier },
    });
  }

  async updateWorkspace(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    const { name, tier } = req.body as { name?: string; tier?: "demo" | "live" };

    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    if (tier && (tier === "demo" || tier === "live")) {
      setWorkspaceTier(workspaceId, tier);
    }

    res.json({
      success: true,
      data: {
        id: workspaceId,
        name: name || "My Workspace",
        tier: getWorkspaceTier(workspaceId),
        updatedAt: new Date().toISOString(),
      },
    });
  }
}
