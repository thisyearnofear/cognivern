/**
 * Browser-side mirror of the backend's sealed-bid event hashing
 * (src/backend/cre/workflows/sealedBidGovernance.ts). Kept dependency-free —
 * no `@/` imports — so the root-level parity test can import it directly and
 * assert both implementations agree byte-for-byte.
 */

/**
 * Deterministic JSON serialization: objects are recursively key-sorted,
 * undefined entries are dropped, arrays retain their original order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en-US"))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

/**
 * Recompute a governance event's hash in the browser:
 * SHA-256 over `${runId}|${eventType}|${timestamp}|${canonicalJson(payload)}`,
 * lowercase hex.
 */
export async function hashSealedBidEvent(params: {
  runId: string;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const material = [
    params.runId,
    params.eventType,
    params.timestamp,
    canonicalJson(params.payload),
  ].join("|");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
