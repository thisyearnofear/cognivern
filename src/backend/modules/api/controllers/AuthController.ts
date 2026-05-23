import { Request, Response } from "express";
import { SiweMessage, generateNonce } from "siwe";
import { SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import type { AuthUser, Workspace } from "@cognivern/shared";
import { setWorkspaceTier } from "../../../middleware/workspaceMiddleware.js";

interface StoredNonce {
  nonce: string;
  expiresAt: number;
}

const nonceStore = new Map<string, StoredNonce>();
const userStore = new Map<string, AuthUser>();
const workspaceStore = new Map<string, Workspace>();

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "cognivern-dev-jwt-secret-change-in-production"
);

function getJwtSecret(): Uint8Array {
  return JWT_SECRET;
}

export class AuthController {
  async getNonce(req: Request, res: Response): Promise<void> {
    const nonce = generateNonce();
    nonceStore.set(nonce, {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });
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

    const stored = nonceStore.get(siweMessage.nonce);
    if (!stored || stored.expiresAt < Date.now()) {
      nonceStore.delete(siweMessage.nonce);
      res.status(401).json({
        success: false,
        error: "Nonce expired or invalid. Please request a new one.",
      });
      return;
    }

    nonceStore.delete(siweMessage.nonce);

    try {
      const result = await siweMessage.verify({ signature });

      if (!result.success) {
        res.status(401).json({
          success: false,
          error: "Signature verification failed",
        });
        return;
      }
    } catch {
      res.status(401).json({
        success: false,
        error: "Signature verification failed",
      });
      return;
    }

    const normalizedAddress = address.toLowerCase();
    let user = userStore.get(normalizedAddress);

    if (!user) {
      user = {
        id: randomUUID(),
        walletAddress: normalizedAddress,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      userStore.set(normalizedAddress, user);

      const workspace: Workspace = {
        id: randomUUID(),
        name: `${address.slice(0, 6)}...${address.slice(-4)}'s Workspace`,
        ownerId: user.id,
        tier: "demo",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      workspaceStore.set(workspace.id, workspace);
      setWorkspaceTier(workspace.id, "demo");
    } else {
      user.lastLoginAt = new Date().toISOString();
      userStore.set(normalizedAddress, user);
    }

    const workspace = Array.from(workspaceStore.values()).find(
      (w) => w.ownerId === user.id
    );

    if (!workspace) {
      res.status(500).json({
        success: false,
        error: "No workspace found for user",
      });
      return;
    }

    const token = await new SignJWT({
      sub: user.id,
      walletAddress: user.walletAddress,
      workspaceId: workspace.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(getJwtSecret());

    res.json({
      token,
      user,
      workspace,
    });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const userId = (req as any).userId;
    const workspaceId = (req as any).workspaceId;

    if (!userId || !workspaceId) {
      res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
      return;
    }

    const user = Array.from(userStore.values()).find((u) => u.id === userId);
    const workspace = workspaceStore.get(workspaceId);

    if (!user || !workspace) {
      res.status(404).json({
        success: false,
        error: "User or workspace not found",
      });
      return;
    }

    res.json({
      user,
      workspace,
    });
  }
}
