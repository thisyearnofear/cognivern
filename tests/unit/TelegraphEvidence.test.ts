import { describe, expect, it } from 'vitest';
import { buildTelegraphEvidenceBundle } from '../../src/backend/services/telegraph/TelegraphEvidence.js';
import {
  canonicalJson,
  sha256CanonicalJson,
  telegraphArtifactDataHash,
} from '../../src/backend/services/telegraph/stableJson.js';

function input() {
  return {
    attemptId: 'attempt-1',
    workspaceId: 'ws-1',
    agentId: 'agent-1',
    mandateId: 'mandate-1',
    request: {
      bodyHash: 'body-hash',
      intendedCall: {
        minerId: '9002',
        minerName: 'TxLens',
        intent: 'GAS_PRICE',
        paramsHash: 'params-hash',
        paramFields: ['chain'],
        estimatedCostUsd: 0.01,
      },
      compliance: {
        minerId: '731002',
        intent: 'SANCTIONS_SCREENING_MATCH',
        paramsHash: 'subject-hash',
        subjectFields: ['name'],
      },
    },
    screening: {
      status: 'completed' as const,
      runId: 'screen-1',
      artifactId: 'screen-artifact-1',
      artifactHash: 'screen-artifact-hash',
      artifactEvidenceHash: 'screen-artifact-evidence-hash',
      minerId: '731002',
      minerName: 'Counterproof Sanctions Screener',
      intent: 'SANCTIONS_SCREENING_MATCH',
      verdict: 'review',
      providerVerdict: 'REVIEW',
      verdictSource: 'counterproof-adapter',
      detail: 'label=REVIEW',
      confidence: 1,
      costUsd: '0.0100',
      latencyMs: 120,
      paymentNetwork: 'eip155:84532',
      rawResponseHash: 'raw-response-hash',
      source: 'OFAC SDN',
      listVersion: '2026-11-22',
    },
    gate: {
      decision: 'deny' as const,
      name: 'compliance',
      reason: 'screen requires review',
      runId: 'gate-1',
      artifactId: 'gate-artifact-1',
      artifactHash: 'gate-artifact-hash',
    },
    settlement: { status: 'not_attempted' as const },
    spendGuard: {
      enabled: true,
      schema: 'cognivern.telegraph.spend-guard.v1',
      maxTotalCostUsd: 0.03,
      consensusScreens: 1,
    },
    policyViolations: [],
    costs: {
      currency: 'USD' as const,
      screeningUsd: '0.0100',
      parentEstimatedUsd: 0.01,
      parentUsd: null,
      totalUsd: '0.0100',
    },
    replay: {
      endpoint: 'POST /api/telegraph/compliant-call',
      cliCommand: 'telegraph-demo compliant-call',
    },
  };
}

describe('buildTelegraphEvidenceBundle', () => {
  it('links the screen, gate decision, policy evaluation, costs, and replay', () => {
    const bundle = buildTelegraphEvidenceBundle(input());

    expect(bundle.schema).toBe('cognivern.telegraph.compliant-call-evidence.v1');
    expect(bundle.screening).toMatchObject({
      runId: 'screen-1',
      verdict: 'review',
      providerVerdict: 'REVIEW',
      verdictSource: 'counterproof-adapter',
      artifactEvidenceHash: 'screen-artifact-evidence-hash',
    });
    expect(bundle.gate).toMatchObject({
      decision: 'deny',
      runId: 'gate-1',
      artifactHash: 'gate-artifact-hash',
    });
    expect(bundle.settlement).toMatchObject({ status: 'not_attempted' });
    expect(bundle.policyEvaluation).toEqual({ passed: true, violations: [] });
    expect(bundle.costs).toMatchObject({ screeningUsd: '0.0100', totalUsd: '0.0100' });
    expect(typeof bundle.evidenceHash).toBe('string');
    expect((bundle.evidenceHash as string).length).toBe(64);
    expect(canonicalJson(bundle)).not.toContain('ISIL KHORASAN');
  });

  it('hashes canonical JSON deterministically', () => {
    const a = { b: 1, a: [true, { d: undefined, c: 'x' }] };
    const b = { a: [true, { c: 'x' }], b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(sha256CanonicalJson(a)).toBe(sha256CanonicalJson(b));
  });
});

describe('telegraphArtifactDataHash', () => {
  it('excludes evidenceBundle so the bundle can carry a stable artifact hash', () => {
    const core = { miner: { id: '9002' }, compliance: { verdict: 'clear' } };
    const withBundle = { ...core, evidenceBundle: { evidenceHash: 'abc' } };
    expect(telegraphArtifactDataHash(withBundle)).toBe(telegraphArtifactDataHash(core));
  });
});
