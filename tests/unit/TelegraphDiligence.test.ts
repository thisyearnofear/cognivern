import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SpendTracker,
  buildSummary,
  compliantCallBody,
  fillParams,
  finalGovernedDecision,
  gateOutcome,
  governedPrompt,
  modelConfigsFromEnv,
  parseDecision,
  parseRationale,
  payloadRiskSignals,
  stepEvidenceFrom,
  toPublicReport,
  type CaseResult,
  type DiligenceCasesFile,
  type StepEvidence,
} from '../../tooling/scripts/agents/telegraph-diligence.js';

const supplier = {
  name: 'MAHAN AIR',
  type: 'entity' as const,
  country: 'IR',
  paymentUsd: 48000,
  paymentRail: 'SWIFT wire',
};

function step(overrides: Partial<StepEvidence> = {}): StepEvidence {
  return {
    step: 1,
    screenMinerId: '731002',
    verdict: 'clear',
    status: 'approved',
    blocked: false,
    reviewRequired: false,
    parentPurchased: true,
    parentRiskSignals: [],
    ...overrides,
  };
}

function evidence(steps: StepEvidence[], step2Expected = false) {
  return { steps, step2Expected, specialistSpendUsd: 0, escalations: [] };
}

describe('fillParams', () => {
  it('substitutes supplier fields and throws on unknown placeholders', () => {
    expect(fillParams({ name: '$name', type: '$type' }, supplier)).toEqual({
      name: 'MAHAN AIR',
      type: 'entity',
    });
    const individual = { ...supplier, type: 'individual' as const };
    expect(fillParams({ type: '$type' }, individual)).toEqual({ type: 'individual' });
    expect(() => fillParams({ name: '$bogus' }, supplier)).toThrow(/unknown supplier placeholder/);
  });
});

describe('parseDecision', () => {
  it('parses plain JSON', () => {
    expect(parseDecision('{"decision":"proceed","rationale":"ok"}')).toBe('proceed');
  });
  it('parses fenced JSON', () => {
    expect(parseDecision('```json\n{"decision":"hold"}\n```')).toBe('hold');
  });
  it('normalizes case', () => {
    expect(parseDecision('{"decision":"REJECT"}')).toBe('reject');
  });
  it('extracts JSON embedded in prose', () => {
    expect(parseDecision('My answer: {"decision": "hold", "rationale": "unsure"} done.')).toBe(
      'hold',
    );
  });
  it('returns unparseable for garbage', () => {
    expect(parseDecision('I cannot decide')).toBe('unparseable');
    expect(parseDecision('{"decision":"maybe"}')).toBe('unparseable');
  });
});

describe('parseRationale', () => {
  it('returns the rationale string', () => {
    expect(parseRationale('{"decision":"hold","rationale":"needs a human"}')).toBe('needs a human');
  });
  it('caps the rationale at 300 characters', () => {
    const long = 'x'.repeat(400);
    expect(parseRationale(`{"decision":"hold","rationale":"${long}"}`)).toHaveLength(300);
  });
  it('collapses whitespace and returns null when absent', () => {
    expect(parseRationale('{"decision":"hold","rationale":" a   b  c "}')).toBe('a b c');
    expect(parseRationale('{"decision":"hold"}')).toBeNull();
    expect(parseRationale('no json here')).toBeNull();
  });
});

describe('compliantCallBody', () => {
  const specialists = {
    screenA: { minerId: '731002', intent: 'SANCTIONS_SCREENING_MATCH', params: { name: '$name' } },
    screenB: { minerId: '710637', intent: 'SANCTIONS_SCREENING_MATCH', params: { name: '$name' } },
    registry: { minerId: '7393', intent: 'CORPORATE_REGISTRY_LOOKUP', params: { name: '$name' } },
    vendorVerify: { minerId: '7396', intent: 'VENDOR_VERIFY', params: { name: '$name' } },
  };

  it('never emits a settlement block, even if unexpected runtime props are supplied', () => {
    const unexpected = { settlement: { payee: 'payee-wallet', amountUsd: 0.01, intentId: 'c-1' } };
    const registryBody = compliantCallBody({
      parent: specialists.registry,
      screen: specialists.screenA,
      supplier,
      mandateId: 'm-1',
      description: 'd',
      ...unexpected,
    }) as Record<string, unknown>;
    const vendorBody = compliantCallBody({
      parent: specialists.vendorVerify,
      screen: specialists.screenB,
      supplier,
      mandateId: 'm-1',
      description: 'd',
      ...unexpected,
    }) as Record<string, unknown>;

    expect('settlement' in registryBody).toBe(false);
    expect('settlement' in vendorBody).toBe(false);
  });
});

