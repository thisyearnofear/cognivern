/**
 * API Error Classes - Structured Error Handling
 *
 * Following DRY principle - single source of truth for API errors
 */

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR",
    details?: unknown,
  ) {
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
  constructor(message: string, details?: unknown) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Access denied") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, "NOT_FOUND");
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details);
  }
}

// 5xx Server Errors
export class InternalError extends ApiError {
  constructor(message: string = "Internal server error") {
    super(message, 500, "INTERNAL_ERROR");
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = "Service temporarily unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}

// Domain-specific errors
export class WalletError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "WALLET_ERROR", details);
  }
}

export class PolicyError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "POLICY_ERROR", details);
  }
}

export class SpendError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "SPEND_ERROR", details);
  }
}

// Error handler middleware factory
import { Request, Response, NextFunction } from "express";

export const errorHandler =
  (logger?: { error: (msg: string, err?: Error) => void }) =>
  (err: Error, req: Request, res: Response, _next: NextFunction) => {
    // Log the error
    if (logger) {
      logger.error(
        `API Error: ${err.message}`,
        err instanceof Error ? err : undefined,
      );
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
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
