import { Request, Response, NextFunction } from "express";

// Simple console logger for middleware
const logger = {
  warn: (message: string) => console.warn(`[WARN] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
  info: (message: string) => console.log(`[INFO] ${message}`),
};

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error(
    `API Error: ${error.message} - ${req.method} ${req.url} from ${req.ip}`
  );

  // Handle different error types
  if (error instanceof APIError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    res.status(400).json({
      error: "Validation failed",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Handle blockchain/contract errors
  if (
    error.message.includes("contract") ||
    error.message.includes("transaction")
  ) {
    res.status(502).json({
      error: "Blockchain service unavailable",
      details:
        "The blockchain service is currently unavailable. Please try again later.",
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Default error response
  res.status(500).json({
    error: "Internal server error",
    details:
      process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
