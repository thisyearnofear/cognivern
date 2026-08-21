/**
 * Optional Idempotency-Key middleware for side-effecting routes.
 *
 * When the client sends `Idempotency-Key`, a prior successful response for the
 * same workspace+method+path+key is replayed instead of re-running the handler.
 * Controllers that perform chain/ledger writes should prefer this (or their own
 * store) so a client retry after a timeout does not double-submit.
 */
import type { Request, Response, NextFunction } from "express";
import { idempotencyStore } from "@backend/modules/api/storage/IdempotencyStore.js";

function buildKey(req: Request, clientKey: string): string {
  const workspace = req.workspaceId || "public";
  return `${workspace}:${req.method}:${req.path}:${clientKey}`;
}

export function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const raw = req.headers["idempotency-key"];
  const clientKey = Array.isArray(raw) ? raw[0] : raw;
  if (!clientKey || typeof clientKey !== "string" || !clientKey.trim()) {
    next();
    return;
  }

  const key = buildKey(req, clientKey.trim().slice(0, 160));

  void (async () => {
    try {
      const existing = await idempotencyStore.getRecord(key);
      if (existing) {
        res.status(existing.statusCode).json(existing.body);
        return;
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        const statusCode = res.statusCode || 200;
        if (statusCode >= 200 && statusCode < 300) {
          void idempotencyStore.setRecord(key, {
            statusCode,
            body: (body && typeof body === "object"
              ? (body as Record<string, unknown>)
              : { data: body }) as Record<string, unknown>,
            createdAtMs: Date.now(),
          });
        }
        return originalJson(body);
      }) as typeof res.json;

      next();
    } catch {
      next();
    }
  })();
}
