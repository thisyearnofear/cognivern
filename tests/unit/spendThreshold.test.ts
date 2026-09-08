import { describe, it, expect } from 'vitest';
import { meetsApprovalThreshold } from '@backend/services/blockchain/spendThreshold.js';

/**
 * The threshold-gate is pure: spend amount vs policy approvalThreshold, both
 * wei strings (full precision via BigInt). These pin the gating decision so a
 * malformed/absent/zero threshold never blocks a spend, and the boundary is
 * inclusive (>=).
 */
describe('meetsApprovalThreshold', () => {
  it('returns false when the threshold is absent', () => {
    expect(meetsApprovalThreshold('1000', undefined)).toBe(false);
    expect(meetsApprovalThreshold('1000', '')).toBe(false);
  });

  it('returns false for an invalid/empty amount', () => {
    expect(meetsApprovalThreshold(undefined, '500')).toBe(false);
    expect(meetsApprovalThreshold('', '500')).toBe(false);
    expect(meetsApprovalThreshold('abc', '500')).toBe(false);
    expect(meetsApprovalThreshold('10.5', '500')).toBe(false);
  });

  it('returns false when the threshold is malformed', () => {
    expect(meetsApprovalThreshold('1000', 'abc')).toBe(false);
    expect(meetsApprovalThreshold('1000', '10.5')).toBe(false);
  });

  it('never gates when the threshold is zero', () => {
    // A zero threshold would otherwise gate every (non-zero) spend; treat it
    // as "no threshold" so a misconfigured policy can't block all spends.
    expect(meetsApprovalThreshold('1000', '0')).toBe(false);
    expect(meetsApprovalThreshold('1', '0')).toBe(false);
  });

  it('is inclusive at the boundary (>=)', () => {
    expect(meetsApprovalThreshold('500', '500')).toBe(true);
    expect(meetsApprovalThreshold('501', '500')).toBe(true);
    expect(meetsApprovalThreshold('499', '500')).toBe(false);
  });

  it('works with full-precision wei amounts that overflow Number', () => {
    const big = '10000000000000000000'; // 1e19 wei — exceeds Number.MAX_SAFE
    const threshold = '5000000000000000000'; // 5e18 wei
    expect(meetsApprovalThreshold(big, threshold)).toBe(true);
    expect(meetsApprovalThreshold('100000000000000000', threshold)).toBe(false);
  });
});
