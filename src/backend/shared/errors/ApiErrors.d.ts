/**
 * API Error Classes - Structured Error Handling
 *
 * Following DRY principle - single source of truth for API errors
 */
export declare class ApiError extends Error {
    readonly statusCode: number;
    readonly code: string;
    readonly details?: unknown;
    readonly timestamp: string;
    constructor(message: string, statusCode?: number, code?: string, details?: unknown);
    toJSON(): {
        timestamp: string;
        details: unknown;
        success: boolean;
        error: string;
        code: string;
    };
}
export declare class BadRequestError extends ApiError {
    constructor(message: string, details?: unknown);
}
export declare class UnauthorizedError extends ApiError {
    constructor(message?: string);
}
export declare class ForbiddenError extends ApiError {
    constructor(message?: string);
}
export declare class NotFoundError extends ApiError {
    constructor(resource: string);
}
export declare class ConflictError extends ApiError {
    constructor(message: string);
}
export declare class ValidationError extends ApiError {
    constructor(message: string, details?: unknown);
}
export declare class InternalError extends ApiError {
    constructor(message?: string);
}
export declare class ServiceUnavailableError extends ApiError {
    constructor(message?: string);
}
export declare class WalletError extends ApiError {
    constructor(message: string, details?: unknown);
}
export declare class PolicyError extends ApiError {
    constructor(message: string, details?: unknown);
}
export declare class SpendError extends ApiError {
    constructor(message: string, details?: unknown);
}
import { Request, Response, NextFunction } from "express";
export declare const errorHandler: (logger?: {
    error: (msg: string, err?: Error) => void;
}) => (err: Error, req: Request, res: Response, _next: NextFunction) => Response<any, Record<string, any>>;
export declare const asyncHandler: (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=ApiErrors.d.ts.map
