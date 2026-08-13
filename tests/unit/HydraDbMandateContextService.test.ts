import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-hydra-context-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.HYDRADB_ENABLED = "false";
delete process.env.HYDRADB_API_KEY;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { HydraDbMandateContextService } = await import("@backend/services/hydradb/HydraDbMandateContextService.js");

let mandateId = "";

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("hydra-context-user", now, now);
  db.prepare("INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("hydra-context-workspace", "Hydra context", "hydra-context-user", now, now);
  mandateId = FundedMandateService.create("hydra-context-workspace", {
    name: "Context mandate",
    objective: "Verify fail-open context behavior",
  }).id;
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* cleanup best effort */ }
  }
});

describe("HydraDbMandateContextService", () => {
  it("returns structured disabled status without making HydraDB a dependency", async () => {
    const service = new HydraDbMandateContextService();
    const sync = await service.syncMandate("hydra-context-workspace", mandateId);

    expect(sync.enabled).toBe(false);
    expect(sync.syncStatus).toBe("disabled");
    expect(sync.ingested).toEqual({ mandate: 0, outcomes: 0, statements: 0, recommendations: 0, runs: 0 });
    expect(sync.warning).toMatch(/fully operational/i);
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM hydra_context_sync_jobs").get()).toEqual({ count: 0 });

    const context = await service.getContext("hydra-context-workspace", mandateId);
    expect(context.chunks).toEqual([]);
    expect(context.provenance).toEqual([]);
    expect(context.metrics.hydraDbCalls).toBe(0);
    expect(context.syncStatus).toBe("disabled");
  });

  it("serializes best-effort mutation syncs and preserves the mutation boundary", async () => {
    const service = new HydraDbMandateContextService();
    const first = service.syncMandateBestEffort("hydra-context-workspace", mandateId, "mandate_updated");
    const second = service.syncMandateBestEffort("hydra-context-workspace", mandateId, "outcome_created");
    const results = await Promise.all([first, second]);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.syncStatus)).toEqual(["disabled", "disabled"]);
    expect(results[1]?.syncTrigger).toBe("outcome_created");
    expect(getDb().prepare("SELECT COUNT(*) AS count FROM hydra_context_sync_jobs").get()).toEqual({ count: 0 });
  });

  it("persists enabled best-effort syncs for recovery after a process restart", async () => {
    const service = new HydraDbMandateContextService();
    const fakeIngestion = {
      isEnabled: () => true,
      ensureDatabase: async () => true,
      ingestAppRecordIds: async () => ["app-ingest-1", "app-ingest-2", "app-ingest-3"],
      ingestCreRuns: async () => [],
      waitForIndexing: async () => true,
    };
    (service as unknown as { ingestion: typeof fakeIngestion }).ingestion = fakeIngestion;

    const result = await service.syncMandateBestEffort("hydra-context-workspace", mandateId, "mandate_updated");
    expect(result.syncStatus).toBe("synced");

    const job = getDb().prepare(
      "SELECT status, attempts, last_synced_at FROM hydra_context_sync_jobs WHERE workspace_id = ? AND mandate_id = ?",
    ).get("hydra-context-workspace", mandateId) as { status: string; attempts: number; last_synced_at: string | null };
    expect(job).toMatchObject({ status: "completed", attempts: 1 });
    expect(job.last_synced_at).toBeTruthy();
  });

  it("rejects a mandate lookup from another workspace before querying HydraDB", async () => {
    const service = new HydraDbMandateContextService();
    await expect(service.getContext("another-workspace", mandateId)).rejects.toThrow(/mandate not found/i);
  });
});
