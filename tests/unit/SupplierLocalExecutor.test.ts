import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type {
  SupplierLocalExecutorDeps,
  SupplierPaymentRailReceipt,
} from '@backend/services/telegraph/SupplierPaymentExecutor.js';
import type { StepWorld } from '../fixtures/supplier-payment-world.js';

const dbPath = path.join(os.tmpdir(), `cognivern-supplier-local-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import('@backend/db/index.js');
const { FundedMandateService } = await import(
  '@backend/services/governance/FundedMandateService.js'
);
const { CreRunStore } = await import('@backend/cre/storage/CreRunStore.js');
const { sha256CanonicalJson } = await import('@backend/services/telegraph/stableJson.js');
const { DEVNET_SCHEMA, LOCAL_SCHEMA } = await import(
  '@backend/services/telegraph/SupplierPaymentAuthorization.js'
);
const {
  DEVNET_GENESIS_HASH,
  createLocalSupplierExecutor,
  executeLocalSupplierPayment,
  reconcileLocalSupplierPayment,
  executeSupplierPayment,
} = await import('@backend/services/telegraph/SupplierPaymentExecutor.js');
const { initSupplierPaymentClaims } = await import(
  '@backend/services/telegraph/SupplierPaymentStore.js'
);
const fx = await import('../fixtures/supplier-payment-world.js');

const NOW = fx.FIXTURE_NOW;
const WS = 'ws-supplier-local';
const MINT = 'So11111111111111111111111111111111111111112'; // local mint fixture
const PAYEE = fx.FIXTURE_PAYEE;
const PAYER = fx.FIXTURE_PAYER;
const LOCAL_GENESIS = 'ELFHfXXTJW7hGGbnWdbAjzaKcDS2vf9Pst4JoCbNWVPW'; // spawned local

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-local-report-root-'));
const supplier: Record<string, unknown> = { ...fx.SUPPLIER };

let MANDATE_ID = '';
let worlds: StepWorld[] = [];
const baseReport = () => fx.buildReport(MANDATE_ID, worlds.map((w) => ({ ...w.stepEvidence })), supplier);

function envelopeBody(report: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return fx.envelopeBody(
    report,
    {
      schema: LOCAL_SCHEMA,
      workspaceId: WS,
      mandateId: MANDATE_ID,
      cluster: 'localnet',
      mint: MINT,
      payee: PAYEE,
    },
    overrides,
  );
}
const sign = (body: Record<string, unknown>) => fx.signEnvelope(privateKey, body);
const localRail = (receipt?: Partial<SupplierPaymentRailReceipt>) =>
  fx.fakeRail({ cluster: 'localnet', genesis: LOCAL_GENESIS, payer: PAYER, receipt });

let creStore: InstanceType<typeof CreRunStore>;

function makeDeps(rail: ReturnType<typeof localRail>, report: Record<string, unknown>) {
  const subjectHash = sha256CanonicalJson(supplier);
  fs.writeFileSync(
    path.join(reportRoot, `${sha256CanonicalJson(report)}.json`),
    JSON.stringify(report),
  );
  const deps: SupplierLocalExecutorDeps = {
    config: {
      enabled: true,
      workspaceId: WS,
      mandateId: MANDATE_ID,
      trustedPublicKey: publicKey,
      reportRoot,
      subjectPayeePins: { [subjectHash]: PAYEE },
      rail: {
        cluster: 'localnet',
        mint: MINT,
        payer: PAYER,
        maxTransferUsd: 0.01,
        genesisHash: LOCAL_GENESIS,
      },
      envLimits: {
        maxTransferUsd: 0.01,
        runwayUsd: 0.01,
        payeeAllowlist: [PAYEE],
        policySource: 'env',
      },
      evidenceMaxAgeMs: 24 * 60 * 60 * 1000,
    },
    rail,
    creStore,
    now: NOW,
  };
  return deps;
}

const consumedBaseUnits = () =>
  FundedMandateService.get(WS, MANDATE_ID)!.budget.byAsset.USDC.consumedAmount as string;

async function seedWorld() {
  const persistence = {
    async append() {},
    async loadAll() {
      return [] as never[];
    },
    async writeAll() {},
    async truncate() {},
  };
  creStore = new CreRunStore({ persistence });
  for (const world of worlds) {
    await creStore.add(world.screenRun as never);
    await creStore.add(world.parentRun as never);
  }
}

beforeAll(() => {
  vi.useFakeTimers({ now: NOW });
  const db = getDb();
  initSupplierPaymentClaims(db);
  const now = new Date().toISOString();
  db.prepare('INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)').run(
    'user-supplier-local',
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WS, WS, 'user-supplier-local', now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_agents (id, workspace_id, name, role, chain, created_at, updated_at) VALUES (?, ?, ?, 'executor', 'solana', ?, ?)",
  ).run('agent-1', WS, 'agent-1', now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_policies (id, workspace_id, name, type, created_at, updated_at) VALUES (?, ?, ?, 'spend', ?, ?)",
  ).run('policy-1', WS, 'policy-1', now, now);
});

beforeEach(async () => {
  MANDATE_ID = FundedMandateService.create(WS, {
    name: 'Supplier diligence mandate',
    objective: 'Pay cleared diligence suppliers',
    agentIds: ['agent-1'],
    policyIds: ['policy-1'],
    status: 'active',
    budget: {
      byAsset: {
        USDC: {
          authorizedAmount: '10000',
          allocatedAmount: '10000',
          consumedAmount: '0',
          pendingAmount: '10000',
        },
      },
    },
  }).id;
  worlds = fx.LINEAGE.map((lin) => fx.buildStepWorld(WS, MANDATE_ID, lin, supplier));
  await seedWorld();
});

afterAll(() => {
  vi.useRealTimers();
  closeDb();
  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}-wal`, { force: true });
  fs.rmSync(`${dbPath}-shm`, { force: true });
  fs.rmSync(reportRoot, { recursive: true, force: true });
});

