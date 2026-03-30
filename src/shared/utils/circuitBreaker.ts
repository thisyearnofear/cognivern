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

import logger from "../../utils/logger.js";

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  threshold?: number;
  /** Time in ms before attempting to close circuit */
  resetAfterMs?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

export class CircuitBreaker {
  private serviceName: string;
  private threshold: number;
  private resetAfterMs: number;
  private enableLogging: boolean;

  private failures: number = 0;
  private lastFailure: number = 0;
  private isOpen: boolean = false;

  constructor(serviceName: string, config: CircuitBreakerConfig = {}) {
    this.serviceName = serviceName;
    this.threshold = config.threshold ?? 5;
    this.resetAfterMs = config.resetAfterMs ?? 30000;
    this.enableLogging = config.enableLogging ?? true;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should try to recover
    if (this.isOpen) {
      const timeSinceFailure = Date.now() - this.lastFailure;

      if (timeSinceFailure < this.resetAfterMs) {
        if (this.enableLogging) {
          logger.warn(`Circuit breaker OPEN for ${this.serviceName}, rejecting request`);
        }
        throw new Error(
          `${this.serviceName} circuit breaker is open - service temporarily unavailable`
        );
      }

      // Half-open state: try one request
      if (this.enableLogging) {
        logger.info(`Circuit breaker HALF-OPEN for ${this.serviceName}, attempting recovery`);
      }
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure and potentially open the circuit
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.threshold && !this.isOpen) {
      this.isOpen = true;
      if (this.enableLogging) {
        logger.error(
          `Circuit breaker OPENED for ${this.serviceName} after ${this.failures} failures`
        );
      }
    }
  }

  /**
   * Reset the circuit after successful operation
   */
  private reset(): void {
    if (this.isOpen || this.failures > 0) {
      if (this.enableLogging) {
        logger.info(`Circuit breaker CLOSED for ${this.serviceName}, service recovered`);
      }
    }
    this.failures = 0;
    this.isOpen = false;
  }

  /**
   * Get current circuit state (for health checks)
   */
  getState(): { isOpen: boolean; failures: number; lastFailure: number } {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      lastFailure: this.lastFailure,
    };
  }

  /**
   * Manually reset the circuit (for admin operations)
   */
  forceReset(): void {
    this.failures = 0;
    this.isOpen = false;
    this.lastFailure = 0;
    if (this.enableLogging) {
      logger.info(`Circuit breaker FORCE RESET for ${this.serviceName}`);
    }
  }
}

// ===========================================
// PRE-CONFIGURED CIRCUIT BREAKERS
// ===========================================

/**
 * Circuit breaker instances for common external services
 */
export const circuitBreakers = {
  recall: new CircuitBreaker('RecallNetwork', { threshold: 5, resetAfterMs: 30000 }),
  sapience: new CircuitBreaker('SapienceProtocol', { threshold: 3, resetAfterMs: 60000 }),
  blockchain: new CircuitBreaker('BlockchainRPC', { threshold: 5, resetAfterMs: 45000 }),
};
