import type { Request, Response } from "express";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { decodeJwt, SignJWT } from "jose";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(
  os.tmpdir(),
  `cognivern-linkwallet-${process.pid}-${Date.now()}.db`,
);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { AuthController } = await import(
  "@backend/modules/api/controllers/AuthController.js"
);
const { SiweMessage } = await import("siwe");
const { Wallet } = await import("ethers");
const { tokenBlacklistStore } = await import(
  "@backend/shared/storage/TokenBlacklistStore.js"
);

const WORKSPACE = "ws-link-test";
const EMAIL_USER = "user-email-1";
const EMAIL_USER_2 = "user-email-2";
const WALLET_USER = "user-wallet-1";

const walletA = Wallet.createRandom();
const walletC = Wallet.createRandom();

class MockResponse {
  statusCode = 200;
  payload: Record<string, unknown> | undefined;
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(payload: Record<string, unknown>) {
    this.payload = payload;
    return this;
  }
}

function request(
  body: Record<string, unknown>,
  userId?: string,
  workspaceId?: string,
  token?: string,
): Request {
  return {
    body,
    params: {},
    query: {},
    headers: token ? { authorization: `Bearer ${token}` } : {},
    header: () => undefined,
    userId,
    workspaceId,
  } as unknown as Request;
}

// The dev secret is what getJwtSecret() resolves to with JWT_SECRET unset.
const DEV_SECRET = new TextEncoder().encode(
  "cognivern-dev-jwt-secret-change-in-production",
);

async function makeSessionToken(sub: string, workspaceId: string) {
  return new SignJWT({ sub, workspaceId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .setJti(randomBytes(8).toString("hex"))
    .sign(DEV_SECRET);
}

function isBlacklisted(token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  return tokenBlacklistStore.isBlacklisted(hash);
}

async function makeProof(wallet: InstanceType<typeof Wallet>) {
  const db = getDb();
  const nonce = randomBytes(16).toString("hex");
  db.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(
    nonce,
    Date.now() + 60_000,
  );
  const siwe = new SiweMessage({
    domain: "localhost:3000",
    address: wallet.address,
    statement: "Sign in to Cognivern",
    uri: "http://localhost:3000",
    version: "1",
    chainId: 1,
    nonce,
    issuedAt: new Date().toISOString(),
  });
  const message = siwe.prepareMessage();
  const signature = await wallet.signMessage(message);
  return { message, signature, address: wallet.address };
}

function seedUsers() {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)",
  ).run("user-owner", now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-owner", now, now);
  // Two email-method users (password set) and one wallet-native user.
  db.prepare(
    "INSERT INTO users (id, email, password_hash, email_verified, auth_method, created_at, last_login_at) VALUES (?, ?, ?, 1, 'email', ?, ?)",
  ).run(EMAIL_USER, "a@example.com", "hash-a", now, now);
  db.prepare(
    "INSERT INTO users (id, email, password_hash, email_verified, auth_method, created_at, last_login_at) VALUES (?, ?, ?, 1, 'email', ?, ?)",
  ).run(EMAIL_USER_2, "b@example.com", "hash-b", now, now);
  db.prepare(
    "INSERT INTO users (id, wallet_address, auth_method, created_at, last_login_at) VALUES (?, ?, 'wallet', ?, ?)",
  ).run(WALLET_USER, walletC.address.toLowerCase(), now, now);
}

const controller = new AuthController();

describe("AuthController link-wallet", () => {
  beforeAll(seedUsers);

  afterAll(() => {
    closeDb();
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.unlinkSync(`${dbPath}${suffix}`);
      } catch {
        // Ignore SQLite cleanup races.
      }
    }
  });

  it("links a wallet to an email user and reissues a wallet-scoped token", async () => {
    const proof = await makeProof(walletA);
    const oldToken = await makeSessionToken(EMAIL_USER, WORKSPACE);
    const res = new MockResponse();
    await controller.linkWallet(
      request(proof, EMAIL_USER, WORKSPACE, oldToken),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    const { token, user } = res.payload as {
      token: string;
      user: { walletAddress: string };
    };
    const row = getDb()
      .prepare("SELECT wallet_address FROM users WHERE id = ?")
      .get(EMAIL_USER) as { wallet_address: string };
    expect(row.wallet_address.toLowerCase()).toBe(walletA.address.toLowerCase());
    const claims = decodeJwt(token);
    expect(claims.walletAddress).toBe(user.walletAddress);
    expect(claims.workspaceId).toBe(WORKSPACE);
    expect(claims.sub).toBe(EMAIL_USER);
    // The superseded token (no walletAddress claim) is revoked immediately.
    expect(await isBlacklisted(oldToken)).toBe(true);
  });

  it("is idempotent for the same wallet without revoking the session", async () => {
    const proof = await makeProof(walletA);
    const sessionToken = await makeSessionToken(EMAIL_USER, WORKSPACE);
    const res = new MockResponse();
    await controller.linkWallet(
      request(proof, EMAIL_USER, WORKSPACE, sessionToken),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    // No row change → no revocation.
    expect(await isBlacklisted(sessionToken)).toBe(false);
  });

  it("rejects a different wallet while one is linked", async () => {
    const otherWallet = Wallet.createRandom();
    const proof = await makeProof(otherWallet);
    const res = new MockResponse();
    await controller.linkWallet(
      request(proof, EMAIL_USER, WORKSPACE),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(409);
    expect((res.payload as { error: string }).error).toContain("Unlink");
  });

  it("rejects a wallet already owned by another account", async () => {
    const proof = await makeProof(walletC); // owned by WALLET_USER
    const res = new MockResponse();
    await controller.linkWallet(
      request(proof, EMAIL_USER_2, WORKSPACE),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(409);
    const row = getDb()
      .prepare("SELECT wallet_address FROM users WHERE id = ?")
      .get(EMAIL_USER_2) as { wallet_address: string | null };
    expect(row.wallet_address).toBeNull();
  });

  it("rejects an expired/unknown nonce", async () => {
    const siwe = new SiweMessage({
      domain: "localhost:3000",
      address: walletA.address,
      statement: "Sign in to Cognivern",
      uri: "http://localhost:3000",
      version: "1",
      chainId: 1,
      nonce: "deadbeefcafe1234",
      issuedAt: new Date().toISOString(),
    });
    const res = new MockResponse();
    await controller.linkWallet(
      request(
        {
          message: siwe.prepareMessage(),
          signature: "0xdead",
          address: walletA.address,
        },
        EMAIL_USER_2,
        WORKSPACE,
      ),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(401);
  });

  it("unlinks a wallet from an email user and drops the claim", async () => {
    const oldToken = await makeSessionToken(EMAIL_USER, WORKSPACE);
    const res = new MockResponse();
    await controller.unlinkWallet(
      request({}, EMAIL_USER, WORKSPACE, oldToken),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    const row = getDb()
      .prepare("SELECT wallet_address FROM users WHERE id = ?")
      .get(EMAIL_USER) as { wallet_address: string | null };
    expect(row.wallet_address).toBeNull();
    const { token } = res.payload as { token: string };
    expect(decodeJwt(token).walletAddress).toBeUndefined();
    // The old token still carried walletAddress — it must be dead now.
    expect(await isBlacklisted(oldToken)).toBe(true);
  });

  it("refuses to unlink a wallet-native account", async () => {
    const res = new MockResponse();
    await controller.unlinkWallet(
      request({}, WALLET_USER, WORKSPACE),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(409);
  });
});
