/**
 * UpstreamCredentialService — per-program upstream API keys (BYO compute).
 *
 * A sponsor whose participants need a model 0G does not serve — or who
 * brings their own grant credits — pastes that provider's key once per
 * program. The gateway then meters participant `cvk_` calls against it, and
 * the ledger, receipts, and report work unchanged.
 *
 * Custody rules:
 * - AES-256-GCM with a scrypt-derived key from OWS_VAULT_SECRET (same KDF
 *   parameters as the OWS wallet vault). Refuse to store when the secret is
 *   unset — an unencryptable key is never persisted.
 * - Plaintext leaves this module in exactly one direction: into a backend
 *   adapter at request time. It is never logged, never returned by any
 *   endpoint, and the status view exposes only provider + last-4 hint.
 * - One credential per program (upsert). Rotation is a re-POST; revocation
 *   deletes the row, after which the gateway denies with backend_not_configured.
 *
 * Compliance note (see SPONSORED_CREDITS.md): pooling a sponsor's per-person
 * promo codes may violate that sponsor's terms. The organiser owns that
 * call; these rails meter what is legitimately routed, nothing more.
 */

import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";

/** Providers accepted as a per-program upstream. Extend deliberately. */
export const UPSTREAM_PROVIDERS = ["anthropic"] as const;
export type UpstreamProvider = (typeof UPSTREAM_PROVIDERS)[number];

export interface CredentialStatus {
  configured: boolean;
  provider: UpstreamProvider | null;
  keyHint: string | null;
  updatedAt: string | null;
}

function encryptionKey(): Buffer {
  const secret = process.env.OWS_VAULT_SECRET || "";
  if (!secret) {
    throw new Error(
      "Refusing to store an upstream credential: OWS_VAULT_SECRET is not set. " +
        "Set it (and back it up — rotation orphans stored keys) before connecting BYO compute.",
    );
  }
  return scryptSync(secret, "cognivern-ows-v1", 32);
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("base64"),
    data: data.toString("base64"),
    tag: tag.toString("base64"),
  });
}

function decrypt(blob: string): string {
  const { iv, data, tag } = JSON.parse(blob) as {
    iv: string;
    data: string;
    tag: string;
  };
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function isUpstreamProvider(value: unknown): value is UpstreamProvider {
  return (
    typeof value === "string" && (UPSTREAM_PROVIDERS as readonly string[]).includes(value)
  );
}

export class UpstreamCredentialService {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  /** Store (or rotate) a program's upstream key. Never returns key material. */
  setCredential(
    programId: string,
    workspaceId: string,
    provider: UpstreamProvider,
    apiKey: string,
  ): CredentialStatus {
    const now = new Date().toISOString();
    const hint = `••••${apiKey.slice(-4)}`;
    this.db
      .prepare(
        `INSERT INTO program_upstream_credentials
           (program_id, workspace_id, provider, blob, key_hint, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(program_id) DO UPDATE SET
           workspace_id = excluded.workspace_id,
           provider = excluded.provider,
           blob = excluded.blob,
           key_hint = excluded.key_hint,
           updated_at = excluded.updated_at`,
      )
      .run(programId, workspaceId, provider, encrypt(apiKey), hint, now, now);
    return { configured: true, provider, keyHint: hint, updatedAt: now };
  }

  /** Plaintext key for backend-adapter use only. Never expose via an endpoint. */
  getCredential(programId: string): { provider: UpstreamProvider; apiKey: string } | null {
    const row = this.db
      .prepare(`SELECT provider, blob FROM program_upstream_credentials WHERE program_id = ?`)
      .get(programId) as { provider: string; blob: string } | undefined;
    if (!row || !isUpstreamProvider(row.provider)) return null;
    try {
      return { provider: row.provider, apiKey: decrypt(row.blob) };
    } catch {
      return null;
    }
  }

  revokeCredential(programId: string): boolean {
    const result = this.db
      .prepare(`DELETE FROM program_upstream_credentials WHERE program_id = ?`)
      .run(programId);
    return result.changes > 0;
  }

  status(programId: string): CredentialStatus {
    const row = this.db
      .prepare(
        `SELECT provider, key_hint, updated_at FROM program_upstream_credentials WHERE program_id = ?`,
      )
      .get(programId) as
      | { provider: string; key_hint: string; updated_at: string }
      | undefined;
    if (!row || !isUpstreamProvider(row.provider)) {
      return { configured: false, provider: null, keyHint: null, updatedAt: null };
    }
    return {
      configured: true,
      provider: row.provider,
      keyHint: row.key_hint,
      updatedAt: row.updated_at,
    };
  }
}

let shared: UpstreamCredentialService | null = null;
export function sharedUpstreamCredentialService(): UpstreamCredentialService {
  if (!shared) shared = new UpstreamCredentialService();
  return shared;
}
