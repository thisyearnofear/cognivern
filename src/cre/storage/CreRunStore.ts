import { CreRun } from "../types.js";
import {
  CreRunPersistence,
  JsonlCreRunPersistence,
} from "../persistence/CreRunPersistence.js";

export class CreRunStore {
  private runs: CreRun[] = [];
  private maxRuns: number;
  private persistence: CreRunPersistence;
  private loaded = false;

  constructor(params: { maxRuns?: number; persistence?: CreRunPersistence } = {}) {
    this.maxRuns = params.maxRuns ?? 100;
    this.persistence = params.persistence ?? new JsonlCreRunPersistence();
  }

  async ensureLoaded() {
    if (this.loaded) return;
    this.runs = await this.persistence.loadAll();
    this.runs = this.runs.slice(0, this.maxRuns);
    this.loaded = true;
  }

  async add(run: CreRun) {
    await this.ensureLoaded();
    this.runs.unshift(run);
    if (this.runs.length > this.maxRuns) {
      this.runs.pop();
    }
    await this.persistence.append(run);
  }

  async replace(run: CreRun) {
    await this.ensureLoaded();
    const idx = this.runs.findIndex((r) => r.runId === run.runId);
    if (idx === -1) {
      this.runs.unshift(run);
      if (this.runs.length > this.maxRuns) {
        this.runs.pop();
      }
    } else {
      this.runs[idx] = run;
    }
    await this.persistence.writeAll(this.runs);
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
    // Keep local-first simple: clearing only clears memory, not the JSONL file.
    // We can add a destructive wipe endpoint later if needed.
    this.runs = [];
    this.loaded = true;
  }

  async reset() {
    this.runs = [];
    this.loaded = true;
    await this.persistence.truncate();
  }
}

export const creRunStore = new CreRunStore();
