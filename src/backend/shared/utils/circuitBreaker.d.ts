/**
 * Circuit Breaker Utility - Standalone Implementation
 *
 * Provides circuit breaker pattern for services that don't extend BaseService.
 * Follows DRY principle - can be used by any service class.
 *
 * Usage:
 *   const circuit = new CircuitBreaker('RecallNetwork', { threshold: 5 });
 *   await circuit.execute(() => fetch('...'));
 */
export interface CircuitBreakerConfig {
    /** Number of failures before opening circuit */
    threshold?: number;
    /** Time in ms before attempting to close circuit */
    resetAfterMs?: number;
    /** Enable logging */
    enableLogging?: boolean;
}
export declare class CircuitBreaker {
    private serviceName;
    private threshold;
    private resetAfterMs;
    private enableLogging;
    private failures;
    private lastFailure;
    private isOpen;
    constructor(serviceName: string, config?: CircuitBreakerConfig);
    /**
     * Execute an operation with circuit breaker protection
     */
    execute<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Record a failure and potentially open the circuit
     */
    private recordFailure;
    /**
     * Reset the circuit after successful operation
     */
    private reset;
    /**
     * Get current circuit state (for health checks)
     */
    getState(): {
        isOpen: boolean;
        failures: number;
        lastFailure: number;
    };
    /**
     * Manually reset the circuit (for admin operations)
     */
    forceReset(): void;
}
/**
 * Circuit breaker instances for common external services
 */
export declare const circuitBreakers: {
    recall: CircuitBreaker;
    sapience: CircuitBreaker;
    blockchain: CircuitBreaker;
};
//# sourceMappingURL=circuitBreaker.d.ts.map
