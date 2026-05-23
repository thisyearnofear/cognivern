import { Request, Response, NextFunction } from "express";
import { getDb } from "../db/index.js";

export interface WorkspaceContext {
  workspaceId: string;
  tier: "demo" | "live";
}

export function getWorkspaceTier(workspaceId: string): "demo" | "live" {
  const db = getDb();
  const row = db.prepare("SELECT tier FROM workspaces WHERE id = ?").get(workspaceId) as { tier: string } | undefined;
  return (row?.tier as "demo" | "live") || "demo";
}

export function setWorkspaceTier(workspaceId: string, tier: "demo" | "live"): void {
  const db = getDb();
  db.prepare("UPDATE workspaces SET tier = ?, updated_at = ? WHERE id = ?").run(
    tier,
    new Date().toISOString(),
    workspaceId
  );
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
