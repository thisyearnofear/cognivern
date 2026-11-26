/**
 * signer-check — thin CLI over the real loadDedicatedSigner used by both
 * rails. Exists for the uid-isolation CI job: run it as the worker uid to
 * prove the key loads, and as the API uid to prove the open is denied.
 *
 *   tsx signer-check.ts --key /path/payer.json --expected-pubkey <base58>
 *
 * Prints only the derived public key on success — never key material.
 * Errors are prefixed `signer rejected:` by the loader; a permission denial
 * surfaces as an OS-level EACCES inside that message.
 */
import { loadDedicatedSigner } from './signer.js';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (!v) {
    console.error(`missing --${name}`);
    process.exit(1);
  }
  return v;
}

try {
  const signer = await loadDedicatedSigner(arg('key'), arg('expected-pubkey'));
  process.stdout.write(`${JSON.stringify({ ok: true, address: String(signer.address) })}\n`);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : 'signer load failed'}\n`);
  process.exit(2);
}
