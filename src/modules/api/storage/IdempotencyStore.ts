import fs from "node:fs";
import path from "node:path";

export interface IdempotencyRecord {
  statusCode: number;
  body: Record<string, unknown>;
  createdAtMs: number;
}

type SerializedStore = Record<string, IdempotencyRecord>;

export class IdempotencyStore {
  private filePath: string;
  private cache: Map<string, IdempotencyRecord> = new Map();
  private loaded = false;

  constructor(params: { filePath?: string } = {}) {
    this.filePath =
      params.filePath ||
      process.env.IDEMPOTENCY_STORE_FILE ||
      path.join(process.cwd(), "data", "idempotency-store.json");
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as SerializedStore;
      for (const [key, value] of Object.entries(parsed)) {
        this.cache.set(key, value);
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw err;
      }
    }
    this.loaded = true;
  }

  private async flush() {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const out: SerializedStore = {};
    for (const [key, value] of this.cache.entries()) {
      out[key] = value;
    }
    await fs.promises.writeFile(this.filePath, JSON.stringify(out), "utf8");
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    await this.ensureLoaded();
    return this.cache.get(key) || null;
  }

  async set(key: string, value: IdempotencyRecord): Promise<void> {
    await this.ensureLoaded();
    this.cache.set(key, value);
    await this.flush();
  }

  async delete(key: string): Promise<void> {
    await this.ensureLoaded();
    this.cache.delete(key);
    await this.flush();
  }

  async entries(): Promise<Array<[string, IdempotencyRecord]>> {
    await this.ensureLoaded();
    return Array.from(this.cache.entries());
  }
}

export const idempotencyStore = new IdempotencyStore();
