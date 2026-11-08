import { describe, expect, it } from 'vitest';
import {
  delegatedSpendEdges,
  detectProgramSignals,
  rollupAgentSpend,
  type AttributionRecord,
} from '@/lib/program-signals';
import type { FundedMandate } from '@/lib/api-client';

function mandate(overrides: Partial<FundedMandate> = {}): FundedMandate {
  return {
    id: 'm1',
    workspaceId: 'w1',
    name: 'Program',
    objective: 'objective',
    agentIds: ['agent-a', 'agent-b', 'agent-c'],
    status: 'active',
    budget: {
      byAsset: {
        USDC: {
          authorizedAmount: '1000',
          allocatedAmount: '0',
          consumedAmount: '100',
          pendingAmount: '0',
        },
      },
    },
    policyIds: [],
    successMetrics: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function record(overrides: Partial<AttributionRecord> = {}): AttributionRecord {
  return {
    runId: 'run-1',
    allocationId: 'alloc-1',
    intentId: 'intent-1',
    agentId: 'agent-a',
    mandateId: 'm1',
    asset: 'USDC',
    requestedAmount: '100',
    allocatedAmount: '100',
    consumedAmount: '100',
    status: 'consumed',
    recordedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

describe('rollupAgentSpend', () => {
  it('rolls up amounts per agent and flags out-of-scope agents', () => {
    const m = mandate();
    const rollups = rollupAgentSpend(m, [
      record({ agentId: 'agent-a', consumedAmount: '100', allocatedAmount: '120' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', consumedAmount: '50' }),
      record({ allocationId: 'alloc-3', agentId: 'outsider', consumedAmount: '10' }),
    ]);
    const a = rollups.find((r) => r.agentId === 'agent-a');
    const outsider = rollups.find((r) => r.agentId === 'outsider');
    expect(a?.inScope).toBe(true);
    expect(a?.consumed).toBe(BigInt(100));
    expect(outsider?.inScope).toBe(false);
  });
});

describe('detectProgramSignals', () => {
  it('returns no signals for empty records', () => {
    expect(detectProgramSignals(mandate(), [])).toEqual([]);
  });

  it('flags spend by agents outside the mandate population', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a' }),
      record({ allocationId: 'alloc-2', agentId: 'rogue-agent' }),
    ]);
    const sig = signals.find((s) => s.id === 'out_of_scope_spend');
    expect(sig?.severity).toBe('critical');
    expect(sig?.evidence[0].reference).toBe('alloc-2');
  });

  it('flags split procurement when multiple agents buy from one provider', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', provider: 'VendA' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', provider: 'VendA' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', provider: 'VendB' }),
    ]);
    const sig = signals.find((s) => s.id === 'split_procurement');
    expect(sig?.title).toContain('VendA');
    expect(signals.filter((s) => s.id === 'split_procurement')).toHaveLength(1);
  });

  it('flags allocation concentration above 60% share', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', consumedAmount: '700', allocatedAmount: '700' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', consumedAmount: '100', allocatedAmount: '100' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', consumedAmount: '100', allocatedAmount: '100' }),
    ]);
    expect(signals.some((s) => s.id === 'allocation_concentration')).toBe(true);
  });

  it('does not flag concentration when spend is evenly spread', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', consumedAmount: '100', allocatedAmount: '100' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', consumedAmount: '100', allocatedAmount: '100' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', consumedAmount: '100', allocatedAmount: '100' }),
    ]);
    expect(signals.some((s) => s.id === 'allocation_concentration')).toBe(false);
  });

  it('flags treasury race at >=80% committed', () => {
    const m = mandate({
      budget: {
        byAsset: {
          USDC: {
            authorizedAmount: '1000',
            allocatedAmount: '0',
            consumedAmount: '850',
            pendingAmount: '0',
          },
        },
      },
    });
    const signals = detectProgramSignals(m, [record()]);
    const sig = signals.find((s) => s.id === 'treasury_race');
    expect(sig?.severity).toBe('warning');
    expect(sig?.detail).toContain('850');
  });

  it('flags approval pressure on accumulated holds', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', status: 'held' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', status: 'held' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', status: 'held' }),
    ]);
    const sig = signals.find((s) => s.id === 'approval_pressure');
    expect(sig?.severity).toBe('warning');
  });
});

