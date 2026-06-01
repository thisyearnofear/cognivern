/**
 * Workspace Rate Limiter
 *
 * Per-workspace rate limiting using an in-memory sliding window counter.
 * Each workspace gets 100 requests/minute by default.
 *
 * Usage:
 *   import { workspaceRateLimit } from "../middleware/workspaceRateLimit.js";
 *   router.get("/agents", workspaceRateLimit, controller.getAgents);
 */

import type { Request, Response, NextFunction } from "express";

interface WindowEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

const windows = new Map<string, WindowEntry>();

// Periodic cleanup to prevent memory leak (every 2 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of windows) {
    if (now > entry.resetAt) windows.delete(key);
  }
}, 120_000).unref();

/**
 * Extract workspace ID from the request.
 * Checks query param, header, or falls back to a derived key.
 */
function getWorkspaceId(req: Request): string {
  return (
    (req.headers["x-workspace-id"] as string) ||
    (req.query.workspaceId as string) ||
    "default"
  );
}

/**
 * Create a workspace-scoped rate limiter.
 *
 * @param limit - Max requests per window (default 100)
 * @param windowMs - Window duration in ms (default 60 000)
 */
export function workspaceRateLimit(
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const wsId = getWorkspaceId(req);
    const key = `ws:${wsId}`;
    const now = Date.now();

    let entry = windows.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      windows.set(key, entry);
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
        error: "Rate limit exceeded",
        retryAfter,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
