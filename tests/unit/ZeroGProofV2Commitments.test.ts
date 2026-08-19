import { describe, expect, it } from 'vitest';
import {
  buildCommitments,
  canonicalJson,
  hashCanonicalJson,
  hashPolicyContent,
  policySetFromChecks,
} from '../../src/shared/zerog-proof-v2.js';

const contractAddress = '0x0000000000000000000000000000000000000001';
const chainId = 16661n;
const runId = '550e8400-e29b-41d4-a716-446655440000';

function input(overrides: Partial<Parameters<typeof buildCommitments>[0]> = {}) {
  return {
    contractAddress,
    chainId,
    runId,
    evidence: {
      action: {
        type: 'spend',
        amount: '1500',
        currency: 'USDC',
      },
      policyChecks: [
        {
          policyId: 'policy-budget',
          result: true,
          reason: 'Within limit',
          metadata: {
            policyVersion: '3',
            policyContentHash: hashCanonicalJson({ id: 'policy-budget', version: '3' }),
          },
        },
      ],
      evidence: { source: 'governance-test' },
    },
    policySet: {
      schemaVersion: 1,
      policies: [
        {
          id: 'policy-budget',
          version: '3',
          contentHash: hashCanonicalJson({ id: 'policy-budget', version: '3' }),
        },
      ],
    },
    decision: 'approved' as const,
    decisionTimestamp: 1_750_000_000,
    ...overrides,
  };
}

describe('GovernanceProofV2 commitments', () => {
  it('canonicalizes object keys while preserving array order', () => {
    expect(canonicalJson({ z: 1, a: ['first', 'second'] })).toBe('{"a":["first","second"],"z":1}');
  });

  it('uses one canonical policy content shape across evaluator paths', () => {
    const policy = {
      id: 'policy-a',
      version: '1',
      name: 'Budget',
      description: 'Spend boundary',
      status: 'active',
      rules: [{ condition: 'amount > 100', action: 'deny' }],
      metadata: {},
    };

    expect(hashPolicyContent(policy)).toBe(hashCanonicalJson(policy));
  });

  it('requires UUID-like run IDs and rejects undefined proof data', () => {
    expect(() => buildCommitments(input({ runId: 'run-42' }))).toThrow(
      'high-entropy UUID-like identifier',
    );
    expect(() =>
      buildCommitments(
        input({
          evidence: {
            ...input().evidence,
            evidence: { source: undefined },
          },
        }),
      ),
    ).toThrow('undefined');
  });

  it('reuses the same proof ID when a retry reuses the frozen decision timestamp', () => {
    const first = buildCommitments(input());
    const retry = buildCommitments(input());

    expect(retry.decisionTimestamp).toBe(first.decisionTimestamp);
    expect(retry.evidenceHash).toBe(first.evidenceHash);
    expect(retry.policySetHash).toBe(first.policySetHash);
    expect(retry.proofId).toBe(first.proofId);
  });

  it('changes the proof ID when a retry mutates the timestamp or decision', () => {
    const first = buildCommitments(input());
    const restamped = buildCommitments(input({ decisionTimestamp: 1_750_000_001 }));
    const changedDecision = buildCommitments(input({ decision: 'held' }));

    expect(restamped.proofId).not.toBe(first.proofId);
    expect(changedDecision.proofId).not.toBe(first.proofId);
  });

  it('rejects conflicting metadata for the same policy', () => {
    expect(() =>
      policySetFromChecks([
        { policyId: 'policy-a', metadata: { policyVersion: '1', policyContentHash: '0x01' } },
        { policyId: 'policy-a', metadata: { policyVersion: '2', policyContentHash: '0x02' } },
      ]),
    ).toThrow('Conflicting canonical policy metadata');
  });

  it('derives an ordered policy set from evaluator metadata', () => {
    const policySet = policySetFromChecks([
      {
        policyId: 'policy-a',
        metadata: { policyVersion: '1', policyContentHash: '0x01' },
      },
      {
        policyId: 'policy-a',
        metadata: { policyVersion: '1', policyContentHash: '0x01' },
      },
      {
        policyId: 'policy-b',
        metadata: { policyVersion: '2', policyContentHash: '0x02' },
      },
    ]);

    expect(policySet).toEqual({
      schemaVersion: 1,
      policies: [
        { id: 'policy-a', version: '1', contentHash: '0x01' },
        { id: 'policy-b', version: '2', contentHash: '0x02' },
      ],
    });
  });
});
