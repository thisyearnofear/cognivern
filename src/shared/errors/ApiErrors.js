/**
 * API Error Classes - Structured Error Handling
 *
 * Following DRY principle - single source of truth for API errors
 */
export class ApiError extends Error {
    statusCode;
    code;
    details;
    timestamp;
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.timestamp = new Date().toISOString();
        // Maintains proper stack trace in V8 environments
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            success: false,
            error: this.message,
            code: this.code,
            ...(this.details && { details: this.details }),
            timestamp: this.timestamp,
        };
    }
}
// 4xx Client Errors
export class BadRequestError extends ApiError {
    constructor(message, details) {
        super(message, 400, "BAD_REQUEST", details);
    }
}
export class UnauthorizedError extends ApiError {
    constructor(message = "Authentication required") {
        super(message, 401, "UNAUTHORIZED");
    }
}
export class ForbiddenError extends ApiError {
    constructor(message = "Access denied") {
        super(message, 403, "FORBIDDEN");
    }
}
export class NotFoundError extends ApiError {
    constructor(resource) {
        super(`${resource} not found`, 404, "NOT_FOUND");
    }
}
export class ConflictError extends ApiError {
    constructor(message) {
        super(message, 409, "CONFLICT");
    }
}
export class ValidationError extends ApiError {
    constructor(message, details) {
        super(message, 422, "VALIDATION_ERROR", details);
    }
}
// 5xx Server Errors
export class InternalError extends ApiError {
    constructor(message = "Internal server error") {
        super(message, 500, "INTERNAL_ERROR");
    }
}
export class ServiceUnavailableError extends ApiError {
    constructor(message = "Service temporarily unavailable") {
        super(message, 503, "SERVICE_UNAVAILABLE");
    }
}
// Domain-specific errors
export class WalletError extends ApiError {
    constructor(message, details) {
        super(message, 400, "WALLET_ERROR", details);
    }
}
export class PolicyError extends ApiError {
    constructor(message, details) {
        super(message, 400, "POLICY_ERROR", details);
    }
}
export class SpendError extends ApiError {
    constructor(message, details) {
        super(message, 400, "SPEND_ERROR", details);
    }
}
export const errorHandler = (logger) => (err, req, res, _next) => {
    // Log the error
    if (logger) {
        logger.error(`API Error: ${err.message}`, err instanceof Error ? err : undefined);
    }
    // Handle known API errors
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json(err.toJSON());
    }
    // Handle Zod validation errors
    if (err.name === "ZodError") {
        return res.status(422).json({
            success: false,
            error: "Validation failed",
            code: "VALIDATION_ERROR",
            details: err,
            timestamp: new Date().toISOString(),
        });
    }
    // Handle unknown errors
    return res.status(500).json({
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        timestamp: new Date().toISOString(),
    });
};
// Async handler wrapper to catch errors automatically
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
//# sourceMappingURL=ApiErrors.js.map
