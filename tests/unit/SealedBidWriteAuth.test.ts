import type { Request, Response, NextFunction } from "express";
import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createHash } from "node:crypto";
import { sealedBidWriteAuth } from "@backend/middleware/sealedBidAuthMiddleware.js";
import { tokenBlacklistStore } from "@backend/shared/storage/TokenBlacklistStore.js";

const DEV_SECRET = new TextEncoder().encode(
  "cognivern-dev-jwt-secret-change-in-production",
);

const WALLET = "0x1111111111111111111111111111111111111111";

async function mintToken() {
  return new SignJWT({ sub: "u-1", walletAddress: WALLET, workspaceId: "ws-1" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(DEV_SECRET);
}

async function blacklist(token: string) {
  await tokenBlacklistStore.blacklist(
    createHash("sha256").update(token).digest("hex"),
    60_000,
  );
}

function req(mode: string, token?: string): Request {
  const headers: Record<string, string> = { "x-workspace-mode": mode };
  if (token) headers.authorization = `Bearer ${token}`;
  return { headers, header: (n: string) => headers[n.toLowerCase()] } as unknown as Request;
}

function res() {
  return {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
}

const next: NextFunction = () => {};

describe("sealedBidWriteAuth blacklist check", () => {
  it("accepts a valid token in production and binds the wallet", async () => {
    const token = await mintToken();
    const request = req("production", token);
    const response = res();
    let called = false;
    await sealedBidWriteAuth(request, response as unknown as Response, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(request.walletAddress).toBe(WALLET);
  });

  it("rejects a revoked token in production", async () => {
    const token = await mintToken();
    await blacklist(token);
    const request = req("production", token);
    const response = res();
    let called = false;
    await sealedBidWriteAuth(request, response as unknown as Response, () => {
      called = true;
    });
    expect(called).toBe(false);
    expect(response.statusCode).toBe(401);
  });

  it("treats a revoked token as anonymous in sandbox", async () => {
    const token = await mintToken();
    await blacklist(token);
    const request = req("sandbox", token);
    const response = res();
    let called = false;
    await sealedBidWriteAuth(request, response as unknown as Response, () => {
      called = true;
    });
    expect(called).toBe(true);
    expect(request.walletAddress).toBeUndefined();
  });
});
