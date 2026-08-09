import fs from "node:fs";
import path from "node:path";
import { CreRun } from "@backend/cre/types.js";

export interface CreRunPersistence {
  append(run: CreRun): Promise<void>;
  loadAll(): Promise<CreRun[]>;
  writeAll(runs: CreRun[]): Promise<void>;
  truncate(): Promise<void>;
  /**
   * Optional path of the cross-process lock guarding this layer's backing
   * store. The store serializes its read-modify-write cycles with it so
   * concurrent writers (pm2 server + ops scripts) cannot clobber each
   * other's runs. Layers without a local file (remote caches) omit it.
   */
  readonly lockPath?: string;
}

const DEFAULT_MAX_RUNS = 1000;

/** Recency key for run retention: prefer explicit timestamps, blank last. */
function recencyKey(run: CreRun): string {
  return run.startedAt || run.finishedAt || "";
}

/**
 * Local-first JSONL store.
 *
 * Why JSONL?
 * - append-only (safe for crashes)
 * - easy to inspect/debug
 * - no DB required for early users
 *
 * Ordering and multi-process safety:
 * - loadAll() sorts by run recency (startedAt/finishedAt) so the store
 *   always sees newest-first regardless of the file's write history — the
 *   old code's ordering depended on which writer wrote last, which silently
 *   evicted the newest runs at the cap.
 * - writeAll() MERGES with the current file instead of replacing it, so a
 *   process holding a stale in-memory snapshot can never evict runs that
 *   another process added. Newer versions of the same runId win, and the
 *   file stays bounded at maxRuns (newest kept).
 * - Writes are atomic (temp file + rename), so concurrent readers never
 *   observe a truncated file.
 */
export class JsonlCreRunPersistence implements CreRunPersistence {
  private filePath: string;
  private maxRuns: number;
  readonly lockPath: string;

  constructor(params: { filePath?: string; maxRuns?: number } = {}) {
    this.filePath =
      params.filePath ||
      process.env.CRE_RUNS_FILE ||
      path.join(process.cwd(), "data", "cre-runs.jsonl");
    this.maxRuns = params.maxRuns ?? DEFAULT_MAX_RUNS;
    this.lockPath = `${this.filePath}.lock`;
  }

  private async readParsed(): Promise<CreRun[]> {
    try {
      const data = await fs.promises.readFile(this.filePath, "utf8");
      return data
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line) as CreRun);
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
  }

  private async atomicWrite(content: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.promises.writeFile(tmpPath, content, "utf8");
    try {
      await fs.promises.rename(tmpPath, this.filePath);
    } catch (error) {
      await fs.promises.unlink(tmpPath).catch(() => undefined);
      throw error;
    }
  }

  async append(run: CreRun): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const line = JSON.stringify(run);
    await fs.promises.appendFile(this.filePath, `${line}\n`, "utf8");
  }

  async loadAll(): Promise<CreRun[]> {
    const runs = await this.readParsed();
    const latestById = new Map<string, CreRun>();
    for (const run of runs) {
      // The last occurrence wins: append-only writers and merges both write
      // the newest version of a runId later in the file. Delete-then-set so
      // the map's iteration order reflects the LAST write position.
      latestById.delete(run.runId);
      latestById.set(run.runId, run);
    }
    const values = [...latestById.values()];
    // Newest first, by run timestamp — independent of file write order so a
    // file produced by older writers (newest-first) or legacy appends cannot
    // flip the ordering or the cap's eviction direction. Stable sort keeps
    // the last-write order for runs with identical or missing timestamps.
    values.sort((left, right) => recencyKey(right).localeCompare(recencyKey(left)));
    return values;
  }

  /**
   * Merge, never replace: a stale snapshot from another process must not
   * evict runs it never loaded. Newer versions of the same runId win, and
   * the file stays bounded at maxRuns keeping the newest. NOTE: an empty
   * `runs` array preserves the current file (merge of nothing); use
   * truncate() to clear the store.
   */
  async writeAll(runs: CreRun[]): Promise<void> {
    const existing = await this.readParsed();
    const merged = new Map<string, CreRun>();
    for (const run of existing) merged.set(run.runId, run);
    for (const run of runs) merged.set(run.runId, run);
    let values = [...merged.values()];
    values.sort((left, right) => recencyKey(left).localeCompare(recencyKey(right)));
    if (values.length > this.maxRuns) {
      values = values.slice(values.length - this.maxRuns);
    }
    await this.atomicWrite(
      values.map((run) => JSON.stringify(run)).join("\n") +
        (values.length > 0 ? "\n" : ""),
    );
  }

  async truncate(): Promise<void> {
    await this.atomicWrite("");
  }
}

/**
 * Orchestrates multiple persistence layers in parallel.
 * Each layer's append/writeAll/truncate runs concurrently.
 * loadAll reads from the first layer only (fastest source).
 */
export class MultiCreRunPersistence implements CreRunPersistence {
  constructor(private layers: CreRunPersistence[]) {}

  get lockPath(): string | undefined {
    return this.layers.find((layer) => layer.lockPath)?.lockPath;
  }

  async append(run: CreRun): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.append(run)));
  }

  async loadAll(): Promise<CreRun[]> {
    return await this.layers[0].loadAll();
  }

  async writeAll(runs: CreRun[]): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.writeAll(runs)));
  }

  async truncate(): Promise<void> {
    await Promise.all(this.layers.map((layer) => layer.truncate()));
  }
}
