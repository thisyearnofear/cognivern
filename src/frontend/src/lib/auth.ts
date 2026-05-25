import type { AuthUser, Workspace } from '@cognivern/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function generateSiweMessage(
  address: string,
  nonce: string,
  domain: string = typeof window !== 'undefined' ? window.location.host : 'localhost',
  uri: string = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
): string {
  return `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to Cognivern

URI: ${uri}
Version: 1
Chain ID: 1
Nonce: ${nonce}
Issued At: ${new Date().toISOString()}`;
}

export async function fetchNonce(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/nonce`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to fetch nonce');
  const { nonce } = await res.json();
  return nonce;
}

export async function verifySignature(
  message: string,
  signature: string,
  address: string,
): Promise<{ token: string; user: AuthUser; workspace: Workspace }> {
  const res = await fetch(`${API_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature, address }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Verification failed: ${err}`);
  }
  return res.json();
}
