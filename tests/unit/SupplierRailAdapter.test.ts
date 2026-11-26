import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { base58 } from '@scure/base';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { loadDedicatedSigner } from '../../tooling/supplier-payment/signer.js';
import { SupplierJournal } from '../../tooling/supplier-payment/journal.js';
import { verifyTransferOnChain } from '../../tooling/supplier-payment/receipt.js';
import { createLocalSupplierRail } from '../../tooling/supplier-payment/rail.js';
import * as kit from '@solana/kit';
const { createKeyPairSignerFromPrivateKeyBytes } = kit;

// Swap createSolanaRpc for a controllable fake only where a test installs
// one — every other call site keeps the real implementation.
const mocks = vi.hoisted(() => ({ fakeRpc: null as null | Record<string, unknown> }));
vi.mock('@solana/kit', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@solana/kit')>();
  return {
    ...orig,
    createSolanaRpc: ((endpoint: string) =>
      mocks.fakeRpc ?? orig.createSolanaRpc(endpoint as never)) as never,
  };
});

const tmpDirs: string[] = [];
function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-rail-'));
  fs.chmodSync(dir, 0o700);
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

async function writeKeypair(dir: string, name = 'payer.json') {
  // 32-byte ed25519 seed -> kit derives the pair; the on-disk 64-byte
  // secret is seed || pubkey, same layout as solana-keygen files.
  const seed = new Uint8Array(randomBytes(32));
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const secret = new Uint8Array(64);
  secret.set(seed, 0);
  secret.set(base58.decode(signer.address), 32);
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(Array.from(secret)), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return { file, signer };
}

const PAYER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpThe9UPq5aR';
const PAYEE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const SOURCE = 'SourceAta1111111111111111111111111111111';
const DEST = 'DestAta111111111111111111111111111111111';
const SIG = 'sig-fixed';

const expected = {
  payer: PAYER,
  payee: PAYEE,
  mint: MINT,
  amountBaseUnits: '10000',
  sourceAta: SOURCE,
  destAta: DEST,
  intentId: 'intent-1',
  cluster: 'localnet',
};

function goodParsedTx() {
  return {
    meta: {
      err: null,
      preTokenBalances: [
        {
          accountIndex: 2,
          mint: MINT,
          owner: PAYER,
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          uiTokenAmount: { amount: '50000', decimals: 6 },
        },
      ],
      postTokenBalances: [
        {
          accountIndex: 2,
          mint: MINT,
          owner: PAYER,
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          uiTokenAmount: { amount: '40000', decimals: 6 },
        },
        {
          accountIndex: 3,
          mint: MINT,
          owner: PAYEE,
          programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          uiTokenAmount: { amount: '10000', decimals: 6 },
        },
      ],
    },
    transaction: {
      signatures: [SIG],
      message: {
        accountKeys: [
          { pubkey: PAYER, signer: true },
          { pubkey: PAYEE },
          { pubkey: SOURCE },
          { pubkey: DEST },
        ],
        instructions: [
          {
            programId: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
            parsed: {
              type: 'createIdempotent',
              info: {
                source: PAYER,
                wallet: PAYEE,
                mint: MINT,
                account: DEST,
              },
            },
          },
          {
            programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            parsed: {
              type: 'transferChecked',
              info: {
                source: SOURCE,
                destination: DEST,
                mint: MINT,
                authority: PAYER,
                tokenAmount: { amount: '10000', decimals: 6 },
              },
            },
          },
        ],
      },
    },
  };
}

function fakeRpc(opts: { status?: Record<string, unknown> | null; tx?: unknown } = {}) {
  const status = 'status' in opts ? opts.status : { confirmationStatus: 'confirmed', err: null };
  return {
    getSignatureStatuses: () => ({ send: async () => ({ value: [status] }) }),
    getTransaction: () => ({ send: async () => (opts.tx === undefined ? goodParsedTx() : opts.tx) }),
  } as never;
}

