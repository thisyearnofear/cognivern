import { describe, expect, it } from 'vitest';
import { proofDecisionToStamp } from '@/components/landing/proof-flip';
import { LOOP_EXPLORER_STAGES } from '@/components/landing/loop-explorer';
import {
  USE_CASES,
  curlForUseCase,
  verdictJsonForUseCase,
} from '@/components/landing/usecase-api';

describe('proofDecisionToStamp', () => {
  it('maps diligence vocabulary onto the three stamp outcomes', () => {
    expect(proofDecisionToStamp('hold')).toBe('held');
    expect(proofDecisionToStamp('reject')).toBe('denied');
    expect(proofDecisionToStamp('proceed')).toBe('approved');
  });
});

describe('LOOP_EXPLORER_STAGES', () => {
  it('covers the five mandate-loop stages in order', () => {
    expect(LOOP_EXPLORER_STAGES.map((s) => s.key)).toEqual([
      'fund',
      'act',
      'spend',
      'outcome',
      'allocate',
    ]);
  });

  it('matches the live-vs-building product state', () => {
    const byStatus = (status: 'live' | 'building') =>
      LOOP_EXPLORER_STAGES.filter((s) => s.status === status).map((s) => s.key);
    expect(byStatus('live')).toEqual(['fund', 'act', 'spend']);
    expect(byStatus('building')).toEqual(['outcome', 'allocate']);
  });

  it('keeps every stage caption to a single short line', () => {
    for (const stage of LOOP_EXPLORER_STAGES) {
      expect(stage.caption.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(stage.caption).not.toContain('\n');
    }
  });
});

describe('use-case API showcase', () => {
  it('offers the four use-case tabs', () => {
    expect(USE_CASES.map((u) => u.key)).toEqual([
      'payments',
      'procurement',
      'ops',
      'treasury',
    ]);
  });

  it('embeds the per-tab payload into the curl snippet', () => {
    const treasury = USE_CASES.find((u) => u.key === 'treasury')!;
    const curl = curlForUseCase(treasury);
    expect(curl).toContain('"amount": 3500');
    expect(curl).toContain('transfer-new-protocol');
    expect(curl).toContain('/api/governance/evaluate');
    expect(curl).toContain('https://api.cognivern.persidian.com');
  });

  it('syncs the verdict JSON with the use-case decision', () => {
    for (const uc of USE_CASES) {
      const json = verdictJsonForUseCase(uc);
      expect(json).toContain(`"decision": "${uc.verdict.decision}"`);
      expect(json).toContain(`"allowed": ${uc.verdict.decision === 'approved'}`);
    }
  });

  it('varies decisions across tabs so switching visibly updates the verdict', () => {
    const decisions = new Set(USE_CASES.map((u) => u.verdict.decision));
    expect(decisions.size).toBe(3);
  });
});
