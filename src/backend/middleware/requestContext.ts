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
  /** Aborted on request timeout or client disconnect. */
  abortSignal?: AbortSignal;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

const VALID_ID = /^[a-zA-Z0-9-]{8,64}$/;

declare global {
  namespace Express {
    interface Request {
      abortSignal?: AbortSignal;
      abortController?: AbortController;
    }
  }
}

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

  const abortController = new AbortController();
  req.abortController = abortController;
  req.abortSignal = abortController.signal;

  const onClose = () => {
    if (!abortController.signal.aborted) {
      abortController.abort(new Error("client disconnected"));
    }
  };
  req.on("close", onClose);
  res.on("close", onClose);

  requestContext.run(
    {
      requestId,
      route: `${req.method} ${req.path}`,
      startedAt: Date.now(),
      abortSignal: abortController.signal,
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

export function getRequestAbortSignal(): AbortSignal | undefined {
  return requestContext.getStore()?.abortSignal;
}
