import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CreRun } from "@backend/cre/types.js";

type FakeDoc = { _id: number; runId: string; [key: string]: unknown };

const mongoMock = vi.hoisted(() => {
  function matches(doc: FakeDoc, filter: Record<string, unknown>): boolean {
    for (const [key, expected] of Object.entries(filter)) {
      if (key === "_id" && typeof expected === "object" && expected !== null) {
        const op = expected as { $nin?: unknown[] };
        if (op.$nin && op.$nin.includes(doc._id)) return false;
        continue;
      }
      if (doc[key] !== expected) return false;
    }
    return true;
  }

  class FakeCollection {
    docs: FakeDoc[] = [];
    indexes: { keys: Record<string, number>; opts: Record<string, unknown> }[] = [];
    nextId = 1;
    /** When true, an upsert that would insert simulates a concurrent winner:
     *  the doc lands (as the winner's insert) and the caller gets E11000. */
    raceActive = false;

    async insertOne(doc: Record<string, unknown>): Promise<{ insertedId: number }> {
      const next = { ...doc, _id: this.nextId++ } as FakeDoc;
      this.docs.push(next);
      return { insertedId: next._id };
    }

    async updateOne(
      filter: Record<string, unknown>,
      update: { $set: Record<string, unknown> },
      opts: { upsert?: boolean } = {},
    ): Promise<{ modifiedCount: number; upsertedCount: number }> {
      const existing = this.docs.find((d) => matches(d, filter));
      if (existing) {
        Object.assign(existing, update.$set);
        return { modifiedCount: 1, upsertedCount: 0 };
      }
      if (opts.upsert) {
        const doc = { _id: this.nextId++, ...update.$set } as FakeDoc;
        if (this.raceActive) {
          // The winner's insert lands first; we lose the race.
          this.docs.push(doc);
          throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        }
        this.docs.push(doc);
        return { modifiedCount: 0, upsertedCount: 1 };
      }
      return { modifiedCount: 0, upsertedCount: 0 };
    }

    async bulkWrite(
      ops: { updateOne?: { filter: Record<string, unknown>; update: { $set: Record<string, unknown> }; upsert?: boolean } }[],
    ): Promise<{ ok: number }> {
      // Like the real driver: any op error rejects the whole batch.
      for (const op of ops) {
        if (op.updateOne) {
          await this.updateOne(op.updateOne.filter, op.updateOne.update, op.updateOne);
        }
      }
      return { ok: 1 };
    }

    async deleteMany(filter: Record<string, unknown> = {}): Promise<{ deletedCount: number }> {
      const before = this.docs.length;
      if (filter._id && typeof filter._id === "object") {
        const op = filter._id as { $nin?: unknown[] };
        if (op.$nin) {
          // Keep docs whose _id IS in $nin; delete the rest (mirrors
          // Mongo's $nin deleteMany used for cap pruning).
          this.docs = this.docs.filter((d) => op.$nin!.includes(d._id));
        }
      } else if (Object.keys(filter).length === 0) {
        this.docs = [];
      }
      return { deletedCount: before - this.docs.length };
    }

    async countDocuments(): Promise<number> {
      return this.docs.length;
    }

    async createIndex(
      keys: Record<string, number>,
      opts: Record<string, unknown> = {},
    ): Promise<string> {
      this.indexes.push({ keys, opts });
      return `idx_${this.indexes.length}`;
    }

    find(
      filter: Record<string, unknown> = {},
      _options: { projection?: Record<string, number> } = {},
    ) {
      const sort: [string, number][] = [];
      let limit = Infinity;
      const self = this;
      return {
        sort(keys: Record<string, number>) {
          for (const [k, v] of Object.entries(keys)) sort.push([k, v]);
          return this;
        },
        limit(n: number) {
          limit = n;
          return this;
        },
        async toArray(): Promise<FakeDoc[]> {
          let out = self.docs.filter((d) => matches(d, filter));
          // Composite sort: apply all keys, earlier keys taking precedence.
          out.sort((a, b) => {
            for (const [key, dir] of sort) {
              const av = (a[key] ?? "") as string;
              const bv = (b[key] ?? "") as string;
              // Missing fields sort as "" → first on asc, last on desc,
              // mirroring MongoDB's null ordering.
              const cmp = av.localeCompare(bv) * dir;
              if (cmp !== 0) return cmp;
            }
            return 0;
          });
          return out.slice(0, limit);
        },
      };
    }
  }

  const fake = new FakeCollection();
  const service = {
    connect: vi.fn(async () => ({})),
    collection: vi.fn((_name: string) => fake),
    isConnected: vi.fn(() => true),
    disconnect: vi.fn(async () => {}),
  };
  return { FakeCollection, fake, service };
});

vi.mock("@backend/services/MongoDbService.js", () => ({
  mongoDbService: mongoMock.service,
}));

// Imported after the mock so the module under test gets the fake service.
import { MongoDbCreRunPersistence } from "@backend/cre/storage/MongoDbCreRunPersistence.js";

function makeRun(runId: string, startedAt: string, extra: Record<string, unknown> = {}): CreRun {
  return {
    runId,
    workflow: "spend",
    mode: "local",
    startedAt,
    ok: true,
    status: "completed",
    steps: [],
    artifacts: [],
    ...extra,
  } as CreRun;
}

beforeEach(() => {
  mongoMock.fake.docs = [];
  mongoMock.fake.indexes = [];
  mongoMock.fake.nextId = 1;
  mongoMock.fake.raceActive = false;
  mongoMock.service.connect.mockClear();
});

