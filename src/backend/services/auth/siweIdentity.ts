/**
 * SIWE identity binding — the signed message is the only identity source.
 *
 * Callers may still send a separate `address` body field for client
 * convenience, but it must canonically match `siweMessage.address` or
 * the login is rejected. Domain, URI, chain, and issued-at are validated
 * against server-side allowlists so a signature from another origin or
 * chain cannot be replayed here.
 */

export const SIWE_MAX_AGE_MS = 10 * 60 * 1000;
export const SIWE_FUTURE_SKEW_MS = 60 * 1000;

export const SIWE_ALLOWED_CHAIN_IDS: ReadonlySet<number> = new Set([
  1, 8453, 84532, 10, 42161, 421614, 11155111,
]);

export interface SiweBindingFields {
  address: string;
  domain: string;
  uri: string;
  chainId?: number;
  issuedAt?: string;
  expirationTime?: string;
}

export function canonicalAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function addressesEqual(a: string, b: string): boolean {
  return canonicalAddress(a) === canonicalAddress(b);
}

/**
 * Identity after a successful signature check. Uses the address inside
 * the verified SIWE message. If a body address is supplied, it must match.
 */
export function resolveAuthenticatedAddress(
  siweAddress: string,
  bodyAddress?: string,
): string {
  if (!siweAddress) {
    throw new Error("SIWE message is missing an address");
  }
  const signed = canonicalAddress(siweAddress);
  if (bodyAddress && !addressesEqual(signed, bodyAddress)) {
    throw new Error("Signed address does not match the supplied address");
  }
  return signed;
}

export interface AllowedSiweOrigin {
  domain: string;
  origin: string;
}

export function getAllowedSiweOrigins(
  env: NodeJS.ProcessEnv = process.env,
): AllowedSiweOrigin[] {
  const origins = new Set<string>();
  const cors = env.CORS_ORIGIN || "http://localhost:3000";
  for (const part of cors.split(",")) {
    const trimmed = part.trim();
    if (trimmed) origins.add(trimmed.replace(/\/$/, ""));
  }
  const extraDomains = env.SIWE_ALLOWED_DOMAINS || "";
  for (const part of extraDomains.split(",")) {
    const host = part.trim();
    if (!host) continue;
    origins.add(`https://${host}`);
    if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
      origins.add(`http://${host}`);
    }
  }

  const allowed: AllowedSiweOrigin[] = [];
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      allowed.push({ domain: url.host, origin: url.origin });
    } catch {
      // Ignore malformed origin entries.
    }
  }
  return allowed;
}

export function validateSiweBindings(
  message: SiweBindingFields,
  nowMs: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env,
): void {
  const allowed = getAllowedSiweOrigins(env);
  if (allowed.length === 0) {
    throw new Error("No SIWE origins are configured");
  }

  const domainOk = allowed.some(
    (entry) => entry.domain.toLowerCase() === message.domain.toLowerCase(),
  );
  if (!domainOk) {
    throw new Error("SIWE domain is not allowed");
  }

  const uriOk = allowed.some((entry) => {
    const uri = message.uri;
    return uri === entry.origin || uri.startsWith(`${entry.origin}/`);
  });
  if (!uriOk) {
    throw new Error("SIWE URI is not allowed");
  }

  const chainId = message.chainId;
  if (typeof chainId !== "number" || !SIWE_ALLOWED_CHAIN_IDS.has(chainId)) {
    throw new Error("SIWE chain id is not allowed");
  }

  if (!message.issuedAt) {
    throw new Error("SIWE issued-at is required");
  }
  const issuedAt = Date.parse(message.issuedAt);
  if (Number.isNaN(issuedAt)) {
    throw new Error("SIWE issued-at is invalid");
  }
  if (issuedAt - nowMs > SIWE_FUTURE_SKEW_MS) {
    throw new Error("SIWE issued-at is in the future");
  }
  if (nowMs - issuedAt > SIWE_MAX_AGE_MS) {
    throw new Error("SIWE message has expired");
  }

  if (message.expirationTime) {
    const expiresAt = Date.parse(message.expirationTime);
    if (Number.isNaN(expiresAt) || expiresAt <= nowMs) {
      throw new Error("SIWE message has expired");
    }
  }
}
