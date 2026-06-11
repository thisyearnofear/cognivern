import fs from "node:fs";
import path from "node:path";
import { CreRun } from "../types.js";

export interface CreRunPersistence {
  append(run: CreRun): Promise<void>;
  loadAll(): Promise<CreRun[]>;
  writeAll(runs: CreRun[]): Promise<void>;
  truncate(): Promise<void>;
}

/**
 * Local-first JSONL store.
 *
 * Why JSONL?
 * - append-only (safe for crashes)
 * - easy to inspect/debug
 * - no DB required for early users
 */
export class JsonlCreRunPersistence implements CreRunPersistence {
  private filePath: string;

  constructor(params: { filePath?: string } = {}) {
    this.filePath =
      params.filePath ||
      process.env.CRE_RUNS_FILE ||
      path.join(process.cwd(), "data", "cre-runs.jsonl");
  }

  async append(run: CreRun): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const line = JSON.stringify(run);
    await fs.promises.appendFile(this.filePath, `${line}\n`, "utf8");
  }

  async loadAll(): Promise<CreRun[]> {
    try {
      const data = await fs.promises.readFile(this.filePath, "utf8");
      return data
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => JSON.parse(l) as CreRun)
        .reverse(); // newest first
    } catch (err: any) {
      if (err?.code === "ENOENT") return [];
      throw err;
    }
  }

  async writeAll(runs: CreRun[]): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const content = runs.map((run) => JSON.stringify(run)).join("\n");
    await fs.promises.writeFile(
      this.filePath,
      content ? `${content}\n` : "",
      "utf8",
    );
  }

  async truncate(): Promise<void> {
    await this.writeAll([]);
  }
}

/**
 * Orchestrates multiple persistence layers in parallel.
 * Each layer's append/writeAll/truncate runs concurrently.
 * loadAll reads from the first layer only (fastest source).
 */
export class MultiCreRunPersistence implements CreRunPersistence {
  constructor(private layers: CreRunPersistence[]) {}

  async append(run: CreRun): Promise<void> {
    await Promise.all(this.layers.map((l) => l.append(run)));
  }

  async loadAll(): Promise<CreRun[]> {
    return await this.layers[0].loadAll();
  }

  async writeAll(runs: CreRun[]): Promise<void> {
    await Promise.all(this.layers.map((l) => l.writeAll(runs)));
  }

  async truncate(): Promise<void> {
    await Promise.all(this.layers.map((l) => l.truncate()));
  }
}
