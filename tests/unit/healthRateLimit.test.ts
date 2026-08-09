import { afterEach, describe, expect, it } from 'vitest';

const originalHealthLimit = process.env.HEALTH_SLO_RATE_LIMIT_PER_MINUTE;

afterEach(() => {
  if (originalHealthLimit === undefined) {
    delete process.env.HEALTH_SLO_RATE_LIMIT_PER_MINUTE;
  } else {
    process.env.HEALTH_SLO_RATE_LIMIT_PER_MINUTE = originalHealthLimit;
  }
});

describe('health SLO rate limits', () => {
  it('uses the dedicated root budget while /api remains on the general budget', async () => {
    process.env.HEALTH_SLO_RATE_LIMIT_PER_MINUTE = '1';

    const { ApiModule } = await import('../../src/backend/modules/api/ApiModule.js');
    const api = new ApiModule();
    const app = api.getApp();
    await (api as unknown as { setupMiddleware(): Promise<void> }).setupMiddleware();

    app.get('/health/slo', (_req, res) => res.status(200).json({ ok: true }));
    app.get('/api/health/slo', (_req, res) => res.status(200).json({ ok: true }));

    const server = await new Promise<import('node:http').Server>((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      throw new Error('ephemeral test server did not expose a port');
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const rootFirst = await fetch(`${baseUrl}/health/slo`);
      const rootSecond = await fetch(`${baseUrl}/health/slo`);
      const apiRequest = await fetch(`${baseUrl}/api/health/slo`);

      expect(rootFirst.status).toBe(200);
      expect(rootFirst.headers.get('ratelimit-limit')).toBe('1');
      expect(rootSecond.status).toBe(429);
      expect(apiRequest.status).toBe(200);
      expect(apiRequest.headers.get('ratelimit-limit')).not.toBe('1');
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
