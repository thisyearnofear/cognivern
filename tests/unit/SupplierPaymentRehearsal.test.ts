import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from 'node:crypto';
import {
  canonicalJson,
  sha256CanonicalJson,
} from '../../src/backend/services/telegraph/stableJson.js';
import {
  REHEARSAL_SCHEMA,
  rehearseSupplierPayment,
  reviewSupplierPayment,
  type ProposedTransfer,
} from '../../tooling/scripts/agents/supplier-payment-rehearsal.js';

const NOW = Date.parse('2026-11-26T12:00:00.000Z');
const EXPIRES = '2026-11-27T12:00:00.000Z';
// A valid base58 address that is neither the pinned devnet mint nor the
// system program.
const PAYEE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const { publicKey: otherPublicKey } = generateKeyPairSync('ed25519');

function step(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    step: 1,
    screenMinerId: '731002',
    verdict: 'clear',
    status: 'approved',
    blocked: false,
    reviewRequired: false,
    spendGuardBlocked: false,
    settlementGuardBlocked: false,
    pendingAction: null,
    parentRiskSignals: [],
    screeningRunId: 'run-screen-1',
    gateRunId: 'run-gate-1',
    parentRunId: 'run-parent-1',
    evidenceHash: 'a'.repeat(64),
    settlementStatus: 'settled',
    parentPurchased: true,
    costUsd: 0.01,
    latencyMs: 10,
    ...overrides,
  };
}

function supplier() {
  return {
    name: 'Example Supplier GmbH',
    type: 'entity',
    country: 'DE',
    paymentUsd: 1200,
    paymentRail: 'SWIFT wire',
  };
}