describe('delegatedSpendEdges', () => {
  it('groups buyer→beneficiary pairs and flags out-of-scope beneficiaries', () => {
    const m = mandate();
    const edges = delegatedSpendEdges(m, [
      record({ agentId: 'agent-a', onBehalfOfAgentId: 'agent-b', consumedAmount: '100' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-a', onBehalfOfAgentId: 'agent-b', consumedAmount: '50' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', onBehalfOfAgentId: 'rogue', consumedAmount: '25' }),
      record({ allocationId: 'alloc-4', agentId: 'agent-b' }), // no delegation
    ]);
    expect(edges).toHaveLength(2);
    const ab = edges.find((e) => e.beneficiaryAgentId === 'agent-b');
    expect(ab?.buyerAgentId).toBe('agent-a');
    expect(ab?.recordCount).toBe(2);
    expect(ab?.totalConsumed).toBe(BigInt(150));
    expect(ab?.beneficiaryInScope).toBe(true);
    const rogue = edges.find((e) => e.beneficiaryAgentId === 'rogue');
    expect(rogue?.beneficiaryInScope).toBe(false);
  });

  it('flags delegated spend to out-of-scope beneficiaries as critical', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', onBehalfOfAgentId: 'rogue-agent' }),
    ]);
    const sig = signals.find((s) => s.id === 'out_of_scope_spend');
    expect(sig?.severity).toBe('critical');
    expect(sig?.detail).toContain('rogue-agent');
  });
});

describe('delegated_without_coverage', () => {
  it('flags in-scope beneficiaries with no spend records of their own', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', onBehalfOfAgentId: 'agent-b' }),
    ]);
    const sig = signals.find((s) => s.id === 'delegated_without_coverage');
    expect(sig?.severity).toBe('warning');
    expect(sig?.detail).toContain('agent-b');
  });

  it('does not flag beneficiaries who also spend themselves', () => {
    const m = mandate();
    const signals = detectProgramSignals(m, [
      record({ agentId: 'agent-a', onBehalfOfAgentId: 'agent-b' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b' }),
    ]);
    expect(signals.some((s) => s.id === 'delegated_without_coverage')).toBe(false);
  });
});

