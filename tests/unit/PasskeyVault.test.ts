import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

let vaultDir: string;

beforeEach(() => {
  vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ows-vault-test-'));
  process.env.OWS_VAULT_PATH = path.join(vaultDir, 'vault.json');
});

afterEach(() => {
  delete process.env.OWS_VAULT_PATH;
  fs.rmSync(vaultDir, { recursive: true, force: true });
});

async function makeVault() {
  const { OwsLocalVaultService } = await import(
    '../../src/backend/services/blockchain/OwsLocalVaultService.js'
  );
  return new OwsLocalVaultService();
}

describe('PasskeyVault key root lifecycle', () => {
  it('enrolls, derives deterministically, locks, and re-unlocks', async () => {
    const vault = await makeVault();

    expect(vault.keyRootStatus()).toMatchObject({
      enrolled: false,
      locked: true,
      derivedKeyCount: 0,
    });

    const begin = vault.enrollKeyRootBegin();
    expect('root' in begin).toBe(true);
    if (!('root' in begin)) return;
    const rootBytes = Buffer.from(begin.root, 'base64');
    expect(rootBytes.length).toBe(32);

    // Client wraps root in a mera secret vault; here any JSON stands in.
    const wrapped = { version: 1, credential: { credentialId: 'cred-1' }, ciphertext: 'AA==' };
    const commit = vault.enrollKeyRootCommit(wrapped);
    expect('verifier' in commit).toBe(true);

    const status = vault.keyRootStatus();
    expect(status.enrolled).toBe(true);
    expect(status.locked).toBe(false);

    // Derive is deterministic per context.
    const k1 = await vault.deriveAgentKey({ agentId: 'agent-1', mandateId: 'm-1' });
    const k1again = await vault.deriveAgentKey({ agentId: 'agent-1', mandateId: 'm-1' });
    const k2 = await vault.deriveAgentKey({ agentId: 'agent-1', mandateId: 'm-2' });
    expect('error' in k1).toBe(false);
    if ('error' in k1 || 'error' in k1again || 'error' in k2) return;
    expect(k1again.address).toBe(k1.address);
    expect(k1again.walletId).toBe(k1.walletId);
    expect(k2.address).not.toBe(k1.address);
    expect(vault.keyRootStatus().derivedKeyCount).toBe(2);

    // Lock drops the hot root; derivation fails closed.
    vault.lockKeyRoot();
    expect(vault.keyRootStatus().locked).toBe(true);
    const locked = await vault.deriveAgentKey({ agentId: 'agent-1' });
    expect('error' in locked).toBe(true);

    // Unlock roundtrip: begin returns the wrapped blob; commit verifies.
    const ub = vault.unlockKeyRootBegin();
    expect('vault' in ub).toBe(true);
    const wrong = vault.unlockKeyRootCommit(
      crypto.randomBytes(32).toString('base64'),
    );
    expect('error' in wrong).toBe(true);
    const ok = vault.unlockKeyRootCommit(begin.root);
    expect('error' in ok).toBe(false);

    // Same root → same derived addresses after re-unlock.
    const k1re = await vault.deriveAgentKey({ agentId: 'agent-1', mandateId: 'm-1' });
    if ('error' in k1re) return;
    expect(k1re.address).toBe(k1.address);
    expect(k1re.walletId).toBe(k1.walletId);
  });

  it('refuses double enrollment and commits without begin', async () => {
    const vault = await makeVault();
    const begin = vault.enrollKeyRootBegin();
    if (!('root' in begin)) return;
    vault.enrollKeyRootCommit({ ciphertext: 'AA==' });

    const again = vault.enrollKeyRootBegin();
    expect('error' in again).toBe(true);

    const vault2 = await makeVault();
    const orphanCommit = vault2.enrollKeyRootCommit({ ciphertext: 'AA==' });
    expect('error' in orphanCommit).toBe(true);
  });

  it('unlock fails when nothing is enrolled', async () => {
    const vault = await makeVault();
    const ub = vault.unlockKeyRootBegin();
    expect('error' in ub).toBe(true);
    const uc = vault.unlockKeyRootCommit(crypto.randomBytes(32).toString('base64'));
    expect('error' in uc).toBe(true);
  });

  it('listDerivedKeys exposes addresses and contexts, never key material', async () => {
    const vault = await makeVault();
    vault.enrollKeyRootBegin();
    vault.enrollKeyRootCommit({ ciphertext: 'AA==' });
    await vault.deriveAgentKey({ agentId: 'agent-9', mandateId: 'm-9' });

    const keys = vault.listDerivedKeys();
    expect(keys.length).toBe(1);
    expect(keys[0].context).toBe('agent:agent-9:mandate:m-9');
    expect(keys[0].address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(JSON.stringify(keys)).not.toMatch(/privateKey|0x[0-9a-fA-F]{64}/);
  });
});
