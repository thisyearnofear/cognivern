import { describe, it, expect } from 'vitest';

class MockRes {
  statusCode = 200;
  payload: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: any) {
    this.payload = body;
    return this;
  }
}

function makeReq() {
  return { query: {} } as any;
}

function seededLog(overrides: {
  id: string;
  agent: string;
  composite: number;
  label: string;
  escalated?: boolean;
  reasoning?: string[];
  dimensions?: Record<string, number>;
  timestamp?: string;
}) {
  return {
    id: overrides.id,
    timestamp: overrides.timestamp ?? '2026-06-13T00:00:00.000Z',
    agent: overrides.agent,
    actionType: 'governance.evaluate',
    description: 'test',
    complianceStatus: 'compliant' as const,
    severity: 'low' as const,
    details: {},
    policyChecks: [],
    outcome: 'allowed' as const,
    metadata: {},
    evidence: {
      hash: '0x0',
      suspicion: {
        composite: overrides.composite,
        label: overrides.label,
        escalated: overrides.escalated ?? false,
        reasoning: overrides.reasoning ?? [],
        dimensions: overrides.dimensions ?? {},
      },
    },
  };
}

describe('AuditLogController.getSuspicionInsights', () => {
  it('returns correct distribution, averageScore, and escalationRate', async () => {
    const logs = [
      seededLog({ id: 'r1', agent: 'agent-a', composite: 0.1, label: 'normal', dimensions: { ruleViolations: 0.1 } }),
      seededLog({ id: 'r2', agent: 'agent-a', composite: 0.2, label: 'normal', dimensions: { ruleViolations: 0.2 } }),
      seededLog({ id: 'r3', agent: 'agent-b', composite: 0.15, label: 'normal', dimensions: { temporalAnomaly: 0.15 } }),
      seededLog({ id: 'r4', agent: 'agent-b', composite: 0.5, label: 'elevated', dimensions: { scopeCreep: 0.5 } }),
      seededLog({ id: 'r5', agent: 'agent-c', composite: 0.85, label: 'critical', escalated: true, reasoning: ['high composite'], dimensions: { ruleViolations: 0.9, scopeCreep: 0.8 } }),
    ];

    const stubService = {
      getFilteredLogs: async () => logs,
    } as any;

    const { AuditLogController } = await import(
      '../../src/backend/modules/api/controllers/AuditLogController.js'
    );
    const controller = new AuditLogController(stubService);
    const res = new MockRes();

    await controller.getSuspicionInsights(makeReq(), res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);

    const data = res.payload.data;
    expect(data.totalScored).toBe(5);
    expect(data.distribution.normal).toBe(3);
    expect(data.distribution.elevated).toBe(1);
    expect(data.distribution.critical).toBe(1);
    expect(data.distribution.high).toBe(0);

    // averageScore = (0.1+0.2+0.15+0.5+0.85)/5 = 0.36
    expect(data.averageScore).toBe(0.36);

    // escalationRate = 1/5 * 100 = 20
    expect(data.escalationRate).toBe(20);
  });

  it('returns topAgents sorted by avgScore descending', async () => {
    const logs = [
      seededLog({ id: 'r1', agent: 'agent-a', composite: 0.1, label: 'normal' }),
      seededLog({ id: 'r2', agent: 'agent-a', composite: 0.2, label: 'normal' }),
      seededLog({ id: 'r3', agent: 'agent-b', composite: 0.6, label: 'high' }),
    ];

    const stubService = { getFilteredLogs: async () => logs } as any;
    const { AuditLogController } = await import(
      '../../src/backend/modules/api/controllers/AuditLogController.js'
    );
    const controller = new AuditLogController(stubService);
    const res = new MockRes();

    await controller.getSuspicionInsights(makeReq(), res as any);

    const topAgents = res.payload.data.topAgents;
    expect(topAgents.length).toBe(2);
    expect(topAgents[0].agentId).toBe('agent-b');
    expect(topAgents[0].avgScore).toBe(0.6);
    expect(topAgents[1].agentId).toBe('agent-a');
    expect(topAgents[1].avgScore).toBe(0.15);
  });

  it('returns recentEscalations for escalated entries only', async () => {
    const logs = [
      seededLog({ id: 'r1', agent: 'agent-a', composite: 0.1, label: 'normal' }),
      seededLog({ id: 'r2', agent: 'agent-b', composite: 0.85, label: 'critical', escalated: true, reasoning: ['bad'] }),
    ];

    const stubService = { getFilteredLogs: async () => logs } as any;
    const { AuditLogController } = await import(
      '../../src/backend/modules/api/controllers/AuditLogController.js'
    );
    const controller = new AuditLogController(stubService);
    const res = new MockRes();

    await controller.getSuspicionInsights(makeReq(), res as any);

    const recent = res.payload.data.recentEscations ?? res.payload.data.recentEscalations;
    expect(recent).toHaveLength(1);
    expect(recent[0].runId).toBe('r2');
    expect(recent[0].escalated).toBe(true);
  });

  it('computes dimensionContribution as per-dimension averages', async () => {
    const logs = [
      seededLog({ id: 'r1', agent: 'agent-a', composite: 0.3, label: 'normal', dimensions: { ruleViolations: 0.2, scopeCreep: 0.4 } }),
      seededLog({ id: 'r2', agent: 'agent-a', composite: 0.3, label: 'normal', dimensions: { ruleViolations: 0.6 } }),
    ];

    const stubService = { getFilteredLogs: async () => logs } as any;
    const { AuditLogController } = await import(
      '../../src/backend/modules/api/controllers/AuditLogController.js'
    );
    const controller = new AuditLogController(stubService);
    const res = new MockRes();

    await controller.getSuspicionInsights(makeReq(), res as any);

    const dc = res.payload.data.dimensionContribution;
    // ruleViolations: (0.2+0.6)/2 = 0.4
    expect(dc.ruleViolations).toBe(0.4);
    // scopeCreep: 0.4/1 = 0.4
    expect(dc.scopeCreep).toBe(0.4);
  });

  it('returns 500 with SUSPICION_INSIGHTS_ERROR on service failure', async () => {
    const stubService = {
      getFilteredLogs: async () => { throw new Error('db down'); },
    } as any;

    const { AuditLogController } = await import(
      '../../src/backend/modules/api/controllers/AuditLogController.js'
    );
    const controller = new AuditLogController(stubService);
    const res = new MockRes();

    await controller.getSuspicionInsights(makeReq(), res as any);

    expect(res.statusCode).toBe(500);
    expect(res.payload.success).toBe(false);
    expect(res.payload.error.code).toBe('SUSPICION_INSIGHTS_ERROR');
  });
});