function validReport(): Record<string, unknown> {
  const model = (label: string) => ({
    label,
    alone: {
      decision: 'proceed',
      correct: true,
      costUsd: 0.001,
      rationale: 'synthetic',
    },
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
    generatedAt: '2026-11-24T00:00:00.000Z',
    policy: 'declared policy',
    execution: {
      api: 'https://api.internal.example',
      dryRun: false,
      startedAt: '2026-11-24T00:00:00.000Z',
      mandateId: 'mandate-1',
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
      models: [
        { label: 'qwen', provider: 'alibaba', model: 'qwen-plus', route: 'direct' },
        { label: 'groq', provider: 'groq', model: 'llama', route: 'direct' },
      ],
      evaluatorMinersUsed: false,
    },
    cases: [
      {
        id: 'case-clear',
        description: 'synthetic',
        supplier: supplier(),
        expectedDecision: 'reject', // deliberately wrong: must never be consulted
        groundTruth: { source: 'fixture', assertion: 'synthetic', checkedAt: '2026-11-24' },
        evidence: {
          steps: [
            step({}),
            step({
              step: 2,
              screenMinerId: '710637',
              gateRunId: 'run-gate-2',
              parentRunId: 'run-parent-2',
              screeningRunId: 'run-screen-2',
              evidenceHash: 'b'.repeat(64),
            }),
          ],
          specialistSpendUsd: 0.02,
          escalations: [],
        },
        gate: null,
        perModel: [model('qwen'), model('groq')],
      },
    ],
    summary: {},
  };
}

function bodyFor(report: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const diligenceCase = (report.cases as Record<string, unknown>[])[0];
  return {
    schema: REHEARSAL_SCHEMA,
    workspaceId: 'ws-1',
    mandateId: 'mandate-1',
    caseId: 'case-clear',
    subjectHash: sha256CanonicalJson(diligenceCase.supplier),
    reportHash: sha256CanonicalJson(report),
    cluster: 'devnet',
    mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    payee: PAYEE,
    amountBaseUnits: '10000',
    intentId: 'intent-1',
    expiresAt: EXPIRES,
    ...overrides,
  };
}

function signEnvelope(
  body: Record<string, unknown>,
  key: KeyObject = privateKey,
): Record<string, unknown> {
  const signature = cryptoSign(null, Buffer.from(canonicalJson(body), 'utf8'), key);
  return { body, signature: signature.toString('base64') };
}

function expectBlocked(result: unknown, match: RegExp) {
  expect(result).toMatchObject({ status: 'blocked' });
  expect((result as { reason: string }).reason).toMatch(match);
}

describe('reviewSupplierPayment', () => {
  it('returns eligible for a valid signed authorization over a clean report', () => {
    const report = validReport();
    const result = reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, NOW);
    expect(result).toEqual({
      status: 'eligible_for_rehearsal',
      body: bodyFor(report),
      reportHash: sha256CanonicalJson(report),
      proposedTransfer: {
        workspaceId: 'ws-1',
        mandateId: 'mandate-1',
        caseId: 'case-clear',
        intentId: 'intent-1',
        cluster: 'devnet',
        mint: MINT,
        payee: PAYEE,
        amountBaseUnits: '10000',
        expiresAt: EXPIRES,
      },
    });
  });

  it('blocks a clear screen with a held parent even when step 2 and models proceeded', () => {
    const report = validReport();
    const steps = ((report.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>)
      .steps as Record<string, unknown>[];
    steps[0].status = 'held';
    steps[0].settlementStatus = 'held';
    steps[0].parentPurchased = false;
    const env = signEnvelope(bodyFor(report));
    const recorded: ProposedTransfer[] = [];
    expectBlocked(
      rehearseSupplierPayment(report, env, publicKey, NOW, (t) => recorded.push(t)),
      /step 1: status is not approved/,
    );
    expect(recorded).toHaveLength(0);
  });

  it('blocks a later human-released step status', () => {
    const report = validReport();
    const steps = ((report.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>)
      .steps as Record<string, unknown>[];
    steps[0].status = 'released';
    expectBlocked(
      reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, NOW),
      /status is not approved/,
    );
  });

  it('blocks when a step is missing', () => {
    const report = validReport();
    const ev = (report.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>;
    ev.steps = [(ev.steps as Record<string, unknown>[])[0]];
    expectBlocked(
      reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, NOW),
      /exactly steps 1 and 2/,
    );
  });

  it('blocks on a gate hold and on a final non-proceed decision', () => {
    const report = validReport();
    const diligenceCase = (report.cases as Record<string, unknown>[])[0];
    diligenceCase.gate = { decision: 'reject', decidedBy: 'compliance_gate', reasons: ['x'] };
    expectBlocked(
      reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, NOW),
      /gate hold/,
    );

    const report2 = validReport();
    const perModel = (report2.cases as Record<string, unknown>[])[0].perModel as Record<
      string,
      unknown
    >[];
    (perModel[0].governed as Record<string, unknown>).finalDecision = 'hold';
    expectBlocked(
      reviewSupplierPayment(report2, signEnvelope(bodyFor(report2)), publicKey, NOW),
      /not a model proceed/,
    );

    const report3 = validReport();
    const perModel3 = (report3.cases as Record<string, unknown>[])[0].perModel as Record<
      string,
      unknown
    >[];
    (perModel3[1].governed as Record<string, unknown>).finalDecision = 'reject';
    expectBlocked(
      reviewSupplierPayment(report3, signEnvelope(bodyFor(report3)), publicKey, NOW),
      /not a model proceed/,
    );
  });

  it('blocks a dry-run report and a report with no models', () => {
    const report = validReport();
    (report.execution as Record<string, unknown>).dryRun = true;
    expectBlocked(
      reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, NOW),
      /dry run/,
    );
    const report2 = validReport();
    (report2.execution as Record<string, unknown>).models = [];
    expectBlocked(
      reviewSupplierPayment(report2, signEnvelope(bodyFor(report2)), publicKey, NOW),
      /no models/,
    );
  });

  it('blocks malformed or incomplete evidence bindings', () => {
    // Duplicated configured model labels make coverage ambiguous.
    const dupModels = validReport();
    const dupExecution = dupModels.execution as Record<string, unknown>;
    dupExecution.models = [
      ...(dupExecution.models as unknown[]),
      { label: 'qwen', provider: 'x', model: 'y', route: 'direct' },
    ];
    expectBlocked(
      reviewSupplierPayment(dupModels, signEnvelope(bodyFor(dupModels)), publicKey, NOW),
      /duplicate configured model label/,
    );

    // Missing supplier: nothing usable to hash for subjectHash.
    const noSupplier = validReport();
    delete (noSupplier.cases as Record<string, unknown>[])[0].supplier;
    expectBlocked(
      reviewSupplierPayment(noSupplier, signEnvelope(bodyFor(noSupplier)), publicKey, NOW),
      /supplier is missing or malformed/,
    );

    // Missing run references and repeated refs across steps.
    const missingRef = validReport();
    const missingRefSteps = (
      (missingRef.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>
    ).steps as Record<string, unknown>[];
    delete missingRefSteps[1].gateRunId;
    expectBlocked(
      reviewSupplierPayment(missingRef, signEnvelope(bodyFor(missingRef)), publicKey, NOW),
      /missing gate run reference/,
    );
    const reusedRef = validReport();
    const reusedRefSteps = (
      (reusedRef.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>
    ).steps as Record<string, unknown>[];
    reusedRefSteps[1].parentRunId = reusedRefSteps[0].parentRunId;
    expectBlocked(
      reviewSupplierPayment(reusedRef, signEnvelope(bodyFor(reusedRef)), publicKey, NOW),
      /reuse the same parentRunId/,
    );

    // Guard flags absent rather than explicitly false.
    const absentFlags = validReport();
    const absentSteps = (
      (absentFlags.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>
    ).steps as Record<string, unknown>[];
    delete absentSteps[0].blocked;
    delete absentSteps[0].reviewRequired;
    expectBlocked(
      reviewSupplierPayment(absentFlags, signEnvelope(bodyFor(absentFlags)), publicKey, NOW),
      /blocked flag missing/,
    );

    // Non-finite review clock and a signature in the wrong encoding.
    const report = validReport();
    expectBlocked(
      reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, Number.NaN),
      /clock/,
    );
    const env = signEnvelope(bodyFor(report));
    const hexSignature = Buffer.from(env.signature as string, 'base64').toString('hex');
    expectBlocked(
      reviewSupplierPayment(report, { ...env, signature: hexSignature }, publicKey, NOW),
      /schema/,
    );
  });

  it('blocks when parent risk signals are missing or non-empty', () => {
    // Missing entirely — the payload was never structurally inspected.
    const missing = validReport();
    const missingSteps = (
      (missing.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>
    ).steps as Record<string, unknown>[];
    delete missingSteps[1].parentRiskSignals;
    expectBlocked(
      reviewSupplierPayment(missing, signEnvelope(bodyFor(missing)), publicKey, NOW),
      /parent risk signals missing or non-empty/,
    );

    // Non-empty — the Nov 24 shape: clean envelope, but the vendor-verify
    // payload itself carried review/staleness warnings.
    const flagged = validReport();
    const flaggedSteps = (
      (flagged.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>
    ).steps as Record<string, unknown>[];
    flaggedSteps[1].parentRiskSignals = ['parent_review_required', 'source_stale'];
    expectBlocked(
      reviewSupplierPayment(flagged, signEnvelope(bodyFor(flagged)), publicKey, NOW),
      /parent risk signals missing or non-empty/,
    );
  });

  it('blocks when a later human release touched the case evidence', () => {
    const report = validReport();
    const steps = ((report.cases as Record<string, unknown>[])[0].evidence as Record<string, unknown>)
      .steps as Record<string, unknown>[];
    steps[0].settlementTransfer = {
      rail: 'solana',
      status: 'settled',
      reason: 'released by operator',
    };
    expectBlocked(
      reviewSupplierPayment(report, signEnvelope(bodyFor(report)), publicKey, NOW),
      /transfer record/,
    );
  });

  it('blocks on any post-signing tampering with terms, identity, or report bytes', () => {
    const report = validReport();
    const base = bodyFor(report);
    const signed = signEnvelope(base);
    // Schema-shape fields (payee, intentId, ids, subjectHash) fail signature;
    // literal-pinned fields (mint, amountBaseUnits) fail the schema earlier.
    const tampered: [Record<string, unknown>, RegExp][] = [
      [{ ...base, payee: '11111111111111111111111111111111' }, /signature does not verify/],
      [{ ...base, amountBaseUnits: '20000' }, /v1 schema/],
      [{ ...base, intentId: 'intent-2' }, /signature does not verify/],
      [{ ...base, mandateId: 'mandate-2' }, /signature does not verify/],
      [{ ...base, workspaceId: 'ws-2' }, /signature does not verify/],
      [
        { ...base, mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
        /v1 schema/,
      ],
      [{ ...base, subjectHash: '0'.repeat(64) }, /signature does not verify/],
    ];
    for (const [mutated, match] of tampered) {
      expectBlocked(
        reviewSupplierPayment(report, { ...signed, body: mutated }, publicKey, NOW),
        match,
      );
    }
    // Report bytes changed after signing: reportHash no longer matches.
    const changedReport = { ...validReport(), generatedAt: '2026-11-25T00:00:00.000Z' };
    expectBlocked(
      reviewSupplierPayment(changedReport, signEnvelope(bodyFor(report)), publicKey, NOW),
      /reportHash/,
    );
  });

  it('blocks a valid body signed with the wrong key or already expired', () => {
    const report = validReport();
    expectBlocked(
      reviewSupplierPayment(
        report,
        signEnvelope(bodyFor(report), generateKeyPairSync('ed25519').privateKey),
        publicKey,
        NOW,
      ),
      /signature does not verify/,
    );
    const expired = bodyFor(report, { expiresAt: '2026-11-25T12:00:00.000Z' });
    const expiredResult = reviewSupplierPayment(
      report,
      signEnvelope(expired),
      otherPublicKey,
      NOW,
    );
    expectBlocked(expiredResult, /signature does not verify|expired/);
    const expiredAgainstTrusted = reviewSupplierPayment(
      report,
      signEnvelope(expired, privateKey),
      publicKey,
      NOW,
    );
    expectBlocked(expiredAgainstTrusted, /expired/);
  });

  it('rejects malformed inputs before accessing fields', () => {
    expectBlocked(reviewSupplierPayment(null, {}, publicKey, NOW), /schema/);
    expectBlocked(reviewSupplierPayment(validReport(), 'nope', publicKey, NOW), /schema/);
    expectBlocked(
      reviewSupplierPayment(validReport(), { body: {}, signature: 'x' }, publicKey, NOW),
      /schema/,
    );
  });
});

describe('rehearseSupplierPayment', () => {
  it('records exactly one proposed transfer for an eligible review', () => {
    const report = validReport();
    const recorded: ProposedTransfer[] = [];
    const result = rehearseSupplierPayment(
      report,
      signEnvelope(bodyFor(report)),
      publicKey,
      NOW,
      (t) => recorded.push(t),
    );
    expect(result.status).toBe('eligible_for_rehearsal');
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual({
      workspaceId: 'ws-1',
      mandateId: 'mandate-1',
      caseId: 'case-clear',
      intentId: 'intent-1',
      cluster: 'devnet',
      mint: MINT,
      payee: PAYEE,
      amountBaseUnits: '10000',
      expiresAt: EXPIRES,
    });
  });

  it('records nothing on a blocked review — no actual debit is exercised', () => {
    const report = validReport();
    const recorded: ProposedTransfer[] = [];
    const result = rehearseSupplierPayment(
      report,
      signEnvelope(bodyFor(report), generateKeyPairSync('ed25519').privateKey),
      publicKey,
      NOW,
      (t) => recorded.push(t),
    );
    expect(result.status).toBe('blocked');
    expect(recorded).toHaveLength(0);
  });
});
