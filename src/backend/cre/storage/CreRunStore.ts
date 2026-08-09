import { CreRun } from "@backend/cre/types.js";
import {
  CreRunPersistence,
  JsonlCreRunPersistence,
  MultiCreRunPersistence,
} from "@backend/cre/persistence/CreRunPersistence.js";
import {
  CreLedgerChain,
  creLedgerChain,
} from "@backend/cre/persistence/CreLedgerChain.js";
import { MongoDbCreRunPersistence } from "./MongoDbCreRunPersistence.js";
import { withRunStoreLock } from "@backend/cre/persistence/runStoreLock.js";

const DEFAULT_MAX_RUNS = 1000;

function readMaxRunsFromEnv(): number | undefined {
  const raw = process.env.CRE_MAX_RUNS;
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

export class CreRunStore {
  private runs: CreRun[] = [];
  private maxRuns: number;
  private persistence: CreRunPersistence;
  private ledger: CreLedgerChain;
  private loaded = false;

  constructor(
    params: {
      maxRuns?: number;
      persistence?: CreRunPersistence;
      ledger?: CreLedgerChain;
    } = {},
  ) {
    this.maxRuns = params.maxRuns ?? readMaxRunsFromEnv() ?? DEFAULT_MAX_RUNS;

    // Default to dual persistence: JSONL (hot cache) + MongoDB (durable).
    // The JSONL layer is capped at the same run budget so the file never
    // grows past what the store surfaces in memory.
    const layers: CreRunPersistence[] = [
      new JsonlCreRunPersistence({ maxRuns: this.maxRuns }),
    ];
    if (process.env.MONGODB_URI) {
      layers.push(new MongoDbCreRunPersistence({ maxRuns: this.maxRuns }));
    }
    this.persistence = params.persistence || new MultiCreRunPersistence(layers);
    this.ledger = params.ledger || creLedgerChain;
  }

  async ensureLoaded() {
    if (this.loaded) return;
    // loadAll() is newest-first, so the slice retains the most recent runs
    // and the cap evicts the oldest — never the newest.
    this.runs = await this.persistence.loadAll();
    this.runs = this.runs.slice(0, this.maxRuns);
    this.loaded = true;
  }

  /**
   * Serialize the read-modify-write cycle across processes sharing the same
   * backing store. Custom persistence layers (tests, in-memory) without a
   * lockPath run unlocked; they are per-process by construction.
   */
  private async withLock<T>(task: () => Promise<T>): Promise<T> {
    const lockPath = this.persistence.lockPath;
    if (!lockPath) return task();
    return withRunStoreLock(lockPath, task);
  }

  async add(run: CreRun) {
    await this.ensureLoaded();
    await this.withLock(async () => {
      this.runs.unshift(run);
      if (this.runs.length > this.maxRuns) {
        this.runs.pop();
      }
      await this.persistence.append(run);
      await this.ledger.record("add", run);
    });
  }

  async replace(run: CreRun) {
    await this.ensureLoaded();
    await this.withLock(async () => {
      const idx = this.runs.findIndex((r) => r.runId === run.runId);
      if (idx === -1) {
        this.runs.unshift(run);
        if (this.runs.length > this.maxRuns) {
          this.runs.pop();
        }
      } else {
        this.runs[idx] = run;
      }
      // writeAll() merges with the current file, so this process's snapshot
      // never evicts runs another process added.
      await this.persistence.writeAll(this.runs);
      await this.ledger.record("replace", run);
    });
  }

  async list() {
    await this.ensureLoaded();
    return this.runs;
  }

  async get(runId: string) {
    await this.ensureLoaded();
    return this.runs.find((r) => r.runId === runId);
  }

  async clear() {
    this.runs = [];
    this.loaded = true;
  }

  async reset() {
    this.runs = [];
    this.loaded = true;
    await this.withLock(async () => {
      await this.persistence.truncate();
      await this.ledger.record("truncate");
    });
  }
}

export const creRunStore = new CreRunStore();
