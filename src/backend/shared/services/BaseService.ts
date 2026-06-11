/**
 * Base Service Class - DRY Foundation for All Services
 *
 * Provides common functionality that all services need:
 * - Logging
 * - Error handling
 * - Health checks
 * - Metrics
 * - Configuration
 */

import { EventEmitter } from "events";
import { Logger } from "../logging/Logger.js";
import {
  ServiceConfig,
  HealthStatus,
  DependencyHealth,
} from "../types/index.js";
import { ServiceError, ValidationError } from "../errors/index.js";

/**
 * Cache entry with TTL support
 */
interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

export abstract class BaseService extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly config: ServiceConfig;
  protected isInitialized = false;
  protected startTime = Date.now();

  // In-memory cache with TTL support
  private cache: Map<string, CacheEntry> = new Map();

  constructor(config: ServiceConfig) {
    super();
    this.config = config;
    this.logger = new Logger(config.name, config.logLevel);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`Initializing ${this.config.name} service...`);

      await this.onInitialize();

      this.isInitialized = true;
      this.logger.info(`${this.config.name} service initialized successfully`);
      this.emit("initialized");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Failed to initialize ${this.config.name} service:`,
        err,
      );
      throw new ServiceError(`Service initialization failed: ${err.message}`);
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info(`Shutting down ${this.config.name} service...`);

      await this.onShutdown();

      this.isInitialized = false;
      this.logger.info(`${this.config.name} service shut down successfully`);
      this.emit("shutdown");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `Error during ${this.config.name} service shutdown:`,
        err,
      );
      throw new ServiceError(`Service shutdown failed: ${err.message}`);
    }
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<HealthStatus> {
    const dependencies = await this.checkDependencies();
    const hasUnhealthyDeps = Object.values(dependencies).some(
      (dep) => dep.status === "unhealthy",
    );

    return {
      status: !this.isInitialized
        ? "unhealthy"
        : hasUnhealthyDeps
          ? "degraded"
          : "healthy",
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: this.config.version,
      dependencies,
    };
  }

  /**
   * Validate input data
   */
  protected validate<T>(data: unknown, validator: (data: unknown) => T): T {
    try {
      return validator(data);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      throw new ValidationError(`Validation failed: ${err.message}`);
    }
  }

  /**
   * Execute operation with error handling and logging
   */
  protected async executeWithLogging<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Starting ${operation}`, context);

      const result = await fn();

      const duration = Date.now() - startTime;
      this.logger.info(`${operation} completed successfully`, {
        duration,
        ...context,
      });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;
      this.logger.error(`${operation} failed`, {
        error: err.message,
        duration,
        ...context,
      });

      throw err;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logger.warn(
          `Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
          {
            error: lastError.message,
          },
        );

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===========================================
  // CACHING CAPABILITIES (PERFORMANT + DRY)
  // ===========================================

  /**
   * Execute operation with caching support
   * Returns cached value if valid, otherwise fetches and caches
   *
   * @param key - Unique cache key
   * @param fetcher - Function to fetch data if cache miss
   * @param ttlMs - Time-to-live in milliseconds (default: 60s)
   * @returns Cached or freshly fetched value
   */
  protected async withCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 60000,
  ): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      this.logger.debug(`Cache hit for key: ${key}`);
      return cached.value as T;
    }

    this.logger.debug(`Cache miss for key: ${key}, fetching...`);
    const value = await fetcher();
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern - Pattern to match keys (partial match). If empty, clears all.
   */
  protected invalidateCache(pattern?: string): void {
    if (!pattern) {
      const count = this.cache.size;
      this.cache.clear();
      this.logger.debug(`Cleared all cache entries (${count} items)`);
      return;
    }

    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    this.logger.debug(`Cleared ${cleared} cache entries matching: ${pattern}`);
  }

  /**
   * Get current cache size (for metrics)
   */
  protected get cacheSize(): number {
    return this.cache.size;
  }

  // ===========================================
  // CIRCUIT BREAKER (MODULAR + PERFORMANT)
  // ===========================================

  /**
   * Check if service is healthy
   */
  get healthy(): boolean {
    return this.isInitialized;
  }

  /**
   * Get service name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get service version
   */
  get version(): string {
    return this.config.version;
  }

  /**
   * Abstract methods that subclasses must implement
   */
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract checkDependencies(): Promise<
    Record<string, DependencyHealth>
  >;
}
