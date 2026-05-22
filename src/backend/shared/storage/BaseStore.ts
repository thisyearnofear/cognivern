/**
 * Base Store Class - DRY Foundation for File-Based Storage
 *
 * Consolidates common patterns from:
 * - IdempotencyStore
 * - CreRunStore
 * - UxEventStore
 *
 * Provides:
 * - Lazy loading
 * - File persistence (JSON/JSONL)
 * - TTL-based expiration (optional)
 * - Atomic operations
 */

import fs from "node:fs";
import path from "node:path";

export interface BaseStoreConfig {
  /** File path for persistence */
  filePath?: string;
  /** Environment variable name for file path */
  envVar?: string;
  /** Default filename if no path provided */
  defaultFilename: string;
  /** Maximum number of records to keep in memory */
  maxRecords?: number;
  /** Enable TTL-based expiration */
  enableTtl?: boolean;
  /** Default TTL in milliseconds */
  defaultTtlMs?: number;
}

export interface TtlRecord<T> {
  data: T;
  createdAt: number;
  ttlMs?: number;
}

/**
 * Abstract base class for file-backed stores
 */
export abstract class BaseStore<T, R = T> {
  protected filePath: string;
  protected loaded = false;
  protected maxRecords: number;
  protected enableTtl: boolean;
  protected defaultTtlMs: number;

  // In-memory cache
  protected cache: Map<string, R> = new Map();

  constructor(config: BaseStoreConfig) {
    this.filePath =
      config.filePath ||
      (config.envVar ? process.env[config.envVar] : undefined) ||
      path.join(process.cwd(), "data", config.defaultFilename);

    this.maxRecords = config.maxRecords ?? 1000;
    this.enableTtl = config.enableTtl ?? false;
    this.defaultTtlMs = config.defaultTtlMs ?? 3600000; // 1 hour default
  }

  // ===========================================
  // ABSTRACT METHODS (Subclass must implement)
  // ===========================================

  /**
   * Parse a single line from file into a record
   */
  protected abstract parseLine(line: string): { key: string; record: R } | null;

  /**
   * Serialize a record to a line for file storage
   */
  protected abstract serializeRecord(key: string, record: R): string;

  /**
   * Called after data is loaded (optional override)
   */
  protected onAfterLoad?(): Promise<void>;

  // ===========================================
  // CORE OPERATIONS
  // ===========================================

  /**
   * Ensure data is loaded from file (lazy loading)
   */
  protected async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    try {
      const raw = await fs.promises.readFile(this.filePath, "utf8");
      const lines = raw.split("\n").filter(Boolean);

      for (const line of lines) {
        const parsed = this.parseLine(line);
        if (parsed) {
          this.cache.set(parsed.key, parsed.record);
        }
      }

      // Enforce max records limit
      if (this.cache.size > this.maxRecords) {
        await this.enforceLimit();
      }

      await this.onAfterLoad?.();
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw err;
      }
    }

    this.loaded = true;
  }

  /**
   * Get a record by key
   */
  async get(key: string): Promise<R | null> {
    await this.ensureLoaded();
    const record = this.cache.get(key);

    if (!record) return null;

    // Check TTL if enabled
    if (this.enableTtl && this.isExpired(record)) {
      this.cache.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Set a record by key
   */
  async set(key: string, record: R): Promise<void> {
    await this.ensureLoaded();
    this.cache.set(key, record);
    await this.persistRecord(key, record);
  }

  /**
   * Delete a record by key
   */
  async delete(key: string): Promise<void> {
    await this.ensureLoaded();
    this.cache.delete(key);
    await this.flush();
  }

  /**
   * Check if a record exists
   */
  async has(key: string): Promise<boolean> {
    await this.ensureLoaded();
    return this.cache.has(key);
  }

  /**
   * Get all entries
   */
  async entries(): Promise<Array<[string, R]>> {
    await this.ensureLoaded();
    return Array.from(this.cache.entries());
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    await this.ensureLoaded();
    return Array.from(this.cache.keys());
  }

  /**
   * Get store size
   */
  async size(): Promise<number> {
    await this.ensureLoaded();
    return this.cache.size;
  }

  /**
   * Clear all records from memory
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.loaded = true;
  }

  /**
   * Clear all records (memory + file)
   */
  async reset(): Promise<void> {
    this.cache.clear();
    this.loaded = true;
    await this.truncate();
  }

  // ===========================================
  // PERSISTENCE
  // ===========================================

  /**
   * Persist a single record (append mode)
   */
  protected async persistRecord(key: string, record: R): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
    const line = this.serializeRecord(key, record);
    await fs.promises.appendFile(this.filePath, `${line}\n`, "utf8");
  }

  /**
   * Flush all records to file (rewrite mode)
   */
  protected async flush(): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });

    const lines: string[] = [];
    for (const [key, record] of this.cache.entries()) {
      lines.push(this.serializeRecord(key, record));
    }

    const content = lines.join("\n");
    await fs.promises.writeFile(
      this.filePath,
      content ? `${content}\n` : "",
      "utf8",
    );
  }

  /**
   * Truncate the file
   */
  protected async truncate(): Promise<void> {
    try {
      await fs.promises.unlink(this.filePath);
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        throw err;
      }
    }
  }

  // ===========================================
  // TTL HELPERS
  // ===========================================

  /**
   * Check if a record is expired (for TTL-enabled stores)
   */
  protected isExpired(record: R): boolean {
    if (!this.enableTtl) return false;

    const ttlRecord = record as unknown as TtlRecord<unknown>;
    if (!ttlRecord.createdAt) return false;

    const ttlMs = ttlRecord.ttlMs ?? this.defaultTtlMs;
    return Date.now() - ttlRecord.createdAt > ttlMs;
  }

  /**
   * Clean up expired records
   */
  async cleanupExpired(): Promise<number> {
    if (!this.enableTtl) return 0;

    await this.ensureLoaded();
    let cleaned = 0;

    for (const [key, record] of this.cache.entries()) {
      if (this.isExpired(record)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      await this.flush();
    }

    return cleaned;
  }

  // ===========================================
  // LIMIT ENFORCEMENT
  // ===========================================

  /**
   * Enforce max records limit by removing oldest entries
   */
  private async enforceLimit(): Promise<void> {
    if (this.cache.size <= this.maxRecords) return;

    // Remove oldest entries (first N)
    const entries = Array.from(this.cache.entries());
    const toRemove = entries.slice(0, this.cache.size - this.maxRecords);

    for (const [key] of toRemove) {
      this.cache.delete(key);
    }

    await this.flush();
  }
}
