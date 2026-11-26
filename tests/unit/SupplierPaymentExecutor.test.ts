import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import type {
  SupplierPaymentExecutorDeps,
  SupplierPaymentRailReceipt,
} from '@backend/services/telegraph/SupplierPaymentExecutor.js';
import type { StepWorld } from '../fixtures/supplier-payment-world.js';

const dbPath = path.join(os.tmpdir(), `cognivern-supplier-exec-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import('@backend/db/index.js');
const { FundedMandateService } = await import(
  '@backend/services/governance/FundedMandateService.js'
);
const { CreRunStore } = await import('@backend/cre/storage/CreRunStore.js');
const { sha256CanonicalJson } = await import('@backend/services/telegraph/stableJson.js');
const { DEVNET_SCHEMA, REHEARSAL_SCHEMA } = await import(
  '@backend/services/telegraph/SupplierPaymentAuthorization.js'
);
const { DEVNET_GENESIS_HASH, executeSupplierPayment, reconcileSupplierPayment } = await import(
  '@backend/services/telegraph/SupplierPaymentExecutor.js'
);
const { initSupplierPaymentClaims, SupplierPaymentStore } = await import(
  '@backend/services/telegraph/SupplierPaymentStore.js'
);
const fx = await import('../fixtures/supplier-payment-world.js');

const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const WS = 'ws-supplier-exec';
const MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const PAYEE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAYER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpThe9UPq5aR';
// Independently spelled-out canonical devnet genesis (sdk/src/genesis_config.rs).
const FULL_DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-report-root-'));

const supplier: Record<string, unknown> = { ...fx.SUPPLIER };
const LINEAGE = fx.LINEAGE;
function fill(params: Record<string, string>) {
  return fx.fillParams(params, supplier);
}
function buildStepWorld(mandateId: string, lin: (typeof LINEAGE)[number]): StepWorld {
  return fx.buildStepWorld(WS, mandateId, lin, supplier);
}
const buildReport = (mandateId: string, steps: Record<string, unknown>[]) =>
  fx.buildReport(mandateId, steps, supplier);
let MANDATE_ID = '';
function envelopeBody(report: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return fx.envelopeBody(
    report,
    {
      schema: DEVNET_SCHEMA,
      workspaceId: WS,
      mandateId: MANDATE_ID,
      cluster: 'devnet',
      mint: MINT,
      payee: PAYEE,
    },
    overrides,
  );
}
function signEnvelope(body: Record<string, unknown>) {
  return fx.signEnvelope(privateKey, body);
}
function fakeRail(receipt?: Partial<SupplierPaymentRailReceipt>) {
  return fx.fakeRail({ cluster: 'devnet', genesis: FULL_DEVNET_GENESIS, payer: PAYER, receipt });
}
function seedReceipt(
  rail: ReturnType<typeof fakeRail>,
  intentId: string,
  overrides: Partial<SupplierPaymentRailReceipt> = {},
) {
  rail.receipts.set(intentId, {
    cluster: 'devnet',
    mint: MINT,
    payee: PAYEE,
    payer: PAYER,
    amountBaseUnits: '10000',
    confirmationStatus: 'confirmed',
    intentId,
    signature: `reconciled-${intentId}`,
    ...overrides,
  });
}

let creStore: InstanceType<typeof CreRunStore>;
let worlds: StepWorld[] = [];
const baseReport = () => buildReport(MANDATE_ID, worlds.map((w) => ({ ...w.stepEvidence })));

function makeDeps(rail: ReturnType<typeof fakeRail>, report: Record<string, unknown>) {
  const subjectHash = sha256CanonicalJson(supplier);
  fs.writeFileSync(
    path.join(reportRoot, `${sha256CanonicalJson(report)}.json`),
    JSON.stringify(report),
  );
  const deps: SupplierPaymentExecutorDeps = {
    config: {
      enabled: true,
      workspaceId: WS,
      mandateId: MANDATE_ID,
      trustedPublicKey: publicKey,
      reportRoot,
      subjectPayeePins: { [subjectHash]: PAYEE },
      rail: {
        cluster: 'devnet',
        mint: MINT,
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
    'user-supplier-exec',
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WS, WS, 'user-supplier-exec', now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_agents (id, workspace_id, name, role, chain, created_at, updated_at) VALUES (?, ?, ?, 'executor', 'solana', ?, ?)",
  ).run('agent-1', WS, 'agent-1', now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_policies (id, workspace_id, name, type, created_at, updated_at) VALUES (?, ?, ?, 'spend', ?, ?)",
  ).run('policy-1', WS, 'policy-1', now, now);
});

beforeEach(async () => {
  // Every test gets a fresh dedicated mandate with exactly the 0.01 cap —
  // no cross-test budget or claim state.
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
  worlds = LINEAGE.map((lin) => buildStepWorld(MANDATE_ID, lin));
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

describe('executeSupplierPayment', () => {
  it('executes a fully bound devnet authorization once and debits the mandate once', async () => {
    const rail = fakeRail();
    const report = baseReport();
    const body = envelopeBody(report);
    const result = await executeSupplierPayment(WS, signEnvelope(body), makeDeps(rail, report));
    expect(result).toEqual({ status: 'confirmed', signature: `sig-${body.intentId}` });
    expect(rail.calls).toHaveLength(1);
    expect(consumedBaseUnits()).toBe('10000');
    expect(DEVNET_GENESIS_HASH).toBe(FULL_DEVNET_GENESIS);
  });

  it('replays a completed identical envelope — stored signature, no new call or debit', async () => {
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    const envelope = signEnvelope(body);
    expect((await executeSupplierPayment(WS, envelope, deps)).status).toBe('confirmed');
    // The mandate is fully consumed; replay still returns the stored signature.
    const second = await executeSupplierPayment(WS, envelope, deps);
    expect(second).toEqual({ status: 'replayed', signature: `sig-${envelope.body.intentId}` });
    expect(rail.calls).toHaveLength(1);
    expect(consumedBaseUnits()).toBe('10000');
  });

  it('conflicts on a different signed body under the same intent', async () => {
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    expect(
      (await executeSupplierPayment(WS, signEnvelope(envelopeBody(report)), deps)).status,
    ).toBe('confirmed');
    const tampered = signEnvelope(
      envelopeBody(report, { expiresAt: '2026-11-28T00:00:00.000Z' }),
    );
    expect(await executeSupplierPayment(WS, tampered, deps)).toMatchObject({
      status: 'denied',
      reason: expect.stringContaining('different terms'),
    });
    expect(rail.calls).toHaveLength(1);
  });

  it('denies a new intent on the same reviewed case by case uniqueness, not budget', async () => {
    const rail = fakeRail();
    rail.sendTransfer = async (t) => {
      rail.calls.push(t);
      throw new Error('rpc timeout');
    };
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    // Leave the first claim PENDING so the mandate budget is untouched: the
    // second intent's denial can only come from the reviewed-case constraint.
    expect((await executeSupplierPayment(WS, signEnvelope(body), deps)).status).toBe('pending');
    expect(consumedBaseUnits()).toBe('0');
    const newIntent = signEnvelope({ ...body, intentId: `${body.intentId}-2` });
    const result = await executeSupplierPayment(WS, newIntent, deps);
    expect(result).toMatchObject({
      status: 'denied',
      reason: 'a claim already exists for this reviewed case',
    });
    expect(rail.calls).toHaveLength(1);
    expect(consumedBaseUnits()).toBe('0');
  });

  it('settles a concurrent race with exactly one send and one debit', async () => {
    let releaseSend: () => void = () => {};
    const sendGate = new Promise<void>((resolve) => {
      releaseSend = resolve;
    });
    const rail = fakeRail();
    const base = rail.sendTransfer;
    rail.sendTransfer = async (t) => {
      await sendGate;
      return base(t); // base records the attempt
    };
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const envelope = signEnvelope(envelopeBody(report));
    // Two identical envelopes racing: one claims durably; the loser sees the
    // pending/confirmed claim or the claimed-mandate conflict — never a
    // second dispatch or debit.
    const p1 = executeSupplierPayment(WS, envelope, deps);
    const p2 = executeSupplierPayment(WS, envelope, deps);
    releaseSend();
    const [r1, r2] = await Promise.all([p1, p2]);
    const statuses = [r1.status, r2.status];
    expect(statuses.filter((s) => s === 'confirmed')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'pending' || s === 'denied')).toHaveLength(1);
    expect(rail.calls).toHaveLength(1);
    expect(consumedBaseUnits()).toBe('10000');
  });
});

describe('executeSupplierPayment denials — zero broadcasts, zero debits', () => {
  const deny = async (
    mutate: (deps: SupplierPaymentExecutorDeps, report: Record<string, unknown>) => Promise<{
      workspace?: string;
      envelope?: unknown;
    }>,
  ) => {
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const { workspace = WS, envelope = signEnvelope(envelopeBody(report)) } = await mutate(
      deps,
      report,
    );
    const result = await executeSupplierPayment(workspace, envelope, deps);
    expect(result.status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
    expect(consumedBaseUnits()).toBe('0');
    return result as { status: 'denied'; reason: string };
  };

  it('rejects a rehearsal-schema envelope even when correctly signed', () =>
    deny(async (_deps, report) => ({
      envelope: signEnvelope({ ...envelopeBody(report), schema: REHEARSAL_SCHEMA }),
    })));

  it('rejects a different workspace or mandate binding', async () => {
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    expect((await executeSupplierPayment('ws-other', signEnvelope(envelopeBody(report)), deps)).status).toBe('denied');
    const wrongMandate = signEnvelope(envelopeBody(report, { mandateId: 'other' }));
    expect((await executeSupplierPayment(WS, wrongMandate, deps)).status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
  });

  it('rejects when the deployment is disabled', () =>
    deny(async (deps) => {
      deps.config.enabled = false;
      return {};
    }));

  it('rejects a payee not pinned for the subject', () =>
    deny(async (deps) => {
      deps.config.subjectPayeePins = {};
      return {};
    }));

  it('rejects an env allowlist that is not exactly the bound payee', () =>
    deny(async (deps) => {
      deps.config.envLimits.payeeAllowlist = [PAYEE, PAYEE];
      return {};
    }));

  it('rejects env limits looser than the 0.01 rehearsal amount', () =>
    deny(async (deps) => {
      deps.config.envLimits.runwayUsd = 5;
      return {};
    }));

  it('rejects a chain whose genesis is only the truncated devnet id', async () => {
    const rail = fakeRail();
    rail.getGenesisHash = async () => 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
    const report = baseReport();
    const result = await executeSupplierPayment(
      WS,
      signEnvelope(envelopeBody(report)),
      makeDeps(rail, report),
    );
    expect(result).toMatchObject({ status: 'denied' });
    expect(rail.calls).toHaveLength(0);
  });

  it('rejects altered report bytes under the signed hash', async () => {
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    fs.writeFileSync(
      path.join(reportRoot, `${sha256CanonicalJson(report)}.json`),
      JSON.stringify({ ...report, generatedAt: '2026-11-26T11:00:00.000Z' }),
    );
    const result = await executeSupplierPayment(
      WS,
      signEnvelope(envelopeBody(report)),
      deps,
    );
    expect(result.status).toBe('denied');
    expect(rail.calls).toHaveLength(0);
  });

  it('rejects a parent run that was approval-released', async () => {
    const parentRun = (await creStore.get(worlds[1].parentRun.runId as string))!;
    await creStore.replace({ ...parentRun, approvalState: 'approved' } as never);
    const rail = fakeRail();
    const report = baseReport();
    const result = await executeSupplierPayment(
      WS,
      signEnvelope(envelopeBody(report)),
      makeDeps(rail, report),
    );
    expect(result).toMatchObject({ status: 'denied', reason: expect.stringContaining('approval') });
    expect(rail.calls).toHaveLength(0);
  });

  it('rejects a bundle missing a bound mandate policy', async () => {
    const parentRun = (await creStore.get(worlds[0].parentRun.runId as string))!;
    const artifacts = (parentRun.artifacts as unknown as Record<string, unknown>[]).map((a) => {
      const data = a.data as Record<string, unknown>;
      const { evidenceHash: _dropped, ...bundleCore } = data.evidenceBundle as Record<
        string,
        unknown
      >;
      const tamperedBundle = { ...bundleCore, policyId: null };
      const tamperedHash = sha256CanonicalJson(tamperedBundle);
      // Point the report's evidence ref at the tampered bundle so every hash
      // check passes — only the mandate policy binding can deny.
      worlds[0].stepEvidence = { ...worlds[0].stepEvidence, evidenceHash: tamperedHash };
      return {
        ...a,
        data: {
          ...data,
          evidenceBundle: { ...tamperedBundle, evidenceHash: tamperedHash },
        },
      };
    });
    await creStore.replace({ ...parentRun, artifacts } as never);
    const rail = fakeRail();
    const report = baseReport();
    const result = await executeSupplierPayment(
      WS,
      signEnvelope(envelopeBody(report)),
      makeDeps(rail, report),
    );
    expect(result).toMatchObject({ status: 'denied', reason: expect.stringContaining('policy') });
    expect(rail.calls).toHaveLength(0);
  });

  it('rejects a mandate whose allocation exceeds the 0.01 ceiling', async () => {
    const db = getDb();
    db.prepare("UPDATE funded_mandates SET budget_by_asset = ? WHERE id = ?").run(
      JSON.stringify({
        USDC: {
          authorizedAmount: '100000',
          allocatedAmount: '100000',
          consumedAmount: '0',
          pendingAmount: '100000',
        },
      }),
      MANDATE_ID,
    );
    const rail = fakeRail();
    const report = baseReport();
    const result = await executeSupplierPayment(
      WS,
      signEnvelope(envelopeBody(report)),
      makeDeps(rail, report),
    );
    expect(result).toMatchObject({ status: 'denied', reason: expect.stringContaining('cap') });
    expect(rail.calls).toHaveLength(0);
  });
});

describe('pending claims and reconciliation', () => {
  it('keeps a claim pending across a DB reopen, never redispatches, then reconciles', async () => {
    const rail = fakeRail();
    rail.sendTransfer = async (t) => {
      rail.calls.push(t); // count the attempt before failing
      throw new Error('rpc timeout');
    };
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    const envelope = signEnvelope(body);
    expect((await executeSupplierPayment(WS, envelope, deps)).status).toBe('pending');
    expect(rail.calls).toHaveLength(1);

    // Simulated restart: close and reopen the same test DB file.
    closeDb();
    getDb();
    const claim = SupplierPaymentStore.getClaim(WS, body.intentId);
    expect(claim?.state).toBe('pending');
    const second = await executeSupplierPayment(WS, envelope, deps);
    expect(second.status).toBe('pending');
    expect(rail.calls).toHaveLength(1); // never redispatched

    // Even after the envelope expired, reconciliation against the trusted
    // adapter is allowed — the signed body already bound everything.
    seedReceipt(rail, body.intentId);
    const reconciled = await reconcileSupplierPayment(WS, envelope, {
      ...deps,
      now: Date.parse('2026-12-01T00:00:00.000Z'),
    });
    expect(reconciled).toEqual({ status: 'confirmed', signature: `reconciled-${body.intentId}` });
    expect(rail.calls).toHaveLength(1);
    expect(consumedBaseUnits()).toBe('10000');
    expect(SupplierPaymentStore.getClaim(WS, body.intentId)?.state).toBe('confirmed');
  });

  it('stays pending when the receipt does not match the proposal, then reconciles a corrected receipt', async () => {
    const rail = fakeRail({ payee: '11111111111111111111111111111111' });
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    const envelope = signEnvelope(body);
    expect((await executeSupplierPayment(WS, envelope, deps)).status).toBe('pending');
    expect(SupplierPaymentStore.getClaim(WS, body.intentId)?.state).toBe('pending');
    expect(consumedBaseUnits()).toBe('0');
    // The altered receipt still on the adapter cannot finalize the claim.
    expect((await reconcileSupplierPayment(WS, envelope, deps)).status).toBe('pending');
    // A corrected, proposal-matching receipt finalizes it — one debit total.
    seedReceipt(rail, body.intentId);
    expect((await reconcileSupplierPayment(WS, envelope, deps)).status).toBe('confirmed');
    expect(consumedBaseUnits()).toBe('10000');
    expect(rail.calls).toHaveLength(1);
  });

  it('rolls the mandate debit back when the finalize write fails', async () => {
    const db = getDb();
    db.exec(`
      CREATE TEMP TRIGGER claims_confirm_guard
      BEFORE UPDATE ON supplier_payment_claims
      WHEN NEW.state = 'confirmed'
      BEGIN SELECT RAISE(ABORT, 'forced finalize failure'); END
    `);
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    const envelope = signEnvelope(body);
    const result = await executeSupplierPayment(WS, envelope, deps);
    expect(result.status).toBe('pending');
    expect(SupplierPaymentStore.getClaim(WS, body.intentId)?.state).toBe('pending');
    expect(consumedBaseUnits()).toBe('0'); // consumeBudget rolled back
    db.exec('DROP TRIGGER claims_confirm_guard');
    seedReceipt(rail, body.intentId);
    expect((await reconcileSupplierPayment(WS, envelope, deps)).status).toBe('confirmed');
    expect(consumedBaseUnits()).toBe('10000');
    expect(rail.calls).toHaveLength(1);
  });

  it('reconciles idempotently on the same signature and denies a conflicting one', async () => {
    const rail = fakeRail();
    const report = baseReport();
    const deps = makeDeps(rail, report);
    const body = envelopeBody(report);
    const envelope = signEnvelope(body);
    expect((await executeSupplierPayment(WS, envelope, deps)).status).toBe('confirmed');
    // Identical signature from the adapter — idempotent confirm.
    expect(await reconcileSupplierPayment(WS, envelope, deps)).toEqual({
      status: 'confirmed',
      signature: `sig-${body.intentId}`,
    });
    // A different signature for a confirmed claim is a conflict.
    seedReceipt(rail, body.intentId, { signature: 'different-sig' });
    expect(await reconcileSupplierPayment(WS, envelope, deps)).toMatchObject({
      status: 'denied',
    });
    expect(consumedBaseUnits()).toBe('10000');
  });
});

describe('CRE parent evidence gate — derived from the signal, not the report', () => {
  // Each case replaces one step's world with a parent payload that fails the
  // positive-sufficiency check; the other step keeps the clean default.
  const held: { name: string; stepIndex: number; payload: unknown; risks: string[] }[] = [
    {
      name: 'the step-2 vendor payload carries the Nov 24 warning shape',
      stepIndex: 1,
      payload: {
        legal_name: supplier.name,
        entity_status: 'ACTIVE',
        verdict: 'Caution',
        verified: false,
        review_required: true,
        sanctions: {
          available: false,
          match: null,
          age_seconds: 1382472,
          max_age_seconds: 86400,
        },
      },
      risks: [
        'incomplete_evidence',
        'parent_review_required',
        'parent_unverified',
        'source_stale',
        'source_unavailable',
      ],
    },
    {
      name: 'the step-2 vendor payload is null',
      stepIndex: 1,
      payload: null,
      risks: ['incomplete_evidence'],
    },
    {
      name: 'the step-2 vendor payload is an empty object',
      stepIndex: 1,
      payload: {},
      risks: ['incomplete_evidence'],
    },
    {
      name: 'the vendor reports verified but the non-SDN source is absent',
      stepIndex: 1,
      payload: {
        legal_name: supplier.name,
        entity_status: 'ACTIVE',
        review_required: false,
        verified: true,
        verdict: 'Verified',
        sanctions: { available: true, match: false, age_seconds: 60, max_age_seconds: 86400 },
      },
      risks: ['incomplete_evidence'],
    },
    {
      name: 'the vendor reports a non-clear non-SDN match',
      stepIndex: 1,
      payload: {
        legal_name: supplier.name,
        entity_status: 'ACTIVE',
        review_required: false,
        verified: true,
        verdict: 'Verified',
        sanctions: {
          available: true,
          match: false,
          age_seconds: 60,
          max_age_seconds: 86400,
          non_sdn: { available: true, match: true, age_seconds: 60, max_age_seconds: 86400 },
        },
      },
      risks: ['incomplete_evidence'],
    },
    {
      name: 'the vendor verified a different legal name',
      stepIndex: 1,
      payload: {
        legal_name: 'Unrelated Holdings AG',
        entity_status: 'ACTIVE',
        review_required: false,
        verified: true,
        verdict: 'Verified',
        sanctions: {
          available: true,
          match: false,
          age_seconds: 60,
          max_age_seconds: 86400,
          non_sdn: { available: true, match: false, age_seconds: 60, max_age_seconds: 86400 },
        },
      },
      risks: ['incomplete_evidence'],
    },
    {
      name: 'the step-1 registry payload lacks subject identity',
      stepIndex: 0,
      payload: { found: true },
      risks: ['incomplete_evidence'],
    },
  ];

  for (const c of held) {
    it(`denies with 'CRE parent evidence held' when ${c.name}`, async () => {
      worlds[c.stepIndex] = fx.buildStepWorld(WS, MANDATE_ID, LINEAGE[c.stepIndex], supplier, c.payload);
      await seedWorld();
      const rail = fakeRail();
      const report = baseReport();
      const body = envelopeBody(report);
      const result = await executeSupplierPayment(
        WS,
        signEnvelope(body),
        makeDeps(rail, report),
      );
      expect(result.status).toBe('denied');
      if (result.status !== 'denied') return;
      expect(result.reason).toContain(`step ${c.stepIndex + 1}: CRE parent evidence held`);
      for (const risk of c.risks) expect(result.reason).toContain(risk);
      expect(rail.calls).toHaveLength(0);
      expect(SupplierPaymentStore.getClaim(WS, body.intentId)).toBeUndefined();
      expect(consumedBaseUnits()).toBe('0');
    });
  }
});
