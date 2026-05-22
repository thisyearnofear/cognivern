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
import { ServiceConfig, HealthStatus, DependencyHealth } from "../types/index.js";
export declare abstract class BaseService extends EventEmitter {
    protected readonly logger: Logger;
    protected readonly config: ServiceConfig;
    protected isInitialized: boolean;
    protected startTime: number;
    private cache;
    private circuits;
    constructor(config: ServiceConfig);
    /**
     * Initialize the service
     */
    initialize(): Promise<void>;
    /**
     * Shutdown the service gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Get service health status
     */
    getHealth(): Promise<HealthStatus>;
    /**
     * Validate input data
     */
    protected validate<T>(data: unknown, validator: (data: unknown) => T): T;
    /**
     * Execute operation with error handling and logging
     */
    protected executeWithLogging<T>(operation: string, fn: () => Promise<T>, context?: Record<string, any>): Promise<T>;
    /**
     * Retry operation with exponential backoff
     */
    protected retryWithBackoff<T>(operation: () => Promise<T>, maxRetries?: number, baseDelay?: number): Promise<T>;
    /**
     * Sleep for specified milliseconds
     */
    protected sleep(ms: number): Promise<void>;
    /**
     * Execute operation with caching support
     * Returns cached value if valid, otherwise fetches and caches
     *
     * @param key - Unique cache key
     * @param fetcher - Function to fetch data if cache miss
     * @param ttlMs - Time-to-live in milliseconds (default: 60s)
     * @returns Cached or freshly fetched value
     */
    protected withCache<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T>;
    /**
     * Invalidate cache entries matching a pattern
     * @param pattern - Pattern to match keys (partial match). If empty, clears all.
     */
    protected invalidateCache(pattern?: string): void;
    /**
     * Get current cache size (for metrics)
     */
    protected get cacheSize(): number;
    /**
     * Execute operation with circuit breaker protection
     * Prevents cascading failures from unhealthy external services
     *
     * @param serviceName - Name of the external service
     * @param operation - Function to execute
     * @param threshold - Number of failures before opening circuit (default: 5)
     * @param resetAfterMs - Time before attempting to close circuit (default: 30s)
     * @returns Result of the operation
     * @throws ServiceError if circuit is open
     */
    protected withCircuitBreaker<T>(serviceName: string, operation: () => Promise<T>, threshold?: number, resetAfterMs?: number): Promise<T>;
    /**
     * Get or create circuit state for a service
     */
    private getCircuit;
    /**
     * Record a failure and potentially open the circuit
     */
    private recordCircuitFailure;
    /**
     * Reset circuit state after successful operation
     */
    private resetCircuit;
    /**
     * Check if service is healthy
     */
    get healthy(): boolean;
    /**
     * Get service name
     */
    get name(): string;
    /**
     * Get service version
     */
    get version(): string;
    /**
     * Abstract methods that subclasses must implement
     */
    protected abstract onInitialize(): Promise<void>;
    protected abstract onShutdown(): Promise<void>;
    protected abstract checkDependencies(): Promise<Record<string, DependencyHealth>>;
}
//# sourceMappingURL=BaseService.d.ts.map