describe('toPublicReport', () => {
  const internalReport = {
    schema: 'cognivern.telegraph.diligence-report.v1',
    policy: 'declared policy',
    execution: {
      api: 'https://api.internal.example',
      dryRun: false,
      startedAt: '2026-11-23T00:00:00Z',
      mandateId: 'telegraph-supplier-diligence',
      spendCapUsd: 0.25,
      casesFileHash: 'abc',
      casesFile: {
        policy: 'declared policy',
        specialists: {
          screenA: {
            minerId: '731002',
            intent: 'SANCTIONS_SCREENING_MATCH',
            params: { name: '$name' },
          },
          screenB: {
            minerId: '710637',
            intent: 'SANCTIONS_SCREENING_MATCH',
            params: { name: '$name' },
          },
          registry: {
            minerId: '7393',
            intent: 'CORPORATE_REGISTRY_LOOKUP',
            params: { name: '$name' },
          },
          vendorVerify: { minerId: '7396', intent: 'VENDOR_VERIFY', params: { name: '$name' } },
        },
      },
      models: [{ label: 'm', provider: 'example', model: 'm1', route: 'direct' }],
    },
    cases: [
      {
        id: 'listed-entity',
        description: 'desc',
        supplier,
        expectedDecision: 'reject' as const,
        groundTruth: { source: 's', assertion: 'a', checkedAt: '2026-11-23' },
        evidence: {
          steps: [
            {
              step: 1,
              screenMinerId: '731002',
              verdict: 'hit',
              providerVerdict: 'BLOCK',
              status: 'denied',
              reviewRequired: false,
              pendingAction: null,
              parentPurchased: false,
              settlementStatus: 'failed',
              costUsd: 0.01,
              latencyMs: 2000,
              screeningRunId: 'run-1',
              gateRunId: 'gate-1',
              parentRunId: null,
              evidenceHash: 'hash-1',
              parentResponseHash: 'phash',
              parentResponse: { secret: 'payload' },
              error: 'HTTP 500 from https://internal.example/path?key=secret',
            } as CaseResult['evidence']['steps'][number],
          ],
          specialistSpendUsd: 0.01,
          escalations: [],
        },
        gate: {
          decision: 'reject' as const,
          decidedBy: 'compliance_gate' as const,
          reasons: ['sanctions_hit'],
        },
        perModel: [
          {
            label: 'm',
            alone: {
              decision: 'proceed' as const,
              correct: false,
              rationale: 'looks fine',
              costUsd: null,
              error: 'boom',
            },
            governed: {
              modelDecision: null,
              finalDecision: 'reject' as const,
              decidedBy: 'compliance_gate',
              correct: true,
              rationale: null,
              costUsd: null,
            },
            decisionChanged: true,
          },
        ],
      } as CaseResult,
    ],
    summary: {
      perModel: [],
      run: { specialistSpendUsd: 0.01, escalations: 0, casesHeld: 0, casesRejected: 1 },
    },
  };

  it('emits the public schema, id, and expected shape', () => {
    const pub = toPublicReport(internalReport, { id: 'test-report' });
    expect(pub.schema).toBe('cognivern.telegraph.diligence-public-report.v1');
    expect(pub.id).toBe('test-report');
    expect(pub.network).toBe('testnet x402 (Base Sepolia)');
    expect(pub.cases[0].evidence.steps[0]).toMatchObject({
      step: 1,
      verdict: 'hit',
      screeningRunId: 'run-1',
      errored: true,
    });
    expect(pub.specialists.screenA).toEqual({
      minerId: '731002',
      intent: 'SANCTIONS_SCREENING_MATCH',
    });
    expect(Array.isArray(pub.honestyBounds)).toBe(true);
  });

  it('carries the Solana settlement as signature + cluster, never a URL', () => {
    const withSettlement = {
      ...internalReport,
      cases: [
        {
          ...internalReport.cases[0],
          evidence: {
            ...internalReport.cases[0].evidence,
            steps: [
              {
                ...internalReport.cases[0].evidence.steps[0],
                settlementTransfer: {
                  rail: 'solana',
                  status: 'settled',
                  cluster: 'mainnet-beta',
                  payee: 'payee-wallet',
                  amountUsd: 0.01,
                  signature: 'sig-1',
                  explorerUrl: 'https://internal-should-not-leak.example/tx/sig-1',
                  intentId: 'listed-entity',
                },
              },
            ],
            settlement: {
              rail: 'solana',
              status: 'settled',
              cluster: 'mainnet-beta',
              payee: 'payee-wallet',
              amountUsd: 0.01,
              signature: 'sig-1',
              explorerUrl: 'https://internal-should-not-leak.example/tx/sig-1',
              intentId: 'listed-entity',
              attemptedStep: 2,
            },
          },
        },
      ],
    };
    const pub = toPublicReport(withSettlement, { id: 'test-report' });
    const step = pub.cases[0].evidence.steps[0] as Record<string, unknown>;
    const settle = pub.cases[0].evidence.settlement as Record<string, unknown>;

    expect(step.settlementTransfer).toMatchObject({
      rail: 'solana',
      status: 'settled',
      cluster: 'mainnet-beta',
      signature: 'sig-1',
    });
    expect(settle).toMatchObject({
      status: 'settled',
      signature: 'sig-1',
      attemptedStep: 2,
    });
    // explorerUrl is derivable — it must not leak into the public report
    // (also keeps the http-string ban below passing).
    expect(JSON.stringify(pub)).not.toContain('explorerUrl');
    expect(JSON.stringify(pub)).not.toContain('http');
  });

  it('never leaks internals: no error/key/url keys and no http strings', () => {
    const pub = toPublicReport(internalReport, { id: 'test-report' });
    const bannedKeys = new Set([
      'error',
      'apiKey',
      'baseUrl',
      'gatewayKey',
      'parentResponse',
      'api',
    ]);
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          expect(bannedKeys.has(key)).toBe(false);
          walk(value);
        }
      } else if (typeof node === 'string') {
        expect(node.toLowerCase().includes('http')).toBe(false);
      }
    };
    walk(pub);
  });
});

