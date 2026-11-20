import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Anjoman service unit tests.
 *
 * Coverage:
 *  - /agent/chat request shape (Bearer key, stream:false, maxSpendUsd)
 *  - Immediate 200 answers vs the 202 async-job path
 *  - Job polling on typed status (never resolves early on a pending job)
 *  - Timeout → cancel, failed/cancelled job → terminal failure
 *  - Escrow balance + spend report reads
 *  - Governed task: telegraph.signal artifact, anjoman_api_key payment
 *    method, fail-safe held (no miner confidence signal)
 */

const config = {
  enabled: true,
  apiUrl: 'https://backend.test',
  apiKey: 'anjoman_test_key',
  taskTimeoutMs: 5_000,
  pollIntervalMs: 1,
};

type FetchCall = { url: string; init?: RequestInit };

function makeFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  const calls: FetchCall[] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  };
  return { calls, fetchFn: fetchFn as never };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('AnjomanService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function makeService(fetchFn: unknown, extra: Record<string, unknown> = {}) {
    const { AnjomanService } = await import('../../src/backend/services/anjoman/AnjomanService.js');
    return new AnjomanService(
      { ...config, ...extra },
      {
        fetchFn: fetchFn as never,
        sleep: async () => {},
      },
    );
  }

  it('runTask: posts to /agent/chat with Bearer key and returns the answer', async () => {
    const { calls, fetchFn } = makeFetch(() =>
      json({
        answer: 'Vendor is not on any sanctions list.',
        sources: [{ minerId: '731002', minerName: 'Counterproof' }],
        costUsd: 0.03,
        conversationId: 'conv-1',
      }),
    );
    const svc = await makeService(fetchFn);

    const result = await svc.runTask({ message: 'Screen vendor Acme', maxSpendUsd: 0.5 });

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.answer).toContain('sanctions');
    expect(result.sources?.[0].minerId).toBe('731002');
    expect(result.costUsd).toBe('0.0300');
    expect(result.conversationId).toBe('conv-1');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://backend.test/agent/chat');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer anjoman_test_key');
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body).toEqual({ stream: false, message: 'Screen vendor Acme', maxSpendUsd: 0.5 });
  });

  it('runTask: canonical intent + params path needs no message', async () => {
    const { calls, fetchFn } = makeFetch(() => json({ answer: '0.42', costUsd: '0.01' }));
    const svc = await makeService(fetchFn, { defaultMaxSpendUsd: 0.25 });

    const result = await svc.runTask({
      intent: 'GAS_PRICE_GENERAL',
      params: { chain: 'base' },
    });

    expect(result.success).toBe(true);
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.intent).toBe('GAS_PRICE_GENERAL');
    expect(body.params).toEqual({ chain: 'base' });
    expect(body.maxSpendUsd).toBe(0.25); // default applied when caller omits
    expect(body.message).toBeUndefined();
  });

  it('runTask: rejects a request with neither message nor intent', async () => {
    const { calls, fetchFn } = makeFetch(() => json({}));
    const svc = await makeService(fetchFn);

    const result = await svc.runTask({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('message or intent');
    expect(calls).toHaveLength(0);
  });

  it('runTask: 202 job polls until a terminal status, then returns the answer', async () => {
    const statuses = ['running', 'running', 'completed'];
    let polls = 0;
    const { calls, fetchFn } = makeFetch((url) => {
      if (url.endsWith('/agent/chat')) {
        return json({ jobId: 'job-9' }, 202);
      }
      if (url.includes('/agent/jobs/job-9')) {
        const status = statuses[Math.min(polls++, statuses.length - 1)];
        return json({ status, answer: 'screened', costUsd: '0.05' });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const svc = await makeService(fetchFn);

    const result = await svc.runTask({ message: 'deep task' });

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
    expect(result.jobId).toBe('job-9');
    expect(result.answer).toBe('screened');
    expect(result.costUsd).toBe('0.05');
    expect(polls).toBe(3); // kept polling through "running" — no early resolve
    expect(calls.some((c) => c.url.includes('/agent/jobs/job-9'))).toBe(true);
  });

  it('runTask: a failed job is a terminal failure', async () => {
    const { fetchFn } = makeFetch((url) => {
      if (url.endsWith('/agent/chat')) return json({ jobId: 'job-bad' }, 202);
      return json({ status: 'failed' });
    });
    const svc = await makeService(fetchFn);

    const result = await svc.runTask({ message: 'boom' });
    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.jobId).toBe('job-bad');
    expect(result.error).toContain('failed');
  });

  it('runTask: timeout cancels the job and reports cancelled', async () => {
    const cancelled: string[] = [];
    const { fetchFn } = makeFetch((url) => {
      if (url.endsWith('/agent/chat')) return json({ jobId: 'job-slow' }, 202);
      if (url.endsWith('/cancel')) {
        cancelled.push(url);
        return json({ ok: true });
      }
      return json({ status: 'running' }); // never finishes
    });
    const svc = await makeService(fetchFn, { taskTimeoutMs: 30 });

    const result = await svc.runTask({ message: 'too slow' });
    expect(result.success).toBe(false);
    expect(result.status).toBe('cancelled');
    expect(result.error).toContain('did not finish');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toContain('/agent/jobs/job-slow/cancel');
  });

  it('runTask: non-ok responses surface status and body', async () => {
    const { fetchFn } = makeFetch(() => new Response('rate limit exceeded', { status: 429 }));
    const svc = await makeService(fetchFn);

    const result = await svc.runTask({ message: 'hi' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('429');
    expect(result.error).toContain('rate limited');
  });

  it('runTask: disabled service fails without touching the network', async () => {
    const { calls, fetchFn } = makeFetch(() => json({}));
    const svc = await makeService(fetchFn, { apiKey: undefined, enabled: false });

    const result = await svc.runTask({ message: 'hi' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ANJOMAN_API_KEY');
    expect(calls).toHaveLength(0);
  });

  it('getEscrowBalance + getSpend read account surfaces', async () => {
    const { calls, fetchFn } = makeFetch((url) => {
      if (url.includes('/engine/escrow/balance')) return json({ balance: 2.5 });
      if (url.includes('/agent/spend'))
        return json({ jobs: [{ jobId: 'j1', costUsd: 0.03 }], totalCostUsd: 0.03 });
      throw new Error(`unexpected: ${url}`);
    });
    const svc = await makeService(fetchFn);

    expect(await svc.getEscrowBalance()).toBe('2.5');
    const spend = await svc.getSpend();
    expect(spend.entries).toHaveLength(1);
    expect(spend.totalCostUsd).toBe('0.0300');
    expect(
      calls.every((c) => {
        const h = c.init?.headers as Record<string, string>;
        return h.Authorization === 'Bearer anjoman_test_key';
      }),
    ).toBe(true);
  });

  it('getStatus: ready=false without a key; reachable + balance with one', async () => {
    const { AnjomanService } = await import('../../src/backend/services/anjoman/AnjomanService.js');
    const noKey = new AnjomanService({ ...config, apiKey: undefined });
    expect((await noKey.getStatus()).ready).toBe(false);

    const { fetchFn } = makeFetch(() => json({ balance: 1.25 }));
    const svc = await makeService(fetchFn);
    const status = await svc.getStatus();
    expect(status.ready).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.escrowBalanceUsd).toBe('1.25');
  });
});

// ---------------------------------------------------------------------------
// Governed task (TelegraphGovernanceHelper.governedAnjomanTask)
// ---------------------------------------------------------------------------

describe('governedAnjomanTask', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps a completed task into a held telegraph.signal artifact', async () => {
    const { telegraphGovernanceHelper } = await import(
      '../../src/backend/services/telegraph/TelegraphGovernanceHelper.js'
    );
    const { anjomanService } = await import('../../src/backend/services/anjoman/AnjomanService.js');

    vi.spyOn(anjomanService, 'runTask').mockResolvedValue({
      success: true,
      status: 'completed',
      answer: 'Acme Ltd is clear — no sanctions or fraud flags.',
      sources: [
        { minerId: '731002', minerName: 'Counterproof', costUsd: '0.01' },
        { minerId: '18', minerName: 'CompanyResearch', costUsd: '0.02' },
      ],
      costUsd: '0.0300',
      jobId: 'job-1',
      latencyMs: 4200,
    });

    const result = await telegraphGovernanceHelper.governedAnjomanTask({
      agentId: 'agent-1',
      mandateId: 'mandate-1',
      task: { message: 'Screen vendor Acme for a sealed-bid round' },
    });

    // Fail-safe: no miner confidence → held, never auto-approved.
    expect(result.success).toBe(true);
    expect(result.status).toBe('held');
    expect(result.decision?.confidenceKnown).toBe(false);
    expect(result.decision?.approved).toBe(false);

    expect(result.artifact?.type).toBe('telegraph.signal');
    const data = result.artifact!.data as Record<string, unknown>;
    const cost = data.cost as Record<string, unknown>;
    expect(cost.paymentMethod).toBe('anjoman_api_key');
    expect(cost.usd).toBe('0.0300');
    const miner = data.miner as Record<string, unknown>;
    expect(miner.id).toBe('anjoman');
    const signal = data.signal as Record<string, unknown>;
    expect((signal.sources as unknown[]).length).toBe(2);
    const task = data.task as Record<string, unknown>;
    expect(task.jobId).toBe('job-1');

    // Shaped like a miner response so the CRE recorder handles it unchanged.
    expect(result.response?.metadata.minerId).toBe('anjoman');
    expect(result.response?.metadata.costUsd).toBe('0.0300');
    expect(result.response?.metadata.paid).toBe(true);
  });

  it('propagates task failure as a failed governed call', async () => {
    const { telegraphGovernanceHelper } = await import(
      '../../src/backend/services/telegraph/TelegraphGovernanceHelper.js'
    );
    const { anjomanService } = await import('../../src/backend/services/anjoman/AnjomanService.js');

    vi.spyOn(anjomanService, 'runTask').mockResolvedValue({
      success: false,
      status: 'failed',
      error: 'Anjoman task failed: 402',
      latencyMs: 800,
    });

    const result = await telegraphGovernanceHelper.governedAnjomanTask({
      agentId: 'agent-1',
      task: { message: 'x' },
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('402');
  });
});
