import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import type {
  SupplierPaymentExecutorDeps,
  SupplierPaymentRailReceipt,
} from '@backend/services/telegraph/SupplierPaymentExecutor.js';

const dbPath = path.join(os.tmpdir(), `cognivern-supplier-exec-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import('@backend/db/index.js');
const { FundedMandateService } = await import(
  '@backend/services/governance/FundedMandateService.js'
);
const { CreRunStore } = await import('@backend/cre/storage/CreRunStore.js');
const { buildTelegraphEvidenceBundle } = await import(
  '@backend/services/telegraph/TelegraphEvidence.js'
);
const { canonicalJson, sha256CanonicalJson, telegraphArtifactDataHash } = await import(
  '@backend/services/telegraph/stableJson.js'
);
const { DEVNET_SCHEMA, REHEARSAL_SCHEMA } = await import(
  '@backend/services/telegraph/SupplierPaymentAuthorization.js'
);
const { DEVNET_GENESIS_HASH, executeSupplierPayment, reconcileSupplierPayment } = await import(
  '@backend/services/telegraph/SupplierPaymentExecutor.js'
);
const { initSupplierPaymentClaims, SupplierPaymentStore } = await import(
  '@backend/services/telegraph/SupplierPaymentStore.js'
);

const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const WS = 'ws-supplier-exec';
const MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const PAYEE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAYER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpThe9UPq5aR';
// Independently spelled-out canonical devnet genesis (sdk/src/genesis_config.rs).
const FULL_DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const reportRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-report-root-'));

const supplier = {
  name: 'Example Supplier GmbH',
  type: 'entity',
  country: 'DE',
  paymentUsd: 1200,
  paymentRail: 'SWIFT wire',
};

const LINEAGE: Array<{
  step: number;
  screenMinerId: string;
  screenIntent: string;
  screenParams: Record<string, string>;
  parentMinerId: string;
  parentIntent: string;
  parentParams: Record<string, string>;
}> = [
  {
    step: 1,
    screenMinerId: '731002',
    screenIntent: 'SANCTIONS_SCREENING_MATCH',
    screenParams: { name: '$name', type: '$type' },
    parentMinerId: '7393',
    parentIntent: 'CORPORATE_REGISTRY_LOOKUP',
    parentParams: { name: '$name' },
  },
  {
    step: 2,
    screenMinerId: '710637',
    screenIntent: 'SANCTIONS_SCREENING_MATCH',
    screenParams: { name: '$name' },
    parentMinerId: '7396',
    parentIntent: 'VENDOR_VERIFY',
    parentParams: { name: '$name' },
  },
];

function fill(params: Record<string, string>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = v.startsWith('$') ? (supplier as Record<string, unknown>)[v.slice(1)] : v;
  }
  return out;
}

interface StepWorld {
  screenRun: Record<string, unknown>;
  parentRun: Record<string, unknown>;
  stepEvidence: Record<string, unknown>;
}

function buildStepWorld(mandateId: string, lin: (typeof LINEAGE)[number]): StepWorld {
  const i = lin.step;
  const screenRunId = `screen-run-${i}`;
  const screenArtifactId = `screen-artifact-${i}`;
  const parentRunId = `parent-run-${i}`;
  const parentArtifactId = `parent-artifact-${i}`;

  const screenData = {
    agentId: 'agent-1',
    workspaceId: WS,
    mandateId,
    miner: { id: lin.screenMinerId, name: 'Counterproof Sanctions Screener', intent: lin.screenIntent },
    signal: {
      data: { verdict: 'clear', detail: `screen ${i}` },
      confidence: 1,
      confidenceThreshold: 0.5,
      confidenceMet: true,
    },
    cost: { usd: '0.0100', paymentMethod: 'x402', paid: true },
    latencyMs: 10,
    timestamp: '2026-11-26T10:00:00.000Z',
  };
  const screenArtifactHash = telegraphArtifactDataHash(screenData);
  const screenArtifactEvidenceHash = `${'e'.repeat(63)}${i}`;

  const parentCore = {
    agentId: 'agent-1',
    workspaceId: WS,
    mandateId,
    description: `Diligence case-clear: step ${lin.step}`,
    miner: { id: lin.parentMinerId, name: 'Parent Miner', intent: lin.parentIntent },
    signal: {
      data: { ok: true, step: i },
      confidence: 1,
      confidenceThreshold: 0.5,
      confidenceMet: true,
    },
    cost: { usd: '0.0100', paymentMethod: 'x402', paid: true, paymentNetwork: 'eip155:84532' },
    latencyMs: 10,
    timestamp: '2026-11-26T10:00:00.000Z',
    compliance: {
      gate: 'compliance',
      verdict: 'clear',
      screeningRunId: screenRunId,
      screeningMinerId: lin.screenMinerId,
    },
  };
  const parentArtifactHash = telegraphArtifactDataHash(parentCore);

  const bundle = buildTelegraphEvidenceBundle({
    attemptId: `attempt-${i}`,
    workspaceId: WS,
    agentId: 'agent-1',
    mandateId,
    policyId: 'policy-1',
    request: {
      bodyHash: `body-hash-${i}`,
      intendedCall: {
        minerId: lin.parentMinerId,
        minerName: 'Parent Miner',
        intent: lin.parentIntent,
        paramsHash: sha256CanonicalJson(fill(lin.parentParams)),
        paramFields: ['name'],
        estimatedCostUsd: 0.01,
      },
      compliance: {
        minerId: lin.screenMinerId,
        intent: lin.screenIntent,
        paramsHash: sha256CanonicalJson(fill(lin.screenParams)),
        subjectFields: Object.keys(lin.screenParams),
      },
    },
    screening: {
      status: 'completed',
      runId: screenRunId,
      artifactId: screenArtifactId,
      artifactHash: screenArtifactHash,
      artifactEvidenceHash: screenArtifactEvidenceHash,
      minerId: lin.screenMinerId,
      minerName: 'Counterproof Sanctions Screener',
      intent: lin.screenIntent,
      verdict: 'clear',
      providerVerdict: 'CLEAR',
      rawResponseHash: sha256CanonicalJson(screenData.signal.data),
      costUsd: '0.0100',
      latencyMs: 10,
    },
    gate: {
      decision: 'allow',
      name: 'compliance',
      runId: parentRunId,
      artifactId: parentArtifactId,
      artifactHash: parentArtifactHash,
    },
    settlement: {
      status: 'settled',
      runId: parentRunId,
      artifactId: parentArtifactId,
      artifactHash: parentArtifactHash,
      minerId: lin.parentMinerId,
      minerName: 'Parent Miner',
      intent: lin.parentIntent,
      costUsd: '0.0100',
      paid: true,
      paymentNetwork: 'eip155:84532',
      latencyMs: 10,
    },
    spendGuard: null,
    policyViolations: [],
    costs: {
      currency: 'USD',
      screeningUsd: '0.0100',
      parentEstimatedUsd: 0.01,
      parentUsd: '0.0100',
      totalUsd: '0.0200',
    },
    replay: { endpoint: 'POST /api/telegraph/compliant-call', cliCommand: 'x' },
  });

  const runShape = {
    projectId: WS,
    workflow: 'governance',
    mode: 'cre',
    ok: true,
    status: 'completed',
    approvalState: 'not_required',
    provenance: { source: 'cognivern' },
    steps: [],
  } as const;

  const screenRun = {
    ...runShape,
    runId: screenRunId,
    startedAt: '2026-11-26T10:00:00.000Z',
    artifacts: [
      {
        id: screenArtifactId,
        type: 'telegraph.signal',
        createdAt: '2026-11-26T10:00:00.000Z',
        data: screenData,
        evidence: { hash: screenArtifactEvidenceHash },
      },
    ],
  } as unknown as Record<string, unknown>;

  const parentRun = {
    ...runShape,
    runId: parentRunId,
    startedAt: '2026-11-26T10:00:01.000Z',
    artifacts: [
      {
        id: parentArtifactId,
        type: 'telegraph.signal',
        createdAt: '2026-11-26T10:00:01.000Z',
        data: { ...parentCore, evidenceBundle: bundle },
      },
    ],
  } as unknown as Record<string, unknown>;

  const stepEvidence = {
    step: i,
    screenMinerId: lin.screenMinerId,
    verdict: 'clear',
    status: 'approved',
    blocked: false,
    reviewRequired: false,
    spendGuardBlocked: false,
    settlementGuardBlocked: false,
    pendingAction: null,
    screeningRunId: screenRunId,
    gateRunId: parentRunId,
    parentRunId,
    parentResponseHash: sha256CanonicalJson(parentCore.signal.data),
    evidenceHash: bundle.evidenceHash,
    settlementStatus: 'settled',
    parentPurchased: true,
    costUsd: 0.01,
    latencyMs: 10,
  };

  return { screenRun, parentRun, stepEvidence };
}

let reportCounter = 0;
function buildReport(mandateId: string, steps: Record<string, unknown>[]): Record<string, unknown> {
  // Distinct generatedAt per report keeps each test's binding unique.
  const generatedAt = `2026-11-26T10:${String(10 + reportCounter++).padStart(2, '0')}:00.000Z`;
  const model = (label: string) => ({
    label,
    alone: { decision: 'proceed', correct: true, costUsd: 0.001 },
    governed: {
      modelDecision: 'proceed',
      finalDecision: 'proceed',
      decidedBy: 'model',
      correct: true,
      costUsd: 0.001,
    },
    decisionChanged: false,
  });
  return {
    schema: 'cognivern.telegraph.diligence-report.v1',
    generatedAt,
    policy: 'declared policy',
    execution: {
      api: 'https://api.internal.example',
      dryRun: false,
      startedAt: generatedAt,
      mandateId,
      spendCapUsd: 0.25,
      casesFileHash: 'b'.repeat(64),
      casesFile: {
        policy: 'declared policy',
        specialists: {
          screenA: { minerId: '731002', intent: 'SANCTIONS_SCREENING_MATCH', params: {} },
          screenB: { minerId: '710637', intent: 'SANCTIONS_SCREENING_MATCH', params: {} },
          registry: { minerId: '7393', intent: 'CORPORATE_REGISTRY_LOOKUP', params: {} },
          vendorVerify: { minerId: '7396', intent: 'VENDOR_VERIFY', params: {} },
        },
      },
      models: [{ label: 'qwen', provider: 'alibaba', model: 'qwen-plus', route: 'direct' }],
      evaluatorMinersUsed: false,
    },
    cases: [
      {
        id: 'case-clear',
        supplier,
        expectedDecision: 'reject', // deliberately wrong — never consulted
        groundTruth: { source: 'fixture', assertion: 'synthetic', checkedAt: '2026-11-26' },
        evidence: { steps, specialistSpendUsd: 0.02, escalations: [] },
        gate: null,
        perModel: [model('qwen')],
      },
    ],
    summary: {},
  };
}

let MANDATE_ID = '';
function envelopeBody(report: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const diligenceCase = (report.cases as Record<string, unknown>[])[0];
  return {
    schema: DEVNET_SCHEMA,
    workspaceId: WS,
    mandateId: MANDATE_ID,
    caseId: 'case-clear',
    subjectHash: sha256CanonicalJson(diligenceCase.supplier),
    reportHash: sha256CanonicalJson(report),
    cluster: 'devnet',
    mint: MINT,
    payee: PAYEE,
    amountBaseUnits: '10000',
    intentId: `intent-${MANDATE_ID}`,
    expiresAt: '2026-11-27T12:00:00.000Z',
    ...overrides,
  };
}

function signEnvelope(body: Record<string, unknown>) {
  const signature = cryptoSign(null, Buffer.from(canonicalJson(body), 'utf8'), privateKey);
  return { body, signature: signature.toString('base64') };
}

function fakeRail(receipt?: Partial<SupplierPaymentRailReceipt>) {
  const calls: unknown[] = [];
  const receipts = new Map<string, SupplierPaymentRailReceipt>();
  return {
    calls,
    receipts,
    async getGenesisHash() {
      return FULL_DEVNET_GENESIS;
    },
    async sendTransfer(transfer: unknown): Promise<SupplierPaymentRailReceipt> {
      calls.push(transfer);
      const t = transfer as {
        mint: string;
        payee: string;
        amountBaseUnits: string;
        intentId: string;
      };
      const r: SupplierPaymentRailReceipt = {
        cluster: 'devnet',
        mint: t.mint,
        payee: t.payee,
        payer: PAYER,
        amountBaseUnits: t.amountBaseUnits,
        confirmationStatus: 'confirmed',
        intentId: t.intentId,
        signature: `sig-${t.intentId}`,
        ...receipt,
      };
      receipts.set(t.intentId, r);
      return r;
    },
    async fetchReceipt(intentId: string) {
      return receipts.get(intentId) ?? null;
    },
  };
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
