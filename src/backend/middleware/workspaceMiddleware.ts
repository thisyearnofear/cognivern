import { Request, Response, NextFunction } from "express";
import { getDb } from "../db/index.js";
import { isPublicApiPath } from "./publicEndpoints.js";

export interface WorkspaceContext {
  workspaceId: string;
  tier: "demo" | "live";
}

export function getWorkspaceTier(workspaceId: string): "demo" | "live" {
  const db = getDb();
  const row = db
    .prepare("SELECT tier FROM workspaces WHERE id = ?")
    .get(workspaceId) as { tier: string } | undefined;
  return (row?.tier as "demo" | "live") || "demo";
}

export function setWorkspaceTier(
  workspaceId: string,
  tier: "demo" | "live",
): void {
  const db = getDb();
  db.prepare("UPDATE workspaces SET tier = ?, updated_at = ? WHERE id = ?").run(
    tier,
    new Date().toISOString(),
    workspaceId,
  );
}

export async function workspaceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Public endpoints (per-resource auth, see publicEndpoints.ts) do not
  // require a workspace tier. Skip without requiring req.workspaceId.
  if (isPublicApiPath(req.path)) {
    next();
    return;
  }

  const workspaceId = req.workspaceId;

  if (!workspaceId) {
    res.status(401).json({
      success: false,
      error: "Workspace context required. Authenticate first.",
    });
    return;
  }

  const tier = getWorkspaceTier(workspaceId);
  (req as Request & { workspaceTier: string }).workspaceTier = tier;

  // Propagate workspaceId into the request-scoped AsyncLocalStorage store
  // so Logger.*Ctx and other services can read it.
  const { getRequestContext } = await import("./requestContext.js");
  const ctx = getRequestContext();
  if (ctx) {
    ctx.workspaceId = workspaceId;
  }

  next();
}
