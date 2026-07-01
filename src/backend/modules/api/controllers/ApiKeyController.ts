import { Request, Response } from "express";
import { randomUUID, randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "@backend/db/index.js";

function hashKeySha256(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function hashKeyScrypt(key: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(key, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyScrypt(key: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHash] = parts;
  const derived = scryptSync(key, salt, 64).toString("hex");
  const a = Buffer.from(derived, "hex");
  const b = Buffer.from(expectedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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

    try {
      const db = getDb();
      const rows = db
        .prepare(
          "SELECT id, name, key_prefix, scopes, last_used_at, created_at, revoked_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC",
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
    } catch (err) {
      res.status(500).json({
        success: false,
        error: "Failed to list API keys",
      });
    }
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

    try {
      const validScopes = [
        "agents:read",
        "agents:write",
        "governance:read",
        "governance:write",
        "audit:read",
        "spend:execute",
      ];
      const keyScopes = (
        scopes || ["agents:read", "governance:read", "audit:read"]
      ).filter((s) => validScopes.includes(s));

      const db = getDb();

      const existingCount = db
        .prepare(
          "SELECT COUNT(*) as count FROM api_keys WHERE workspace_id = ? AND revoked_at IS NULL",
        )
        .get(workspaceId) as { count: number };

      if (existingCount.count >= 10) {
        res
          .status(400)
          .json({
            success: false,
            error: "Maximum 10 active API keys per workspace",
          });
        return;
      }

      const id = randomUUID();
      const rawKey = generateApiKey();
      const keyHash = hashKeyScrypt(rawKey);
      const keyPrefix = rawKey.slice(0, 8);
      const now = new Date().toISOString();

      db.prepare(
        "INSERT INTO api_keys (id, workspace_id, name, key_hash, key_prefix, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        workspaceId,
        name.trim(),
        keyHash,
        keyPrefix,
        JSON.stringify(keyScopes),
        now,
      );

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
    } catch (err) {
      res.status(500).json({
        success: false,
        error: "Failed to create API key",
      });
    }
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

    try {
      const db = getDb();
      const row = db
        .prepare(
          "SELECT id FROM api_keys WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL",
        )
        .get(keyId, workspaceId) as { id: string } | undefined;

      if (!row) {
        res
          .status(404)
          .json({
            success: false,
            error: "API key not found or already revoked",
          });
        return;
      }

      const now = new Date().toISOString();
      db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(
        now,
        keyId,
      );

      res.json({ success: true, data: { id: keyId, revokedAt: now } });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: "Failed to revoke API key",
      });
    }
  }
}

export function resolveWorkspaceFromApiKey(key: string): string | null {
  const db = getDb();
  const keyPrefix = key.slice(0, 8);

  const scryptRows = db
    .prepare(
      "SELECT workspace_id, id, key_hash FROM api_keys WHERE key_prefix = ? AND revoked_at IS NULL AND key_hash LIKE 'scrypt:%'",
    )
    .all(keyPrefix) as Array<{ workspace_id: string; id: string; key_hash: string }>;

  for (const row of scryptRows) {
    if (verifyScrypt(key, row.key_hash)) {
      db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        row.id,
      );
      return row.workspace_id;
    }
  }

  const legacyHash = hashKeySha256(key);
  const legacyRow = db
    .prepare(
      "SELECT workspace_id, id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
    )
    .get(legacyHash) as { workspace_id: string; id: string } | undefined;

  if (!legacyRow) return null;

  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    legacyRow.id,
  );
  return legacyRow.workspace_id;
}
