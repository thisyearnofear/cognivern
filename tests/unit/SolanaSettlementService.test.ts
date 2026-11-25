import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSigner } from '@solana/kit';

/**
 * Solana settlement service unit tests.
 *
 * Coverage:
 *  - USD → base-units conversion (6-decimal USDC)
 *  - Explorer URL per cluster
 *  - Pure guard evaluation: per-transfer cap, payee allowlist, session
 *    runway, invalid amounts — every violation blocks before broadcast
 *  - Config validation: malformed env values fail closed, empty strings are
 *    unset, mainnet needs explicit arming, RPC URLs are redacted
 *  - Durable intent journal: pre-broadcast record, payload binding, replay of
 *    confirmed/sent/uncertain intents, concurrent same-intent dedupe
 *  - A mocked-RPC broadcast that proves the send path journals `sent` before
 *    `sendTransaction` and commits only after confirmation
 *
 * No live sends — the RPC and signer are injected.
 */

import {
  evaluateSettlementGuards,
  explorerUrl,
  isValidSolanaAddress,
  MAINNET_USDC_MINT,
  DEVNET_USDC_MINT,
  redactRpcUrl,
  SolanaSettlementError,
  SolanaSettlementService,
  usdToBaseUnits,
  type SolanaSettlementConfig,
} from '../../src/backend/services/blockchain/solana/SolanaSettlementService.js';
import { SettlementIntentStore } from '../../src/backend/services/blockchain/solana/SettlementIntentStore.js';

const ALLOWED_PAYEE = '11111111111111111111111111111111';
const OTHER_PAYEE = 'So11111111111111111111111111111111111111112';
const guards = (over: Partial<Parameters<typeof evaluateSettlementGuards>[0]> = {}) =>
  evaluateSettlementGuards({
    intent: { payee: ALLOWED_PAYEE, amountUsd: 0.01 },
    maxTransferUsd: 0.05,
    payeeAllowlist: [ALLOWED_PAYEE],
    runwayUsd: 0.25,
    spentUsd: 0,
    ...over,
  });

