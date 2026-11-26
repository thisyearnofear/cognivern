/**
 * Shared synthetic supplier-payment world for executor tests and the local
 * governed-worker proof harness. Everything here is synthetic: an ephemeral
 * diligence report, CRE run/artifact records shaped like real
 * TelegraphGovernanceHelper output, and a fake rail. Imported by tests and
 * tooling proof harnesses only — never by production code.
 */
import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { buildTelegraphEvidenceBundle } from '@backend/services/telegraph/TelegraphEvidence.js';
import {
  canonicalJson,
  sha256CanonicalJson,
  telegraphArtifactDataHash,
} from '@backend/services/telegraph/stableJson.js';
import type { SupplierPaymentRailReceipt } from '@backend/services/telegraph/SupplierPaymentExecutor.js';

export const SUPPLIER = {
  name: 'Example Supplier GmbH',
  type: 'entity',
  country: 'DE',
  paymentUsd: 1200,
  paymentRail: 'SWIFT wire',
} as const;

export const FIXTURE_NOW = Date.parse('2026-11-26T12:00:00.000Z');
export const FIXTURE_PAYER = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpThe9UPq5aR';
export const FIXTURE_PAYEE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
// Independently spelled-out canonical devnet genesis (sdk/src/genesis_config.rs).
export const FULL_DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export interface StepLineageDef {
  step: number;
  screenMinerId: string;
  screenIntent: string;
  screenParams: Record<string, string>;
  parentMinerId: string;
  parentIntent: string;
  parentParams: Record<string, string>;
}

export const LINEAGE: StepLineageDef[] = [
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

export function fillParams(
  params: Record<string, string>,
  supplier: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = v.startsWith('$') ? supplier[v.slice(1)] : v;
  }
  return out;
}

export interface StepWorld {
  screenRun: Record<string, unknown>;
  parentRun: Record<string, unknown>;
  stepEvidence: Record<string, unknown>;
}

export function buildStepWorld(
  workspaceId: string,
  mandateId: string,
  lin: StepLineageDef,
  supplier: Record<string, unknown> = SUPPLIER,
): StepWorld {
  const i = lin.step;
  const screenRunId = `screen-run-${i}`;
  const screenArtifactId = `screen-artifact-${i}`;
  const parentRunId = `parent-run-${i}`;
  const parentArtifactId = `parent-artifact-${i}`;

  const screenData = {
    agentId: 'agent-1',
    workspaceId,
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
    workspaceId,
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
    workspaceId,
    agentId: 'agent-1',
    mandateId,
    policyId: 'policy-1',
    request: {
      bodyHash: `body-hash-${i}`,
      intendedCall: {
        minerId: lin.parentMinerId,
        minerName: 'Parent Miner',
        intent: lin.parentIntent,
        paramsHash: sha256CanonicalJson(fillParams(lin.parentParams, supplier)),
        paramFields: ['name'],
        estimatedCostUsd: 0.01,
      },
      compliance: {
        minerId: lin.screenMinerId,
        intent: lin.screenIntent,
        paramsHash: sha256CanonicalJson(fillParams(lin.screenParams, supplier)),
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
    projectId: workspaceId,
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

/**
 * A held world: the step evidence records a gate hold so the Gate 1 review
 * blocks and the executor never dispatches.
 */
export function heldStepEvidence(stepEvidence: Record<string, unknown>): Record<string, unknown> {
  return {
    ...stepEvidence,
    status: 'held',
    blocked: true,
    reviewRequired: true,
  };
}

let reportCounter = 0;
export function buildReport(
  mandateId: string,
  steps: Record<string, unknown>[],
  supplier: Record<string, unknown> = SUPPLIER,
): Record<string, unknown> {
  // Distinct generatedAt per report keeps each binding unique.
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

export interface EnvelopeSpec {
  schema: string;
  workspaceId: string;
  mandateId: string;
  caseId?: string;
  cluster: string;
  mint: string;
  payee: string;
  intentId?: string;
  expiresAt?: string;
}

export interface EnvelopeBodyShape extends Record<string, unknown> {
  schema: string;
  workspaceId: string;
  mandateId: string;
  caseId: string;
  subjectHash: string;
  reportHash: string;
  cluster: string;
  mint: string;
  payee: string;
  amountBaseUnits: string;
  intentId: string;
  expiresAt: string;
}

export function envelopeBody(
  report: Record<string, unknown>,
  spec: EnvelopeSpec,
  overrides: Record<string, unknown> = {},
): EnvelopeBodyShape {
  const diligenceCase = (report.cases as Record<string, unknown>[])[0];
  return {
    schema: spec.schema,
    workspaceId: spec.workspaceId,
    mandateId: spec.mandateId,
    caseId: spec.caseId ?? 'case-clear',
    subjectHash: sha256CanonicalJson(diligenceCase.supplier),
    reportHash: sha256CanonicalJson(report),
    cluster: spec.cluster,
    mint: spec.mint,
    payee: spec.payee,
    amountBaseUnits: '10000',
    intentId: spec.intentId ?? `intent-${spec.mandateId}`,
    expiresAt: spec.expiresAt ?? '2026-11-27T12:00:00.000Z',
    ...overrides,
  } as EnvelopeBodyShape;
}

export function signEnvelope(
  privateKey: KeyObject,
  body: Record<string, unknown>,
): { body: Record<string, unknown>; signature: string } {
  const signature = cryptoSign(null, Buffer.from(canonicalJson(body), 'utf8'), privateKey);
  return { body, signature: signature.toString('base64') };
}

export function generateIssuer() {
  return generateKeyPairSync('ed25519');
}

export function fakeRail(opts: {
  cluster: string;
  genesis: string;
  payer: string;
  receipt?: Partial<SupplierPaymentRailReceipt>;
}) {
  const calls: unknown[] = [];
  const receipts = new Map<string, SupplierPaymentRailReceipt>();
  return {
    calls,
    receipts,
    async getGenesisHash() {
      return opts.genesis;
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
        cluster: opts.cluster,
        mint: t.mint,
        payee: t.payee,
        payer: opts.payer,
        amountBaseUnits: t.amountBaseUnits,
        confirmationStatus: 'confirmed',
        intentId: t.intentId,
        signature: `sig-${t.intentId}`,
        ...opts.receipt,
      };
      receipts.set(t.intentId, r);
      return r;
    },
    async fetchReceipt(intentId: string) {
      return receipts.get(intentId) ?? null;
    },
  };
}
