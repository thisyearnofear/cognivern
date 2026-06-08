import { BaseStore, TtlRecord } from "./BaseStore.js";

export interface RateLimitWindow {
  count: number;
  resetAt: number;
}

type RateLimitRecord = TtlRecord<RateLimitWindow>;

export class RateLimitStore extends BaseStore<RateLimitWindow, RateLimitRecord> {
  constructor() {
    super({
      envVar: "RATE_LIMIT_STORE_FILE",
      defaultFilename: "rate-limit-store.jsonl",
      maxRecords: 5000,
      enableTtl: true,
      defaultTtlMs: 120_000,
    });
  }

  protected parseLine(
    line: string,
  ): { key: string; record: RateLimitRecord } | null {
    try {
      const parsed = JSON.parse(line);
      if (parsed.key && parsed.record) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  protected serializeRecord(key: string, record: RateLimitRecord): string {
    return JSON.stringify({ key, record });
  }

  async getWindow(key: string): Promise<RateLimitWindow | null> {
    const record = await this.get(key);
    if (!record) return null;
    if (Date.now() > record.data.resetAt) {
      await this.delete(key);
      return null;
    }
    return record.data;
  }

  async setWindow(
    key: string,
    window: RateLimitWindow,
    ttlMs: number,
  ): Promise<void> {
    const record: RateLimitRecord = {
      data: window,
      createdAt: Date.now(),
      ttlMs,
    };
    await this.set(key, record);
  }
}

export const rateLimitStore = new RateLimitStore();
