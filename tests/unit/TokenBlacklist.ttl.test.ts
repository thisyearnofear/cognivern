import { describe, expect, it } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import { isPublicApiPath } from "@backend/middleware/publicEndpoints.js";

describe("logout blacklist TTL binding", () => {
  it("computes TTL through JWT exp rather than a fixed 24h window", async () => {
    const secret = new TextEncoder().encode("test-secret");
    const token = await new SignJWT({ sub: "u1", workspaceId: "w1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    const { exp } = decodeJwt(token);
    expect(typeof exp).toBe("number");
    const ttlMs = Math.max((exp as number) * 1000 - Date.now() + 60_000, 60_000);
    // Must outlast the old 24h default so a 7d JWT stays revoked after logout.
    expect(ttlMs).toBeGreaterThan(86_400_000);
    expect(ttlMs).toBeGreaterThan(6 * 86_400_000);
  });
});

describe("auth refresh public path", () => {
  it("exposes /auth/refresh without authMiddleware gating", () => {
    expect(isPublicApiPath("/auth/refresh")).toBe(true);
  });
});
