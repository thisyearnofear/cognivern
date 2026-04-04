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
import { ServiceError, ValidationError } from "../errors/index.js";
export class BaseService extends EventEmitter {
    logger;
    config;
    isInitialized = false;
    startTime = Date.now();
    // In-memory cache with TTL support
    cache = new Map();
    // Circuit breaker states per external service
    circuits = new Map();
    constructor(config) {
        super();
        this.config = config;
        this.logger = new Logger(config.name, config.logLevel);
    }
    /**
     * Initialize the service
     */
    async initialize() {
        try {
            this.logger.info(`Initializing ${this.config.name} service...`);
            await this.onInitialize();
            this.isInitialized = true;
            this.logger.info(`${this.config.name} service initialized successfully`);
            this.emit("initialized");
        }
        catch (error) {
            this.logger.error(`Failed to initialize ${this.config.name} service:`, error);
            throw new ServiceError(`Service initialization failed: ${error.message}`);
        }
    }
    /**
     * Shutdown the service gracefully
     */
    async shutdown() {
        try {
            this.logger.info(`Shutting down ${this.config.name} service...`);
            await this.onShutdown();
            this.isInitialized = false;
            this.logger.info(`${this.config.name} service shut down successfully`);
            this.emit("shutdown");
        }
        catch (error) {
            this.logger.error(`Error during ${this.config.name} service shutdown:`, error);
            throw new ServiceError(`Service shutdown failed: ${error.message}`);
        }
    }
    /**
     * Get service health status
     */
    async getHealth() {
        const dependencies = await this.checkDependencies();
        const hasUnhealthyDeps = Object.values(dependencies).some((dep) => dep.status === "unhealthy");
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
    validate(data, validator) {
        try {
            return validator(data);
        }
        catch (error) {
            throw new ValidationError(`Validation failed: ${error.message}`);
        }
    }
    /**
     * Execute operation with error handling and logging
     */
    async executeWithLogging(operation, fn, context) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error(`${operation} failed`, {
                error: error.message,
                duration,
                ...context,
            });
            throw error;
        }
    }
    /**
     * Retry operation with exponential backoff
     */
    async retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (attempt === maxRetries) {
                    break;
                }
                const delay = baseDelay * Math.pow(2, attempt - 1);
                this.logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
                    error: error.message,
                });
                await this.sleep(delay);
            }
        }
        throw lastError;
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
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
    async withCache(key, fetcher, ttlMs = 60000) {
        const cached = this.cache.get(key);
        if (cached && Date.now() < cached.expiresAt) {
            this.logger.debug(`Cache hit for key: ${key}`);
            return cached.value;
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
    invalidateCache(pattern) {
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
    get cacheSize() {
        return this.cache.size;
    }
    // ===========================================
    // CIRCUIT BREAKER (MODULAR + PERFORMANT)
    // ===========================================
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
    async withCircuitBreaker(serviceName, operation, threshold = 5, resetAfterMs = 30000) {
        const circuit = this.getCircuit(serviceName);
        // Check if circuit is open
        if (circuit.isOpen && Date.now() - circuit.lastFailure < resetAfterMs) {
            this.logger.warn(`Circuit breaker OPEN for ${serviceName}, rejecting request`);
            throw new ServiceError(`${serviceName} circuit breaker is open - service temporarily unavailable`);
        }
        // If circuit was open but reset period passed, try to close it
        if (circuit.isOpen) {
            this.logger.info(`Circuit breaker HALF-OPEN for ${serviceName}, attempting recovery`);
        }
        try {
            const result = await operation();
            this.resetCircuit(serviceName);
            return result;
        }
        catch (error) {
            this.recordCircuitFailure(serviceName, threshold);
            throw error;
        }
    }
    /**
     * Get or create circuit state for a service
     */
    getCircuit(serviceName) {
        if (!this.circuits.has(serviceName)) {
            this.circuits.set(serviceName, {
                failures: 0,
                lastFailure: 0,
                isOpen: false,
            });
        }
        return this.circuits.get(serviceName);
    }
    /**
     * Record a failure and potentially open the circuit
     */
    recordCircuitFailure(serviceName, threshold) {
        const circuit = this.getCircuit(serviceName);
        circuit.failures++;
        circuit.lastFailure = Date.now();
        if (circuit.failures >= threshold && !circuit.isOpen) {
            circuit.isOpen = true;
            this.logger.error(`Circuit breaker OPENED for ${serviceName} after ${circuit.failures} failures`);
            this.emit("circuit:open", { serviceName, failures: circuit.failures });
        }
    }
    /**
     * Reset circuit state after successful operation
     */
    resetCircuit(serviceName) {
        const circuit = this.getCircuit(serviceName);
        if (circuit.isOpen || circuit.failures > 0) {
            this.logger.info(`Circuit breaker CLOSED for ${serviceName}, service recovered`);
            this.emit("circuit:close", { serviceName });
        }
        circuit.failures = 0;
        circuit.isOpen = false;
    }
    /**
     * Check if service is healthy
     */
    get healthy() {
        return this.isInitialized;
    }
    /**
     * Get service name
     */
    get name() {
        return this.config.name;
    }
    /**
     * Get service version
     */
    get version() {
        return this.config.version;
    }
}
//# sourceMappingURL=BaseService.js.map
