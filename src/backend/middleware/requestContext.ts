import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export interface RequestContext {
  requestId: string;
  workspaceId?: string;
  userId?: string;
  agentId?: string;
  route?: string;
  startedAt: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

const VALID_ID = /^[a-zA-Z0-9-]{8,64}$/;

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers["x-request-id"];
  const requestId =
    typeof incoming === "string" && VALID_ID.test(incoming)
      ? incoming
      : randomUUID();

  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);

  requestContext.run(
    {
      requestId,
      route: `${req.method} ${req.path}`,
      startedAt: Date.now(),
    },
    next,
  );
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
