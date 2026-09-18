import { describe, it, expect, vi } from 'vitest';

const baseAgent = {
  id: 'agent-1',
  name: 'Procurement Bot',
  description: 'Sources vendors under mandate',
  type: 'procurement' as const,
  status: 'active' as const,
  walletId: 'wallet-9',
  policyIds: [],
  createdAt: '2026-09-01T00:00:00.000Z',
};

function makeBinding() {
  return {
    chainId: 143,
    agentRegistry: 'eip155:143:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
    agentId: '42',
    owner: '0xowner',
    agentURI: 'https://api.example.com/erc8004/agents/agent-1/card',
    registerTxHash: '0xabc',
    registeredAt: '2026-09-17T00:00:00.000Z',
  };
}

async function makeService(vault: Record<string, unknown> = {}) {
  const { Erc8004Service } = await import(
    '../../src/backend/services/blockchain/erc8004/Erc8004Service.js'
  );
  return new Erc8004Service({
    getAgent: vi.fn(async () => baseAgent),
    updateAgentMetadata: vi.fn(async () => baseAgent),
    sendContractCall: vi.fn(async () => ({ txHash: '0xabc', from: '0xowner' })),
    ...vault,
  } as never);
}

describe('Erc8004Service', () => {
  it('builds a registration-v1 file with bindings and services', async () => {
    const service = await makeService();
    const file = service.buildRegistrationFile({
      agent: baseAgent,
      binding: makeBinding(),
      baseUrl: 'https://api.example.com',
    }) as {
      type: string;
      name: string;
      active: boolean;
      services: Array<{ name: string; endpoint: string }>;
      registrations: Array<{ agentId: number; agentRegistry: string }>;
      supportedTrust: string[];
    };

    expect(file.type).toBe(
      'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    );
    expect(file.name).toBe('Procurement Bot');
    expect(file.active).toBe(true);
    expect(file.registrations).toEqual([
      {
        agentId: 42,
        agentRegistry:
          'eip155:143:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
      },
    ]);
    expect(file.supportedTrust).toContain('reputation');
    expect(
      file.services.some(
        (s) =>
          s.name === 'cognivern' &&
          s.endpoint === 'https://api.example.com/erc8004/agents/agent-1/card',
      ),
    ).toBe(true);
  });

  it('leaves registrations empty before the on-chain binding exists', async () => {
    const service = await makeService();
    const file = service.buildRegistrationFile({
      agent: { ...baseAgent, status: 'standby' },
      baseUrl: '',
    }) as { registrations: unknown[]; active: boolean; services: unknown[] };

    expect(file.registrations).toEqual([]);
    expect(file.active).toBe(false);
  });

  it('encodes a registration file as a self-contained data: URI', async () => {
    const service = await makeService();
    const file = service.buildRegistrationFile({
      agent: baseAgent,
      baseUrl: '',
    });
    const uri = service.registrationFileToDataUri(file);
    expect(uri.startsWith('data:application/json;base64,')).toBe(true);
    const decoded = JSON.parse(
      Buffer.from(uri.split(',')[1], 'base64').toString('utf8'),
    );
    expect(decoded.name).toBe('Procurement Bot');
  });

  it('registerAgent fails closed when the feature flag is off', async () => {
    const service = await makeService();
    const result = await service.registerAgent({ agentId: 'agent-1' });
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toMatch(/not enabled/i);
    }
  });

  it('registerAgent rejects agents with no owning wallet', async () => {
    process.env.ERC8004_ENABLED = 'true';
    try {
      const service = await makeService({
        getAgent: vi.fn(async () => ({ ...baseAgent, walletId: undefined })),
      });
      const result = await service.registerAgent({ agentId: 'agent-1' });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toMatch(/wallet/i);
      }
    } finally {
      delete process.env.ERC8004_ENABLED;
    }
  });

  it('registerAgent refuses to re-register a bound agent', async () => {
    process.env.ERC8004_ENABLED = 'true';
    try {
      const service = await makeService({
        getAgent: vi.fn(async () => ({
          ...baseAgent,
          metadata: { erc8004: makeBinding() },
        })),
      });
      const result = await service.registerAgent({ agentId: 'agent-1' });
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toMatch(/already/i);
      }
    } finally {
      delete process.env.ERC8004_ENABLED;
    }
  });

  it('giveFeedback fails closed when disabled', async () => {
    const service = await makeService();
    const result = await service.giveFeedback({
      agentId: '42',
      walletId: 'wallet-9',
      value: 100,
    });
    expect('error' in result).toBe(true);
  });
});
