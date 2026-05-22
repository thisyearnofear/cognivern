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
export declare abstract class BaseStore<T, R = T> {
    protected filePath: string;
    protected loaded: boolean;
    protected maxRecords: number;
    protected enableTtl: boolean;
    protected defaultTtlMs: number;
    protected cache: Map<string, R>;
    constructor(config: BaseStoreConfig);
    /**
     * Parse a single line from file into a record
     */
    protected abstract parseLine(line: string): {
        key: string;
        record: R;
    } | null;
    /**
     * Serialize a record to a line for file storage
     */
    protected abstract serializeRecord(key: string, record: R): string;
    /**
     * Called after data is loaded (optional override)
     */
    protected onAfterLoad?(): Promise<void>;
    /**
     * Ensure data is loaded from file (lazy loading)
     */
    protected ensureLoaded(): Promise<void>;
    /**
     * Get a record by key
     */
    get(key: string): Promise<R | null>;
    /**
     * Set a record by key
     */
    set(key: string, record: R): Promise<void>;
    /**
     * Delete a record by key
     */
    delete(key: string): Promise<void>;
    /**
     * Check if a record exists
     */
    has(key: string): Promise<boolean>;
    /**
     * Get all entries
     */
    entries(): Promise<Array<[string, R]>>;
    /**
     * Get all keys
     */
    keys(): Promise<string[]>;
    /**
     * Get store size
     */
    size(): Promise<number>;
    /**
     * Clear all records from memory
     */
    clear(): Promise<void>;
    /**
     * Clear all records (memory + file)
     */
    reset(): Promise<void>;
    /**
     * Persist a single record (append mode)
     */
    protected persistRecord(key: string, record: R): Promise<void>;
    /**
     * Flush all records to file (rewrite mode)
     */
    protected flush(): Promise<void>;
    /**
     * Truncate the file
     */
    protected truncate(): Promise<void>;
    /**
     * Check if a record is expired (for TTL-enabled stores)
     */
    protected isExpired(record: R): boolean;
    /**
     * Clean up expired records
     */
    cleanupExpired(): Promise<number>;
    /**
     * Enforce max records limit by removing oldest entries
     */
    private enforceLimit;
}
//# sourceMappingURL=BaseStore.d.ts.map