describe('gateOutcome', () => {
  it('rejects on a hit that is not held for review', () => {
    const out = gateOutcome(
      evidence([step({ verdict: 'hit', status: 'denied', blocked: true, parentPurchased: false })]),
    );
    expect(out).toEqual({
      decision: 'reject',
      decidedBy: 'compliance_gate',
      reasons: ['sanctions_hit'],
    });
  });
  it('holds on a hit that was held for review (disputed)', () => {
    const out = gateOutcome(
      evidence([
        step({
          verdict: 'hit',
          status: 'held',
          blocked: true,
          reviewRequired: true,
          parentPurchased: false,
        }),
      ]),
    );
    expect(out).toEqual({ decision: 'hold', decidedBy: 'review_hold', reasons: ['disputed_hit'] });
  });
  it('holds on a review verdict at step 1', () => {
    const out = gateOutcome(
      evidence([
        step({
          verdict: 'review',
          status: 'held',
          reviewRequired: true,
          pendingAction: 'review_compliance_verdict',
          parentPurchased: false,
        }),
      ]),
    );
    expect(out?.decision).toBe('hold');
    expect(out?.reasons).toContain('compliance_review');
  });
  it('reports low_confidence_evidence when the purchased parent is held by the confidence gate', () => {
    const out = gateOutcome(
      evidence(
        [
          step({ status: 'held', settlementStatus: 'held', parentPurchased: false }),
          step({ step: 2 }),
        ],
        true,
      ),
    );
    expect(out?.decision).toBe('hold');
    expect(out?.reasons).toEqual(['low_confidence_evidence']);
  });
  it('reports spend_guard and request_error reasons', () => {
    const out = gateOutcome(
      evidence([step({ error: 'HTTP 500', verdict: undefined, parentPurchased: false })]),
    );
    expect(out?.reasons).toContain('request_error');
    const out2 = gateOutcome(
      evidence([
        step({
          verdict: 'unknown',
          blocked: true,
          spendGuardBlocked: true,
          parentPurchased: false,
        }),
      ]),
    );
    expect(out2?.reasons).toEqual(['spend_guard', 'compliance_review']);
  });
  it('returns null when both screens clear and both parents purchased', () => {
    const out = gateOutcome(evidence([step(), step({ step: 2, screenMinerId: '710637' })], true));
    expect(out).toBeNull();
  });
  it('holds when step 1 cleared but step 2 never ran', () => {
    const out = gateOutcome(evidence([step()], true));
    expect(out?.decision).toBe('hold');
  });
  it('holds when a parent purchase did not complete', () => {
    const out = gateOutcome(evidence([step({ parentPurchased: false }), step({ step: 2 })], true));
    expect(out?.decision).toBe('hold');
  });
  it('holds on a spend-guard-blocked step', () => {
    const out = gateOutcome(
      evidence([
        step({
          verdict: 'unknown',
          blocked: true,
          spendGuardBlocked: true,
          parentPurchased: false,
        }),
      ]),
    );
    expect(out?.decision).toBe('hold');
  });
  it('reports settlement_guard when the settlement leg was blocked before screening', () => {
    const out = gateOutcome(
      evidence([
        step({
          verdict: undefined,
          status: 'denied',
          blocked: true,
          parentPurchased: false,
          settlementGuardBlocked: true,
          settlementTransfer: {
            rail: 'solana',
            status: 'blocked',
            reason: 'payee not allowlisted',
          },
        }),
      ]),
    );
    expect(out?.decision).toBe('hold');
    expect(out?.reasons).toContain('settlement_guard');
  });
  it('holds when the parent purchased but the settlement did not settle', () => {
    for (const status of ['failed', 'uncertain', 'unavailable']) {
      const out = gateOutcome(evidence([step({ settlementTransfer: { rail: 'solana', status } })]));
      expect(out?.decision).toBe('hold');
      expect(out?.reasons).toContain('settlement_incomplete');
    }
  });
});


