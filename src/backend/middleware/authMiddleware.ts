import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "cognivern-dev-jwt-secret-change-in-production"
);

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
  next: NextFunction
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
