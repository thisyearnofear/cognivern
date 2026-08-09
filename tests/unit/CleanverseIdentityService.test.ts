import { describe, it, expect, vi } from 'vitest';

describe('CleanverseIdentityService', () => {
  it('evaluateAPass denies blacklisted, paused, and frozen identities', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    const base = {
      chain: 'monad',
      address: '0xabc',
      tier: 'TIER_1',
      group: 'CLEANVERSE_USER',
    };

    expect(
      service.evaluateAPass('0xabc', {
        ...base,
        status: 'ACTIVE',
        isPaused: false,
        isBlacklisted: true,
      }).ok,
    ).toBe(false);

    expect(
      service.evaluateAPass('0xabc', {
        ...base,
        status: 'ACTIVE',
        isPaused: true,
        isBlacklisted: false,
      }).ok,
    ).toBe(false);

    expect(
      service.evaluateAPass('0xabc', {
        ...base,
        status: 'FROZEN',
        isPaused: false,
        isBlacklisted: false,
      }).ok,
    ).toBe(false);

    // Live API encodes frozen as the integer status 2.
    expect(
      service.evaluateAPass('0xabc', {
        ...base,
        status: 2,
        isPaused: false,
        isBlacklisted: false,
      }).ok,
    ).toBe(false);
  });

  it('evaluateAPass denies an expired A-Pass', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    const result = service.evaluateAPass('0xabc', {
      chain: 'monad',
      address: '0xabc',
      status: 1,
      tier: '26',
      group: 'CLEANVERSE_USER',
      expiration: String(Math.floor(Date.now() / 1000) - 3600),
      isPaused: false,
      isBlacklisted: false,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it('evaluateAPass accepts an active A-Pass', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    const result = service.evaluateAPass('0xabc', {
      chain: 'monad',
      address: '0xabc',
      status: 1,
      tier: '26',
      group: 'CLEANVERSE_USER',
      expiration: String(Math.floor(Date.now() / 1000) + 86400 * 365),
      isPaused: false,
      isBlacklisted: false,
    });
    expect(result.ok).toBe(true);
  });

  it('screenAddresses parses the documented query_apass envelope', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        code: '0000',
        message: 'success',
        data: {
          cvRecordId: '487',
          customerId: 'CUST123456789012',
          status: 1,
          tier: '26',
          subTier: 1,
          group: 'G1',
          subGroup: 'AB',
          countries: ['SG', 'US'],
          expirationTime: Math.floor(Date.now() / 1000) + 86400 * 365,
          currentKycHash: '3557683c1e62fb7dc8ef438e81cb4ffd',
        },
      })
      .mockResolvedValueOnce({
        code: '0000',
        message: 'success',
        data: null,
      });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const screening = await service.screenAddresses(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      'monad',
    );

    expect(screening.sender.ok).toBe(true);
    expect(screening.sender.aPass?.tier).toBe('26');
    expect(screening.sender.aPass?.countries).toEqual(['SG', 'US']);
    expect(screening.recipient.ok).toBe(false);
    expect(screening.reason).toMatch(/No A-Pass found/);
  });

  it('verifyAPass sends the documented atoken field and reads data.code', async () => {
    const request = vi.fn().mockResolvedValue({
      code: '0000',
      message: 'ok',
      data: {
        chain: 'monad',
        atoken: '0xaC0893567D43C3E7e6e35a72803df05416C1f20D',
        address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd',
        code: 4,
        message: 'apass verify success',
        magickLink: 'https://register.cleanverse.com/apass/abc',
      },
    });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const result = await service.verifyAPass(
      'monad',
      '0x888895E314BF33CEeBCF5320279061aed3a5E2bd',
      '0xaC0893567D43C3E7e6e35a72803df05416C1f20D',
    );

    expect(result.success).toBe(true);
    expect(result.code).toBe(4);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/verify_apass',
        body: {
          chain: 'monad',
          atoken: '0xaC0893567D43C3E7e6e35a72803df05416C1f20D',
          address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd',
        },
      }),
    );
  });

  it('evaluateAPass denies unknown or missing status (fail-closed)', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    const base = {
      chain: 'monad',
      address: '0xabc',
      tier: '26',
      group: 'CLEANVERSE_USER',
    };

    expect(
      service.evaluateAPass('0xabc', { ...base, status: 0 }).ok,
    ).toBe(false);
    expect(
      service.evaluateAPass('0xabc', { ...base, status: '' }).ok,
    ).toBe(false);
    expect(service.evaluateAPass('0xabc', { ...base }).ok).toBe(false);
  });

  it('evaluateAPass denies a malformed expiration (fail-closed)', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    const result = service.evaluateAPass('0xabc', {
      chain: 'monad',
      address: '0xabc',
      status: 1,
      tier: '26',
      group: 'CLEANVERSE_USER',
      expiration: 'not-a-timestamp',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/invalid expiration/i);
  });

  it('evaluateAPass tolerates millisecond expiration values', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    const result = service.evaluateAPass('0xabc', {
      chain: 'monad',
      address: '0xabc',
      status: 'ACTIVE',
      tier: '26',
      group: 'CLEANVERSE_USER',
      expiration: String(Date.now() + 86400 * 365 * 1000),
    });
    expect(result.ok).toBe(true);
  });

  it('screenAddresses tolerates the legacy result payload container', async () => {
    const request = vi.fn().mockResolvedValueOnce({
      code: '0000',
      message: 'success',
      result: {
        cvRecordId: '999',
        status: 1,
        tier: '12',
        group: 'G2',
        expirationTime: Math.floor(Date.now() / 1000) + 86400 * 365,
      },
    });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const screening = await service.screenAddresses(
      '0x1111111111111111111111111111111111111111',
      '0x1111111111111111111111111111111111111111',
      'monad',
    );

    expect(screening.sender.ok).toBe(true);
    expect(screening.sender.aPass?.tier).toBe('12');
  });

  it('queryAPass fails closed on a non-success envelope', async () => {
    const request = vi.fn().mockResolvedValue({
      code: '0002',
      message: 'Business failure',
      data: null,
    });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const result = await service.queryAPass('monad', '0xabc');

    expect(result.success).toBe(false);
    expect(result.code).toBe('0002');
    expect(result.error).toMatch(/Business failure/);
  });

  it('verifyAPass fails closed when the business envelope is not 0000', async () => {
    const request = vi.fn().mockResolvedValue({
      code: '0002',
      message: 'Business failure',
      data: { code: 4, message: 'apass verify success' },
    });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const result = await service.verifyAPass('monad', '0xUser', '0xAToken');

    expect(result.success).toBe(false);
  });

  it('verifyAPass fails closed for a frozen/expired A-Pass (data.code 3)', async () => {
    const request = vi.fn().mockResolvedValue({
      code: '0000',
      message: 'ok',
      data: {
        chain: 'monad',
        atoken: '0xAToken',
        address: '0xUser',
        code: 3,
        message: 'apass frozen',
      },
    });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const result = await service.verifyAPass('monad', '0xUser', '0xAToken');

    expect(result.success).toBe(false);
    expect(result.code).toBe(3);
  });
});

describe('Cleanverse crypto encodePayload', () => {
  it('round-trips AES payload with a 16-byte key', async () => {
    const { encodePayload, decodePayload } = await import(
      '../../src/backend/services/blockchain/cleanverse/crypto.js'
    );
    const key = Buffer.alloc(16, 7).toString('utf-8');
    const encoded = encodePayload({ chain: 'monad', address: '0xabc' }, key);
    const decoded = decodePayload<{ chain: string; address: string }>(encoded, key);
    expect(decoded.chain).toBe('monad');
    expect(decoded.address).toBe('0xabc');
  });
});