describe('payloadRiskSignals', () => {
  it('returns empty for a benign payload', () => {
    expect(
      payloadRiskSignals({
        verified: true,
        review_required: false,
        sanctions: { available: true, match: null, age_seconds: 100, max_age_seconds: 86400 },
      }),
    ).toEqual([]);
    expect(payloadRiskSignals(null)).toEqual([]);
    expect(payloadRiskSignals('string')).toEqual([]);
  });

  it('detects review flags, unverified subjects and unavailable sources at any depth', () => {
    const out = payloadRiskSignals({
      result: {
        checks: [
          { name: 'ofac', available: false },
          { name: 'registry', verified: false, reviewRequired: true },
        ],
      },
    });
    expect(out).toEqual(['parent_review_required', 'parent_unverified', 'source_unavailable']);
  });

  it('detects stale sources only when age exceeds the maximum', () => {
    expect(payloadRiskSignals({ age_seconds: 1382472, max_age_seconds: 86400 })).toEqual([
      'source_stale',
    ]);
    expect(payloadRiskSignals({ source: { ageSeconds: 90000, maxAgeSeconds: 86400 } })).toEqual([
      'source_stale',
    ]);
    expect(payloadRiskSignals({ age_seconds: 100, max_age_seconds: 86400 })).toEqual([]);
  });
});