describe('local supplier executor', () => {
  it('executes a fully bound localnet authorization once and debits once', async () => {
    const rail = localRail();
    const report = baseReport();
    const body = envelopeBody(report);
    const executor = createLocalSupplierExecutor(makeDeps(rail, report));
    const result = await executor.execute(WS, sign(body));
    expect(result).toEqual({ status: 'confirmed', signature: `sig-${body.intentId}` });
    expect(rail.calls).toHaveLength(1);
    expect(consumedBaseUnits()).toBe('10000');
  });

  it('reconciles a pending local claim to a finalized receipt', async () => {
    const rail = localRail();
    rail.sendTransfer = async () => {
      throw new Error('rpc timeout');
    };
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    const executor = createLocalSupplierExecutor(deps);
    const env = sign(body);
    expect((await executor.execute(WS, env)).status).toBe('pending');
    rail.receipts.set(body.intentId as string, {
      cluster: 'localnet',
      mint: MINT,
      payee: PAYEE,
      payer: PAYER,
      amountBaseUnits: '10000',
      confirmationStatus: 'finalized',
      intentId: body.intentId as string,
      signature: 'real-signature',
    });
    expect(await executor.reconcile(WS, env)).toEqual({
      status: 'confirmed',
      signature: 'real-signature',
    });
    expect(consumedBaseUnits()).toBe('10000');
  });

  it('denies a held evidence report with no dispatch and no debit', async () => {
    const rail = localRail();
    const heldSteps = worlds.map((w) => fx.heldStepEvidence(w.stepEvidence));
    const report = fx.buildReport(MANDATE_ID, heldSteps, supplier);
    const deps = makeDeps(rail, report);
    const result = await executeLocalSupplierPayment(WS, sign(envelopeBody(report)), deps);
    expect(result.status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
    expect(consumedBaseUnits()).toBe('0');
  });

  it('denies a devnet-schema envelope to the local executor', async () => {
    const rail = localRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const devnetBody = fx.envelopeBody(report, {
      schema: DEVNET_SCHEMA,
      workspaceId: WS,
      mandateId: MANDATE_ID,
      cluster: 'devnet',
      mint: fx.DEVNET_USDC_MINT,
      payee: PAYEE,
    });
    const result = await executeLocalSupplierPayment(WS, sign(devnetBody), deps);
    expect(result.status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
  });

  it('denies a local-schema envelope to the devnet executor', async () => {
    const rail = fx.fakeRail({ cluster: 'devnet', genesis: fx.FULL_DEVNET_GENESIS, payer: PAYER });
    const report = baseReport();
    const subjectHash = sha256CanonicalJson(supplier);
    fs.writeFileSync(
      path.join(reportRoot, `${sha256CanonicalJson(report)}.json`),
      JSON.stringify(report),
    );
    const result = await executeSupplierPayment(WS, sign(envelopeBody(report)), {
      config: {
        enabled: true,
        workspaceId: WS,
        mandateId: MANDATE_ID,
        trustedPublicKey: publicKey,
        reportRoot,
        subjectPayeePins: { [subjectHash]: PAYEE },
        rail: {
          cluster: 'devnet',
          mint: fx.DEVNET_USDC_MINT,
          payer: PAYER,
          maxTransferUsd: 0.01,
          genesisHash: DEVNET_GENESIS_HASH,
        },
        envLimits: {
          maxTransferUsd: 0.01,
          runwayUsd: 0.01,
          payeeAllowlist: [PAYEE],
          policySource: 'env',
        },
      },
      rail,
      creStore,
      now: NOW,
    });
    expect(result.status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
  });

  it('local factory refuses canonical devnet pins even when consistently configured', () => {
    const rail = localRail();
    const deps = makeDeps(rail, baseReport());
    deps.config.rail.cluster = 'localnet';
    deps.config.rail.genesisHash = fx.FULL_DEVNET_GENESIS; // public genesis — not local
    expect(() => createLocalSupplierExecutor(deps)).toThrow(/not a valid non-public/);
  });

  it('local factory refuses the canonical devnet mint as the local mint', () => {
    const rail = localRail();
    const deps = makeDeps(rail, baseReport());
    deps.config.rail.mint = fx.DEVNET_USDC_MINT;
    deps.config.rail.genesisHash = LOCAL_GENESIS;
    expect(() => createLocalSupplierExecutor(deps)).toThrow(/not a valid non-public/);
  });

  it('local factory refuses mainnet and testnet genesis pins', () => {
    const rail = localRail();
    for (const genesis of [
      '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
      '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY',
    ]) {
      const deps = makeDeps(rail, baseReport());
      deps.config.rail.genesisHash = genesis;
      expect(() => createLocalSupplierExecutor(deps)).toThrow(/not a valid non-public/);
    }
  });

  it('denies a local envelope carrying the wrong mint literal', async () => {
    const rail = localRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report, { mint: 'TokenzQdYHnbKXi7kvo2tcmhvTQMuKqKGZEqMqgDScBY' });
    const result = await executeLocalSupplierPayment(WS, sign(body), deps);
    expect(result.status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
  });
});
