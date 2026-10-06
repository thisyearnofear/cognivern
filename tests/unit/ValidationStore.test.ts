/**
 * ValidationStore tests — server-recorded cohort-travel evidence.
 *
 * Uses a throwaway SQLite file (same pattern as CreditLedgerService tests).
 * Privacy bound under test: open events carry no identity columns.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-validation-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { ValidationStore } = await import(
  "@backend/services/credits/ValidationStore.js"
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
db.prepare(
  "INSERT OR IGNORE INTO credit_ledger_commitments (id, program_id, commitment_root, payload_hash, created_at) VALUES ('cmt-1', 'prog-1', 'root', 'hash', ?)",
).run(now);
db.prepare(
  "INSERT OR IGNORE INTO credit_ledger_commitments (id, program_id, commitment_root, payload_hash, created_at) VALUES ('cmt-2', 'prog-1', 'root', 'hash', ?)",
).run(now);

const store = new ValidationStore(db);

describe("ValidationStore", () => {
  it("starts empty", () => {
    expect(store.summary("prog-nope")).toEqual({
      shareCount: 0,
      lastSharedAt: null,
      openCount: 0,
      lastOpenedAt: null,
      feedbackCount: 0,
      avgUsefulness: null,
      wouldReuseCount: 0,
    });
  });

  it("records shares and summarises them", () => {
    const id = store.recordShare({
      programId: "prog-1",
      workspaceId: "ws-1",
      commitmentId: "cmt-1",
    });
    expect(id.startsWith("shr_")).toBe(true);
    store.recordShare({ programId: "prog-1", workspaceId: "ws-1", commitmentId: "cmt-2" });
    const summary = store.summary("prog-1");
    expect(summary.shareCount).toBe(2);
    expect(typeof summary.lastSharedAt).toBe("string");
  });

  it("records opens with no identity columns", () => {
    store.recordOpen("cmt-1");
    const db = getDb();
    const cols = db.prepare(`PRAGMA table_info(verify_open_events)`).all() as Array<{
      name: string;
    }>;
    const names = cols.map((c) => c.name);
    expect(names).toEqual(["id", "commitment_id", "created_at"]);
    expect(names).not.toContain("ip");
    expect(names).not.toContain("user_agent");
  });

  it("records feedback and averages usefulness", () => {
    store.recordFeedback({
      programId: "prog-1",
      workspaceId: "ws-1",
      usefulness: 5,
      wouldReuse: true,
    });
    store.recordFeedback({
      programId: "prog-1",
      workspaceId: "ws-1",
      usefulness: 3,
      wouldReuse: false,
      note: "Needs a summary paragraph.",
    });
    const summary = store.summary("prog-1");
    expect(summary.feedbackCount).toBe(2);
    expect(summary.avgUsefulness).toBe(4);
    expect(summary.wouldReuseCount).toBe(1);
  });

  it("scopes summaries per program", () => {
    expect(store.summary("prog-other").shareCount).toBe(0);
    expect(store.summary("prog-other").feedbackCount).toBe(0);
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
