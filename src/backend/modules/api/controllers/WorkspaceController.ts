import { Request, Response } from "express";
import { getDb } from "../../../db/index.js";
import type { Workspace } from "@cognivern/shared";

export class WorkspaceController {
  async getWorkspace(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        "SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE id = ?",
      )
      .get(workspaceId) as
      | {
          id: string;
          name: string;
          owner_id: string;
          tier: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      res.status(404).json({ success: false, error: "Workspace not found" });
      return;
    }

    const workspace: Workspace = {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      tier: row.tier as "demo" | "live",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({ success: true, data: workspace });
  }

  async updateWorkspace(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    const { name, tier } = req.body as {
      name?: string;
      tier?: "demo" | "live";
    };

    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();

    if (name) {
      db.prepare(
        "UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?",
      ).run(name, now, workspaceId);
    }

    if (tier && (tier === "demo" || tier === "live")) {
      db.prepare(
        "UPDATE workspaces SET tier = ?, updated_at = ? WHERE id = ?",
      ).run(tier, now, workspaceId);
    }

    const row = db
      .prepare(
        "SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE id = ?",
      )
      .get(workspaceId) as
      | {
          id: string;
          name: string;
          owner_id: string;
          tier: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      res.status(404).json({ success: false, error: "Workspace not found" });
      return;
    }

    const workspace: Workspace = {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      tier: row.tier as "demo" | "live",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({ success: true, data: workspace });
  }
}
