import { describe, it, expect, vi } from 'vitest';

describe('CleanverseIdentityService', () => {
  it('evaluateAPass denies blacklisted and paused identities', async () => {
    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({
      request: vi.fn(),
    } as never);

    expect(
      service.evaluateAPass('0xabc', {
        chain: 'monad',
        address: '0xabc',
        status: 'ACTIVE',
        tier: 'TIER_1',
        group: 'CLEANVERSE_USER',
        isPaused: false,
        isBlacklisted: true,
      }).ok,
    ).toBe(false);

    expect(
      service.evaluateAPass('0xabc', {
        chain: 'monad',
        address: '0xabc',
        status: 'ACTIVE',
        tier: 'TIER_1',
        group: 'CLEANVERSE_USER',
        isPaused: true,
        isBlacklisted: false,
      }).ok,
    ).toBe(false);

    expect(
      service.evaluateAPass('0xabc', {
        chain: 'monad',
        address: '0xabc',
        status: 'FROZEN',
        tier: 'TIER_1',
        group: 'CLEANVERSE_USER',
        isPaused: false,
        isBlacklisted: false,
      }).ok,
    ).toBe(false);
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
      status: 'ACTIVE',
      tier: 'TIER_2',
      group: 'CLEANVERSE_USER',
      isPaused: false,
      isBlacklisted: false,
    });
    expect(result.ok).toBe(true);
  });

  it('screenAddresses fails closed when either party lacks A-Pass', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        code: 4,
        result: {
          chain: 'monad',
          address: '0x1111111111111111111111111111111111111111',
          status: 'ACTIVE',
          tier: 'TIER_1',
          group: 'CLEANVERSE_USER',
          isPaused: false,
          isBlacklisted: false,
        },
      })
      .mockResolvedValueOnce({ code: 2, message: 'no A-Pass' });

    const { CleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/CleanverseIdentityService.js'
    );
    const service = new CleanverseIdentityService({ request } as never);
    const screening = await service.screenAddresses(
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      'monad',
    );

    expect(screening.ok).toBe(false);
    expect(screening.sender.ok).toBe(true);
    expect(screening.recipient.ok).toBe(false);
    expect(screening.reason).toMatch(/Recipient failed CVI/);
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
