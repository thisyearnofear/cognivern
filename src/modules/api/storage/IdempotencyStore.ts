/**
 * Idempotency Store - Refactored to extend BaseStore
 *
 * Consolidates common patterns with CreRunStore and UxEventStore
 * via the shared BaseStore abstraction (DRY principle).
 */

import { BaseStore, TtlRecord } from "../../../shared/storage/BaseStore.js";

export interface IdempotencyRecord {
  statusCode: number;
  body: Record<string, unknown>;
  createdAtMs: number;
}

type IdempotencyCacheRecord = TtlRecord<IdempotencyRecord>;

/**
 * Idempotency store for deduplicating API requests
 * Extends BaseStore for shared persistence and caching logic
 */
export class IdempotencyStore extends BaseStore<IdempotencyRecord, IdempotencyCacheRecord> {
  constructor(params: { filePath?: string } = {}) {
    super({
      filePath: params.filePath,
      envVar: "IDEMPOTENCY_STORE_FILE",
      defaultFilename: "idempotency-store.json",
      maxRecords: 10000,
      enableTtl: true,
      defaultTtlMs: 86400000, // 24 hours
    });
  }

  /**
   * Parse JSON line into cache record
   */
  protected parseLine(line: string): { key: string; record: IdempotencyCacheRecord } | null {
    try {
      const parsed = JSON.parse(line);
      // Handle both old format (direct record) and new format (with key)
      if (parsed.key && parsed.record) {
        return { key: parsed.key, record: parsed.record };
      }
      // Legacy format: key is first field, rest is data
      const keys = Object.keys(parsed);
      if (keys.length === 1) {
        const key = keys[0];
        const data = parsed[key] as IdempotencyRecord;
        return {
          key,
          record: { data, createdAt: data.createdAtMs, ttlMs: this.defaultTtlMs },
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Serialize cache record to JSON line
   */
  protected serializeRecord(key: string, record: IdempotencyCacheRecord): string {
    return JSON.stringify({ key, record });
  }

  /**
   * Get idempotency record (legacy-compatible interface)
   */
  async getRecord(key: string): Promise<IdempotencyRecord | null> {
    const cached = await this.get(key);
    return cached?.data ?? null;
  }

  /**
   * Set idempotency record (legacy-compatible interface)
   */
  async setRecord(key: string, value: IdempotencyRecord): Promise<void> {
    const record: IdempotencyCacheRecord = {
      data: value,
      createdAt: value.createdAtMs,
      ttlMs: this.defaultTtlMs,
    };
    await this.set(key, record);
  }
}

export const idempotencyStore = new IdempotencyStore();
