// Offline digest check for held-bundle.json — the proposed Praman
// reproduction boundary. Recomputes the canonical SHA-256 of the bundle
// after removing `evidenceHash`, and requires it to match both the pinned
// digest below and the bundle's embedded evidenceHash. Any byte change —
// including a changed gate decision — fails closed.
//
// Usage: node verify.mjs [path-to-bundle.json]
// Exit 0 on match, 1 on any mismatch or malformed input.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const PINNED_DIGEST =
  '0a532c32a6fb22a0f14c26f182c19085e0cfd24de3bb2414503de8a4b80bc427';

function normalize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const normalized = normalize(item);
      return normalized === undefined ? null : normalized;
    });
  }
  const out = Object.create(null);
  for (const key of Object.keys(value).sort()) {
    const normalized = normalize(value[key]);
    if (normalized !== undefined) out[key] = normalized;
  }
  return out;
}

function sha256CanonicalJson(value) {
  const normalized = normalize(value);
  return createHash('sha256')
    .update(JSON.stringify(normalized === undefined ? null : normalized))
    .digest('hex');
}

const path = process.argv[2] ?? new URL('./held-bundle.json', import.meta.url);
const bundle = JSON.parse(await readFile(path, 'utf8'));
if (typeof bundle !== 'object' || bundle === null || Array.isArray(bundle)) {
  console.error('FAIL: not a bundle object');
  process.exit(1);
}
const { evidenceHash, ...core } = bundle;
const recomputed = sha256CanonicalJson(core);

if (recomputed !== PINNED_DIGEST) {
  console.error(`FAIL: recomputed ${recomputed} does not match pinned ${PINNED_DIGEST}`);
  process.exit(1);
}
if (evidenceHash !== recomputed) {
  console.error(`FAIL: embedded evidenceHash ${evidenceHash} does not match recomputed`);
  process.exit(1);
}
if (bundle.gate?.decision !== 'deny' || bundle.gate?.reviewRequired !== true) {
  console.error('FAIL: bundle is not the expected held decision');
  process.exit(1);
}
if (bundle.settlementTransfer !== undefined) {
  console.error('FAIL: bundle carries a transfer; the held reproduction must not');
  process.exit(1);
}
console.log(`OK: digest ${recomputed} matches pinned evidenceHash (held, no transfer)`);
