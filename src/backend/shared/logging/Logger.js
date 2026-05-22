/**
 * Unified Logging System
 *
 * Centralized logging that eliminates duplication across all services.
 * Provides structured logging with consistent format and levels.
 */
import winston from "winston";
import { config } from "../config/index.js";
export class Logger {
    winston;
    serviceName;
    constructor(serviceName, level = config.LOG_LEVEL) {
        this.serviceName = serviceName;
        this.winston = this.createWinstonLogger(level);
    }
    createWinstonLogger(level) {
        const formats = [
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json(),
        ];
        // Add colorization for development
        if (config.NODE_ENV === "development") {
            formats.unshift(winston.format.colorize());
        }
        return winston.createLogger({
            level,
            format: winston.format.combine(...formats),
            defaultMeta: {
                service: this.serviceName,
                environment: config.NODE_ENV,
                version: process.env.npm_package_version || "1.0.0",
            },
            transports: [
                // Console transport for all environments
                new winston.transports.Console({
                    format: config.NODE_ENV === "development"
                        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
                        : winston.format.json(),
                }),
                // File transports for production
                ...(config.NODE_ENV === "production"
                    ? [
                        new winston.transports.File({
                            filename: `logs/${this.serviceName}-error.log`,
                            level: "error",
                            maxsize: 10 * 1024 * 1024, // 10MB
                            maxFiles: 5,
                        }),
                        new winston.transports.File({
                            filename: `logs/${this.serviceName}-combined.log`,
                            maxsize: 10 * 1024 * 1024, // 10MB
                            maxFiles: 5,
                        }),
                    ]
                    : []),
            ],
            // Handle uncaught exceptions and rejections
            exceptionHandlers: [
                new winston.transports.File({
                    filename: `logs/${this.serviceName}-exceptions.log`,
                }),
            ],
            rejectionHandlers: [
                new winston.transports.File({
                    filename: `logs/${this.serviceName}-rejections.log`,
                }),
            ],
        });
    }
    /**
     * Log error message
     */
    error(message, context) {
        if (context instanceof Error) {
            this.winston.error(message, {
                error: {
                    message: context.message,
                    stack: context.stack,
                    name: context.name,
                },
            });
        }
        else {
            this.winston.error(message, context);
        }
    }
    /**
     * Log warning message
     */
    warn(message, context) {
        this.winston.warn(message, context);
    }
    /**
     * Log info message
     */
    info(message, context) {
        this.winston.info(message, context);
    }
    /**
     * Log debug message
     */
    debug(message, context) {
        this.winston.debug(message, context);
    }
    /**
     * Create child logger with additional context
     */
    child(context) {
        const childLogger = new Logger(this.serviceName);
        childLogger.winston = this.winston.child(context);
        return childLogger;
    }
    /**
     * Log HTTP request
     */
    logRequest(req, res, duration) {
        this.info("HTTP Request", {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            userAgent: req.get("User-Agent"),
            ip: req.ip,
        });
    }
    /**
     * Log database query
     */
    logQuery(query, duration, params) {
        this.debug("Database Query", {
            query: query.substring(0, 200), // Truncate long queries
            duration,
            paramCount: params?.length || 0,
        });
    }
    /**
     * Log API call
     */
    logApiCall(service, endpoint, duration, success) {
        this.info("External API Call", {
            service,
            endpoint,
            duration,
            success,
        });
    }
    /**
     * Log trading action
     */
    logTradingAction(action, symbol, quantity, price) {
        this.info("Trading Action", {
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
    logGovernanceAction(agentId, action, outcome, riskLevel) {
        this.info("Governance Action", {
            agentId,
            action,
            outcome,
            riskLevel,
        });
    }
    /**
     * Log performance metrics
     */
    logMetrics(metrics) {
        this.info("Performance Metrics", metrics);
    }
}
// Create default logger instance
export const defaultLogger = new Logger("cognivern", config.LOG_LEVEL);
// Export convenience functions for backward compatibility
export const logger = {
    error: (message, context) => defaultLogger.error(message, context),
    warn: (message, context) => defaultLogger.warn(message, context),
    info: (message, context) => defaultLogger.info(message, context),
    debug: (message, context) => defaultLogger.debug(message, context),
};
//# sourceMappingURL=Logger.js.map
