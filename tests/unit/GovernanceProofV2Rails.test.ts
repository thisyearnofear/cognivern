import { afterEach, describe, expect, it } from 'vitest';
import { ZeroGProofV2Service } from '../../src/backend/services/blockchain/ZeroGProofV2Service.js';
import { XLayerProofV2Service } from '../../src/backend/services/blockchain/XLayerProofV2Service.js';

// Construction is config-gated only: JsonRpcProvider/Wallet creation performs
// no network access, and disabled services never touch the RPC.
const POSTER_KEY = `0x${'1'.repeat(64)}`;
const CONTRACT = '0x0000000000000000000000000000000000000001';

const XLAYER_ENV = [
  'XLAYER_PROOF_VERSION',
  'XLAYER_MAINNET_RPC_URL',
  'XLAYER_MAINNET_CHAIN_ID',
  'XLAYER_MAINNET_POSTER_PRIVATE_KEY',
  'XLAYER_MAINNET_PROOF_CONTRACT',
  'EXECUTION_XLAYER_MAINNET_RPC_URL',
  'EXECUTION_XLAYER_MAINNET_CHAIN_ID',
  'EXECUTION_XLAYER_MAINNET_POSTER_PRIVATE_KEY',
  'EXECUTION_XLAYER_MAINNET_PROOF_CONTRACT',
  'ZEROG_PROOF_VERSION',
];

function clearEnv() {
  for (const name of XLAYER_ENV) delete process.env[name];
}

afterEach(clearEnv);

describe('XLayerProofV2Service', () => {
  it('stays disabled without the explicit opt-in flag', () => {
    process.env.XLAYER_MAINNET_POSTER_PRIVATE_KEY = POSTER_KEY;
    process.env.XLAYER_MAINNET_PROOF_CONTRACT = CONTRACT;

    delete process.env.XLAYER_PROOF_VERSION;
    const service = new XLayerProofV2Service();
    expect(service.isEnabled()).toBe(false);
  });

  it('stays disabled without a poster key or contract', () => {
    process.env.XLAYER_PROOF_VERSION = 'v2';

    const service = new XLayerProofV2Service();
    expect(service.isEnabled()).toBe(false);
  });

  it('refuses a non-mainnet chain configuration', () => {
    process.env.XLAYER_PROOF_VERSION = 'v2';
    process.env.XLAYER_MAINNET_CHAIN_ID = '1952'; // testnet, must be rejected
    process.env.XLAYER_MAINNET_POSTER_PRIVATE_KEY = POSTER_KEY;
    process.env.XLAYER_MAINNET_PROOF_CONTRACT = CONTRACT;

    const service = new XLayerProofV2Service();
    expect(service.isEnabled()).toBe(false);
  });

  it('enables with flag, mainnet chain, poster key, and contract', () => {
    process.env.XLAYER_PROOF_VERSION = 'v2';
    process.env.XLAYER_MAINNET_POSTER_PRIVATE_KEY = POSTER_KEY;
    process.env.XLAYER_MAINNET_PROOF_CONTRACT = CONTRACT;

    const service = new XLayerProofV2Service();
    expect(service.isEnabled()).toBe(true);
    expect(service.getInfo()).toMatchObject({
      enabled: true,
      version: 'v2',
      network: 'xlayer-mainnet',
      chainId: 196,
      contractAddress: CONTRACT,
      explorerUrl: `https://www.oklink.com/xlayer/address/${CONTRACT}`,
    });
  });

  it('accepts the rails-era EXECUTION_XLAYER_MAINNET_* aliases', () => {
    process.env.XLAYER_PROOF_VERSION = 'v2';
    process.env.EXECUTION_XLAYER_MAINNET_POSTER_PRIVATE_KEY = POSTER_KEY;
    process.env.EXECUTION_XLAYER_MAINNET_PROOF_CONTRACT = CONTRACT;

    const service = new XLayerProofV2Service();
    expect(service.isEnabled()).toBe(true);
    expect(service.getInfo().chainId).toBe(196);
  });
});

describe('ZeroGProofV2Service (wrapper parity)', () => {
  it('stays disabled without ZEROG_PROOF_VERSION=v2', () => {
    delete process.env.ZEROG_PROOF_VERSION;
    const service = new ZeroGProofV2Service();
    expect(service.isEnabled()).toBe(false);
  });
});
