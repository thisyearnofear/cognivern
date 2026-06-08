import { BaseStore, TtlRecord } from "./BaseStore.js";

type BlacklistRecord = TtlRecord<{ revokedAt: number }>;

export class TokenBlacklistStore extends BaseStore<
  { revokedAt: number },
  BlacklistRecord
> {
  constructor() {
    super({
      envVar: "TOKEN_BLACKLIST_FILE",
      defaultFilename: "token-blacklist.jsonl",
      maxRecords: 10000,
      enableTtl: true,
      defaultTtlMs: 86_400_000,
    });
  }

  protected parseLine(
    line: string,
  ): { key: string; record: BlacklistRecord } | null {
    try {
      const parsed = JSON.parse(line);
      if (parsed.key && parsed.record) return parsed;
      return null;
    } catch {
      return null;
    }
  }

  protected serializeRecord(key: string, record: BlacklistRecord): string {
    return JSON.stringify({ key, record });
  }

  async isBlacklisted(tokenHash: string): Promise<boolean> {
    return this.has(tokenHash);
  }

  async blacklist(tokenHash: string, ttlMs?: number): Promise<void> {
    const record: BlacklistRecord = {
      data: { revokedAt: Date.now() },
      createdAt: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
    };
    await this.set(tokenHash, record);
  }
}

export const tokenBlacklistStore = new TokenBlacklistStore();