describe("MongoDbCreRunPersistence merge semantics", () => {
  it("writeAll merges runs another process appended instead of clobbering them", async () => {
    const p = new MongoDbCreRunPersistence();
    // Another process appended run-2 directly to the shared collection.
    await mongoMock.fake.insertOne(makeRun("run-2", "2026-01-02T00:00:00.000Z"));

    // This process (whose snapshot never saw run-2) replaces run-1.
    await p.writeAll([makeRun("run-1", "2026-01-01T00:00:00.000Z")]);

    const byId = new Map(mongoMock.fake.docs.map((d) => [d.runId, d]));
    expect(byId.get("run-1")?.runId).toBe("run-1");
    expect(byId.get("run-2")?.runId).toBe("run-2");
  });

  it("writeAll upserts newer versions of the same runId without duplicating", async () => {
    const p = new MongoDbCreRunPersistence();
    await p.writeAll([makeRun("run-1", "2026-01-01T00:00:00.000Z")]);
    await p.writeAll([
      makeRun("run-1", "2026-01-01T00:00:00.000Z", { status: "consumed" }),
    ]);
    expect(mongoMock.fake.docs).toHaveLength(1);
    expect(mongoMock.fake.docs[0].status).toBe("consumed");
  });

  it("writeAll with an empty array leaves the collection intact (use truncate to clear)", async () => {
    const p = new MongoDbCreRunPersistence();
    await p.writeAll([makeRun("run-1", "2026-01-01T00:00:00.000Z")]);
    await p.writeAll([]);
    expect(mongoMock.fake.docs).toHaveLength(1);
  });

  it("writeAll caps the collection at maxRuns keeping the newest runs", async () => {
    const p = new MongoDbCreRunPersistence({ maxRuns: 3 });
    for (const i of [1, 2, 3, 4, 5]) {
      await p.writeAll([makeRun(`run-${i}`, `2026-01-0${i}T00:00:00.000Z`)]);
    }
    expect(mongoMock.fake.docs.map((d) => d.runId).sort()).toEqual([
      "run-3",
      "run-4",
      "run-5",
    ]);
  });

  it("append upserts instead of inserting: re-adding a run never duplicates it", async () => {
    const p = new MongoDbCreRunPersistence();
    await p.append(makeRun("run-1", "2026-01-01T00:00:00.000Z"));
    await p.append(makeRun("run-1", "2026-01-01T00:00:00.000Z", { status: "failed" }));
    expect(mongoMock.fake.docs).toHaveLength(1);
    expect(mongoMock.fake.docs[0].status).toBe("failed");
  });

  it("append does not mutate the shared run object with a storage _id", async () => {
    const p = new MongoDbCreRunPersistence();
    const run = makeRun("run-1", "2026-01-01T00:00:00.000Z");
    await p.append(run);
    expect(run).not.toHaveProperty("_id");
  });

  it("loadAll strips _id and limits to maxRuns newest-first", async () => {
    const p = new MongoDbCreRunPersistence({ maxRuns: 2 });
    for (const i of [1, 2, 3]) {
      await p.append(makeRun(`run-${i}`, `2026-01-0${i}T00:00:00.000Z`));
    }
    const loaded = await p.loadAll();
    expect(loaded.map((r) => r.runId)).toEqual(["run-3", "run-2"]);
    expect(loaded[0]).not.toHaveProperty("_id");
  });

  it("ensures a unique index on runId, and only once per process", async () => {
    const p = new MongoDbCreRunPersistence();
    await p.append(makeRun("run-1", "2026-01-01T00:00:00.000Z"));
    await p.append(makeRun("run-2", "2026-01-02T00:00:00.000Z"));
    await p.writeAll([makeRun("run-3", "2026-01-03T00:00:00.000Z")]);
    const idx = mongoMock.fake.indexes.filter((i) => i.keys.runId === 1);
    expect(idx).toHaveLength(1);
    expect(idx[0].opts.unique).toBe(true);
  });

  it("retries an E11000 append race as a plain update, never dropping the write", async () => {
    const p = new MongoDbCreRunPersistence();
    mongoMock.fake.raceActive = true;
    await p.append(makeRun("run-1", "2026-01-01T00:00:00.000Z", { status: "consumed" }));
    expect(mongoMock.fake.docs).toHaveLength(1);
    expect(mongoMock.fake.docs[0].status).toBe("consumed");
  });

  it("writeAll survives a batch-level E11000 race without losing any run", async () => {
    const p = new MongoDbCreRunPersistence();
    await p.writeAll([makeRun("run-1", "2026-01-01T00:00:00.000Z")]);
    // A concurrent process races us on run-2's insert mid-batch.
    mongoMock.fake.raceActive = true;
    await p.writeAll([
      makeRun("run-1", "2026-01-01T00:00:00.000Z", { status: "ok" }),
      makeRun("run-2", "2026-01-02T00:00:00.000Z"),
    ]);
    const byId = new Map(mongoMock.fake.docs.map((d) => [d.runId, d]));
    expect(mongoMock.fake.docs).toHaveLength(2);
    expect(byId.get("run-1")?.status).toBe("ok");
    expect(byId.get("run-2")?.runId).toBe("run-2");
  });

  it("truncate clears the collection", async () => {
    const p = new MongoDbCreRunPersistence();
    await p.append(makeRun("run-1", "2026-01-01T00:00:00.000Z"));
    await p.truncate();
    expect(mongoMock.fake.docs).toHaveLength(0);
  });
});