describe('structural payload gate (Nov 24 regression)', () => {
  // The Nov 24 registered-clear evidence: both screening miners clear, both
  // parents purchased and approved — but the vendor-verify payload itself
  // said review_required, verified=false, sanctions unavailable, and its SDN
  // copy was ~16x beyond its own maximum age. Before payloadRiskSignals the
  // gate stayed silent and the hold depended on the models noticing.
  const nov24VendorPayload = {
    verdict: 'Caution',
    verified: false,
    review_required: true,
    sanctions: {
      available: false,
      match: null,
      age_seconds: 1382472,
      max_age_seconds: 86400,
    },
  };

  it('the extracted signals match the documented Nov 24 warnings', () => {
    expect(payloadRiskSignals(nov24VendorPayload)).toEqual([
      'parent_review_required',
      'parent_unverified',
      'source_stale',
      'source_unavailable',
    ]);
  });

  it('gateOutcome holds even when every envelope flag is clean', () => {
    const cleanStep = (n: number, miner: string, payload: unknown) =>
      step({
        step: n,
        screenMinerId: miner,
        verdict: 'clear',
        status: 'approved',
        reviewRequired: false,
        settlementStatus: 'settled',
        parentPurchased: true,
        parentRiskSignals: payloadRiskSignals(payload),
        parentResponse: payload,
      });
    const registryPayload = { status: 'active', verified: true };
    const out = gateOutcome(
      evidence(
        [
          cleanStep(1, '731002', registryPayload),
          cleanStep(2, '710637', nov24VendorPayload),
        ],
        true,
      ),
    );
    expect(out?.decision).toBe('hold');
    expect(out?.decidedBy).toBe('review_hold');
    expect(out?.reasons).toEqual(
      expect.arrayContaining([
        'parent_review_required',
        'parent_unverified',
        'source_stale',
        'source_unavailable',
      ]),
    );
    // A model proceed must not override the structural hold.
    const final = finalGovernedDecision(out, 'proceed', false);
    expect(final.decision).toBe('hold');
    expect(final.decidedBy).toBe('review_hold');
  });

  it('a clean payload still lets the gate pass', () => {
    const clean = step({
      parentRiskSignals: [],
      parentResponse: { verified: true, sanctions: { available: true, match: null } },
    });
    expect(gateOutcome(evidence([clean, step({ step: 2, screenMinerId: '710637' })], true))).toBeNull();
  });
});

describe('governedPrompt', () => {
  it('passes the complete parent payload untruncated', () => {
    const long = 'x'.repeat(9000);
    const payload = {
      verdict: 'Caution',
      padding: long,
      review_required: true,
      sanctions: { available: false, match: null },
    };
    const prompt = governedPrompt(supplier, [
      step({
        parentResponse: payload,
        parentRiskSignals: payloadRiskSignals(payload),
      }),
    ]);
    expect(prompt).toContain(long);
    expect(prompt).toContain('"review_required": true');
    expect(prompt).toContain('"available": false');
    expect(prompt).not.toContain('<truncated>');
    expect(prompt.length).toBeGreaterThan(9000);
  });

  it('records null rather than a truncated stub when the parent was never purchased', () => {
    const prompt = governedPrompt(supplier, [step({ parentResponse: undefined })]);
    expect(prompt).toContain('"specialistPayload": null');
  });
});

describe('finalGovernedDecision', () => {
  it('lets the gate override a model proceed', () => {
    const out = finalGovernedDecision(
      { decision: 'reject', decidedBy: 'compliance_gate', reasons: ['sanctions_hit'] },
      'proceed',
      false,
    );
    expect(out.decision).toBe('reject');
    expect(out.decidedBy).toBe('compliance_gate');
    expect(out.modelDecision).toBeNull();
  });
  it('holds with model_unparseable when the model output cannot be parsed', () => {
    const out = finalGovernedDecision(null, 'unparseable', false);
    expect(out).toEqual({
      decision: 'hold',
      decidedBy: 'model_unparseable',
      modelDecision: 'unparseable',
    });
  });
  it('passes through a parsed model decision', () => {
    const out = finalGovernedDecision(null, 'proceed', false);
    expect(out.decision).toBe('proceed');
    expect(out.decidedBy).toBe('model');
  });
});

describe('modelConfigsFromEnv', () => {
  it('normalizes labels and reads per-label env', () => {
    const configs = modelConfigsFromEnv({
      DILIGENCE_MODELS: 'qwen, my-model',
      DILIGENCE_QWEN_BASE_URL: 'https://ms.example/v1',
      DILIGENCE_QWEN_API_KEY: 'k',
      DILIGENCE_QWEN_MODEL: 'qwen-plus',
      DILIGENCE_QWEN_PROVIDER: 'Alibaba Model Studio',
      DILIGENCE_MY_MODEL_BASE_URL: 'https://x.example/v1',
      DILIGENCE_MY_MODEL_API_KEY: 'k2',
      DILIGENCE_MY_MODEL_MODEL: 'm1',
    });
    expect(configs.map((c) => c.label)).toEqual(['qwen', 'my-model']);
    expect(configs[0].provider).toBe('Alibaba Model Studio');
    expect(configs[1].skipped).toBeUndefined();
  });

  it('marks labels missing config as skipped, and costUsd stays null without prices', () => {
    const configs = modelConfigsFromEnv({ DILIGENCE_MODELS: 'nope' });
    expect(configs[0].skipped).toBe('missing config');
    expect(configs[0].inputUsdPerMtok).toBeUndefined();
  });
});

