/**
 * Dedicated signer loading for the supplier payment rail. Only explicitly
 * supplied key material is ever used — no env vars, no default wallet paths,
 * no shared singletons. The key file must be a regular file owned by this
 * process user, mode exactly 0600, inside a directory owned by this user
 * with mode exactly 0700; neither may be a symlink (the file is opened
 * O_RDONLY|O_NOFOLLOW and read from that same fd).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createKeyPairSignerFromBytes, type TransactionSigner } from '@solana/kit';

function fail(message: string): never {
  throw new Error(`signer rejected: ${message}`);
}

export async function loadDedicatedSigner(
  keyPath: string,
  expectedPublicKey: string,
): Promise<TransactionSigner> {
  if (!expectedPublicKey || typeof expectedPublicKey !== 'string') {
    fail('a pinned expected public key is required');
  }
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;

  const dir = path.dirname(keyPath);
  const dirStat = fs.lstatSync(dir, { throwIfNoEntry: false });
  if (!dirStat?.isDirectory()) fail('signer directory missing');
  if (dirStat.isSymbolicLink()) fail('signer directory must not be a symlink');
  if ((dirStat.mode & 0o777) !== 0o700) fail('signer directory must be mode 0700');
  if (uid !== undefined && dirStat.uid !== uid) {
    fail('signer directory is not owned by this user');
  }

  // Pre-check for a readable error; O_NOFOLLOW below is the real guard.
  const linkStat = fs.lstatSync(keyPath, { throwIfNoEntry: false });
  if (!linkStat) fail('key file missing');
  if (linkStat.isSymbolicLink()) fail('key file must not be a symlink');
  const fd = fs.openSync(
    keyPath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0),
  );
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile()) fail('key file is not a regular file');
    if ((stat.mode & 0o777) !== 0o600) fail('key file must be mode 0600');
    if (uid !== undefined && stat.uid !== uid) fail('key file is not owned by this user');
    const raw = fs.readFileSync(fd, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fail('key file is not a JSON secret array');
    }
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 64 ||
      !parsed.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)
    ) {
      fail('key file is not a 64-byte JSON secret array');
    }
    const signer = await createKeyPairSignerFromBytes(new Uint8Array(parsed));
    if (signer.address !== expectedPublicKey) {
      fail('key file public key does not match the pinned payer');
    }
    return signer;
  } finally {
    fs.closeSync(fd);
  }
}
