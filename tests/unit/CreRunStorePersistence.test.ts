import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  JsonlCreRunPersistence,
  MultiCreRunPersistence,
} from "@backend/cre/persistence/CreRunPersistence.js";
import { CreLedgerChain } from "@backend/cre/persistence/CreLedgerChain.js";
import { CreRunStore } from "@backend/cre/storage/CreRunStore.js";
import { withRunStoreLock } from "@backend/cre/persistence/runStoreLock.js";
import type { CreRun } from "@backend/cre/types.js";

function makeRun(runId: string, startedAt: string): CreRun {
  return {
    runId,
    workflow: "spend",
    mode: "local",
    startedAt,
    ok: true,
    status: "completed",
    steps: [],
    artifacts: [],
  };
}

let dir: string;
let runsFile: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "cre-runs-store-"));
  runsFile = path.join(dir, "cre-runs.jsonl");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function persistence(maxRuns?: number): JsonlCreRunPersistence {
  return new JsonlCreRunPersistence({ filePath: runsFile, ...(maxRuns ? { maxRuns } : {}) });
}

function store(p: JsonlCreRunPersistence, maxRuns?: number): CreRunStore {
  return new CreRunStore({
    persistence: p,
    maxRuns,
    ledger: new CreLedgerChain({ filePath: path.join(dir, "cre-ledger.jsonl") }),
  });
}

describe("JsonlCreRunPersistence ordering", () => {
  it("loads newest-first and resolves duplicate runIds to the last write", async () => {
    const p = persistence();
    await p.append(makeRun("run-1", "2026-01-01T00:00:00.000Z"));
    await p.append(makeRun("run-2", "2026-01-02T00:00:00.000Z"));
    await p.append(makeRun("run-1", "2026-01-03T00:00:00.000Z")); // update
    const loaded = await p.loadAll();
    expect(loaded.map((r) => r.runId)).toEqual(["run-1", "run-2"]);
    expect(loaded[0].startedAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("loadAll stays newest-first even after a merge-based writeAll", async () => {
    const p = persistence();
    for (const i of [1, 2, 3]) {
      await p.append(makeRun(`run-${i}`, `2026-01-0${i}T00:00:00.000Z`));
    }
    await p.writeAll([makeRun("run-2", "2026-01-02T00:00:00.000Z")]);
    const loaded = await p.loadAll();
    expect(loaded.map((r) => r.runId)).toEqual(["run-3", "run-2", "run-1"]);
  });
});

describe("multi-process write safety (the eviction bug)", () => {
  it("writeAll merges runs written by another process instead of clobbering them", async () => {
    // Process A adds run-1 through its store.
    const p = persistence();
    const storeA = store(p);
    await storeA.add(makeRun("run-1", "2026-01-01T00:00:00.000Z"));

    // Another process appends run-2 directly to the shared file.
    await fs.promises.appendFile(
      runsFile,
      `${JSON.stringify(makeRun("run-2", "2026-01-02T00:00:00.000Z"))}\n`,
      "utf8",
    );

    // Process A (whose in-memory snapshot never saw run-2) replaces run-1.
    const updated = makeRun("run-1", "2026-01-01T00:00:00.000Z");
    updated.status = "failed";
    await storeA.replace(updated);

    // Both runs survive a reload from disk.
    const reloaded = await persistence().loadAll();
    const byId = new Map(reloaded.map((r) => [r.runId, r]));
    expect(byId.get("run-1")?.status).toBe("failed");
    expect(byId.get("run-2")?.runId).toBe("run-2");
  });

  it("two store instances sharing one file never lose each other's runs", async () => {
    const storeA = store(persistence());
    const storeB = store(persistence());
    await storeA.add(makeRun("run-a", "2026-01-01T00:00:00.000Z"));
    await storeB.add(makeRun("run-b", "2026-01-02T00:00:00.000Z"));

    const updatedA = makeRun("run-a", "2026-01-01T00:00:00.000Z");
    updatedA.status = "consumed";
    await storeA.replace(updatedA);

    const reloaded = await persistence().loadAll();
    expect(new Set(reloaded.map((r) => r.runId))).toEqual(
      new Set(["run-a", "run-b"]),
    );
  });

  it("writeAll caps the file at maxRuns keeping the newest runs", async () => {
    const p = persistence(3);
    for (const i of [1, 2, 3, 4, 5]) {
      await p.append(makeRun(`run-${i}`, `2026-01-0${i}T00:00:00.000Z`));
    }
    await p.writeAll([makeRun("run-2", "2026-01-02T00:00:00.000Z")]);
    const loaded = await p.loadAll();
    expect(loaded.map((r) => r.runId)).toEqual(["run-5", "run-4", "run-3"]);
  });
});

describe("CreRunStore eviction semantics", () => {
  it("keeps the newest maxRuns runs when exceeding the cap", async () => {
    const s = store(persistence(), 3);
    for (const i of [1, 2, 3, 4, 5]) {
      await s.add(makeRun(`run-${i}`, `2026-01-0${i}T00:00:00.000Z`));
    }
    expect((await s.list()).map((r) => r.runId)).toEqual([
      "run-5",
      "run-4",
      "run-3",
    ]);
  });

  it("a fresh load never drops the newest run at the cap (regression)", async () => {
    const s1 = store(persistence(), 3);
    for (const i of [1, 2, 3, 4]) {
      await s1.add(makeRun(`run-${i}`, `2026-01-0${i}T00:00:00.000Z`));
    }
    // Simulate a reload from disk: the previous bug dropped the newest run
    // because loadAll() order depended on the file's write history.
    const reloaded = store(persistence(), 3);
    const runs = await reloaded.list();
    expect(runs[0].runId).toBe("run-4");
    expect(runs.map((r) => r.runId)).toContain("run-3");
    expect(runs.map((r) => r.runId)).toContain("run-2");
  });

  it("MultiCreRunPersistence exposes the first layer's lockPath", async () => {
    const multi = new MultiCreRunPersistence([persistence()]);
    expect(multi.lockPath).toBe(`${runsFile}.lock`);
  });
});

describe("withRunStoreLock", () => {
  it("serializes concurrent critical sections", async () => {
    const lockPath = path.join(dir, "store.lock");
    const order: string[] = [];
    const first = withRunStoreLock(lockPath, async () => {
      order.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 150));
      order.push("first:end");
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = withRunStoreLock(lockPath, async () => {
      order.push("second");
    });
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("fails fast when the lock cannot be acquired within the timeout", async () => {
    const lockPath = path.join(dir, "held.lock");
    await fs.promises.writeFile(lockPath, "held by another process", "utf8");
    await expect(
      withRunStoreLock(
        lockPath,
        async () => undefined,
        { acquireTimeoutMs: 120, staleMs: 60_000, retryMs: 20 },
      ),
    ).rejects.toThrow(/Timed out acquiring/);
  });

  it("steals a stale lock left by a crashed holder", async () => {
    const lockPath = path.join(dir, "stale.lock");
    await fs.promises.writeFile(lockPath, "crashed holder", "utf8");
    const past = new Date(Date.now() - 60_000);
    await fs.promises.utimes(lockPath, past, past);
    let ran = false;
    await withRunStoreLock(lockPath, async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
