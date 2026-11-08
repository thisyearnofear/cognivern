import { describe, expect, it } from 'vitest';
import { decisionLayer, summarizeDecisionLayers, normalizeAuditLog } from '@/lib/normalizers';

function log(overrides: Record<string, unknown>) {
  return normalizeAuditLog({ id: 'l1', action: 'spend', timestamp: '2026-01-01T00:00:00Z', ...overrides });
}

describe('decisionLayer', () => {
  it('classifies held decisions as escalation', () => {
    expect(decisionLayer(log({ decision: 'held' }))).toBe('escalation');
  });

  it('classifies denied with a failed policy check as policy', () => {
    const l = log({
      decision: 'denied',
      policyChecks: [{ policyId: 'p1', result: false, reason: 'over budget' }],
    });
    expect(decisionLayer(l)).toBe('policy');
  });

  it('classifies denied without failed checks as evaluation', () => {
    const l = log({
      decision: 'denied',
      policyChecks: [{ policyId: 'p1', result: true, reason: 'ok' }],
    });
    expect(decisionLayer(l)).toBe('evaluation');
  });

  it('classifies approved as cleared', () => {
    expect(decisionLayer(log({ decision: 'approved' }))).toBe('cleared');
  });
});

describe('summarizeDecisionLayers', () => {
  it('counts each layer', () => {
    const counts = summarizeDecisionLayers([
      log({ id: 'a', decision: 'approved' }),
      log({ id: 'b', decision: 'held' }),
      log({ id: 'c', decision: 'denied' }),
      log({ id: 'd', decision: 'denied', policyChecks: [{ policyId: 'p', result: false, reason: 'x' }] }),
    ]);
    expect(counts).toEqual({ policy: 1, evaluation: 1, escalation: 1, cleared: 1 });
  });
});
