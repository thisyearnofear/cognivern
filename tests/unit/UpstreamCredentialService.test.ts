/**
 * UpstreamCredentialService tests — per-program BYO key custody.
 *
 * Custody bounds under test: encrypted at rest, plaintext only via
 * getCredential (backend-adapter path), refused without OWS_VAULT_SECRET,
 * and status exposes hint metadata but never key material.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-upstream-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.OWS_VAULT_SECRET = "test-vault-secret-do-not-use";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { UpstreamCredentialService } = await import(
  "@backend/services/credits/UpstreamCredentialService.js"
);

const db = getDb();
const now = new Date().toISOString();
db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES ('u-1', ?, ?)").run(
  now,
  now,
);
db.prepare(
  "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES ('ws-1', 'ws-1', 'u-1', 'live', ?, ?)",
).run(now, now);
db.prepare(
  "INSERT OR IGNORE INTO credit_programs (id, workspace_id, name, created_at, updated_at) VALUES ('prog-1', 'ws-1', 'p1', ?, ?)",
).run(now, now);

const service = new UpstreamCredentialService(db);

describe("UpstreamCredentialService", () => {
  it("round-trips a key and reports a hint-only status", () => {
    const status = service.setCredential("prog-1", "ws-1", "anthropic", "sk-ant-test-key-1234");
    expect(status).toEqual({
      configured: true,
      provider: "anthropic",
      keyHint: "••••1234",
      updatedAt: expect.any(String),
    });

    const credential = service.getCredential("prog-1");
    expect(credential).toEqual({ provider: "anthropic", apiKey: "sk-ant-test-key-1234" });

    const raw = db
      .prepare(`SELECT blob, key_hint FROM program_upstream_credentials WHERE program_id = ?`)
      .get("prog-1") as { blob: string; key_hint: string };
    expect(raw.blob).not.toContain("sk-ant-test-key-1234");
    expect(raw.key_hint).toBe("••••1234");
  });

  it("rotates on re-POST and revokes cleanly", () => {
    service.setCredential("prog-1", "ws-1", "anthropic", "sk-ant-rotated-9999");
    expect(service.getCredential("prog-1")?.apiKey).toBe("sk-ant-rotated-9999");
    expect(service.revokeCredential("prog-1")).toBe(true);
    expect(service.getCredential("prog-1")).toBeNull();
    expect(service.revokeCredential("prog-1")).toBe(false);
    expect(service.status("prog-1").configured).toBe(false);
  });

  it("returns undecryptable blobs as null rather than throwing", () => {
    service.setCredential("prog-1", "ws-1", "anthropic", "sk-ant-test-key-1234");
    db.prepare(`UPDATE program_upstream_credentials SET blob = 'tampered' WHERE program_id = ?`).run(
      "prog-1",
    );
    expect(service.getCredential("prog-1")).toBeNull();
    service.revokeCredential("prog-1");
  });

  it("refuses to store without OWS_VAULT_SECRET", () => {
    const saved = process.env.OWS_VAULT_SECRET;
    delete process.env.OWS_VAULT_SECRET;
    try {
      expect(() => service.setCredential("prog-1", "ws-1", "anthropic", "sk-ant-x")).toThrow(
        /OWS_VAULT_SECRET/,
      );
    } finally {
      process.env.OWS_VAULT_SECRET = saved;
    }
  });
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

beforeEach(() => {
  db.prepare(`DELETE FROM program_upstream_credentials`).run();
});
