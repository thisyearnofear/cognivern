import { Request, Response } from "express";
import { randomUUID, randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "@backend/db/index.js";
import {
  createKeyMandate,
  getKeyMandatesForWorkspace,
  validateMandateLimits,
  type KeyMandate,
} from "@backend/services/keys/KeyMandateService.js";

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

      const mandates = getKeyMandatesForWorkspace(workspaceId);
      const keys = rows.map((r) => ({
        id: r.id,
        name: r.name,
        keyPrefix: r.key_prefix,
        scopes: JSON.parse(r.scopes),
        lastUsedAt: r.last_used_at,
        createdAt: r.created_at,
        revokedAt: r.revoked_at,
        mandate: serializeMandate(mandates.get(r.id)),
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

    const { name, scopes, mandate } = req.body as {
      name?: string;
      scopes?: string[];
      mandate?: unknown;
    };

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

      // Optional TEE-sealed spend mandate ("key = sealed mandate" paradigm).
      let mandateLimits = null;
      if (mandate) {
        try {
          mandateLimits = validateMandateLimits(mandate);
        } catch (err) {
          res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : "Invalid mandate",
          });
          return;
        }
        // A mandate only means something if the key may execute spend.
        if (!keyScopes.includes("spend:execute")) {
          keyScopes.push("spend:execute");
        }
      }

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

      const mandateRecord = mandateLimits
        ? createKeyMandate({ apiKeyId: id, workspaceId, limits: mandateLimits })
        : null;

      res.status(201).json({
        success: true,
        data: {
          id,
          name: name.trim(),
          key: rawKey,
          keyPrefix,
          scopes: keyScopes,
          createdAt: now,
          mandate: serializeMandate(mandateRecord),
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

  /**
   * Bring-your-own-credential import: the user supplies existing key material
   * (e.g. an agent credential they already manage elsewhere); we wrap it into
   * this workspace — same hashing, same scopes, optional TEE-sealed mandate —
   * instead of minting fresh entropy. The raw key is never echoed back or
   * logged; only its scrypt hash persists.
   */
  async importKey(req: Request, res: Response): Promise<void> {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const { name, rawKey, scopes, mandate } = req.body as {
      name?: string;
      rawKey?: string;
      scopes?: string[];
      mandate?: unknown;
    };

    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, error: "name is required" });
      return;
    }
    if (typeof rawKey !== "string" || rawKey.length < 32 || rawKey.length > 256) {
      res.status(400).json({
        success: false,
        error: "rawKey must be 32-256 characters of existing key material",
      });
      return;
    }
    if (/\s/.test(rawKey)) {
      res.status(400).json({ success: false, error: "rawKey must not contain whitespace" });
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

      let mandateLimits = null;
      if (mandate) {
        try {
          mandateLimits = validateMandateLimits(mandate);
        } catch (err) {
          res.status(400).json({
            success: false,
            error: err instanceof Error ? err.message : "Invalid mandate",
          });
          return;
        }
        if (!keyScopes.includes("spend:execute")) {
          keyScopes.push("spend:execute");
        }
      }

      const db = getDb();
      const id = randomUUID();
      const keyHash = hashKeyScrypt(rawKey);
      const keyPrefix = rawKey.slice(0, 8);
      const now = new Date().toISOString();

      try {
        db.prepare(
          "INSERT INTO api_keys (id, workspace_id, name, key_hash, key_prefix, scopes, created_at, imported) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
        ).run(id, workspaceId, name.trim(), keyHash, keyPrefix, JSON.stringify(keyScopes), now);
      } catch (err) {
        res.status(409).json({
          success: false,
          error: "This credential is already wrapped in this workspace",
        });
        return;
      }

      const mandateRecord = mandateLimits
        ? createKeyMandate({ apiKeyId: id, workspaceId, limits: mandateLimits })
        : null;

      res.status(201).json({
        success: true,
        data: {
          id,
          name: name.trim(),
          // Deliberately no `key` field: the caller already has the material.
          keyPrefix,
          scopes: keyScopes,
          imported: true,
          createdAt: now,
          mandate: serializeMandate(mandateRecord),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to import API key" });
    }
  }
}

function serializeMandate(m: KeyMandate | null | undefined) {
  if (!m) return null;
  return {
    status: m.status, // pending | sealed | failed | unsupported
    policyId: m.policyId,
    budgetUsd: m.dailyLimitUsd,
    perTxUsd: m.perTxUsd,
    approvalThresholdUsd: m.approvalThresholdUsd,
    sealedTxHash: m.sealedTxHash,
  };
}

/** What the middleware needs about an authenticated API key. */
export interface ApiKeyRecord {
  workspaceId: string;
  keyId: string;
  scopes: string[];
}

export function resolveApiKeyRecord(key: string): ApiKeyRecord | null {
  const db = getDb();
  const keyPrefix = key.slice(0, 8);

  const scryptRows = db
    .prepare(
      "SELECT workspace_id, id, key_hash, scopes FROM api_keys WHERE key_prefix = ? AND revoked_at IS NULL AND key_hash LIKE 'scrypt:%'",
    )
    .all(keyPrefix) as Array<{ workspace_id: string; id: string; key_hash: string; scopes: string }>;

  for (const row of scryptRows) {
    if (verifyScrypt(key, row.key_hash)) {
      db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        row.id,
      );
      return { workspaceId: row.workspace_id, keyId: row.id, scopes: parseScopes(row.scopes) };
    }
  }

  const legacyHash = hashKeySha256(key);
  const legacyRow = db
    .prepare(
      "SELECT workspace_id, id, scopes FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
    )
    .get(legacyHash) as { workspace_id: string; id: string; scopes: string } | undefined;

  if (!legacyRow) return null;

  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    legacyRow.id,
  );
  return {
    workspaceId: legacyRow.workspace_id,
    keyId: legacyRow.id,
    scopes: parseScopes(legacyRow.scopes),
  };
}

function parseScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function resolveWorkspaceFromApiKey(key: string): string | null {
  return resolveApiKeyRecord(key)?.workspaceId ?? null;
}
