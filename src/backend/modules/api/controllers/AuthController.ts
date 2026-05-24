import { Request, Response } from "express";
import { SiweMessage, generateNonce } from "siwe";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import type { AuthUser, Workspace } from "@cognivern/shared";
import { getDb } from "../../../db/index.js";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode("cognivern-dev-jwt-secret-change-in-production");
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret();

export class AuthController {
  async getNonce(_req: Request, res: Response): Promise<void> {
    const db = getDb();
    const nonce = generateNonce();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    db.prepare("DELETE FROM nonces WHERE expires_at < ?").run(Date.now());
    db.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(nonce, expiresAt);

    res.json({ nonce });
  }

  async verify(req: Request, res: Response): Promise<void> {
    const { message, signature, address } = req.body as {
      message: string;
      signature: string;
      address: string;
    };

    if (!message || !signature || !address) {
      res.status(400).json({
        success: false,
        error: "message, signature, and address are required",
      });
      return;
    }

    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch {
      res.status(400).json({
        success: false,
        error: "Invalid SIWE message format",
      });
      return;
    }

    const db = getDb();
    const stored = db
      .prepare("SELECT nonce, expires_at FROM nonces WHERE nonce = ?")
      .get(siweMessage.nonce) as { nonce: string; expires_at: number } | undefined;

    if (!stored || stored.expires_at < Date.now()) {
      db.prepare("DELETE FROM nonces WHERE nonce = ?").run(siweMessage.nonce);
      res.status(401).json({
        success: false,
        error: "Nonce expired or invalid. Please request a new one.",
      });
      return;
    }

    db.prepare("DELETE FROM nonces WHERE nonce = ?").run(siweMessage.nonce);

    try {
      const result = await siweMessage.verify({ signature });
      if (!result.success) {
        res.status(401).json({ success: false, error: "Signature verification failed" });
        return;
      }
    } catch {
      res.status(401).json({ success: false, error: "Signature verification failed" });
      return;
    }

    const normalizedAddress = address.toLowerCase();
    let user = db
      .prepare("SELECT id, wallet_address, created_at, last_login_at FROM users WHERE wallet_address = ?")
      .get(normalizedAddress) as { id: string; wallet_address: string; created_at: string; last_login_at: string } | undefined;

    let workspace: { id: string; name: string; owner_id: string; tier: string; created_at: string; updated_at: string } | undefined;

    if (!user) {
      const userId = randomUUID();
      const workspaceId = randomUUID();
      const now = new Date().toISOString();
      const workspaceName = `${address.slice(0, 6)}...${address.slice(-4)}'s Workspace`;

      const insertUser = db.prepare(
        "INSERT INTO users (id, wallet_address, created_at, last_login_at) VALUES (?, ?, ?, ?)"
      );
      const insertWorkspace = db.prepare(
        "INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
      );

      const transaction = db.transaction(() => {
        insertUser.run(userId, normalizedAddress, now, now);
        insertWorkspace.run(workspaceId, workspaceName, userId, "demo", now, now);
      });
      transaction();

      user = { id: userId, wallet_address: normalizedAddress, created_at: now, last_login_at: now };
      workspace = { id: workspaceId, name: workspaceName, owner_id: userId, tier: "demo", created_at: now, updated_at: now };
    } else {
      const now = new Date().toISOString();
      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, user.id);
      user.last_login_at = now;

      workspace = db
        .prepare("SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE owner_id = ?")
        .get(user.id) as typeof workspace;
    }

    if (!workspace) {
      res.status(500).json({ success: false, error: "No workspace found for user" });
      return;
    }

    const authUser: AuthUser = {
      id: user.id,
      walletAddress: user.wallet_address,
      createdAt: user.created_at,
      lastLoginAt: user.last_login_at,
    };

    const authWorkspace: Workspace = {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      tier: workspace.tier as "demo" | "live",
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
    };

    const token = await new SignJWT({
      sub: authUser.id,
      walletAddress: authUser.walletAddress,
      workspaceId: authWorkspace.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    res.json({ token, user: authUser, workspace: authWorkspace });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    const workspaceId = req.workspaceId;

    if (!userId || !workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, wallet_address, created_at, last_login_at FROM users WHERE id = ?")
      .get(userId) as { id: string; wallet_address: string; created_at: string; last_login_at: string } | undefined;

    const workspace = db
      .prepare("SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE id = ?")
      .get(workspaceId) as { id: string; name: string; owner_id: string; tier: string; created_at: string; updated_at: string } | undefined;

    if (!user || !workspace) {
      res.status(404).json({ success: false, error: "User or workspace not found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      } as AuthUser,
      workspace: {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.owner_id,
        tier: workspace.tier as "demo" | "live",
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
      } as Workspace,
    });
  }
}