describe('loadDedicatedSigner', () => {
  it('loads a mode-0600 key file inside a mode-0700 directory', async () => {
    const dir = tmpDir();
    const { file, signer } = await writeKeypair(dir);
    const loaded = await loadDedicatedSigner(file, signer.address);
    expect(loaded.address).toBe(signer.address);
  });

  it('rejects a symlink, loose permissions, and a mismatched public key', async () => {
    const dir = tmpDir();
    const { file, signer } = await writeKeypair(dir);
    const link = path.join(dir, 'link.json');
    fs.symlinkSync(file, link);
    await expect(loadDedicatedSigner(link, signer.address)).rejects.toThrow(/symlink/);

    fs.chmodSync(file, 0o644);
    await expect(loadDedicatedSigner(file, signer.address)).rejects.toThrow(/0600/);
    fs.chmodSync(file, 0o600);
    fs.chmodSync(dir, 0o755);
    await expect(loadDedicatedSigner(file, signer.address)).rejects.toThrow(/0700/);
    fs.chmodSync(dir, 0o700);

    await expect(loadDedicatedSigner(file, PAYEE)).rejects.toThrow(/public key/);
    await expect(loadDedicatedSigner(path.join(dir, 'missing.json'), signer.address)).rejects.toThrow(/missing/);
    // The pinned expected key is mandatory — never optional.
    await expect(
      loadDedicatedSigner(file, undefined as unknown as string),
    ).rejects.toThrow(/expected public key/);
    expect(signer.address).not.toBe(PAYEE);
  });
});

const BINDING = 'b'.repeat(64);

describe('SupplierJournal', () => {
  it('claims once, conflicts on different terms and on a second intent', () => {
    const journal = new SupplierJournal(path.join(tmpDir(), 'j.db'), BINDING);
    const base = {
      intentId: 'i1',
      proposalHash: 'a'.repeat(64),
      payer: PAYER,
      payee: PAYEE,
      mint: MINT,
      amountBaseUnits: '10000',
    };
    expect(journal.claim(base).status).toBe('claimed');
    expect(journal.claim(base)).toMatchObject({
      status: 'conflict',
      reason: 'intent already claimed',
    });
    expect(journal.claim({ ...base, proposalHash: 'b'.repeat(64) })).toMatchObject({
      status: 'conflict',
      reason: 'intent bound to different terms',
    });
    expect(journal.claim({ ...base, intentId: 'i2' })).toMatchObject({
      status: 'conflict',
      reason: expect.stringContaining('lifetime cap'),
    });
    journal.close();
  });

  it('commits the signature before broadcast and rejects a different one', () => {
    const journal = new SupplierJournal(path.join(tmpDir(), 'j.db'), BINDING);
    const base = {
      intentId: 'i1',
      proposalHash: 'a'.repeat(64),
      payer: PAYER,
      payee: PAYEE,
      mint: MINT,
      amountBaseUnits: '10000',
    };
    journal.claim(base);
    journal.recordSigned({
      intentId: 'i1',
      proposalHash: base.proposalHash,
      signature: SIG,
      sourceAta: SOURCE,
      destAta: DEST,
    });
    expect(() =>
      journal.recordSigned({
        intentId: 'i1',
        proposalHash: base.proposalHash,
        signature: 'other-sig',
        sourceAta: SOURCE,
        destAta: DEST,
      }),
    ).toThrow(/different signature/);
    journal.close();
  });

  it('refuses a journal bound to a different deployment or predating binding', () => {
    const dir = tmpDir();
    const file = path.join(dir, 'j.db');
    const journal = new SupplierJournal(file, BINDING);
    journal.claim({
      intentId: 'i1',
      proposalHash: 'a'.repeat(64),
      payer: PAYER,
      payee: PAYEE,
      mint: MINT,
      amountBaseUnits: '10000',
    });
    journal.close();
    expect(() => new SupplierJournal(file, 'c'.repeat(64))).toThrow(
      /different deployment/,
    );
    // Reopening under the same binding is fine.
    new SupplierJournal(file, BINDING).close();

    // A legacy journal with rows but no binding stamp fails closed.
    const legacyDir = tmpDir();
    const legacyFile = path.join(legacyDir, 'legacy.db');
    const seed = new SupplierJournal(legacyFile, BINDING);
    seed.claim({
      intentId: 'i1',
      proposalHash: 'a'.repeat(64),
      payer: PAYER,
      payee: PAYEE,
      mint: MINT,
      amountBaseUnits: '10000',
    });
    seed.close();
    const raw = new Database(legacyFile);
    raw.prepare("DELETE FROM journal_meta WHERE key = 'binding_hash'").run();
    raw.close();
    expect(() => new SupplierJournal(legacyFile, BINDING)).toThrow(
      /predates deployment binding/,
    );
  });

  it('rejects in-memory, relative, symlink and world-readable journal paths', () => {
    expect(() => new SupplierJournal(':memory:', BINDING)).toThrow(/real absolute file/);
    expect(() => new SupplierJournal('journal.db', BINDING)).toThrow(/real absolute file/);
    const dir = tmpDir();
    fs.chmodSync(dir, 0o755);
    expect(() => new SupplierJournal(path.join(dir, 'j.db'), BINDING)).toThrow(/0700/);
    fs.chmodSync(dir, 0o700);
    const link = path.join(tmpDir(), 'link.db');
    fs.symlinkSync(path.join(dir, 'j.db'), link);
    expect(() => new SupplierJournal(link, BINDING)).toThrow(/symlink/);
  });
});

