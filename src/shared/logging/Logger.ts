/**
 * Unified Logging System
 *
 * Centralized logging that eliminates duplication across all services.
 * Provides structured logging with consistent format and levels.
 */

import winston from 'winston';
import { config } from '../config/index.js';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private winston: winston.Logger;
  private serviceName: string;

  constructor(serviceName: string, level: LogLevel = config.LOG_LEVEL as LogLevel) {
    this.serviceName = serviceName;
    this.winston = this.createWinstonLogger(level);
  }

  private createWinstonLogger(level: LogLevel): winston.Logger {
    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ];

    // Add colorization for development
    if (config.NODE_ENV === 'development') {
      formats.unshift(winston.format.colorize());
    }

    return winston.createLogger({
      level,
      format: winston.format.combine(...formats),
      defaultMeta: {
        service: this.serviceName,
        environment: config.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
      },
      transports: [
        // Console transport for all environments
        new winston.transports.Console({
          format: config.NODE_ENV === 'development'
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              )
            : winston.format.json(),
        }),

        // File transports for production
        ...(config.NODE_ENV === 'production' ? [
          new winston.transports.File({
            filename: `logs/${this.serviceName}-error.log`,
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: `logs/${this.serviceName}-combined.log`,
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          }),
        ] : []),
      ],

      // Handle uncaught exceptions and rejections
      exceptionHandlers: [
        new winston.transports.File({
          filename: `logs/${this.serviceName}-exceptions.log`
        }),
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: `logs/${this.serviceName}-rejections.log`
        }),
      ],
    });
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext | Error): void {
    if (context instanceof Error) {
      this.winston.error(message, {
        error: {
          message: context.message,
          stack: context.stack,
          name: context.name,
        },
      });
    } else {
      this.winston.error(message, context);
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.winston.info(message, context);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, context);
  }

  /**
   * Create child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.serviceName);
    childLogger.winston = this.winston.child(context);
    return childLogger;
  }

  /**
   * Log HTTP request
   */
  logRequest(req: any, res: any, duration: number): void {
    this.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  /**
   * Log database query
   */
  logQuery(query: string, duration: number, params?: any[]): void {
    this.debug('Database Query', {
      query: query.substring(0, 200), // Truncate long queries
      duration,
      paramCount: params?.length || 0,
    });
  }

  /**
   * Log API call
   */
  logApiCall(service: string, endpoint: string, duration: number, success: boolean): void {
    this.info('External API Call', {
      service,
      endpoint,
      duration,
      success,
    });
  }

  /**
   * Log trading action
   */
  logTradingAction(action: string, symbol: string, quantity: number, price: number): void {
    this.info('Trading Action', {
      action,
      symbol,
      quantity,
      price,
      value: quantity * price,
    });
  }

  /**
   * Log governance action
   */
  logGovernanceAction(agentId: string, action: string, outcome: string, riskLevel: string): void {
    this.info('Governance Action', {
      agentId,
      action,
      outcome,
      riskLevel,
    });
  }

  /**
   * Log performance metrics
   */
  logMetrics(metrics: Record<string, number>): void {
    this.info('Performance Metrics', metrics);
  }
}

// Create default logger instance
export const defaultLogger = new Logger('cognivern', config.LOG_LEVEL as LogLevel);

// Export convenience functions for backward compatibility
export const logger = {
  error: (message: string, context?: LogContext | Error) => defaultLogger.error(message, context),
  warn: (message: string, context?: LogContext) => defaultLogger.warn(message, context),
  info: (message: string, context?: LogContext) => defaultLogger.info(message, context),
  debug: (message: string, context?: LogContext) => defaultLogger.debug(message, context),
};
