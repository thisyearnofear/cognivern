import { Request, Response } from "express";
import { SiweMessage, generateNonce } from "siwe";
import { SignJWT, decodeJwt, compactVerify } from "jose";
import { randomUUID } from "node:crypto";
import { createHash, randomBytes } from "node:crypto";
import {
  createPublicClient,
  http,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import {
  mainnet,
  base,
  baseSepolia,
  optimism,
  arbitrum,
  arbitrumSepolia,
  sepolia,
} from "viem/chains";
import type { AuthUser, Workspace } from "@cognivern/shared";
import { getDb } from "@backend/db/index.js";
import { WorkspaceDataService } from "@backend/services/WorkspaceDataService.js";
import {
  resolveAuthenticatedAddress,
  validateSiweBindings,
} from "@backend/services/auth/siweIdentity.js";

// Simple bcrypt-like hashing using scrypt (built into Node.js crypto)
async function hashPassword(password: string): Promise<string> {
  const { scryptSync, randomBytes } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Seed a default "Moderate Spend Policy" for a newly created workspace so
 * the governance check page works on the first click — without this, a
 * tester lands on an empty dashboard and the first governance evaluation
 * returns 503 NO_ACTIVE_POLICY.
 *
 * The template matches the onboarding wizard's "Moderate" preset so the
 * wizard and the seed are consistent. Testers can tighten or relax it
 * from the policies page.
 */
function seedDefaultWorkspaceData(workspaceId: string): void {
  try {
    WorkspaceDataService.createPolicy(workspaceId, {
      name: "[Sample] Default Spend Policy",
      type: "budget",
      description:
        "Sample policy created by Cognivern: deny single transactions over $1,000, flag daily totals over $500. Adjust, replace, or delete this from the Policies page.",
      rules: [
        { condition: "amount > 1000", action: "deny" },
        { condition: "daily_total > 500", action: "flag" },
      ],
    });
  } catch {
    // Seeding is best-effort — never block workspace creation.
  }
  // Also seed a default test agent so the governance check examples
  // ($50 approved, $500 held, $5,000 denied) work on the first click
  // without the tester needing to create an agent first.
  try {
    WorkspaceDataService.createAgent(workspaceId, {
      name: "[Sample] Test Agent",
      role: "general",
      chain: "base",
      budget: "$5,000",
      source: "sample",
    });
  } catch {
    // Best-effort — never block workspace creation.
  }
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

/** How long after `exp` a token may still be presented to /auth/refresh. */
const REFRESH_GRACE_MS = 24 * 60 * 60 * 1000;

function blacklistTtlMsFromToken(token: string): number {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp === "number") {
      // Keep the hash until JWT expiry (+1m skew), never shorter than 1 minute.
      return Math.max(exp * 1000 - Date.now() + 60_000, 60_000);
    }
  } catch {
    // fall through
  }
  // Unknown exp — cover the maximum issued lifetime.
  return 7 * 86_400_000;
}

async function verifyRefreshableToken(
  token: string,
): Promise<{ sub: string; workspaceId: string; walletAddress?: string } | null> {
  try {
    await compactVerify(token, JWT_SECRET);
    const payload = decodeJwt(token);
    if (typeof payload.sub !== "string" || typeof payload.workspaceId !== "string") {
      return null;
    }

    const now = Date.now();
    if (typeof payload.exp === "number") {
      const expMs = payload.exp * 1000;
      if (now > expMs + REFRESH_GRACE_MS) {
        return null;
      }
    } else if (typeof payload.iat === "number") {
      // No exp claim — bound by iat + 7d + grace.
      if (now > payload.iat * 1000 + 7 * 86_400_000 + REFRESH_GRACE_MS) {
        return null;
      }
    } else {
      return null;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { tokenBlacklistStore } = await import(
      "../../../shared/storage/TokenBlacklistStore.js"
    );
    if (await tokenBlacklistStore.isBlacklisted(tokenHash)) {
      return null;
    }

    return {
      sub: payload.sub,
      workspaceId: payload.workspaceId,
      walletAddress:
        typeof payload.walletAddress === "string"
          ? payload.walletAddress
          : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Chain config for viem public clients used during SIWE signature verification.
 * Coinbase Smart Wallet produces ERC-6492 wrapped signatures that require
 * an on-chain call to the Universal Signature Verifier. viem's
 * `publicClient.verifyMessage` handles this natively — unlike siwe@3's
 * `checkContractWalletSignature` which only handles plain EIP-1271.
 */
const CHAIN_CONFIG: Record<number, { chain: Chain; rpc: string }> = {
  1: { chain: mainnet, rpc: process.env.ETH_RPC_URL || "https://eth.drpc.org" },
  8453: { chain: base, rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org" },
  84532: { chain: baseSepolia, rpc: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org" },
  10: { chain: optimism, rpc: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io" },
  42161: { chain: arbitrum, rpc: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc" },
  421614: { chain: arbitrumSepolia, rpc: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc" },
  11155111: { chain: sepolia, rpc: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia.publicnode.com" },
};

const viemClientCache = new Map<number, PublicClient<Transport, Chain>>();

function getViemClient(chainId: number): PublicClient<Transport, Chain> | undefined {
  const cfg = CHAIN_CONFIG[chainId];
  if (!cfg) return undefined;
  let client = viemClientCache.get(chainId);
  if (!client) {
    client = createPublicClient({
      chain: cfg.chain,
      transport: http(cfg.rpc),
    }) as PublicClient<Transport, Chain>;
    viemClientCache.set(chainId, client);
  }
  return client;
}

/**
 * Verify a SIWE signature, supporting:
 *  - EOA signatures (standard ecrecover)
 *  - EIP-1271 contract wallet signatures (on-chain isValidSignature)
 *  - ERC-6492 wrapped signatures (Coinbase Smart Wallet / undeployed contracts)
 *
 * Strategy: try siwe's native verify first (fast path for EOAs). If it throws
 * due to an invalid signature length (ERC-6492 produces long ABI-encoded
 * payloads that ethers can't parse as r/s/v), fall back to viem's
 * `publicClient.verifyMessage` which handles all three cases via the
 * Universal Signature Verifier contract.
 */
async function verifySiweSignature(
  siweMessage: SiweMessage,
  signature: string,
): Promise<boolean> {
  // Fast path: standard EOA signature (65 bytes = 0x + 130 hex chars)
  if (signature.length === 132) {
    try {
      const result = await siweMessage.verify({ signature });
      if (result.success) return true;
    } catch {
      // Fall through to viem-based verification
    }
  }

  // Slow path: ERC-6492 / EIP-1271 via viem's on-chain verification.
  // This handles Coinbase Smart Wallet's Multicall3-wrapped passkey signatures,
  // Safe multisig signatures, and any other contract wallet.
  const chainId = siweMessage.chainId ?? 1;
  const client = getViemClient(chainId);
  if (!client) {
    // Unknown chain — can't verify on-chain. Try siwe as a last resort.
    try {
      const result = await siweMessage.verify({ signature });
      return result.success;
    } catch {
      return false;
    }
  }

  try {
    const messageText = siweMessage.prepareMessage();
    const valid = await client.verifyMessage({
      address: siweMessage.address as `0x${string}`,
      message: messageText,
      signature: signature as `0x${string}`,
    });
    return valid;
  } catch (err) {
    console.error("[SIWE] viem verifyMessage failed:", err);
    return false;
  }
}

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

    res.json({ nonce, expiresAt: new Date(expiresAt).toISOString() });
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

    try {
      validateSiweBindings(siweMessage);
    } catch (err) {
      res.status(401).json({
        success: false,
        error: err instanceof Error ? err.message : "Invalid SIWE message",
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
      // Supports EOA, EIP-1271 (contract wallets), and ERC-6492
      // (Coinbase Smart Wallet wrapped passkey signatures).
      const valid = await verifySiweSignature(siweMessage, signature);
      if (!valid) {
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

    let normalizedAddress: string;
    try {
      normalizedAddress = resolveAuthenticatedAddress(
        siweMessage.address,
        address,
      );
    } catch (err) {
      res.status(401).json({
        success: false,
        error: err instanceof Error ? err.message : "Address mismatch",
      });
      return;
    }
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
      const workspaceName = `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}'s Workspace`;

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

      // Seed a default policy so governance check works on first click.
      seedDefaultWorkspaceData(workspaceId);

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
      .setExpirationTime("7d")
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

  /**
   * Rotate a session JWT. Accepts a still-valid token OR a recently expired
   * one (signature + blacklist checked; expiry may have passed within the
   * refresh grace window). This matches the frontend contract of recovering
   * from a 401 by posting the rejected Bearer to /auth/refresh.
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const presented = authHeader.slice(7);
    const claims = await verifyRefreshableToken(presented);
    if (!claims) {
      res.status(401).json({
        success: false,
        error: "Token expired or invalid. Please sign in again.",
      });
      return;
    }

    const userId = claims.sub;
    const workspaceId = claims.workspaceId;

    const db = getDb();
    const user = db
      .prepare(
        "SELECT id, wallet_address, email, created_at, last_login_at FROM users WHERE id = ?",
      )
      .get(userId) as
      | {
          id: string;
          wallet_address: string | null;
          email: string | null;
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

    const authUser: AuthUser = {
      id: user.id,
      walletAddress: user.wallet_address ?? undefined,
      email: user.email ?? undefined,
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
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    // Rotate: revoke the presented token through its remaining lifetime so a
    // stolen copy cannot be refreshed again after this response.
    const presentedHash = createHash("sha256").update(presented).digest("hex");
    const { tokenBlacklistStore } = await import(
      "../../../shared/storage/TokenBlacklistStore.js"
    );
    await tokenBlacklistStore.blacklist(
      presentedHash,
      blacklistTtlMsFromToken(presented),
    );

    res.json({ token, user: authUser, workspace: authWorkspace });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const { tokenBlacklistStore } = await import(
        "../../../shared/storage/TokenBlacklistStore.js"
      );
      await tokenBlacklistStore.blacklist(
        tokenHash,
        blacklistTtlMsFromToken(token),
      );
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

    // Seed a default policy so governance check works on first click.
    seedDefaultWorkspaceData(workspaceId);

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
      .setExpirationTime("7d")
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

    // Deliver the token only over email. Never log reset or verification
    // credentials — they are bearer secrets.
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

  /**
   * Upgrade a demo-tier workspace to live. Called after the onboarding wizard
   * completes or when the user explicitly chooses "Set up my workspace".
   * Only the workspace owner can upgrade. Returns the updated workspace object
   * and a fresh JWT reflecting the new tier.
   */
  async upgradeWorkspace(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    const workspaceId = req.workspaceId;

    if (!userId || !workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
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

    if (!workspace) {
      res.status(404).json({ success: false, error: "Workspace not found" });
      return;
    }

    if (workspace.owner_id !== userId) {
      res
        .status(403)
        .json({ success: false, error: "Only the workspace owner can upgrade" });
      return;
    }

    if (workspace.tier === "live") {
      // Already upgraded — return current state with a fresh token.
      const user = db
        .prepare("SELECT wallet_address, email FROM users WHERE id = ?")
        .get(userId) as { wallet_address: string | null; email: string | null } | undefined;
      const token = await new SignJWT({
        sub: userId,
        ...(user?.wallet_address ? { walletAddress: user.wallet_address } : {}),
        ...(user?.email ? { email: user.email } : {}),
        workspaceId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(JWT_SECRET);

      res.json({
        success: true,
        data: {
          token,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            ownerId: workspace.owner_id,
            tier: "live" as const,
            createdAt: workspace.created_at,
            updatedAt: workspace.updated_at,
          },
        },
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE workspaces SET tier = 'live', updated_at = ? WHERE id = ?").run(
      now,
      workspaceId,
    );

    const updatedWorkspace: Workspace = {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      tier: "live",
      createdAt: workspace.created_at,
      updatedAt: now,
    };

    // Issue a fresh token so the frontend can store the updated tier
    const user = db
      .prepare("SELECT wallet_address, email FROM users WHERE id = ?")
      .get(userId) as { wallet_address: string | null; email: string | null } | undefined;

    const token = await new SignJWT({
      sub: userId,
      ...(user?.wallet_address ? { walletAddress: user.wallet_address } : {}),
      ...(user?.email ? { email: user.email } : {}),
      workspaceId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    res.json({ success: true, data: { token, workspace: updatedWorkspace } });
  }

  /**
   * Downgrade a live workspace back to demo (sandbox). Mirror of
   * `upgradeWorkspace` — owner-gated, idempotent, returns a fresh JWT.
   * Used by the "Back to Sandbox" switch in the frontend.
   */
  async downgradeWorkspace(req: Request, res: Response): Promise<void> {
    const userId = req.userId;
    const workspaceId = req.workspaceId;

    if (!userId || !workspaceId) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const db = getDb();
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

    if (!workspace) {
      res.status(404).json({ success: false, error: "Workspace not found" });
      return;
    }

    if (workspace.owner_id !== userId) {
      res
        .status(403)
        .json({ success: false, error: "Only the workspace owner can change the tier" });
      return;
    }

    if (workspace.tier === "demo") {
      // Already demo — return current state with a fresh token.
      const user = db
        .prepare("SELECT wallet_address, email FROM users WHERE id = ?")
        .get(userId) as { wallet_address: string | null; email: string | null } | undefined;
      const token = await new SignJWT({
        sub: userId,
        ...(user?.wallet_address ? { walletAddress: user.wallet_address } : {}),
        ...(user?.email ? { email: user.email } : {}),
        workspaceId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(JWT_SECRET);

      res.json({
        success: true,
        data: {
          token,
          workspace: {
            id: workspace.id,
            name: workspace.name,
            ownerId: workspace.owner_id,
            tier: "demo" as const,
            createdAt: workspace.created_at,
            updatedAt: workspace.updated_at,
          },
        },
      });
      return;
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE workspaces SET tier = 'demo', updated_at = ? WHERE id = ?").run(
      now,
      workspaceId,
    );

    const updatedWorkspace: Workspace = {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.owner_id,
      tier: "demo",
      createdAt: workspace.created_at,
      updatedAt: now,
    };

    const user = db
      .prepare("SELECT wallet_address, email FROM users WHERE id = ?")
      .get(userId) as { wallet_address: string | null; email: string | null } | undefined;

    const token = await new SignJWT({
      sub: userId,
      ...(user?.wallet_address ? { walletAddress: user.wallet_address } : {}),
      ...(user?.email ? { email: user.email } : {}),
      workspaceId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET);

    res.json({ success: true, data: { token, workspace: updatedWorkspace } });
  }
}
