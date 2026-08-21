import {
  GovernanceProofV2Service,
  type GovernanceProofV2Input,
  type GovernanceProofV2Result,
} from './GovernanceProofV2Service.js';

/**
 * 0G Mainnet (Aristotle) GovernanceProofV2 rail.
 *
 * Thin wrapper over the rail-parameterized GovernanceProofV2Service, holding
 * only the 0G-specific environment contract: gated by ZEROG_PROOF_VERSION=v2,
 * pinned to chain 16661, posted by the dedicated ZEROG_MAINNET_POSTER key.
 */

const MAINNET_CHAIN_ID = 16661;

export interface ZeroGProofV2Result extends GovernanceProofV2Result {
  network: '0g-mainnet';
}

export type ZeroGProofV2Input = GovernanceProofV2Input;

export class ZeroGProofV2Service extends GovernanceProofV2Service {
  constructor() {
    super({
      network: '0g-mainnet',
      logTag: '[ZeroGProofV2]',
      displayName: '0G Mainnet',
      enabled: process.env.ZEROG_PROOF_VERSION === 'v2',
      rpcUrl: process.env.ZEROG_MAINNET_RPC_URL || 'https://evmrpc.0g.ai',
      chainId: Number(process.env.ZEROG_MAINNET_CHAIN_ID || MAINNET_CHAIN_ID),
      expectedChainId: MAINNET_CHAIN_ID,
      posterPrivateKey: process.env.ZEROG_MAINNET_POSTER_PRIVATE_KEY || '',
      contractAddress: process.env.ZEROG_MAINNET_PROOF_CONTRACT || '',
      explorerTxBase: 'https://chainscan.0g.ai',
      explorerAddressBase: 'https://chainscan.0g.ai',
    });
  }

  override getInfo() {
    return { ...super.getInfo(), network: '0g-mainnet' as const };
  }

  override async recordDecision(input: ZeroGProofV2Input): Promise<ZeroGProofV2Result | null> {
    return (await super.recordDecision(input)) as ZeroGProofV2Result | null;
  }
}