describe('SpendTracker', () => {
  it('0.04 permits exactly one reservation', () => {
    const spend = new SpendTracker(0.04);
    expect([spend.tryReserve(), spend.tryReserve()]).toEqual([true, false]);
    expect(spend.spent).toBe(0.03);
  });

  it('0.06 permits precisely two reservations', () => {
    const spend = new SpendTracker(0.06);
    expect([spend.tryReserve(), spend.tryReserve(), spend.tryReserve()]).toEqual([true, true, false]);
    expect(spend.spent).toBe(0.06);
  });

  it.each([NaN, Infinity, -Infinity, -1])('constructor rejects %s', (cap) => {
    expect(() => new SpendTracker(cap)).toThrow(/finite and nonnegative/);
  });

  it('zero cap permits no reservation', () => {
    const spend = new SpendTracker(0);
    expect(spend.tryReserve()).toBe(false);
    expect(spend.spent).toBe(0);
  });
});

describe('buildSummary', () => {
  it('counts correctness and changed decisions per model', () => {
    const caseResults: CaseResult[] = [
      {
        id: 'a',
        supplier,
        expectedDecision: 'reject',
        groundTruth: { source: 's', assertion: 'a', checkedAt: '2026-11-23' },
        evidence: { steps: [], specialistSpendUsd: 0.02, escalations: [] },
        gate: null,
        perModel: [
          {
            label: 'm',
            alone: { decision: 'proceed', correct: false, costUsd: null },
            governed: {
              modelDecision: 'reject',
              finalDecision: 'reject',
              decidedBy: 'model',
              correct: true,
              costUsd: null,
            },
            decisionChanged: true,
          },
        ],
      },
      {
        id: 'b',
        supplier,
        expectedDecision: 'hold',
        groundTruth: { source: 's', assertion: 'a', checkedAt: '2026-11-23' },
        evidence: { steps: [], specialistSpendUsd: 0.01, escalations: ['run-1'] },
        gate: null,
        perModel: [
          {
            label: 'm',
            alone: { decision: 'hold', correct: true, costUsd: null },
            governed: {
              modelDecision: 'hold',
              finalDecision: 'hold',
              decidedBy: 'model',
              correct: true,
              costUsd: null,
            },
            decisionChanged: false,
          },
        ],
      },
    ];
    const summary = buildSummary(caseResults, [{ label: 'm', provider: 'm' }]);
    expect(summary.perModel[0]).toMatchObject({
      casesRun: 2,
      aloneCorrect: 1,
      governedCorrect: 2,
      decisionsChanged: 1,
    });
    expect(summary.run.specialistSpendUsd).toBeCloseTo(0.03);
    expect(summary.run.escalations).toBe(1);
    expect(summary.run.casesHeld).toBe(1);
    expect(summary.run.casesRejected).toBe(1);
  });
});

describe('shipped cases file', () => {
  it('passes fixture validation', () => {
    const casesPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../tooling/scripts/agents/telegraph-diligence-cases.json',
    );
    const parsed = JSON.parse(readFileSync(casesPath, 'utf8')) as DiligenceCasesFile;
    expect(parsed.schema).toBe('cognivern.telegraph.diligence-cases.v1');
    expect(parsed.cases.map((c) => c.id)).toEqual([
      'listed-entity',
      'registered-clear',
      'unregistered-supplier',
      'individual-name-match',
    ]);
    for (const c of parsed.cases) {
      for (const key of ['screenA', 'screenB', 'registry', 'vendorVerify'] as const) {
        expect(() => fillParams(parsed.specialists[key].params, c.supplier)).not.toThrow();
      }
    }
  });
});