describe('verifyTransferOnChain', () => {
  it('confirms a fully matching transaction', async () => {
    const check = await verifyTransferOnChain(fakeRpc(), SIG, expected);
    expect(check).toMatchObject({ status: 'confirmed' });
    if (check.status === 'confirmed' || check.status === 'finalized') {
      expect(check.receipt).toMatchObject({
        payer: PAYER,
        payee: PAYEE,
        mint: MINT,
        amountBaseUnits: '10000',
        intentId: 'intent-1',
        signature: SIG,
      });
    }
  });

  it('stays pending on an unknown signature or unconfirmed status', async () => {
    expect(await verifyTransferOnChain(fakeRpc({ status: null }), SIG, expected)).toMatchObject({
      status: 'pending',
    });
    expect(
      await verifyTransferOnChain(
        fakeRpc({ status: { confirmationStatus: 'processed', err: null } }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'pending' });
    expect(await verifyTransferOnChain(fakeRpc({ tx: null }), SIG, expected)).toMatchObject({
      status: 'pending',
    });
  });

  it('rejects a failed transaction and every mutated proposal field', async () => {
    expect(
      await verifyTransferOnChain(
        fakeRpc({ status: { confirmationStatus: 'confirmed', err: { InstructionError: [] } } }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });

    const mutate = (fn: (tx: ReturnType<typeof goodParsedTx>) => void) => {
      const tx = goodParsedTx();
      fn(tx);
      return fakeRpc({ tx });
    };
    // Wrong mint on the transfer.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.transaction.message.instructions[1].parsed.info as Record<string, unknown>).mint =
            'So11111111111111111111111111111111111111112';
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Wrong destination.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.transaction.message.instructions[1].parsed.info as Record<string, unknown>).destination =
            'Other11111111111111111111111111111111111111';
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Wrong amount.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.transaction.message.instructions[1].parsed.info as Record<string, unknown>)
            .tokenAmount = { amount: '20000', decimals: 6 };
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Wrong fee payer.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.transaction.message.accountKeys[0] as Record<string, unknown>).pubkey = PAYEE;
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Extra instruction.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.transaction.message.instructions.push(tx.transaction.message.instructions[1]);
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Balance deltas that do not match.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.meta.postTokenBalances[1].uiTokenAmount.amount = '5000';
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
  });

  it('rejects identity/signature and signer-shape mismatches', async () => {
    const mutate = (fn: (tx: ReturnType<typeof goodParsedTx>) => void) => {
      const tx = goodParsedTx();
      fn(tx);
      return fakeRpc({ tx });
    };
    // Returned transaction is not the asked-for signature.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.transaction.signatures = ['some-other-signature'];
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // A second signer anywhere in the key list.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.transaction.message.accountKeys[1] as Record<string, unknown>).signer = true;
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // First account is the fee payer but not flagged signer.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.transaction.message.accountKeys[0] as Record<string, unknown>).signer = false;
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
  });

  it('rejects incomplete or malformed token balance rows', async () => {
    const mutate = (fn: (tx: ReturnType<typeof goodParsedTx>) => void) => {
      const tx = goodParsedTx();
      fn(tx);
      return fakeRpc({ tx });
    };
    // Source post row missing entirely — not a zero.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.meta.postTokenBalances = tx.meta.postTokenBalances.filter(
            (r) => r.accountIndex !== 2,
          );
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Destination post row missing.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.meta.postTokenBalances = tx.meta.postTokenBalances.filter(
            (r) => r.accountIndex !== 3,
          );
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // A dest-index row with a different mint is a mismatch, not absence.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.meta.preTokenBalances.push({
            accountIndex: 3,
            mint: 'So11111111111111111111111111111111111111112',
            owner: PAYEE,
            uiTokenAmount: { amount: '0', decimals: 6 },
          } as never);
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Duplicate accountIndex in one balance list.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.meta.postTokenBalances.push({ ...tx.meta.postTokenBalances[0] });
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Noncanonical token program on a balance row.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          (tx.meta.postTokenBalances[0] as Record<string, unknown>).programId =
            'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
    // Malformed raw amount.
    expect(
      await verifyTransferOnChain(
        mutate((tx) => {
          tx.meta.postTokenBalances[0].uiTokenAmount.amount = 'notanumber';
        }),
        SIG,
        expected,
      ),
    ).toMatchObject({ status: 'invalid' });
  });
});

