import { Request, Response } from "express";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { getDb } from "../../../db/index.js";

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): string {
  return `cvn_${randomBytes(24).toString("base64url")}`;
}

export class ApiKeyController {
  async listKeys(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
    const rows = db
      .prepare(
        "SELECT id, name, key_prefix, scopes, last_used_at, created_at, revoked_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC"
      )
      .all(workspaceId) as Array<{
      id: string;
      name: string;
      key_prefix: string;
      scopes: string;
      last_used_at: string | null;
      created_at: string;
      revoked_at: string | null;
    }>;

    const keys = rows.map((r) => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.key_prefix,
      scopes: JSON.parse(r.scopes),
      lastUsedAt: r.last_used_at,
      createdAt: r.created_at,
      revokedAt: r.revoked_at,
    }));

    res.json({ success: true, data: keys });
  }

  async createKey(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const { name, scopes } = req.body as { name?: string; scopes?: string[] };

    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }

    const validScopes = ["agents:read", "agents:write", "governance:read", "governance:write", "audit:read", "spend:execute"];
    const keyScopes = (scopes || ["agents:read", "governance:read", "audit:read"]).filter((s) =>
      validScopes.includes(s)
    );

    const db = getDb();

    const existingCount = db
      .prepare("SELECT COUNT(*) as count FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL")
      .get(workspaceId) as { count: number };

    if (existingCount.count >= 10) {
      res.status(400).json({ success: false, error: "Maximum 10 active API keys per workspace" });
      return;
    }

    const id = randomUUID();
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 8);
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO api_keys (id, workspace_id, name, key_hash, key_prefix, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, workspaceId, name.trim(), keyHash, keyPrefix, JSON.stringify(keyScopes), now);

    res.status(201).json({
      success: true,
      data: {
        id,
        name: name.trim(),
        key: rawKey,
        keyPrefix,
        scopes: keyScopes,
        createdAt: now,
      },
    });
  }

  async revokeKey(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const { keyId } = req.params;
    if (!keyId) {
      res.status(400).json({ success: false, error: "keyId is required" });
      return;
    }

    const db = getDb();
    const row = db
      .prepare("SELECT id FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL")
      .get(keyId, workspaceId) as { id: string } | undefined;

    if (!row) {
      res.status(404).json({ success: false, error: "API key not found or already revoked" });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(now, keyId);

    res.json({ success: true, data: { id: keyId, revokedAt: now } });
  }
}

export function resolveWorkspaceFromApiKey(key: string): string | null {
  const db = getDb();
  const keyHash = hashKey(key);
  const row = db
    .prepare("SELECT workspace_id, id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL")
    .get(keyHash) as { workspace_id: string; id: string } | undefined;

  if (!row) return null;

  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
  return row.workspace_id;
}
