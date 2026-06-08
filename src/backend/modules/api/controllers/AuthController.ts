import { Request, Response } from "express";
import { SiweMessage, generateNonce } from "siwe";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { createHash, randomBytes } from "node:crypto";
import type { AuthUser, Workspace } from "@cognivern/shared";
import { getDb } from "../../../db/index.js";

// Simple bcrypt-like hashing using scrypt (built into Node.js crypto)
async function hashPassword(password: string): Promise<string> {
  const { scryptSync, randomBytes } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const { scryptSync } = await import("node:crypto");
  const [salt, hash] = storedHash.split(":");
  const verifyHash = scryptSync(password, salt, 64).toString("hex");
  return hash === verifyHash;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

const JWT_SECRET = getJwtSecret();

export class AuthController {
  async getNonce(_req: Request, res: Response): Promise<void> {
    const db = getDb();
    const nonce = generateNonce();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    db.prepare("DELETE FROM nonces WHERE expires_at < ?").run(Date.now());
    db.prepare("INSERT INTO nonces (nonce, expires_at) VALUES (?, ?)").run(
      nonce,
      expiresAt,
    );

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
      .get(siweMessage.nonce) as
      | { nonce: string; expires_at: number }
      | undefined;

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
        res
          .status(401)
          .json({ success: false, error: "Signature verification failed" });
        return;
      }
    } catch {
      res
        .status(401)
        .json({ success: false, error: "Signature verification failed" });
      return;
    }

    const normalizedAddress = address.toLowerCase();
    let user = db
      .prepare(
        "SELECT id, wallet_address, created_at, last_login_at FROM users WHERE wallet_address = ?",
      )
      .get(normalizedAddress) as
      | {
          id: string;
          wallet_address: string;
          created_at: string;
          last_login_at: string;
        }
      | undefined;

    let workspace:
      | {
          id: string;
          name: string;
          owner_id: string;
          tier: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!user) {
      const userId = randomUUID();
      const workspaceId = randomUUID();
      const now = new Date().toISOString();
      const workspaceName = `${address.slice(0, 6)}...${address.slice(-4)}'s Workspace`;

      const insertUser = db.prepare(
        "INSERT INTO users (id, wallet_address, created_at, last_login_at) VALUES (?, ?, ?, ?)",
      );
      const insertWorkspace = db.prepare(
        "INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      );

      const transaction = db.transaction(() => {
        insertUser.run(userId, normalizedAddress, now, now);
        insertWorkspace.run(
          workspaceId,
          workspaceName,
          userId,
          "demo",
          now,
          now,
        );
      });
      transaction();

      user = {
        id: userId,
        wallet_address: normalizedAddress,
        created_at: now,
        last_login_at: now,
      };
      workspace = {
        id: workspaceId,
        name: workspaceName,
        owner_id: userId,
        tier: "demo",
        created_at: now,
        updated_at: now,
      };
    } else {
      const now = new Date().toISOString();
      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(
        now,
        user.id,
      );
      user.last_login_at = now;

      workspace = db
        .prepare(
          "SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE owner_id = ?",
        )
        .get(user.id) as typeof workspace;
    }

    if (!workspace) {
      res
        .status(500)
        .json({ success: false, error: "No workspace found for user" });
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

    // Ensure owner is in workspace_members
    db.prepare(
      "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    ).run(authWorkspace.id, authUser.id, new Date().toISOString());

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
      .prepare(
        "SELECT id, wallet_address, created_at, last_login_at FROM users WHERE id = ?",
      )
      .get(userId) as
      | {
          id: string;
          wallet_address: string;
          created_at: string;
          last_login_at: string;
        }
      | undefined;

    const workspace = db
      .prepare(
        "SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE id = ?",
      )
      .get(workspaceId) as
      | {
          id: string;
          name: string;
          owner_id: string;
          tier: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!user || !workspace) {
      res
        .status(404)
        .json({ success: false, error: "User or workspace not found" });
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

  async logout(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { tokenBlacklistStore } = await import(
        "../../../shared/storage/TokenBlacklistStore.js"
      );
      await tokenBlacklistStore.blacklist(tokenHash);
    }
    res.json({ success: true });
  }

  async register(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
      return;
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existing = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(normalizedEmail);
    if (existing) {
      res.status(409).json({
        success: false,
        error: "An account with this email already exists",
      });
      return;
    }

    const userId = randomUUID();
    const workspaceId = randomUUID();
    const now = new Date().toISOString();
    const verificationToken = generateToken();
    const passwordHash = await hashPassword(password);

    // Extract name from email for workspace
    const workspaceName = `${normalizedEmail.split("@")[0]}'s Workspace`;

    const transaction = db.transaction(() => {
      db.prepare(
        "INSERT INTO users (id, email, password_hash, auth_method, verification_token, email_verified, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(
        userId,
        normalizedEmail,
        passwordHash,
        "email",
        verificationToken,
        0,
        now,
        now,
      );

      db.prepare(
        "INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(workspaceId, workspaceName, userId, "demo", now, now);
    });

    try {
      transaction();
    } catch (err) {
      console.error("Registration error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to create account",
      });
      return;
    }

    // In production, send verification email here
    // For now, we'll auto-verify in demo mode
    if (process.env.NODE_ENV !== "production") {
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
    }

    res.status(201).json({
      success: true,
      message:
        process.env.NODE_ENV === "production"
          ? "Account created. Please check your email to verify your account."
          : "Account created successfully.",
      userId,
      email: normalizedEmail,
    });
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
      return;
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase();

    const user = db
      .prepare(
        "SELECT id, email, password_hash, auth_method, email_verified, wallet_address, created_at, last_login_at FROM users WHERE email = ?",
      )
      .get(normalizedEmail) as
      | {
          id: string;
          email: string;
          password_hash: string;
          auth_method: string;
          email_verified: number;
          wallet_address: string | null;
          created_at: string;
          last_login_at: string;
        }
      | undefined;

    if (!user || user.auth_method !== "email") {
      res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
      return;
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
      return;
    }

    // Get workspace
    const workspace = db
      .prepare(
        "SELECT id, name, owner_id, tier, created_at, updated_at FROM workspaces WHERE owner_id = ?",
      )
      .get(user.id) as
      | {
          id: string;
          name: string;
          owner_id: string;
          tier: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!workspace) {
      res.status(500).json({
        success: false,
        error: "No workspace found for user",
      });
      return;
    }

    // Update last login
    const now = new Date().toISOString();
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(
      now,
      user.id,
    );

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      emailVerified: user.email_verified === 1,
      authMethod: user.auth_method,
      createdAt: user.created_at,
      lastLoginAt: now,
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
      email: authUser.email,
      workspaceId: authWorkspace.id,
      authMethod: authUser.authMethod,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    res.json({ token, user: authUser, workspace: authWorkspace });
  }

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { token } = req.body as { token: string };

    if (!token) {
      res.status(400).json({
        success: false,
        error: "Verification token is required",
      });
      return;
    }

    const db = getDb();
    const user = db
      .prepare(
        "SELECT id, verification_token FROM users WHERE verification_token = ?",
      )
      .get(token) as { id: string; verification_token: string } | undefined;

    if (!user) {
      res.status(404).json({
        success: false,
        error: "Invalid or expired verification token",
      });
      return;
    }

    db.prepare(
      "UPDATE users SET email_verified = 1, verification_token = NULL WHERE id = ?",
    ).run(user.id);

    res.json({
      success: true,
      message: "Email verified successfully",
    });
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const { email } = req.body as { email: string };

    if (!email) {
      res.status(400).json({
        success: false,
        error: "Email is required",
      });
      return;
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase();

    const user = db
      .prepare("SELECT id FROM users WHERE email = ? AND auth_method = 'email'")
      .get(normalizedEmail);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message:
        "If an account exists with this email, you will receive a password reset link.",
    });

    if (!user) {
      return;
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare(
      "UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?",
    ).run(resetToken, expiresAt, (user as { id: string }).id);

    // In production, send email with reset link
    console.log(
      `Password reset token for ${normalizedEmail}: ${resetToken}`,
    );
  }

  async resetPassword(req: Request, res: Response): Promise<void> {
    const { token, password } = req.body as { token: string; password: string };

    if (!token || !password) {
      res.status(400).json({
        success: false,
        error: "Token and new password are required",
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
      return;
    }

    const db = getDb();
    const user = db
      .prepare(
        "SELECT id, reset_token_expires_at FROM users WHERE reset_token = ?",
      )
      .get(token) as
      | { id: string; reset_token_expires_at: string }
      | undefined;

    if (!user) {
      res.status(404).json({
        success: false,
        error: "Invalid or expired reset token",
      });
      return;
    }

    if (new Date(user.reset_token_expires_at) < new Date()) {
      res.status(400).json({
        success: false,
        error: "Reset token has expired",
      });
      return;
    }

    const passwordHash = await hashPassword(password);
    db.prepare(
      "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?",
    ).run(passwordHash, user.id);

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  }
}
