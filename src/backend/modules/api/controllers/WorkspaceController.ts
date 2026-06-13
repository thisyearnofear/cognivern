import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { getDb } from "../../../db/index.js";
import type { Workspace } from "@cognivern/shared";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode(
      "cognivern-dev-jwt-secret-change-in-production",
    );
  }
  return new TextEncoder().encode(secret);
}

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

  async listWorkspaces(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT w.id, w.name, w.owner_id, w.tier, w.created_at, w.updated_at, wm.role
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = ?
         ORDER BY w.created_at ASC`,
      )
      .all(userId) as Array<{
      id: string;
      name: string;
      owner_id: string;
      tier: string;
      created_at: string;
      updated_at: string;
      role: string;
    }>;

    const workspaces = rows.map((row) => ({
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      tier: row.tier as "demo" | "live",
      role: row.role,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ success: true, data: workspaces });
  }

  async createWorkspace(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({
        success: false,
        error: "Workspace name is required",
      });
      return;
    }

    const db = getDb();
    const workspaceId = randomUUID();
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
      db.prepare(
        "INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'demo', ?, ?)",
      ).run(workspaceId, name.trim(), userId, now, now);

      db.prepare(
        "INSERT INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
      ).run(workspaceId, userId, now);
    });

    try {
      transaction();
    } catch (err) {
      res.status(500).json({
        success: false,
        error: "Failed to create workspace",
      });
      return;
    }

    const workspace: Workspace = {
      id: workspaceId,
      name: name.trim(),
      ownerId: userId,
      tier: "demo",
      createdAt: now,
      updatedAt: now,
    };

    res.status(201).json({ success: true, data: workspace });
  }

  async switchWorkspace(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    const { workspaceId } = req.params as { workspaceId: string };

    if (!userId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();

    // Verify user is a member of the target workspace
    const membership = db
      .prepare(
        "SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
      )
      .get(workspaceId, userId) as { role: string } | undefined;

    if (!membership) {
      res.status(403).json({
        success: false,
        error: "You are not a member of this workspace",
      });
      return;
    }

    const workspace = db
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

    if (!workspace) {
      res.status(404).json({ success: false, error: "Workspace not found" });
      return;
    }

    const user = db
      .prepare(
        "SELECT id, wallet_address, email, auth_method, created_at, last_login_at FROM users WHERE id = ?",
      )
      .get(userId) as Record<string, unknown> | undefined;

    // Issue a new JWT scoped to the target workspace
    const token = await new SignJWT({
      sub: userId,
      walletAddress: user?.wallet_address,
      email: user?.email,
      workspaceId: workspace.id,
      authMethod: user?.auth_method || "wallet",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getJwtSecret());

    res.json({
      success: true,
      data: {
        token,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          ownerId: workspace.owner_id,
          tier: workspace.tier as "demo" | "live",
          createdAt: workspace.created_at,
          updatedAt: workspace.updated_at,
        },
      },
    });
  }
}
