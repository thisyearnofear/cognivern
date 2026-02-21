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
}

export const creRunStore = new CreRunStore();
