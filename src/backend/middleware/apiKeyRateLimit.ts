/**
 * API Key Rate Limiter
 *
 * Per-key rate limiting using persistent file-backed storage.
 * Each API key gets 50 requests/minute by default.
 * Counters survive server restarts.
 *
 * Usage:
 *   import { apiKeyRateLimit } from "@backend/middleware/apiKeyRateLimit.js";
 *   router.get("/data", apiKeyRateLimit, controller.getData);
 */

import type { Request, Response, NextFunction } from 'express';
import { rateLimitStore } from "@backend/shared/storage/RateLimitStore.js";

const DEFAULT_LIMIT = 50;
const DEFAULT_WINDOW_MS = 60_000;

function getApiKeyId(req: Request): string | null {
  const key = req.headers['x-api-key'] as string | undefined;
  if (key) return `key:${key.slice(0, 8)}`;
  const authKey = (req as unknown as Record<string, unknown>).apiKeyId;
  if (typeof authKey === 'string') return `key:${authKey}`;
  return null;
}

export function apiKeyRateLimit(limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const keyId = getApiKeyId(req);

    if (!keyId) {
      next();
      return;
    }

    const now = Date.now();
    const window = await rateLimitStore.getWindow(keyId);

    let entry: { count: number; resetAt: number };
    if (!window) {
      entry = { count: 0, resetAt: now + windowMs };
    } else {
      entry = window;
    }

    entry.count++;

    const remaining = Math.max(0, limit - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    rateLimitStore.setWindow(keyId, entry, windowMs * 2).catch(() => {});

    if (entry.count > limit) {
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        success: false,
        error: 'API key rate limit exceeded',
        retryAfter,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
