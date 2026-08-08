import { describe, expect, it } from 'vitest';
import { buildSpendAttributionReport } from '@backend/services/governance/SpendAttributionService.js';
import type { CreRun } from '@backend/cre/types.js';

function run(runId: string, recordedAt: string, data: Record<string, unknown>): CreRun {
  return {
    runId,
    workflow: 'spend',
    mode: 'cre',
    startedAt: recordedAt,
    finishedAt: recordedAt,
    ok: data.status === 'consumed',
    status: data.status === 'consumed' ? 'completed' : 'paused_for_approval',
    steps: [],
    artifacts: [
      {
        id: `${runId}-artifact`,
        type: 'capital_attribution',
        createdAt: recordedAt,
        data,
      },
    ],
  };
}

const base = {
  version: 1,
  allocationId: 'allocation-1',
  intentId: 'intent-1',
  agentId: 'agent-1',
  asset: 'ETH',
  requestedAmount: '100',
  allocatedAmount: '100',
  consumedAmount: '0',
};

describe('SpendAttributionService', () => {
  it('aggregates amounts by asset and keeps the newest lifecycle record', () => {
    const report = buildSpendAttributionReport([
      run('held-run', '2026-01-01T00:00:00.000Z', { ...base, status: 'held' }),
      run('completed-run', '2026-01-01T00:01:00.000Z', {
        ...base,
        status: 'consumed',
        consumedAmount: '100',
        transactionHash: '0x' + 'a'.repeat(64),
      }),
      run('second-intent', '2026-01-01T00:02:00.000Z', {
        ...base,
        intentId: 'intent-2',
        allocationId: 'allocation-2',
        allocatedAmount: '50',
        consumedAmount: '0',
        status: 'held',
      }),
    ]);

    expect(report.totalRecords).toBe(2);
    expect(report.counts.consumed).toBe(1);
    expect(report.counts.held).toBe(1);
    expect(report.totalsByAsset.ETH).toEqual({
      allocatedAmount: '150',
      consumedAmount: '100',
      pendingAmount: '50',
      recordCount: 2,
    });
  });

  it('ignores malformed attribution artifacts instead of inventing amounts', () => {
    const report = buildSpendAttributionReport([
      run('bad', '2026-01-01T00:00:00.000Z', {
        ...base,
        status: 'consumed',
        allocatedAmount: 'not-a-number',
      }),
    ]);

    expect(report.totalRecords).toBe(0);
    expect(report.totalsByAsset).toEqual({});
  });

  it('uses the reconciled lifecycle record when timestamps tie', () => {
    const report = buildSpendAttributionReport([
      run('parent-run', '2026-01-01T00:00:00.000Z', { ...base, status: 'uncertain' }),
      run('child-run', '2026-01-01T00:00:00.000Z', {
        ...base,
        status: 'consumed',
        consumedAmount: '100',
      }),
    ]);

    expect(report.totalRecords).toBe(1);
    expect(report.records[0]?.status).toBe('consumed');
  });

  it('does not let stale consumed evidence hide a newer uncertain lifecycle', () => {
    const report = buildSpendAttributionReport([
      run('old-consumed', '2026-01-01T00:00:00.000Z', {
        ...base,
        status: 'consumed',
        consumedAmount: '100',
      }),
      run('new-uncertain', '2026-01-01T00:02:00.000Z', {
        ...base,
        status: 'uncertain',
      }),
    ]);

    expect(report.totalRecords).toBe(1);
    expect(report.records[0]?.status).toBe('uncertain');
  });
});
