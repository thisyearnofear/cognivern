import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { tokenBlacklistStore } from "../shared/storage/TokenBlacklistStore.js";

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
  walletAddress: string;
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
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      success: false,
      error: "Authentication required. Provide a Bearer token.",
    });
    return;
  }

  const token = authHeader.slice(7);

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

    next();
  } catch {
    res.status(401).json({
      success: false,
      error: "Token expired or invalid. Please sign in again.",
    });
  }
}