describe('createLocalSupplierRail guards', () => {
  it('refuses non-loopback endpoints before any network use', async () => {
    const dir = tmpDir();
    const { file, signer } = await writeKeypair(dir);
    fs.chmodSync(dir, 0o700);
    await expect(
      createLocalSupplierRail({
        endpoint: 'https://api.devnet.solana.com',
        signerKeyPath: file,
        payer: signer.address,
        journalPath: path.join(dir, 'j.db'),
        mint: MINT,
        scope: { workspaceId: 'w', mandateId: 'm', caseId: 'c', payee: PAYEE },
      }),
    ).rejects.toThrow(/loopback/);
    await expect(
      createLocalSupplierRail({
        endpoint: 'http://localhost:8899',
        signerKeyPath: file,
        payer: signer.address,
        journalPath: path.join(dir, 'j.db'),
        mint: MINT,
        scope: { workspaceId: 'w', mandateId: 'm', caseId: 'c', payee: PAYEE },
      }),
    ).rejects.toThrow(/loopback/);
  });
});

describe('createLocalSupplierRail conflict and recovery semantics', () => {
  const FAKE_GENESIS = 'FakeLocalGenesis1111111111111111111111111111';
  const FAKE_BLOCKHASH = '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY';

  function chainMock(opts: { status?: Record<string, unknown> | null; tx?: unknown } = {}) {
    const calls = { genesis: 0, send: 0, sigStatus: 0, getTx: 0 };
    const status =
      'status' in opts
        ? opts.status
        : { confirmationStatus: 'confirmed', err: { InstructionError: [0, 'custom'] } };
    const rpc = {
      getGenesisHash: () => ({
        send: async () => (calls.genesis++, FAKE_GENESIS),
      }),
      getLatestBlockhash: () => ({
        send: async () => ({
          value: { blockhash: FAKE_BLOCKHASH, lastValidBlockHeight: BigInt(100) },
        }),
      }),
      sendTransaction: () => ({
        send: async () => (calls.send++, 'fake-broadcast-signature'),
      }),
      getSignatureStatuses: () => ({
        send: async () => (calls.sigStatus++, { value: [status] }),
      }),
      getTransaction: () => ({
        send: async () => (calls.getTx++, opts.tx ?? null),
      }),
    } as unknown as Record<string, unknown>;
    return { rpc, calls };
  }

  const localOpts = (
    dir: string,
    signerAddress: string,
    scope: { workspaceId: string; mandateId: string; caseId: string; payee: string },
  ) => ({
    endpoint: 'http://127.0.0.1:18899',
    signerKeyPath: path.join(dir, 'payer.json'),
    payer: signerAddress,
    journalPath: path.join(dir, 'j.db'),
    mint: MINT,
    scope,
  });

  const transfer = {
    workspaceId: 'w',
    mandateId: 'm',
    caseId: 'c',
    intentId: 'i1',
    cluster: 'localnet',
    mint: MINT,
    payee: PAYEE,
    amountBaseUnits: '10000',
    expiresAt: '2030-01-01T00:00:00.000Z',
  };

  it('recovers the identical binding on replay but never changed terms', async () => {
    const dir = tmpDir();
    const { file, signer } = await writeKeypair(dir);
    void file;
    const { rpc, calls } = chainMock();
    mocks.fakeRpc = rpc;
    try {
      const scope = { workspaceId: 'w', mandateId: 'm', caseId: 'c', payee: PAYEE };
      const rail = await createLocalSupplierRail(localOpts(dir, signer.address, scope));
      // First send commits the signature to the journal, broadcasts once,
      // and fails closed on the (invalid) chain state.
      await expect(rail.sendTransfer(transfer)).rejects.toThrow(/invalid/);
      expect(calls.send).toBe(1);
      expect(calls.sigStatus).toBe(1);

      // Replay with CHANGED terms (a different expiry) — the journal claim
      // conflicts and no recovery is attempted: no chain receipt reads, no
      // second broadcast.
      await expect(
        rail.sendTransfer({ ...transfer, expiresAt: '2031-01-01T00:00:00.000Z' }),
      ).rejects.toThrow(/different terms/);
      expect(calls.sigStatus).toBe(1);
      expect(calls.send).toBe(1);

      // Identical replay DOES exercise the recovery path: genesis and the
      // recorded signature are re-checked against the same chain.
      await expect(rail.sendTransfer(transfer)).rejects.toThrow(/invalid/);
      expect(calls.sigStatus).toBe(2);
      expect(calls.send).toBe(1);
    } finally {
      mocks.fakeRpc = null;
    }
  });

  it('fails closed when a journal belongs to a different deployment', async () => {
    const dir = tmpDir();
    const { signer } = await writeKeypair(dir);
    const { rpc } = chainMock();
    mocks.fakeRpc = rpc;
    try {
      const scopeA = { workspaceId: 'w', mandateId: 'm', caseId: 'c', payee: PAYEE };
      await createLocalSupplierRail(localOpts(dir, signer.address, scopeA));
      // Same journal path, different scope — a different deployment binding.
      await expect(
        createLocalSupplierRail(
          localOpts(dir, signer.address, { ...scopeA, caseId: 'other' }),
        ),
      ).rejects.toThrow(/different deployment/);
    } finally {
      mocks.fakeRpc = null;
    }
  });

  it('rejects expired or malformed expiry before any signing', async () => {
    const dir = tmpDir();
    const { signer } = await writeKeypair(dir);
    const { rpc, calls } = chainMock();
    mocks.fakeRpc = rpc;
    try {
      const rail = await createLocalSupplierRail(
        localOpts(dir, signer.address, {
          workspaceId: 'w',
          mandateId: 'm',
          caseId: 'c',
          payee: PAYEE,
        }),
      );
      await expect(
        rail.sendTransfer({ ...transfer, expiresAt: 'not-a-date' }),
      ).rejects.toThrow(/not a valid timestamp/);
      await expect(
        rail.sendTransfer({ ...transfer, expiresAt: '2020-01-01T00:00:00.000Z' }),
      ).rejects.toThrow(/expired/);
      await expect(
        rail.sendTransfer({ ...transfer, intentId: '   ' }),
      ).rejects.toThrow(/intentId is blank/);
      expect(calls.send).toBe(0);
      expect(calls.sigStatus).toBe(0);
    } finally {
      mocks.fakeRpc = null;
    }
  });
});