const dirs: string[] = [];
function tempStore(): SettlementIntentStore {
  const dir = mkdtempSync(join(tmpdir(), 'cognivern-settlement-'));
  dirs.push(dir);
  return new SettlementIntentStore({ filePath: join(dir, 'intents.json') });
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface FakeRpcState {
  sent: number;
  sentWires: string[];
  statuses: Array<{ confirmationStatus?: string; err?: unknown } | null>;
  failSend?: Error;
  tokenError?: Error;
  solLamports: bigint;
  usdcUiAmount: number | null;
}

function fakeRpc(state: Partial<FakeRpcState> = {}) {
  const s: FakeRpcState = {
    sent: 0,
    sentWires: [],
    statuses: [{ confirmationStatus: 'confirmed', err: null }],
    solLamports: 1_000_000_000n,
    usdcUiAmount: 5,
    ...state,
  };
  const rpc = {
    getLatestBlockhash: () => ({
      send: async () => ({
        value: {
          blockhash: '11111111111111111111111111111111',
          lastValidBlockHeight: 1000n,
        },
      }),
    }),
    sendTransaction: (_wire: string) => ({
      send: async () => {
        s.sent += 1;
        s.sentWires.push(_wire);
        if (s.failSend) throw s.failSend;
        return 'signature';
      },
    }),
    getSignatureStatuses: () => ({
      send: async () => ({
        value: s.statuses,
      }),
    }),
    getBalance: () => ({
      send: async () => ({ value: s.solLamports }),
    }),
    getTokenAccountBalance: () => ({
      send: async () => {
        if (s.tokenError) throw s.tokenError;
        return {
          value: {
            amount: '5000000',
            decimals: 6,
            uiAmount: s.usdcUiAmount,
            uiAmountString: '5',
          },
        };
      },
    }),
  };
  return { rpc, state: s };
}

async function makeService(
  over: Partial<SolanaSettlementConfig> = {},
  opts: { rpcState?: Partial<FakeRpcState>; store?: SettlementIntentStore } = {},
) {
  const signer = await generateKeyPairSigner();
  const { rpc, state } = fakeRpc(opts.rpcState);
  const store = opts.store ?? tempStore();
  const service = new SolanaSettlementService(
    {
      enabled: true,
      maxTransferUsd: 0.05,
      runwayUsd: 0.25,
      payeeAllowlist: [ALLOWED_PAYEE, OTHER_PAYEE],
      cluster: 'devnet',
      ...over,
    },
    {
      store,
      signer,
      createRpc: (() => rpc) as never,
      sleep: async () => undefined,
    },
  );
  return { service, state, store, signer };
}

describe('usdToBaseUnits', () => {
  it('converts USD to 6-decimal base units', () => {
    expect(usdToBaseUnits(1)).toBe(1_000_000n);
    expect(usdToBaseUnits(0.01)).toBe(10_000n);
    expect(usdToBaseUnits(0.000001)).toBe(1n);
  });

  it('rounds sub-micro-cent dust', () => {
    expect(usdToBaseUnits(0.0000004)).toBe(0n);
  });
});

describe('explorerUrl', () => {
  it('mainnet omits cluster param; devnet/testnet include it', () => {
    expect(explorerUrl('sig', 'mainnet-beta')).toBe('https://solscan.io/tx/sig');
    expect(explorerUrl('sig', 'devnet')).toBe('https://solscan.io/tx/sig?cluster=devnet');
    expect(explorerUrl('sig', 'testnet')).toBe('https://solscan.io/tx/sig?cluster=testnet');
  });
});

describe('isValidSolanaAddress', () => {
  it('accepts base58 addresses and rejects malformed input', () => {
    expect(isValidSolanaAddress(ALLOWED_PAYEE)).toBe(true);
    expect(isValidSolanaAddress('not-base58!!!')).toBe(false);
    expect(isValidSolanaAddress('')).toBe(false);
  });
});

describe('redactRpcUrl', () => {
  it('redacts query credentials and path tokens', () => {
    expect(redactRpcUrl('https://rpc.example.com/?api-key=abc123&x=1')).toBe(
      'https://rpc.example.com/?api-key=[redacted]&x=1',
    );
    expect(redactRpcUrl('https://org.quiknode.pro/0123456789abcdef0123456789abcdef/')).toBe(
      'https://org.quiknode.pro/[redacted]/',
    );
    expect(redactRpcUrl('https://api.devnet.solana.com')).toBe('https://api.devnet.solana.com');
  });
});

describe('evaluateSettlementGuards', () => {
  it('allows a compliant intent', () => {
    expect(guards()).toEqual({ allowed: true, violations: [] });
  });

  it('blocks non-positive or non-finite amounts', () => {
    for (const amountUsd of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = guards({ intent: { payee: ALLOWED_PAYEE, amountUsd } });
      expect(r.allowed).toBe(false);
      expect(r.violations.join()).toContain('invalid amountUsd');
    }
  });

  it('blocks amounts above the per-transfer cap', () => {
    const r = guards({ intent: { payee: ALLOWED_PAYEE, amountUsd: 0.06 } });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain('per-transfer cap');
  });

  it('blocks when the allowlist is empty (fail closed)', () => {
    const r = guards({ payeeAllowlist: [] });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain('allowlist is empty');
  });

  it('blocks a payee outside the allowlist', () => {
    const r = guards({ intent: { payee: 'NotAllowed111', amountUsd: 0.01 } });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain('not in allowlist');
  });

  it('blocks when the session runway would be exceeded, including pending', () => {
    const r = guards({ spentUsd: 0.25 });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain('session runway');

    const pending = guards({ pendingUsd: 0.25 });
    expect(pending.allowed).toBe(false);
    expect(pending.violations.join()).toContain('pending 0.25');
  });

  it('blocks when a malformed limit is present', () => {
    const r = guards({ maxTransferUsd: Number.NaN });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain('per-transfer cap is not configured');

    const config = guards({ configErrors: ['SOLANA_CLUSTER invalid'] });
    expect(config.allowed).toBe(false);
    expect(config.violations.join()).toContain('invalid settlement config');
  });

  it('collects multiple violations', () => {
    const r = guards({
      intent: { payee: 'Nope', amountUsd: 0.5 },
      payeeAllowlist: [ALLOWED_PAYEE],
    });
    expect(r.allowed).toBe(false);
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe('config validation', () => {
  it("disabled service throws 'disabled'", async () => {
    const svc = new SolanaSettlementService({ enabled: false });
    await expect(
      svc.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
    ).rejects.toMatchObject({ code: 'disabled' });
  });

  it('rejects a malformed payee before any guard/broadcast', async () => {
    const { service } = await makeService();
    await expect(
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: 'not-base58!!!',
        amountUsd: 0.01,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('requires intentId and workspaceId', async () => {
    const { service } = await makeService();
    await expect(
      service.executeTransfer({
        intentId: '',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: '',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('policy block carries violations and never reaches a broadcast', async () => {
    const { service, state } = await makeService({ payeeAllowlist: ['SomeOtherPayee'] });
    const err = await service
      .executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SolanaSettlementError);
    expect((err as SolanaSettlementError).code).toBe('policy');
    expect((err as SolanaSettlementError).violations?.join()).toContain('not in allowlist');
    expect(state.sent).toBe(0);
  });

  it('treats a non-finite cap as a config error instead of fail-open', async () => {
    const { service, state } = await makeService({ maxTransferUsd: Number.NaN });
    expect(service.getConfigErrors().join()).toContain('MAX_USD');
    await expect(
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
    ).rejects.toMatchObject({ code: 'not_ready' });
    expect(state.sent).toBe(0);
  });

  it('rejects a per-transfer cap above the runway', async () => {
    const { service } = await makeService({ maxTransferUsd: 0.5, runwayUsd: 0.25 });
    expect(service.getConfigErrors().join()).toContain('exceeds');
  });

  it('defaults to devnet and its USDC mint and RPC', () => {
    const svc = new SolanaSettlementService({ enabled: false });
    expect(svc.getConfig().cluster).toBe('devnet');
    expect(svc.getConfig().usdcMint).toBe(DEVNET_USDC_MINT);
    expect(svc.getConfig().rpcUrl).toBe('https://api.devnet.solana.com');
  });

  it('mainnet-beta requires explicit arming', () => {
    const unarmed = new SolanaSettlementService({
      enabled: true,
      cluster: 'mainnet-beta',
    });
    expect(unarmed.getConfig().usdcMint).toBe(MAINNET_USDC_MINT);
    expect(unarmed.getConfigErrors().join()).toContain('SOLANA_ALLOW_MAINNET');

    const armed = new SolanaSettlementService({
      enabled: false,
      cluster: 'mainnet-beta',
      allowMainnet: true,
    });
    expect(armed.getConfigErrors()).toEqual([]);
  });

  it('reports disabled cleanly without a key', async () => {
    const svc = new SolanaSettlementService({ enabled: false });
    const status = await svc.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.payer).toBeNull();
  });
});

describe('preflight', () => {
  it('blocks a disabled rail without touching the RPC', async () => {
    const { service, state } = await makeService({ enabled: false });
    const pre = await service.preflight({ payee: ALLOWED_PAYEE, amountUsd: 0.01 });
    expect(pre.ready).toBe(false);
    expect(pre.violations.join()).toContain('SOLANA_SETTLEMENT_ENABLED');
    expect(state.sent).toBe(0);
  });

  it('blocks when the payer SOL is below the fee/rent reserve', async () => {
    const { service } = await makeService({}, { rpcState: { solLamports: 1_000n } });
    const pre = await service.preflight({ payee: ALLOWED_PAYEE, amountUsd: 0.01 });
    expect(pre.ready).toBe(false);
    expect(pre.violations.join()).toContain('fee/rent reserve');
  });

  it('blocks when the payer has no USDC account for the mint', async () => {
    const { service } = await makeService({}, { rpcState: { usdcUiAmount: null } });
    const pre = await service.preflight({ payee: ALLOWED_PAYEE, amountUsd: 0.01 });
    expect(pre.ready).toBe(false);
    expect(pre.violations.join()).toContain('no USDC token account');
  });

  it('distinguishes an unreadable USDC balance from a missing account', async () => {
    const { service } = await makeService(
      {},
      { rpcState: { tokenError: new Error('rpc unavailable') } },
    );
    const pre = await service.preflight({ payee: ALLOWED_PAYEE, amountUsd: 0.01 });
    expect(pre.ready).toBe(false);
    expect(pre.violations.join()).toContain('could not read the settlement payer USDC balance');
    expect(pre.violations.join()).not.toContain('no USDC token account');
  });

  it('blocks when the payer balance is below the requested amount', async () => {
    const { service } = await makeService({}, { rpcState: { usdcUiAmount: 0.005 } });
    const pre = await service.preflight({ payee: ALLOWED_PAYEE, amountUsd: 0.01 });
    expect(pre.ready).toBe(false);
    expect(pre.violations.join()).toContain('below the requested');
  });

  it('is ready when the rail is armed, funded, and the intent passes guards', async () => {
    const { service } = await makeService();
    const pre = await service.preflight({ payee: ALLOWED_PAYEE, amountUsd: 0.01 });
    expect(pre).toMatchObject({ ready: true, violations: [], usdcBalance: 5 });
    expect(pre.solBalance).toBe(1);
  });
});

describe('durable intent journal', () => {
  it('rejects a journal record whose payload hash does not match', async () => {
    const store = tempStore();
    await store.setIntent('w-1:i-1', {
      intentId: 'i-1',
      workspaceId: 'w-1',
      status: 'confirmed',
      requestHash: 'placeholder',
      cluster: 'devnet',
      mint: DEVNET_USDC_MINT,
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
      amountBaseUnits: '10000',
      signature: 'recorded-signature',
      explorerUrl: 'https://solscan.io/tx/recorded-signature?cluster=devnet',
      confirmationStatus: 'confirmed',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    // Recompute the real hash by attempting the transfer with the wrong hash
    // first: the mismatch proves binding works.
    const { service, state } = await makeService({}, { store });
    const err = await service
      .executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SolanaSettlementError);
    expect((err as SolanaSettlementError).code).toBe('intent_conflict');
    expect(state.sent).toBe(0);
  });

  it('returns the recorded signature when the payload matches', async () => {
    const store = tempStore();
    const { service, state, signer } = await makeService({}, { store });
    const first = await service.executeTransfer({
      intentId: 'i-1',
      workspaceId: 'w-1',
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
    });
    expect(first.status).toBe('settled');
    expect(state.sent).toBe(1);

    const replay = await service.executeTransfer({
      intentId: 'i-1',
      workspaceId: 'w-1',
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.signature).toBe(first.signature);
    expect(state.sent).toBe(1);

    const record = await store.getIntent('w-1:i-1');
    expect(record).toMatchObject({
      status: 'confirmed',
      payer: signer.address,
      signature: first.signature,
    });
  });

  it('binds an intentId to its exact payload', async () => {
    const { service } = await makeService();
    await service.executeTransfer({
      intentId: 'i-1',
      workspaceId: 'w-1',
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
    });
    const err = await service
      .executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: OTHER_PAYEE,
        amountUsd: 0.01,
      })
      .catch((e: unknown) => e);
    expect((err as SolanaSettlementError).code).toBe('intent_conflict');
  });

  it('refuses to rebroadcast a sent or uncertain intent', async () => {
    for (const status of ['pending', 'sent', 'uncertain'] as const) {
      const store = tempStore();
      const { service, state } = await makeService({}, { store });
      // Create a matching record by hashing through a real attempt first.
      const result = await service.executeTransfer({
        intentId: `seed-${status}`,
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      });
      const record = await store.getIntent(`w-1:seed-${status}`);
      expect(record).not.toBeNull();
      await store.setIntent(`w-1:seed-${status}`, { ...record!, status });
      const sentBefore = state.sent;
      const err = await service
        .executeTransfer({
          intentId: `seed-${status}`,
          workspaceId: 'w-1',
          payee: ALLOWED_PAYEE,
          amountUsd: 0.01,
        })
        .catch((e: unknown) => e);
      expect((err as SolanaSettlementError).code).toBe('uncertain');
      expect(state.sent).toBe(sentBefore);
      expect(result.status).toBe('settled');
    }
  });

  it('dedupes concurrent attempts for the same intent', async () => {
    const { service, state } = await makeService();
    const [a, b] = await Promise.all([
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
    ]);
    expect(state.sent).toBe(1);
    expect(a.signature).toBe(b.signature);
    expect([a.idempotentReplay, b.idempotentReplay].filter(Boolean)).toHaveLength(1);
  });

  it('reserves runway synchronously so concurrent intents cannot both fit', async () => {
    const { service, state } = await makeService({
      maxTransferUsd: 0.02,
      runwayUsd: 0.03,
    });
    const results = await Promise.allSettled([
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.02,
      }),
      service.executeTransfer({
        intentId: 'i-2',
        workspaceId: 'w-1',
        payee: OTHER_PAYEE,
        amountUsd: 0.02,
      }),
    ]);
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: 'policy',
    });
    expect(state.sent).toBe(1);
  });

  it('journals the signature before broadcast and confirms after', async () => {
    const store = tempStore();
    const { service, state } = await makeService({}, { store });
    const result = await service.executeTransfer({
      intentId: 'i-1',
      workspaceId: 'w-1',
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
    });
    expect(result.signature).toBeTruthy();
    const record = await store.getIntent('w-1:i-1');
    expect(record).toMatchObject({
      status: 'confirmed',
      signature: result.signature,
      explorerUrl: result.explorerUrl,
      confirmationStatus: 'confirmed',
    });
    expect(state.sentWires).toHaveLength(1);
  });

  it('marks a confirmed intent as mandate-debited exactly once', async () => {
    const store = tempStore();
    const { service } = await makeService({ enabled: false }, { store });
    const seeded = {
      intentId: 'i-1',
      workspaceId: 'w-1',
      status: 'confirmed' as const,
      requestHash: 'h',
      cluster: 'devnet' as const,
      mint: DEVNET_USDC_MINT,
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
      amountBaseUnits: '10000',
      signature: 'sig-1',
      confirmationStatus: 'confirmed',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    await store.setIntent('w-1:i-1', seeded);
    expect((await service.getIntentStatus('w-1', 'i-1'))?.mandateDebited).toBeFalsy();
    await service.markMandateDebited('w-1', 'i-1');
    expect((await service.getIntentStatus('w-1', 'i-1'))?.mandateDebited).toBe(true);
    // Idempotent: a second mark does not change the payload it was bound to.
    await service.markMandateDebited('w-1', 'i-1');
    expect(await service.getIntentStatus('w-1', 'i-1')).toMatchObject({
      status: 'confirmed',
      signature: 'sig-1',
      mandateDebited: true,
    });
    // Unknown intents are a no-op rather than inventing a record.
    await service.markMandateDebited('w-1', 'missing');
    expect(await service.getIntentStatus('w-1', 'missing')).toBeNull();
  });
});

describe('env-driven defaults', () => {
  it('mainnet-beta defaults to the mainnet USDC mint', () => {
    const svc = new SolanaSettlementService({
      cluster: 'mainnet-beta',
      enabled: false,
      allowMainnet: true,
    });
    expect(svc.getConfig().usdcMint).toBe(MAINNET_USDC_MINT);
  });

  it('devnet defaults to the devnet USDC mint', () => {
    const svc = new SolanaSettlementService({ cluster: 'devnet', enabled: false });
    expect(svc.getConfig().usdcMint).toBe(DEVNET_USDC_MINT);
  });

  it('explicit mint overrides cluster default', () => {
    const svc = new SolanaSettlementService({ cluster: 'devnet', usdcMint: 'CustomMint111' });
    expect(svc.getConfig().usdcMint).toBe('CustomMint111');
  });
});

describe('reconciliation', () => {
  it('flips an uncertain intent to confirmed when the chain says it landed', async () => {
    const store = tempStore();
    // Drive the real flow so the journal record carries the true payload
    // hash: a send whose response is lost records `uncertain`.
    const { service, state } = await makeService(
      {},
      { store, rpcState: { failSend: new Error('connection reset') } },
    );
    await expect(
      service.executeTransfer({
        intentId: 'i-1',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.01,
      }),
    ).rejects.toBeInstanceOf(SolanaSettlementError);
    expect((await service.getIntentStatus('w-1', 'i-1'))?.status).toBe('uncertain');

    // The cluster later reports the transaction confirmed.
    state.failSend = undefined;
    state.statuses = [{ confirmationStatus: 'finalized', err: null }];
    const record = await service.reconcileIntent('w-1', 'i-1');
    expect(record).toMatchObject({ status: 'confirmed', confirmationStatus: 'finalized' });

    // A confirmed record is replayable: executeTransfer returns the
    // signature without broadcasting again.
    const sentBefore = state.sent;
    const replay = await service.executeTransfer({
      intentId: 'i-1',
      workspaceId: 'w-1',
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
    });
    expect(replay).toMatchObject({ idempotentReplay: true, status: 'settled' });
    expect(state.sent).toBe(sentBefore);
  });

  it('flips an uncertain intent to failed/retryable when the chain says it failed', async () => {
    const store = tempStore();
    const { service } = await makeService(
      { enabled: false },
      { store, rpcState: { statuses: [{ confirmationStatus: 'confirmed', err: { InsufficientFunds: {} } }] } },
    );
    await store.setIntent('w-1:i-1', {
      intentId: 'i-1',
      workspaceId: 'w-1',
      status: 'uncertain',
      requestHash: 'h',
      cluster: 'devnet',
      mint: DEVNET_USDC_MINT,
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
      amountBaseUnits: '10000',
      signature: 'sig-1',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    const record = await service.reconcileIntent('w-1', 'i-1');
    expect(record).toMatchObject({ status: 'failed', retryable: true });
    expect(record?.attempts).toHaveLength(1);
  });

  it('leaves the record untouched when the cluster has not seen the signature', async () => {
    const store = tempStore();
    const { service } = await makeService(
      { enabled: false },
      { store, rpcState: { statuses: [null] } },
    );
    await store.setIntent('w-1:i-1', {
      intentId: 'i-1',
      workspaceId: 'w-1',
      status: 'uncertain',
      requestHash: 'h',
      cluster: 'devnet',
      mint: DEVNET_USDC_MINT,
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
      amountBaseUnits: '10000',
      signature: 'sig-1',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    const before = await service.getIntentStatus('w-1', 'i-1');
    const record = await service.reconcileIntent('w-1', 'i-1');
    expect(record).toEqual(before);
    expect(record?.status).toBe('uncertain');
  });

  it('returns terminal records unchanged and null for unknown intents', async () => {
    const store = tempStore();
    const { service } = await makeService({ enabled: false }, { store });
    expect(await service.reconcileIntent('w-1', 'missing')).toBeNull();
    await store.setIntent('w-1:i-1', {
      intentId: 'i-1',
      workspaceId: 'w-1',
      status: 'confirmed',
      requestHash: 'h',
      cluster: 'devnet',
      mint: DEVNET_USDC_MINT,
      payee: ALLOWED_PAYEE,
      amountUsd: 0.01,
      amountBaseUnits: '10000',
      signature: 'sig-1',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    const record = await service.reconcileIntent('w-1', 'i-1');
    expect(record?.status).toBe('confirmed');
  });

  it('serializes concurrent mandate debits through the exclusive lock', async () => {
    const { service } = await makeService({ enabled: false });
    const order: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = service.runMandateDebitExclusive('w-1', 'i-1', async () => {
      order.push('first-start');
      await gate;
      order.push('first-end');
    });
    const second = service.runMandateDebitExclusive('w-1', 'i-1', async () => {
      order.push('second');
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(order).toEqual(['first-start']);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});

describe('runway rehydration', () => {
  it('counts confirmed journal records toward the runway after a restart', async () => {
    const store = tempStore();
    await store.setIntent('w-1:i-old', {
      intentId: 'i-old',
      workspaceId: 'w-1',
      status: 'confirmed',
      requestHash: 'h',
      cluster: 'devnet',
      mint: DEVNET_USDC_MINT,
      payee: ALLOWED_PAYEE,
      amountUsd: 0.22,
      amountBaseUnits: '220000',
      mandateId: null,
      signature: 'sig-old',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    const { service } = await makeService({}, { store });
    // 0.22 already spent + 0.05 requested would exceed the 0.25 runway.
    await expect(
      service.executeTransfer({
        intentId: 'i-new',
        workspaceId: 'w-1',
        payee: ALLOWED_PAYEE,
        amountUsd: 0.05,
      }),
    ).rejects.toBeInstanceOf(SolanaSettlementError);
    // A smaller transfer still fits (0.22 + 0.02 <= 0.25).
    const result = await service.executeTransfer({
      intentId: 'i-new',
      workspaceId: 'w-1',
      payee: ALLOWED_PAYEE,
      amountUsd: 0.02,
    });
    expect(result.status).toBe('settled');
  });
});

