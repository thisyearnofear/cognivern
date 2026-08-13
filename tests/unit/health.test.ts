import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const mockPrepare = vi.fn().mockReturnValue({ get: vi.fn() });
const mockDb = { prepare: mockPrepare };
const mockZeroGCheckIndexer = vi.fn();
vi.mock('@backend/db/index.js', () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock('@backend/services/blockchain/ZeroGStorageService.js', () => ({
  zeroGStorageService: {
    checkIndexer: mockZeroGCheckIndexer,
  },
}));

vi.mock('@backend/modules/agents/AgentsModule.js', () => {
  return {
    AgentsModule: class {
      getAgents = vi.fn().mockResolvedValue([]);
      getAgentDecisions = vi.fn().mockResolvedValue([]);
    },
  };
});

vi.mock('@backend/services/governance/PolicyService.js', () => ({
  sharedPolicyService: {
    listPolicies: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('mongodb', () => ({
  MongoClient: class {
    async connect(): Promise<void> {
      throw new Error('MongoDB offline');
    }
  },
}));

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    getBlockNumber: vi.fn().mockRejectedValue(new Error('Fhenix offline')),
  })),
  http: vi.fn(),
}));

vi.mock('viem/chains', () => ({
  arbitrumSepolia: { id: 421614 },
}));

vi.mock('@backend/services/blockchain/FheDecisionWatcher.js', () => ({
  sharedFheDecisionWatcher: {
    isRunning: vi.fn(() => false),
    getPendingCount: vi.fn(() => 0),
  },
}));

const { HealthController } = await import(
  '../../src/backend/modules/api/controllers/HealthController.js'
);

