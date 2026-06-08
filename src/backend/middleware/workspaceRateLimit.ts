/**
 * Workspace Rate Limiter
 *
 * Per-workspace rate limiting using persistent file-backed storage.
 * Each workspace gets 100 requests/minute by default.
 * Counters survive server restarts.
 *
 * Usage:
 *   import { workspaceRateLimit } from "../middleware/workspaceRateLimit.js";
 *   router.get("/agents", workspaceRateLimit, controller.getData);
 */

import type { Request, Response, NextFunction } from "express";
import { rateLimitStore } from "../shared/storage/RateLimitStore.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;

function getWorkspaceId(req: Request): string {
  return (
    (req.headers["x-workspace-id"] as string) ||
    (req.query.workspaceId as string) ||
    "default"
  );
}

export function workspaceRateLimit(
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const wsId = getWorkspaceId(req);
    const key = `ws:${wsId}`;
    const now = Date.now();

    const window = await rateLimitStore.getWindow(key);

    let entry: { count: number; resetAt: number };
    if (!window) {
      entry = { count: 0, resetAt: now + windowMs };
    } else {
      entry = window;
    }

    entry.count++;

    const remaining = Math.max(0, limit - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    rateLimitStore
      .setWindow(key, entry, windowMs * 2)
      .catch(() => {});

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
