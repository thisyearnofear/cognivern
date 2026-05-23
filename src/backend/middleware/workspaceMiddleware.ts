import { Request, Response, NextFunction } from "express";

export interface WorkspaceContext {
  workspaceId: string;
  tier: "demo" | "live";
}

const workspaceTierStore = new Map<string, "demo" | "live">();

export function setWorkspaceTier(workspaceId: string, tier: "demo" | "live"): void {
  workspaceTierStore.set(workspaceId, tier);
}

export function getWorkspaceTier(workspaceId: string): "demo" | "live" {
  return workspaceTierStore.get(workspaceId) || "demo";
}

export async function workspaceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const workspaceId = req.workspaceId;

  if (!workspaceId) {
    res.status(401).json({
      success: false,
      error: "Workspace context required. Authenticate first.",
    });
    return;
  }

  const tier = getWorkspaceTier(workspaceId);
  (req as any).workspaceTier = tier;

  next();
}
