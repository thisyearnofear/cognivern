import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimitStore } from '../../src/backend/shared/storage/RateLimitStore.js';

// We test the middleware functions directly by calling them with mock req/res/next.

describe('workspaceRateLimit', () => {
  let workspaceRateLimit: typeof import('../../src/backend/middleware/workspaceRateLimit.js').workspaceRateLimit;

  beforeEach(async () => {
    await rateLimitStore.clear();
    const mod = await import('../../src/backend/middleware/workspaceRateLimit.js');
    workspaceRateLimit = mod.workspaceRateLimit;
  });

  let _testId = 0;
  function makeReq(overrides: Record<string, unknown> = {}): Request {
    _testId++;
    return {
      headers: { 'x-workspace-id': `test-ws-${_testId}` },
      query: {},
      ...overrides,
    } as unknown as Request;
  }

  function mockRes(): Response {
    const headers: Record<string, string | number> = {};
    return {
      setHeader: vi.fn((k: string, v: string | number) => {
        headers[k] = v;
      }),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      get headers() {
        return headers;
      },
    } as unknown as Response;
  }

  it('allows requests within the limit', async () => {
    const limiter = workspaceRateLimit(5, 60_000);
    const next = vi.fn();
    const res = mockRes();

    await limiter(makeReq(), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks requests over the limit', async () => {
    const limiter = workspaceRateLimit(3, 60_000);
    const next = vi.fn();
    const res = mockRes();
    const wsId = `test-ws-block-${_testId++}`;

    await limiter(makeReq({ headers: { 'x-workspace-id': wsId } }), res, next);
    await limiter(makeReq({ headers: { 'x-workspace-id': wsId } }), res, next);
    await limiter(makeReq({ headers: { 'x-workspace-id': wsId } }), res, next);
    await limiter(makeReq({ headers: { 'x-workspace-id': wsId } }), res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Rate limit exceeded' }),
    );
  });

  it('sets rate limit headers', async () => {
    const limiter = workspaceRateLimit(10, 60_000);
    const next = vi.fn();
    const res = mockRes();

    await limiter(makeReq(), res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
  });

  it('uses workspace ID from header', async () => {
    const limiter = workspaceRateLimit(2, 60_000);
    const next = vi.fn();
    const res = mockRes();

    const req1 = makeReq({ headers: { 'x-workspace-id': 'ws-a-isolated' } });
    const req2 = makeReq({ headers: { 'x-workspace-id': 'ws-b-isolated' } });

    await limiter(req1, res, next);
    await limiter(req2, res, next);
    await limiter(req1, res, next);
    await limiter(req1, res, next);

    expect(next).toHaveBeenCalledTimes(3); // ws-a: 2 allowed, ws-b: 1 allowed
  });
});

describe('apiKeyRateLimit', () => {
  let apiKeyRateLimit: typeof import('../../src/backend/middleware/apiKeyRateLimit.js').apiKeyRateLimit;

  beforeEach(async () => {
    await rateLimitStore.clear();
    const mod = await import('../../src/backend/middleware/apiKeyRateLimit.js');
    apiKeyRateLimit = mod.apiKeyRateLimit;
  });

  function mockReq(headers: Record<string, string> = {}): Request {
    return { headers } as unknown as Request;
  }

  function mockRes(): Response {
    return {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
  }

  it('passes through when no API key is present', async () => {
    const limiter = apiKeyRateLimit(5, 60_000);
    const next = vi.fn();
    await limiter(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks requests over the limit for the same key', async () => {
    const limiter = apiKeyRateLimit(2, 60_000);
    const next = vi.fn();
    const res = mockRes();

    await limiter(mockReq({ 'x-api-key': 'sk-abc123' }), res, next);
    await limiter(mockReq({ 'x-api-key': 'sk-abc123' }), res, next);
    await limiter(mockReq({ 'x-api-key': 'sk-abc123' }), res, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('tracks different API keys independently', async () => {
    const limiter = apiKeyRateLimit(1, 60_000);
    const next = vi.fn();
    const res = mockRes();

    await limiter(mockReq({ 'x-api-key': 'sk-key1' }), res, next);
    await limiter(mockReq({ 'x-api-key': 'sk-key2' }), res, next);
    await limiter(mockReq({ 'x-api-key': 'sk-key1' }), res, next);

    expect(next).toHaveBeenCalledTimes(2); // Both allowed (different keys)
  });
});
