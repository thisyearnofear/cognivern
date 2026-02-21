import fs from "node:fs";
import path from "node:path";
import { CreRun } from "../types.js";

export interface CreRunPersistence {
  append(run: CreRun): Promise<void>;
  loadAll(): Promise<CreRun[]>;
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
}
