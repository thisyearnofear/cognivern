import { createHash } from 'node:crypto';

function normalizeForJson(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = normalizeForJson(item);
      return normalized === undefined ? null : normalized;
    });
  }
  // null-prototype object keeps an own "__proto__" key from vanishing into
  // Object.prototype assignment; JSON.stringify serializes it normally.
  const out: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const normalized = normalizeForJson((value as Record<string, unknown>)[key]);
    if (normalized !== undefined) out[key] = normalized;
  }
  return out;
}

/** Deterministic JSON used for hashes embedded in Telegraph evidence. */
export function canonicalJson(value: unknown): string {
  const normalized = normalizeForJson(value);
  return JSON.stringify(normalized === undefined ? null : normalized);
}

export function sha256CanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

/**
 * Hash an artifact payload while excluding its embedded evidenceBundle. The
 * bundle may reference this hash without making the artifact hash recursive.
 */
export function telegraphArtifactDataHash(data: unknown): string {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return sha256CanonicalJson(data);
  }
  const { evidenceBundle: _evidenceBundle, ...core } = data as Record<string, unknown>;
  return sha256CanonicalJson(core);
}
