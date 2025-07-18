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

import { EventEmitter } from 'events';
import { Logger } from '../logging/Logger.js';
import { ServiceConfig, HealthStatus, DependencyHealth } from '../types/index.js';
import { ServiceError, ValidationError } from '../errors/index.js';

export abstract class BaseService extends EventEmitter {
  protected readonly logger: Logger;
  protected readonly config: ServiceConfig;
  protected isInitialized = false;
  protected startTime = Date.now();

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
      this.emit('initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize ${this.config.name} service:`, error);
      throw new ServiceError(`Service initialization failed: ${error.message}`);
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
      this.emit('shutdown');
    } catch (error) {
      this.logger.error(`Error during ${this.config.name} service shutdown:`, error);
      throw new ServiceError(`Service shutdown failed: ${error.message}`);
    }
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<HealthStatus> {
    const dependencies = await this.checkDependencies();
    const hasUnhealthyDeps = Object.values(dependencies).some(dep => dep.status === 'unhealthy');
    
    return {
      status: !this.isInitialized ? 'unhealthy' : hasUnhealthyDeps ? 'degraded' : 'healthy',
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
      throw new ValidationError(`Validation failed: ${error.message}`);
    }
  }

  /**
   * Execute operation with error handling and logging
   */
  protected async executeWithLogging<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Starting ${operation}`, context);
      
      const result = await fn();
      
      const duration = Date.now() - startTime;
      this.logger.info(`${operation} completed successfully`, { 
        duration, 
        ...context 
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`${operation} failed`, { 
        error: error.message, 
        duration, 
        ...context 
      });
      
      throw error;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
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
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

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
  protected abstract checkDependencies(): Promise<Record<string, DependencyHealth>>;
}
