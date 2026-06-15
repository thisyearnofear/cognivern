import { useAccount } from "wagmi";
import type { AuthUser, Workspace } from "@cognivern/shared";

const API_URL = "";

export function generateSiweMessage(
  address: string,
  nonce: string,
  options: {
    domain?: string;
    uri?: string;
    chainId?: number;
  } = {}
): string {
  const domain =
    options.domain ??
    (typeof window !== "undefined" ? window.location.host : "localhost");
  const uri =
    options.uri ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3000");
  // The EIP-4361 spec requires the chain id to match the chain the
  // signature was produced on. Reading it from the active wagmi
  // connection avoids a hardcoded Chain ID: 1 which previously caused
  // backend verification to reject signatures from Arbitrum/Base users.
  const chainId = options.chainId ?? 1;

  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Cognivern

URI: ${uri}
Version: 1
Chain ID: ${chainId}
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
}

/**
 * Hook wrapper that produces a SIWE message with the active chain id.
 * Use this from React components; the bare `generateSiweMessage` is
 * exported for tests and non-component code paths.
 */
export function useSiweMessageFactory() {
  const { chainId } = useAccount();
  return (address: string, nonce: string) =>
    generateSiweMessage(address, nonce, {
      chainId: typeof chainId === "number" ? chainId : 1,
    });
}

export async function fetchNonce(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/nonce`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to fetch nonce");
  const { nonce } = await res.json();
  return nonce;
}

export async function refreshToken(
  currentToken: string
): Promise<{ token: string; user: AuthUser; workspace: Workspace }> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${currentToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json();
}

export async function verifySignature(
  message: string,
  signature: string,
  address: string
): Promise<{ token: string; user: AuthUser; workspace: Workspace }> {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature, address }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Verification failed: ${err}`);
  }
  return res.json();
}