const OPTIONAL_ENV_KEYS = [
  'MONGODB_URI',
  'FHENIX_RPC_URL',
  'FHENIX_PRIVATE_KEY',
  'FILECOIN_PRIVATE_KEY',
  'FILECOIN_RPC_URL',
  'ZEROG_PRIVATE_KEY',
  'FHE_WATCHER_ENABLED',
  'ZEROG_INDEXER_URL',
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(query: Record<string, string> = {}) {
  return { query } as any;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe('HealthController', () => {
  let controller: InstanceType<typeof HealthController>;
  const savedEnv: Partial<Record<(typeof OPTIONAL_ENV_KEYS)[number], string>> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockZeroGCheckIndexer.mockResolvedValue({ healthy: true, latencyMs: 1 });
    for (const key of OPTIONAL_ENV_KEYS) {
      if (process.env[key] !== undefined) {
        savedEnv[key] = process.env[key];
      }
      delete process.env[key];
    }
    controller = new HealthController();
  });

  afterEach(() => {
    for (const key of OPTIONAL_ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe('GET /health (basic)', () => {
    it('returns ok status without deep checks', async () => {
      const res = mockRes();
      await controller.getHealth(mockReq(), res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          message: 'Server is running',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        }),
      );
    });

    it('does not include dependencies when deep is absent', async () => {
      const res = mockRes();
      await controller.getHealth(mockReq(), res);
      const body = res.json.mock.calls[0][0];
      expect(body.dependencies).toBeUndefined();
    });
  });

  describe('GET /health?deep=true', () => {
    it('includes an array of dependencies', async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.dependencies).toBeInstanceOf(Array);
      expect(body.dependencies.length).toBeGreaterThanOrEqual(4);
    });

    it('each dependency has the correct shape', async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      for (const dep of body.dependencies) {
        expect(dep).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            status: expect.stringMatching(/^(healthy|unhealthy)$/),
            latencyMs: expect.any(Number),
          }),
        );
      }
    });

    it('reports ok when all dependencies are healthy', async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('ok');
      expect(body.message).toBe(
        'Required dependencies healthy; one or more optional integrations disabled',
      );
      expect(body.optionalDegraded).toBe(false);
      expect(body.dependencies).toContainEqual(
        expect.objectContaining({
          name: 'control_evaluation',
          status: 'healthy',
          optional: true,
          disabled: true,
        }),
      );
    });

    it('reports degraded when a dependency is unhealthy', async () => {
      const selectOneGet = vi.fn().mockImplementation(() => {
        throw new Error('DB locked');
      });
      const notifGet = vi.fn().mockReturnValue({ name: 'notifications' });
      mockPrepare.mockReturnValueOnce({ get: selectOneGet }).mockReturnValueOnce({ get: notifGet });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('degraded');
      const sqliteCheck = body.dependencies.find((d: any) => d.name === 'sqlite');
      expect(sqliteCheck.status).toBe('unhealthy');
      expect(sqliteCheck.error).toBe('DB locked');
    });

    it('reports unhealthy when notifications table is missing', async () => {
      const selectOneGet = vi.fn().mockReturnValue({ alive: 1 });
      const notifGet = vi.fn().mockReturnValue(undefined);
      mockPrepare.mockReturnValueOnce({ get: selectOneGet }).mockReturnValueOnce({ get: notifGet });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('degraded');
      const notifCheck = body.dependencies.find((d: any) => d.name === 'notifications_table');
      expect(notifCheck.status).toBe('unhealthy');
      expect(notifCheck.error).toBe('notifications table not found');
    });

    it('marks configured MongoDB as optional when it is unhealthy', async () => {
      process.env.MONGODB_URI = 'mongodb://offline.test:27017';
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });

      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('ok');
      expect(body.optionalDegraded).toBe(true);
      expect(body.dependencies).toContainEqual(
        expect.objectContaining({
          name: 'mongodb',
          status: 'unhealthy',
          optional: true,
          error: 'MongoDB offline',
        }),
      );
    });

    it('marks configured Filecoin as optional when it is unhealthy', async () => {
      process.env.FILECOIN_PRIVATE_KEY = 'configured-for-test';
      process.env.FILECOIN_RPC_URL = 'https://filecoin.invalid/rpc';
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });

      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('ok');
      expect(body.optionalDegraded).toBe(true);
      expect(body.dependencies).toContainEqual(
        expect.objectContaining({
          name: 'filecoin_rpc',
          status: 'unhealthy',
          optional: true,
          error: 'HTTP 503',
        }),
      );
      vi.unstubAllGlobals();
    });

    it('marks configured Fhenix as optional when it is unhealthy', async () => {
      process.env.FHENIX_RPC_URL = 'https://fhenix.invalid/rpc';
      process.env.FHENIX_PRIVATE_KEY = 'configured-for-test';
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });

      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('ok');
      expect(body.optionalDegraded).toBe(true);
      expect(body.dependencies).toContainEqual(
        expect.objectContaining({
          name: 'fhenix_client',
          status: 'unhealthy',
          optional: true,
          error: 'Fhenix offline',
        }),
      );
    });

    it('marks an enabled FHE watcher as optional when it is not running', async () => {
      process.env.FHE_WATCHER_ENABLED = 'true';
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });

      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('ok');
      expect(body.optionalDegraded).toBe(true);
      expect(body.dependencies).toContainEqual(
        expect.objectContaining({
          name: 'fhe_watcher',
          status: 'unhealthy',
          optional: true,
        }),
      );
    });

    it('keeps core health ok when an optional 0G indexer is degraded', async () => {
      process.env.ZEROG_PRIVATE_KEY = 'configured-for-test';
      mockZeroGCheckIndexer.mockResolvedValue({
        healthy: false,
        latencyMs: 3,
        error: 'HTTP 503',
      });
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: 'notifications' }),
      });

      const res = mockRes();
      await controller.getHealth(mockReq({ deep: 'true' }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe('ok');
      expect(body.optionalDegraded).toBe(true);
      expect(body.message).toMatch(/optional integrations degraded/i);
      expect(body.dependencies).toContainEqual(
        expect.objectContaining({
          name: 'zerog_indexer',
          status: 'unhealthy',
          optional: true,
          error: 'HTTP 503',
        }),
      );
    });
  });

  describe('GET /health/ready', () => {
    it('returns ready status', async () => {
      const res = mockRes();
      await controller.getReadiness(mockReq(), res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }));
    });
  });

  describe('GET /health/live', () => {
    it('returns alive status', async () => {
      const res = mockRes();
      await controller.getLiveness(mockReq(), res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'alive' }));
    });
  });
});
