/**
 * API Key Rate Limiter
 *
 * Per-key rate limiting using an in-memory sliding window counter.
 * Each API key gets 50 requests/minute by default.
 *
 * Usage:
 *   import { apiKeyRateLimit } from "../middleware/apiKeyRateLimit.js";
 *   router.get("/data", apiKeyRateLimit, controller.getData);
 */

import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_LIMIT = 50;
const DEFAULT_WINDOW_MS = 60_000;

const windows = new Map<string, WindowEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 120_000).unref();

/**
 * Extract API key ID from the request.
 * Checks the X-API-Key header or an auth-validated field on req.
 */
function getApiKeyId(req: Request): string | null {
  const key = req.headers["x-api-key"] as string | undefined;
  if (key) return `key:${key.slice(0, 8)}`; // Use prefix as identifier
  // If set by auth middleware, use that
  const authKey = (req as unknown as Record<string, unknown>).apiKeyId;
  if (typeof authKey === "string") return `key:${authKey}`;
  return null;
}

/**
 * Create an API-key-scoped rate limiter.
 *
 * @param limit - Max requests per window (default 50)
 * @param windowMs - Window duration in ms (default 60 000)
 */
export function apiKeyRateLimit(
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const keyId = getApiKeyId(req);

    // If no API key is present, fall through to the next middleware
    // (workspace-level or global rate limiter should handle anonymous traffic)
    if (!keyId) {
      next();
      return;
    }

    const now = Date.now();

    let entry = windows.get(keyId);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(keyId, entry);
    }

    entry.count++;

    const remaining = Math.max(0, limit - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count >= limit) {
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        success: false,
        error: "API key rate limit exceeded",
        retryAfter,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
