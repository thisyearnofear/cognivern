import { describe, expect, it } from 'vitest';
import {
  evaluateParentSpendGuard,
  evaluatePostScreenSpendGuard,
  evaluateScreenSpendGuard,
  minerEstimatedCostUsd,
  normalizeSpendGuard,
  TelegraphSpendGuardError,
} from '../../src/backend/services/telegraph/TelegraphSpendGuard.js';
import type { TelegraphMinerIntegration } from '../../src/backend/services/telegraph/types.js';

function miner(overrides: Partial<TelegraphMinerIntegration> = {}): TelegraphMinerIntegration {
  return {
    id: '731002',
    slug: 'counterproof',
    kind: 'http',
    protocol: 'x402',
    name: 'Counterproof Sanctions Screener',
    description: 'screening',
    endpoints: [{ path: '/screen', method: 'GET' }],
    min_price_usdc: 10_000,
    activation_status: 'active',
    ...overrides,
  };
}

describe('normalizeSpendGuard', () => {
  it('normalizes caps, lists, consensus, and budget id', () => {
    const policy = normalizeSpendGuard({
      maxScreeningCostUsd: '0.02',
      maxTotalCostUsd: 0.05,
      allowedMiners: ['9002'],
      allowedIntents: ['GAS_PRICE_GENERAL'],
      subjectDenylist: ['ISIL KHORASAN'],
      consensusScreens: 1,
      budgetId: 'budget-1',
    });

    expect(policy?.maxScreeningCostUsd).toBe(0.02);
    expect(policy?.maxTotalCostUsd).toBe(0.05);
    expect(policy?.allowedIntents).toEqual(['GAS_PRICE']);
    expect(policy?.subjectDenylist).toEqual(['isil khorasan']);
    expect(policy?.budgetId).toBe('budget-1');
  });

  it('rejects malformed policy fields', () => {
    expect(() => normalizeSpendGuard({ maxTotalCostUsd: 'free' })).toThrow(
      TelegraphSpendGuardError,
    );
    expect(() => normalizeSpendGuard({ consensusScreens: 0 })).toThrow(TelegraphSpendGuardError);
  });
});

describe('spend guard evaluation', () => {
  it('denies a denied subject before any screening payment', () => {
    const policy = normalizeSpendGuard({ subjectDenylist: ['ISIL KHORASAN'] });
    const violations = evaluateParentSpendGuard({
      policy,
      requestedMinerId: '9002',
      intent: 'GAS_PRICE',
      subjectParams: { name: 'ISIL KHORASAN' },
    });
    expect(violations).toContain('screened subject matched spendGuard.subjectDenylist');
  });

  it('requires the parent miner to be inside the allowed miner and intent sets', () => {
    const policy = normalizeSpendGuard({
      allowedMiners: ['txlens'],
      allowedIntents: ['GAS_PRICE_GENERAL'],
    });
    const violations = evaluateParentSpendGuard({
      policy,
      requestedMinerId: '9002',
      miner: miner({ id: '9002', slug: 'txlens', name: 'TxLens' }),
      intent: 'GAS_PRICE_GENERAL',
      subjectParams: { name: 'Acme' },
    });
    expect(violations).toEqual([]);
  });

  it('fails closed when total cost cannot be proven', () => {
    const policy = normalizeSpendGuard({ maxTotalCostUsd: 0.03 });
    const violations = evaluateScreenSpendGuard({
      policy,
      miner: miner(),
      minerId: '731002',
      intent: 'SANCTIONS_SCREENING_MATCH',
      parentEstimatedCostUsd: null,
    });
    expect(violations).toContain(
      'maxTotalCostUsd could not be proven because a miner price is unavailable',
    );
  });

  it('enforces screening and total spend caps', () => {
    const policy = normalizeSpendGuard({
      maxScreeningCostUsd: 0.005,
      maxTotalCostUsd: 0.015,
    });
    const violations = evaluateScreenSpendGuard({
      policy,
      miner: miner(),
      minerId: '731002',
      intent: 'SANCTIONS_SCREENING_MATCH',
      parentEstimatedCostUsd: 0.01,
    });
    expect(violations.join(' ')).toContain('screening cost $0.0100 exceeds');
    expect(violations.join(' ')).toContain('estimated total $0.0200 exceeds');
  });

  it('re-checks the actual screen cost before the parent call', () => {
    const policy = normalizeSpendGuard({ maxTotalCostUsd: 0.015 });
    const violations = evaluatePostScreenSpendGuard({
      policy,
      actualScreenCostUsd: '0.0100',
      parentEstimatedCostUsd: 0.01,
    });
    expect(violations).toContain('actual total $0.0200 exceeds maxTotalCostUsd $0.0150');
  });

  it('records multi-screen consensus as an unmet policy instead of pretending support', () => {
    const policy = normalizeSpendGuard({ consensusScreens: 2 });
    const violations = evaluateParentSpendGuard({
      policy,
      requestedMinerId: '9002',
      intent: 'GAS_PRICE',
      subjectParams: { name: 'Acme' },
    });
    expect(violations[0]).toContain('consensusScreens=2');
  });
});

describe('minerEstimatedCostUsd', () => {
  it('converts micro-USDC prices and returns null when absent', () => {
    expect(minerEstimatedCostUsd(miner())).toBe(0.01);
    expect(minerEstimatedCostUsd(miner({ min_price_usdc: undefined }))).toBeNull();
  });
});
