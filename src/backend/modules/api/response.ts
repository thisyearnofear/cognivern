import { Response } from "express";

/**
 * Shared API response helpers.
 *
 * These enforce a consistent JSON envelope across all endpoints:
 *   { success, data?, error?, message?, timestamp }
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

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
