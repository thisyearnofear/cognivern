/**
 * InferenceVerdictStore tests — Mission 10 leaderboard math.
 *
 * Uses a throwaway SQLite file (same pattern as ValidationStore tests).
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-verdicts-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { InferenceVerdictStore } = await import(
  "@backend/services/credits/InferenceVerdictStore.js"
);
const { InferenceRecordStore } = await import(
  "@backend/services/credits/InferenceRecordStore.js"
);

const db = getDb();
const store = new InferenceVerdictStore(db);
const records = new InferenceRecordStore(db);

function insertRecord(
  _label: string,
  model: string,
  opts: { costNano?: number; excerpts?: boolean; status?: "ok" | "upstream_error" } = {},
): string {
  return records.insert({
    programId: "prog-1",
    participantId: "part-1",
    workspaceId: "ws-1",
    disclosureTier: "open",
    backend: "test",
    model,
    status: opts.status ?? "ok",
    inputTokens: 10,
    outputTokens: 20,
    cachedTokens: 0,
    costNano: opts.costNano ?? 1_000_000, // $0.001
    latencyMs: 100,
    streamed: false,
    redactionCount: 0,
    redactionCategories: [],
    promptExcerpt: opts.excerpts === false ? null : "what is 2+2?",
    responseExcerpt: opts.excerpts === false ? null : "4",
  });
}

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
  "INSERT OR IGNORE INTO credit_participants (id, program_id, workspace_id, handle, disclosure_tier, created_at, updated_at) VALUES ('part-1', 'prog-1', 'ws-1', 'p1', 'open', ?, ?)",
).run(now, now);

beforeAll(() => {
  // Three ok calls on model-a (two verified correct, one incorrect),
  // one ok call on model-b (verified unknown), one error call ignored.
  const a1 = insertRecord("m", "model-a", { costNano: 1_000_000 });
  const a2 = insertRecord("m", "model-a", { costNano: 2_000_000 });
  const a3 = insertRecord("m", "model-a", { costNano: 3_000_000 });
  const b1 = insertRecord("m", "model-b", { costNano: 4_000_000 });
  insertRecord("m", "model-a", { status: "upstream_error" });
  // No excerpts → never a candidate.
  insertRecord("m", "model-a", { excerpts: false });

  store.insert({ recordId: a1, verdict: "correct", telegraphRunId: "run-1" });
  store.insert({ recordId: a2, verdict: "correct", telegraphRunId: "run-2" });
  store.insert({ recordId: a3, verdict: "incorrect", telegraphRunId: "run-3" });
  store.insert({ recordId: b1, verdict: "unknown", telegraphRunId: "run-4" });
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

describe("InferenceVerdictStore", () => {
  it("computes cost per verified correct answer per model", () => {
    const board = store.leaderboard("prog-1");
    const a = board.find((r) => r.model === "model-a");
    const b = board.find((r) => r.model === "model-b");

    expect(a).toBeDefined();
    expect(a!.okCalls).toBe(4); // 3 ok + rec-noexc; error excluded
    expect(a!.sampledCalls).toBe(3);
    expect(a!.correctCount).toBe(2);
    expect(a!.incorrectCount).toBe(1);
    // Sampled cost = $0.001 + $0.002 + $0.003 = $0.006 → /2 correct = $0.003
    expect(a!.sampledCostUsd).toBeCloseTo(0.006, 6);
    expect(a!.costPerVerifiedCorrectUsd).toBeCloseTo(0.003, 6);
    expect(a!.verifiedAccuracy).toBeCloseTo(2 / 3, 5);

    expect(b).toBeDefined();
    expect(b!.correctCount).toBe(0);
    expect(b!.costPerVerifiedCorrectUsd).toBeNull();
    expect(b!.verifiedAccuracy).toBeNull(); // unknowns excluded from rate
  });

  it("only samples ok records with excerpts and no verdict", () => {
    const candidates = store.sampleCandidates("prog-1", { limit: 10 });
    const ids = candidates.map((c) => c.id);
    // rec-noexc has null excerpts → never eligible; rec-err is not ok;
    // rec-a1/a2/a3/b1 already carry verdicts.
    expect(ids).not.toContain("rec-noexc");
    expect(ids).not.toContain("rec-err");
    expect(ids).not.toContain("rec-a1"); // already verdicted
    expect(ids).toHaveLength(0);
  });

  it("does not double-insert a verdict for the same record", () => {
    const existing = db
      .prepare(`SELECT record_id, verdict FROM inference_record_verdicts LIMIT 1`)
      .get() as { record_id: string; verdict: string };
    store.insert({ recordId: existing.record_id, verdict: "incorrect" });
    const row = db
      .prepare(`SELECT verdict FROM inference_record_verdicts WHERE record_id = ?`)
      .get(existing.record_id) as { verdict: string };
    expect(row.verdict).toBe(existing.verdict);
  });
});