describe('signal confidence', () => {
  it('grades split procurement by pattern strength', () => {
    const m = mandate();
    // Two agents, same provider, same asset → medium confidence, info severity.
    const weak = detectProgramSignals(m, [
      record({ agentId: 'agent-a', provider: 'VendA' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', provider: 'VendA' }),
    ]);
    const weakSig = weak.find((s) => s.id === 'split_procurement');
    expect(weakSig?.confidence).toBe('medium');
    expect(weakSig?.severity).toBe('info');

    // Three agents → high confidence, warning severity.
    const strong = detectProgramSignals(m, [
      record({ agentId: 'agent-a', provider: 'VendA' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', provider: 'VendA' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', provider: 'VendA' }),
    ]);
    const strongSig = strong.find((s) => s.id === 'split_procurement');
    expect(strongSig?.confidence).toBe('high');
    expect(strongSig?.severity).toBe('warning');
  });
});

describe('computeProgramCoverage', () => {
  const agent = (id: string, budget: string) => ({
    id,
    name: id,
    role: 'agent',
    status: 'active' as const,
    trades: 0,
    budget,
    chain: 'filecoin',
  });

  it('flags members with no spend budget', async () => {
    const { computeProgramCoverage } = await import('@/lib/program-signals');
    const advisories = computeProgramCoverage(mandate(), [
      agent('agent-a', '$100/day'),
      agent('agent-b', '$0'),
      agent('agent-c', 'unlimited'),
    ]);
    const sig = advisories.find((a) => a.id === 'uncovered_member');
    expect(sig?.severity).toBe('warning');
    expect(sig?.detail).toContain('agent-b');
  });

  it('warns when population authority exceeds a fiat treasury', async () => {
    const { computeProgramCoverage } = await import('@/lib/program-signals');
    const m = mandate({
      measurementWindow: { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-11T00:00:00Z' },
      budget: {
        byAsset: {
          USD: { authorizedAmount: '500', allocatedAmount: '0', consumedAmount: '0', pendingAmount: '0' },
        },
      },
    });
    const advisories = computeProgramCoverage(m, [
      agent('agent-a', '$100/day'),
      agent('agent-b', '$100/day'),
      agent('agent-c', '$100/day'),
    ]);
    const sig = advisories.find((a) => a.id === 'over_provisioned');
    // 3 × $100/day × 10 days = $3000 > $500 authorized.
    expect(sig?.severity).toBe('warning');
    expect(sig?.detail).toContain('3,000');
  });

  it('converts USD-pegged base units via the asset registry', async () => {
    const { computeProgramCoverage } = await import('@/lib/program-signals');
    const m = mandate({
      measurementWindow: { startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-01-11T00:00:00Z' },
      budget: {
        byAsset: {
          // 500 USDC at 6 decimals = $500 authorized.
          USDC: { authorizedAmount: '500000000', allocatedAmount: '0', consumedAmount: '0', pendingAmount: '0' },
        },
      },
    });
    const advisories = computeProgramCoverage(m, [
      agent('agent-a', '$100/day'),
      agent('agent-b', '$100/day'),
      agent('agent-c', '$100/day'),
    ]);
    const sig = advisories.find((a) => a.id === 'over_provisioned');
    expect(sig?.severity).toBe('warning');
    expect(sig?.detail).toContain('500000000 base units');
  });

  it('honors decimals overrides for deployment-configured assets', async () => {
    const { computeProgramCoverage } = await import('@/lib/program-signals');
    const m = mandate({
      budget: {
        byAsset: {
          CUSTOM: { authorizedAmount: '100000000', allocatedAmount: '0', consumedAmount: '0', pendingAmount: '0' },
        },
      },
    });
    const agents = [agent('agent-a', '$100/day'), agent('agent-b', '$100/day'), agent('agent-c', '$100/day')];
    // Unknown asset → advisory, no hard check.
    const unknown = computeProgramCoverage(m, agents);
    expect(unknown.some((a) => a.title.includes('cannot be unit-checked'))).toBe(true);
    expect(unknown.some((a) => a.id === 'over_provisioned')).toBe(false);
    // Override → treated as 6-decimal USD-pegged → $100 < $300/day authority…
    const overridden = computeProgramCoverage(m, agents, {
      CUSTOM: { decimals: 6, kind: 'fiat', usdPegged: true },
    });
    expect(overridden.some((a) => a.id === 'over_provisioned')).toBe(true);
  });

  it('marks native assets as not USD-comparable instead of hard-checking', async () => {
    const { computeProgramCoverage } = await import('@/lib/program-signals');
    const m = mandate({
      budget: {
        byAsset: {
          FIL: { authorizedAmount: '1000000000000000000000', allocatedAmount: '0', consumedAmount: '0', pendingAmount: '0' },
        },
      },
    });
    const advisories = computeProgramCoverage(m, [
      agent('agent-a', '$100/day'),
      agent('agent-b', '$100/day'),
      agent('agent-c', '$100/day'),
    ]);
    expect(advisories.some((a) => a.id === 'over_provisioned')).toBe(false);
    expect(advisories.some((a) => a.title.includes('not USD-comparable'))).toBe(true);
  });
});

describe('computeDetectionGap', () => {
  it('detects a gap when population signals fire with no individual overspend', async () => {
    const { computeDetectionGap } = await import('@/lib/program-signals');
    const gap = computeDetectionGap(mandate(), [
      record({ agentId: 'agent-a', provider: 'VendA', consumedAmount: '100', allocatedAmount: '100' }),
      record({ allocationId: 'alloc-2', agentId: 'agent-b', provider: 'VendA', consumedAmount: '100', allocatedAmount: '100' }),
      record({ allocationId: 'alloc-3', agentId: 'agent-c', provider: 'VendA', consumedAmount: '100', allocatedAmount: '100' }),
    ]);
    expect(gap.detected).toBe(true);
    expect(gap.individuallyVisibleViolations).toBe(0);
  });

  it('reports no gap when an agent individually overspent', async () => {
    const { computeDetectionGap } = await import('@/lib/program-signals');
    const gap = computeDetectionGap(mandate(), [
      record({ agentId: 'agent-a', consumedAmount: '500', allocatedAmount: '100' }),
    ]);
    expect(gap.individuallyVisibleViolations).toBe(1);
  });
});

describe('treasuryTrajectory', () => {
  it('builds a cumulative committed series per dominant asset', async () => {
    const { treasuryTrajectory } = await import('@/lib/program-signals');
    const traj = treasuryTrajectory(mandate(), [
      record({ recordedAt: '2026-01-02T00:00:00Z', consumedAmount: '100', allocatedAmount: '0' }),
      record({ allocationId: 'alloc-2', recordedAt: '2026-01-04T00:00:00Z', consumedAmount: '100', allocatedAmount: '0' }),
    ]);
    expect(traj?.asset).toBe('USDC');
    expect(traj?.points).toHaveLength(2);
    expect(traj?.points[1].committed).toBe(BigInt(200));
    expect(traj?.ratePerDay).not.toBeNull();
  });

  it('returns null with no records', async () => {
    const { treasuryTrajectory } = await import('@/lib/program-signals');
    expect(treasuryTrajectory(mandate(), [])).toBeNull();
  });
});
