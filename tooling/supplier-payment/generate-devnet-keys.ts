/**
 * Generate dedicated, unfunded devnet-only keypairs for the supplier rail.
 * Writes 64-byte secret arrays (ed25519 seed || pubkey) under
 * ~/.config/cognivern-supplier-devnet/ with dir 0700 / file 0600, atomic
 * no-clobber, no symlink, and prints ONLY the public keys — secret material
 * is never logged.
 *
 *   pnpm exec tsx tooling/supplier-payment/generate-devnet-keys.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createKeyPairSignerFromPrivateKeyBytes } from '@solana/kit';
import { base58 } from '@scure/base';
import { randomBytes } from 'node:crypto';
import { loadDedicatedSigner } from './signer.js';

const dir = path.join(os.homedir(), '.config', 'cognivern-supplier-devnet');
const link0 = fs.lstatSync(dir, { throwIfNoEntry: false });
if (link0?.isSymbolicLink()) throw new Error(`${dir} must not be a symlink`);
if (link0 && !link0.isDirectory()) throw new Error(`${dir} exists and is not a directory`);
if (link0 && (link0.mode & 0o077) !== 0) throw new Error(`${dir} must be mode 0700 — fix or remove`);
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.chmodSync(dir, 0o700);

for (const name of ['payer', 'payee']) {
  const file = path.join(dir, `${name}.json`);
  const link = fs.lstatSync(file, { throwIfNoEntry: false });
  if (link?.isSymbolicLink()) throw new Error(`${file} is a symlink — refusing`);
  if (link) {
    // Reuse goes through the same validated loader: the expected public key
    // is derived from the file's own public half (bytes 32..63), then the
    // loader re-verifies permissions, ownership, bytes and the match.
    const bytes = new Uint8Array(JSON.parse(fs.readFileSync(file, 'utf8')));
    const expected = base58.encode(bytes.slice(32, 64));
    const signer = await loadDedicatedSigner(file, expected);
    console.log(`${name}: exists — keeping. publicKey=${signer.address}`);
    continue;
  }
  // 32-byte ed25519 seed -> kit derives the pair; the on-disk 64-byte
  // secret is seed || pubkey, same layout as solana-keygen files.
  const seed = new Uint8Array(randomBytes(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const secret = new Uint8Array(64);
  secret.set(seed, 0);
  secret.set(base58.decode(signer.address), 32);
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(Array.from(secret)));
  } finally {
    fs.closeSync(fd);
  }
  fs.chmodSync(file, 0o600);
  console.log(`${name}: created ${file} publicKey=${signer.address}`);
}
