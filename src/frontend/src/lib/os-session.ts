import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export interface OsSession {
  userId: string;
  workspaceId: string;
}

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

function b64urlToBuffer(value: string): Buffer {
  const padded =
    value.length % 4 === 0 ? value : value + "=".repeat(4 - (value.length % 4));
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyOsSession(request: Request): OsSession | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  let secret: Uint8Array;
  try {
    secret = getJwtSecret();
  } catch {
    return null;
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", Buffer.from(secret))
    .update(signingInput)
    .digest();
  const actual = b64urlToBuffer(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let payload: { sub?: unknown; workspaceId?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(b64urlToBuffer(parts[1]).toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }
  if (typeof payload.sub !== "string" || typeof payload.workspaceId !== "string") {
    return null;
  }
  if (!payload.sub || !payload.workspaceId) return null;

  return { userId: payload.sub, workspaceId: payload.workspaceId };
}

export function unauthorizedResponse(message = "Authentication required"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}
