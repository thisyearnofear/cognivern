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
/**
 * Abstract base class for file-backed stores
 */
export class BaseStore {
    filePath;
    loaded = false;
    maxRecords;
    enableTtl;
    defaultTtlMs;
    // In-memory cache
    cache = new Map();
    constructor(config) {
        this.filePath =
            config.filePath ||
                (config.envVar ? process.env[config.envVar] : undefined) ||
                path.join(process.cwd(), "data", config.defaultFilename);
        this.maxRecords = config.maxRecords ?? 1000;
        this.enableTtl = config.enableTtl ?? false;
        this.defaultTtlMs = config.defaultTtlMs ?? 3600000; // 1 hour default
    }
    // ===========================================
    // CORE OPERATIONS
    // ===========================================
    /**
     * Ensure data is loaded from file (lazy loading)
     */
    async ensureLoaded() {
        if (this.loaded)
            return;
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
        }
        catch (err) {
            if (err?.code !== "ENOENT") {
                throw err;
            }
        }
        this.loaded = true;
    }
    /**
     * Get a record by key
     */
    async get(key) {
        await this.ensureLoaded();
        const record = this.cache.get(key);
        if (!record)
            return null;
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
    async set(key, record) {
        await this.ensureLoaded();
        this.cache.set(key, record);
        await this.persistRecord(key, record);
    }
    /**
     * Delete a record by key
     */
    async delete(key) {
        await this.ensureLoaded();
        this.cache.delete(key);
        await this.flush();
    }
    /**
     * Check if a record exists
     */
    async has(key) {
        await this.ensureLoaded();
        return this.cache.has(key);
    }
    /**
     * Get all entries
     */
    async entries() {
        await this.ensureLoaded();
        return Array.from(this.cache.entries());
    }
    /**
     * Get all keys
     */
    async keys() {
        await this.ensureLoaded();
        return Array.from(this.cache.keys());
    }
    /**
     * Get store size
     */
    async size() {
        await this.ensureLoaded();
        return this.cache.size;
    }
    /**
     * Clear all records from memory
     */
    async clear() {
        this.cache.clear();
        this.loaded = true;
    }
    /**
     * Clear all records (memory + file)
     */
    async reset() {
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
    async persistRecord(key, record) {
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
        const line = this.serializeRecord(key, record);
        await fs.promises.appendFile(this.filePath, `${line}\n`, "utf8");
    }
    /**
     * Flush all records to file (rewrite mode)
     */
    async flush() {
        await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });
        const lines = [];
        for (const [key, record] of this.cache.entries()) {
            lines.push(this.serializeRecord(key, record));
        }
        const content = lines.join("\n");
        await fs.promises.writeFile(this.filePath, content ? `${content}\n` : "", "utf8");
    }
    /**
     * Truncate the file
     */
    async truncate() {
        try {
            await fs.promises.unlink(this.filePath);
        }
        catch (err) {
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
    isExpired(record) {
        if (!this.enableTtl)
            return false;
        const ttlRecord = record;
        if (!ttlRecord.createdAt)
            return false;
        const ttlMs = ttlRecord.ttlMs ?? this.defaultTtlMs;
        return Date.now() - ttlRecord.createdAt > ttlMs;
    }
    /**
     * Clean up expired records
     */
    async cleanupExpired() {
        if (!this.enableTtl)
            return 0;
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
    async enforceLimit() {
        if (this.cache.size <= this.maxRecords)
            return;
        // Remove oldest entries (first N)
        const entries = Array.from(this.cache.entries());
        const toRemove = entries.slice(0, this.cache.size - this.maxRecords);
        for (const [key] of toRemove) {
            this.cache.delete(key);
        }
        await this.flush();
    }
}
//# sourceMappingURL=BaseStore.js.map
