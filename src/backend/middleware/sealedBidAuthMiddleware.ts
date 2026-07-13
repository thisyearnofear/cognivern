import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";
import { getJwtSecret, type AuthPayload } from "./authMiddleware.js";

// Per-mode auth for sealed-bid WRITE routes.
//
// The sealed-bid endpoints stay in the public allowlist so the sandbox demo
// needs no login. But the two workspace modes are held to different bars:
//
//   - sandbox:    pass through. It is an explicit toy ledger with demo
//                 personas (Alice/Bob/Charlie) — nothing to protect. If a
//                 valid token happens to be present we still surface the
//                 identity, but never require it.
//   - production: require a verified wallet JWT. The controller then binds the
//                 acting identity to req.walletAddress instead of a
//                 client-supplied persona, closing the impersonation gap on
//                 the real ledger.
export async function sealedBidWriteAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const mode =
    (req.headers["x-workspace-mode"] as string)?.toLowerCase() || "sandbox";

  let payload: AuthPayload | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { payload: verified } = await jwtVerify(
        authHeader.slice(7),
        getJwtSecret(),
      );
      payload = verified as unknown as AuthPayload;
    } catch {
      payload = null;
    }
  }

  if (mode === "production" && !payload?.walletAddress) {
    res.status(401).json({
      success: false,
      error:
        "Sign in with your wallet to act on the production ledger. Switch to the sandbox to explore with demo personas.",
    });
    return;
  }

  if (payload) {
    req.userId = payload.sub;
    req.walletAddress = payload.walletAddress;
    req.workspaceId = payload.workspaceId;
  }

  next();
}
