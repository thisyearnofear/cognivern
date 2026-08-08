import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    apiKey: 'kh_test_api_key',
    baseUrl: 'https://app.keeperhub.com',
    enabled: true,
  },
}));

vi.mock('@backend/shared/config/index.js', () => ({
  keeperHubConfig: mockConfig,
  config: { NODE_ENV: 'test', LOG_LEVEL: 'error' as const, PORT: 3000 },
  apiConfig: { port: 3000, apiKey: 'test', corsOrigin: '*', rateLimit: {}, requestTimeout: 30000 },
  sapienceConfig: {},
  databaseConfig: {},
  cacheConfig: {},
  tradingConfig: {},
  mantleConfig: {},
  fhenixConfig: {},
  monitoringConfig: {},
  aiConfig: {},
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

import { KeeperHubExecutionProvider } from '@backend/services/blockchain/KeeperHubExecutionProvider.js';

describe('KeeperHubExecutionProvider', () => {
  let provider: KeeperHubExecutionProvider;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    provider = new KeeperHubExecutionProvider({
      timeoutMs: 500,
      pollIntervalMs: 10,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal('fetch', originalFetch);
    mockConfig.apiKey = 'kh_test_api_key';
  });

  const request = {
    intentId: 'intent-1',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    valueWei: 1_000_000_000_000_000_000n,
    chainId: 84532,
  };

  const simulation = {
    success: true,
    status: 'simulated' as const,
    wouldRevert: false,
    from: '0x1111111111111111111111111111111111111111',
    to: '0x2222222222222222222222222222222222222222',
    value: '1.0',
    gasEstimate: '21000',
  };

  it('returns an error when the API key is not configured', async () => {
    mockConfig.apiKey = '';

    const result = await provider.executeTransfer(request);

    expect(result).toEqual({ error: 'KeeperHub API key is not configured' });
  });

  it('simulates before broadcasting and polls the documented receipt fields', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ walletAddress: request.from }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(simulation), { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: 'exec-123', status: 'running' }), {
        status: 202,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          executionId: 'exec-123',
          status: 'completed',
          transactionHash: '0x' + 'a'.repeat(64),
          transactionLink: 'https://sepolia.arbiscan.io/tx/0x' + 'a'.repeat(64),
          sponsored: false,
          receipts: [
            {
              hash: '0x' + 'a'.repeat(64),
              chainId: 84532,
              from: request.from,
              to: request.to,
              value: '1.0',
              verified: true,
              receiptStatus: 'success',
              blockNumber: 123,
              gasUsed: '21000',
            },
          ],
        }),
        { status: 200, headers: { 'X-Poll-Interval-Hint': '0' } },
      ),
    );

    const result = await provider.executeTransfer(request);

    expect(result).toMatchObject({
      txHash: '0x' + 'a'.repeat(64),
      transactionHash: '0x' + 'a'.repeat(64),
      transactionLink: 'https://sepolia.arbiscan.io/tx/0x' + 'a'.repeat(64),
      executionId: 'exec-123',
      from: '0x1111111111111111111111111111111111111111',
      chainId: 84532,
      sponsored: false,
      verified: true,
      receiptStatus: 'success',
      simulation,
    });

    const calls = fetchMock.mock.calls;
    expect(calls).toHaveLength(4);
    expect(calls[0][0]).toBe('https://app.keeperhub.com/api/user/wallet');
    expect(calls[1][0]).toBe('https://app.keeperhub.com/api/execute/transfer');
    expect(calls[1][1]?.method).toBe('POST');
    expect((calls[1][1]?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer kh_test_api_key',
    );
    expect((calls[1][1]?.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();
    expect(JSON.parse(calls[1][1]?.body as string).simulate).toBe(true);

    expect((calls[2][1]?.headers as Record<string, string>)['Idempotency-Key']).toMatch(
      /^0x[0-9a-f]{64}$/,
    );
    expect(JSON.parse(calls[2][1]?.body as string).simulate).toBeUndefined();
    expect(JSON.parse(calls[2][1]?.body as string).amount).toBe('1.0');
  });

  it('does not broadcast when simulation says the transfer would revert', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ walletAddress: request.from }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          status: 'simulated',
          wouldRevert: true,
          error: 'Insufficient ETH balance',
          code: 'insufficient_balance',
        }),
        { status: 400 },
      ),
    );

    const result = await provider.executeTransfer(request);

    expect(result).toEqual({
      error: 'KeeperHub simulation rejected the transfer: Insufficient ETH balance',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an error when KeeperHub reports failure', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ walletAddress: request.from }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(simulation), { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: 'exec-456' }), { status: 202 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ executionId: 'exec-456', status: 'failed', error: 'insufficient funds' }),
        { status: 200 },
      ),
    );

    const result = await provider.executeTransfer({ ...request, intentId: 'intent-2' });

    expect(result).toEqual({ error: 'KeeperHub execution failed: insufficient funds' });
  });

  it('returns an error when the status poll times out', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ walletAddress: request.from }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(simulation), { status: 200 }));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: 'exec-789' }), { status: 202 }),
    );
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ executionId: 'exec-789', status: 'pending' }), {
        status: 200,
      }),
    );

    const result = await provider.executeTransfer({ ...request, intentId: 'intent-3' });

    expect(result).toMatchObject({
      error: expect.stringContaining('did not complete within'),
      executionId: 'exec-789',
      uncertain: true,
    });
  });

  it('converts wei to ETH exactly and reuses the same transfer body', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ walletAddress: request.from }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...simulation, value: '0.123456789012345678' }), {
        status: 200,
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: 'exec-000' }), { status: 202 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          executionId: 'exec-000',
          status: 'completed',
          transactionHash: '0x' + 'b'.repeat(64),
          receipts: [
            {
              hash: '0x' + 'b'.repeat(64),
              chainId: 84532,
              from: request.from,
              to: request.to,
              value: '0.123456789012345678',
              verified: true,
              receiptStatus: 'success',
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await provider.executeTransfer({
      ...request,
      intentId: 'intent-wei',
      valueWei: 123_456_789_012_345_678n,
    });

    const simulationBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    const broadcastBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string);
    expect(simulationBody.amount).toBe('0.123456789012345678');
    expect(broadcastBody).toEqual({
      amount: '0.123456789012345678',
      chainId: 84532,
      recipientAddress: request.to,
    });
  });
});
