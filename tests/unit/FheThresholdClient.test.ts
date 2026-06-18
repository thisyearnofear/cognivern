import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FheThresholdClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createClient(config: Record<string, unknown> = {}) {
    vi.resetModules();
    const mod = await import("@backend/services/blockchain/FheThresholdClient.js");
    return new mod.FheThresholdClient(config);
  }

  describe('pollOutcome', () => {
    it('returns outcome on first successful poll', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', outcome: 2 }),
      });

      const client = await createClient({ pollIntervalMs: 100 });
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result).not.toBeNull();
      expect(result!.outcome).toBe('approve');
      expect(result!.outcomeRaw).toBe(2);
      expect(result!.decryptedAt).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('/api/v1/decrypt/status');
      expect(mockFetch.mock.calls[0][1].method).toBe('POST');
    });

    it('maps outcome 0 to deny', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', outcome: 0 }),
      });

      const client = await createClient();
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result?.outcome).toBe('deny');
    });

    it('maps outcome 1 to hold', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', outcome: 1 }),
      });

      const client = await createClient();
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result?.outcome).toBe('hold');
    });

    it('retries when status is pending', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'pending' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'pending' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'completed', outcome: 2 }),
        });

      const client = await createClient({ pollIntervalMs: 50 });
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result?.outcome).toBe('approve');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('returns null on timeout', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'pending' }),
      });

      const client = await createClient({ pollIntervalMs: 50, timeoutMs: 120 });
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result).toBeNull();
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null on persistent HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const client = await createClient({ pollIntervalMs: 50, timeoutMs: 120 });
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result).toBeNull();
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null on persistent fetch exception', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      const client = await createClient({ pollIntervalMs: 50, timeoutMs: 120 });
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result).toBeNull();
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('returns null when status is failed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'failed' }),
      });

      const client = await createClient();
      const result = await client.pollOutcome('0xdec1', 123n);

      expect(result).toBeNull();
    });

    it('handles bigint ctHash parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', outcome: 2 }),
      });

      const client = await createClient();
      const result = await client.pollOutcome('0xdec1', 999999999999999999n);

      expect(result?.outcome).toBe('approve');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.ctHash).toBe('999999999999999999');
    });

    it('uses configured thresholdNetworkUrl', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', outcome: 0 }),
      });

      const client = await createClient({
        thresholdNetworkUrl: 'https://custom-threshold.example.com',
      });
      await client.pollOutcome('0xdec1', 123n);

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://custom-threshold.example.com/api/v1/decrypt/status',
      );
    });
  });
});
