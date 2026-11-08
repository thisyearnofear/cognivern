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
