export interface JwtPayload {
  exp?: number;
  [key: string]: unknown;
}

/** Decode a JWT payload without treating base64url as standard base64. */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function jwtSecondsRemaining(token: string, now = Date.now()): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  if (typeof exp !== "number") return null;
  return exp - Math.floor(now / 1000);
}
