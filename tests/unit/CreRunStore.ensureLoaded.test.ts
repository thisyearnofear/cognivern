import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonlCreRunPersistence } from "@backend/cre/persistence/CreRunPersistence.js";
import { CreLedgerChain } from "@backend/cre/persistence/CreLedgerChain.js";
import { CreRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";

function makeRun(runId: string): CreRun {
  return {
    runId,
    workflow: "spend",
    mode: "local",
    startedAt: new Date().toISOString(),
    ok: true,
    status: "completed",
    steps: [],
    artifacts: [],
  };
}

describe("CreRunStore ensureLoaded concurrency", () => {
  let dir: string;
  let runsFile: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "cre-load-"));
    runsFile = path.join(dir, "cre-runs.jsonl");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("deduplicates concurrent first loads", async () => {
    const persistence = new JsonlCreRunPersistence({ filePath: runsFile });
    await persistence.append(makeRun("seed"));

    const store = new CreRunStore({
      persistence,
      ledger: new CreLedgerChain({ filePath: path.join(dir, "ledger.jsonl") }),
    });

    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.list()]);
    const listed = await store.list();
    expect(listed.map((r) => r.runId)).toEqual(["seed"]);
  });
});
