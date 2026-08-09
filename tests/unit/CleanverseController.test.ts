import { describe, expect, it, vi } from 'vitest';

function response() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

describe('CleanverseController', () => {
  it('reports Access USDC configuration without secrets', async () => {
    const { CleanverseController } = await import(
      '../../src/backend/modules/api/controllers/CleanverseController.js'
    );
    const controller = new CleanverseController();
    const res = response();

    await controller.getStatus({} as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        aTokenAddress: '0xaC0893567D43C3E7e6e35a72803df05416C1f20D',
        aTokenSymbol: 'aUSDC',
      },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/apiKey|privateKey|encryptedPrivate|authTag/i);
  });

  it('returns only the explicit Cleanverse USDC deposit address', async () => {
    const { CleanverseController } = await import(
      '../../src/backend/modules/api/controllers/CleanverseController.js'
    );
    const { cleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/index.js'
    );
    const lookup = vi.spyOn(cleanverseIdentityService, 'queryDepositAddress').mockResolvedValue({
      success: true,
      code: '0000',
      data: {
        address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd',
        chain: 'monad',
        depositUSDCWallet: '0xA8f45b41929B83ECBaA3a494507745063AE6093f',
        depositUSDTWallet: '0x1111111111111111111111111111111111111111',
        txHash: '0x' + 'ab'.repeat(32),
      },
    });
    const controller = new CleanverseController();
    const res = response();

    await controller.getDepositAddress(
      { query: { address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd', chain: 'monad' } } as never,
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd',
        chain: 'monad',
        depositAddress: '0xA8f45b41929B83ECBaA3a494507745063AE6093f',
      },
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/apiKey|privateKey|txHash|depositUSDT/i);
    expect(lookup).toHaveBeenCalledWith('monad', '0x888895E314BF33CEeBCF5320279061aed3a5E2bd');
  });

  it('rejects a lookup when Cleanverse returns no explicit USDC wallet', async () => {
    const { CleanverseController } = await import(
      '../../src/backend/modules/api/controllers/CleanverseController.js'
    );
    const { cleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/index.js'
    );
    vi.spyOn(cleanverseIdentityService, 'queryDepositAddress').mockResolvedValue({
      success: true,
      code: '0000',
      data: {
        address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd',
        chain: 'monad',
        depositUSDTWallet: '0xA8f45b41929B83ECBaA3a494507745063AE6093f',
      },
    });
    const controller = new CleanverseController();
    const res = response();

    await controller.getDepositAddress(
      { query: { address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd' } } as never,
      res as never,
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Cleanverse returned no valid USDC deposit address',
    });
  });

  it('rejects a lookup when Cleanverse omits the wallet address', async () => {
    const { CleanverseController } = await import(
      '../../src/backend/modules/api/controllers/CleanverseController.js'
    );
    const { cleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/index.js'
    );
    vi.spyOn(cleanverseIdentityService, 'queryDepositAddress').mockResolvedValue({
      success: true,
      code: '0000',
      data: {
        chain: 'monad',
        depositUSDCWallet: '0xA8f45b41929B83ECBaA3a494507745063AE6093f',
      },
    });
    const controller = new CleanverseController();
    const res = response();

    await controller.getDepositAddress(
      { query: { address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd' } } as never,
      res as never,
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Cleanverse returned an invalid wallet address',
    });
  });

  it('rejects a lookup when Cleanverse returns a malformed wallet address', async () => {
    const { CleanverseController } = await import(
      '../../src/backend/modules/api/controllers/CleanverseController.js'
    );
    const { cleanverseIdentityService } = await import(
      '../../src/backend/services/blockchain/cleanverse/index.js'
    );
    vi.spyOn(cleanverseIdentityService, 'queryDepositAddress').mockResolvedValue({
      success: true,
      code: '0000',
      data: {
        address: 'not-an-address',
        chain: 'monad',
        depositUSDCWallet: '0xA8f45b41929B83ECBaA3a494507745063AE6093f',
      },
    });
    const controller = new CleanverseController();
    const res = response();

    await controller.getDepositAddress(
      { query: { address: '0x888895E314BF33CEeBCF5320279061aed3a5E2bd' } } as never,
      res as never,
    );

    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Cleanverse returned an invalid wallet address',
    });
  });
});
