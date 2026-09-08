import { Response } from "express";

/**
 * Shared API response helpers.
 *
 * The `ApiResponse` envelope type is the single source of truth, owned by
 * `@cognivern/shared` (see packages/shared/src/types/index.ts). This module
 * re-exports it and provides the Express helpers that populate the `timestamp`
 * invariant at runtime:
 *   { success, data?, error?, message?, timestamp }
 *
 * Backend code should import `ApiResponse` from `@cognivern/shared`; this file
 * remains the home of the Express-specific `sendSuccess` / `sendError` helpers.
 */
export type { ApiResponse } from "@cognivern/shared";

/**
 * Send a successful JSON response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Send an error JSON response.
 */
export function sendError(
  res: Response,
  statusCode: number,
  error: string,
): void {
  res.status(statusCode).json({
    success: false,
    error,
    timestamp: new Date().toISOString(),
  });
}
