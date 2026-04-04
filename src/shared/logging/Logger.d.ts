/**
 * Unified Logging System
 *
 * Centralized logging that eliminates duplication across all services.
 * Provides structured logging with consistent format and levels.
 */
export type LogLevel = "error" | "warn" | "info" | "debug";
export interface LogContext {
    [key: string]: any;
}
export declare class Logger {
    private winston;
    private serviceName;
    constructor(serviceName: string, level?: LogLevel);
    private createWinstonLogger;
    /**
     * Log error message
     */
    error(message: string, context?: LogContext | Error): void;
    /**
     * Log warning message
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Log info message
     */
    info(message: string, context?: LogContext): void;
    /**
     * Log debug message
     */
    debug(message: string, context?: LogContext): void;
    /**
     * Create child logger with additional context
     */
    child(context: LogContext): Logger;
    /**
     * Log HTTP request
     */
    logRequest(req: any, res: any, duration: number): void;
    /**
     * Log database query
     */
    logQuery(query: string, duration: number, params?: any[]): void;
    /**
     * Log API call
     */
    logApiCall(service: string, endpoint: string, duration: number, success: boolean): void;
    /**
     * Log trading action
     */
    logTradingAction(action: string, symbol: string, quantity: number, price: number): void;
    /**
     * Log governance action
     */
    logGovernanceAction(agentId: string, action: string, outcome: string, riskLevel: string): void;
    /**
     * Log performance metrics
     */
    logMetrics(metrics: Record<string, number>): void;
}
export declare const defaultLogger: Logger;
export declare const logger: {
    error: (message: string, context?: LogContext | Error) => void;
    warn: (message: string, context?: LogContext) => void;
    info: (message: string, context?: LogContext) => void;
    debug: (message: string, context?: LogContext) => void;
};
//# sourceMappingURL=Logger.d.ts.map