describe('stepEvidenceFrom → gateOutcome parent evidence', () => {
  const compliantResponse = (parentData: unknown, includeResponse = true) => ({
    data: {
      status: 'approved',
      compliance: { screeningMinerId: '710637', verdict: 'clear', providerVerdict: 'CLEAR' },
      evidenceBundle: {
        gate: { runId: 'gate-2', name: 'compliance' },
        settlement: { status: 'settled', runId: 'parent-2' },
        costs: { totalUsd: 0.02 },
      },
      ...(includeResponse ? { response: { data: parentData } } : {}),
    },
  });
  const validVendor = () => ({
    legal_name: 'MAHAN AIR',
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
  });
  const cleanStep1 = () => step({ step: 1, screenMinerId: '731002' });
  const gateHolds = (step2: StepEvidence) =>
    expect(
      gateOutcome(evidence([cleanStep1(), step2], true))?.reasons,
    ).toContain('incomplete_evidence');

  it('accepts a fully verified vendor payload', () => {
    const s2 = stepEvidenceFrom(compliantResponse(validVendor()), 2, 10, '7396', supplier.name);
    expect(s2.parentPurchased).toBe(true);
    expect(s2.parentRiskSignals).toEqual([]);
    expect(gateOutcome(evidence([cleanStep1(), s2], true))).toBeNull();
  });

  it('denies an explicit null parent payload', () => {
    const s2 = stepEvidenceFrom(compliantResponse(null), 2, 10, '7396', supplier.name);
    expect(s2.parentPurchased).toBe(false);
    expect(s2.parentRiskSignals).toEqual(['incomplete_evidence']);
    gateHolds(s2);
  });

  it('denies a settled response with no payload at all', () => {
    const s2 = stepEvidenceFrom(
      compliantResponse(undefined, false),
      2,
      10,
      '7396',
      supplier.name,
    );
    expect(s2.parentPurchased).toBe(false);
    expect(s2.parentRiskSignals).toBeUndefined();
    gateHolds(s2);
  });

  it.each([
    ['a malformed payload', 'junk'],
    ['a payload that never identifies the subject', { verified: true }],
    ['a verified payload missing the non-SDN source', { ...validVendor(), sanctions: { available: true, match: false, age_seconds: 60, max_age_seconds: 86400 } }],
    ['a verified payload for a different legal name', { ...validVendor(), legal_name: 'OTHER CORP' }],
  ])('denies %s', (_label, payload) => {
    const s2 = stepEvidenceFrom(compliantResponse(payload), 2, 10, '7396', supplier.name);
    expect(s2.parentRiskSignals).toContain('incomplete_evidence');
    gateHolds(s2);
  });

  it('denies a registry payload that lacks positive subject identity', () => {
    const s1 = stepEvidenceFrom(compliantResponse({ found: true }), 1, 10, '7393', supplier.name);
    expect(s1.parentRiskSignals).toContain('incomplete_evidence');
    gateHolds(s1);
  });

  it('denies a purchased step whose payload was never inspected', () => {
    const uninspected = step({
      step: 2,
      screenMinerId: '710637',
      parentPurchased: true,
      parentRiskSignals: undefined,
    });
    const out = gateOutcome(evidence([cleanStep1(), uninspected], true));
    expect(out?.decision).toBe('hold');
    expect(out?.reasons).toContain('incomplete_evidence');
  });

  it('serializes parentRiskSignals in the public report only when inspected', () => {
    const report = {
      schema: 'cognivern.telegraph.diligence-report.v1',
      policy: 'declared policy',
      execution: {
        startedAt: '2026-11-26T00:00:00Z',
        mandateId: 'm',
        spendCapUsd: 0.25,
        casesFile: {
          policy: 'p',
          specialists: {
            registry: { minerId: '7393', intent: 'CORPORATE_REGISTRY_LOOKUP', params: {} },
          },
        },
        models: [],
      },
      cases: [
        {
          id: 'c1',
          description: 'd',
          supplier,
          expectedDecision: 'hold',
          groundTruth: { source: 's', assertion: 'a', checkedAt: '2026-11-26' },
          evidence: {
            steps: [
              step({ step: 1, parentRiskSignals: undefined }),
              step({ step: 2, screenMinerId: '710637' }),
            ],
            specialistSpendUsd: 0,
            escalations: [],
          },
          gate: null,
          perModel: [],
        },
      ],
      summary: { perModel: [], run: { specialistSpendUsd: 0, escalations: 0 } },
    } as unknown as Parameters<typeof toPublicReport>[0];
    const pub = toPublicReport(report, { id: 'r' });
    const steps = pub.cases[0].evidence.steps as Record<string, unknown>[];
    expect('parentRiskSignals' in steps[0]).toBe(false);
    expect(steps[1].parentRiskSignals).toEqual([]);
  });
});
