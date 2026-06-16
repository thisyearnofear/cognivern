import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { tokenBlacklistStore } from "../shared/storage/TokenBlacklistStore.js";
import { isPublicApiPath } from "./publicEndpoints.js";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode(
      "cognivern-dev-jwt-secret-change-in-production",
    );
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

export interface AuthPayload {
  sub: string;
  walletAddress?: string;
  email?: string;
  authMethod?: string;
  workspaceId: string;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      walletAddress?: string;
      workspaceId?: string;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Skip auth for public paths (webhooks, health) and for paths that have
  // per-resource auth handled by the controller (e.g. /api/spend uses the
  // OWS scoped key in x-ows-scoped-access, not the JWT). The shared list
  // is the single source of truth — see publicEndpoints.ts.
  if (isPublicApiPath(req.path)) {
    next();
    return;
  }

  // Already authenticated via API key middleware
  if (req.workspaceId) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  // SSE endpoints: EventSource cannot set custom headers, so accept
  // the JWT token as a query parameter for streaming endpoints.
  const queryToken =
    req.path.endsWith("/events/stream") &&
    typeof req.query.token === "string"
      ? req.query.token
      : undefined;

  if (!authHeader?.startsWith("Bearer ") && !queryToken) {
    res.status(401).json({
      success: false,
      error: "Authentication required. Provide a Bearer token.",
    });
    return;
  }

  const token = queryToken || authHeader!.slice(7);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const authPayload = payload as unknown as AuthPayload;

    if (!authPayload.sub || !authPayload.workspaceId) {
      res.status(401).json({
        success: false,
        error: "Invalid token payload",
      });
      return;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (await tokenBlacklistStore.isBlacklisted(tokenHash)) {
      res.status(401).json({
        success: false,
        error: "Token has been revoked",
      });
      return;
    }

    req.userId = authPayload.sub;
    req.walletAddress = authPayload.walletAddress;
    req.workspaceId = authPayload.workspaceId;

    // Propagate auth context into the request-scoped AsyncLocalStorage store
    // so Logger.*Ctx and other services can read workspaceId/userId.
    const { getRequestContext } = await import("./requestContext.js");
    const ctx = getRequestContext();
    if (ctx) {
      ctx.workspaceId = authPayload.workspaceId;
      ctx.userId = authPayload.sub;
    }

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "Token expired or invalid. Please sign in again.",
    });
  }
}
