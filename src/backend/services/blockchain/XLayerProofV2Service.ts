import {
  GovernanceProofV2Service,
  type GovernanceProofV2Input,
  type GovernanceProofV2Result,
} from './GovernanceProofV2Service.js';

/**
 * X Layer Mainnet GovernanceProofV2 rail.
 *
 * Anchors the same canonical Cognivern commitments as the 0G Mainnet rail on
 * X Layer (chain 196). Deliberately proof-only: this service never signs
 * transfers or contract execution, and the poster key must be dedicated to
 * proof posting (not the admin, not an execution/custody wallet).
 *
 * Opt-in via XLAYER_PROOF_VERSION=v2, mirroring ZEROG_PROOF_VERSION. Values are
 * read EXECUTION_* first (the rails-era env names) with XLAYER_* kept as
 * aliases, matching the repo's env migration direction.
 */

const XLAYER_MAINNET_CHAIN_ID = 196;

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return '';
}

export interface XLayerProofV2Result extends GovernanceProofV2Result {
  network: 'xlayer-mainnet';
}

export type XLayerProofV2Input = GovernanceProofV2Input;

export class XLayerProofV2Service extends GovernanceProofV2Service {
  constructor() {
    super({
      network: 'xlayer-mainnet',
      logTag: '[XLayerProofV2]',
      displayName: 'X Layer Mainnet',
      enabled: process.env.XLAYER_PROOF_VERSION === 'v2',
      rpcUrl:
        envFirst('EXECUTION_XLAYER_MAINNET_RPC_URL', 'XLAYER_MAINNET_RPC_URL') ||
        'https://rpc.xlayer.tech',
      chainId: Number(
        envFirst('EXECUTION_XLAYER_MAINNET_CHAIN_ID', 'XLAYER_MAINNET_CHAIN_ID') ||
          XLAYER_MAINNET_CHAIN_ID,
      ),
      expectedChainId: XLAYER_MAINNET_CHAIN_ID,
      posterPrivateKey: envFirst(
        'EXECUTION_XLAYER_MAINNET_POSTER_PRIVATE_KEY',
        'XLAYER_MAINNET_POSTER_PRIVATE_KEY',
      ),
      contractAddress: envFirst(
        'EXECUTION_XLAYER_MAINNET_PROOF_CONTRACT',
        'XLAYER_MAINNET_PROOF_CONTRACT',
      ),
      explorerTxBase: 'https://www.oklink.com/xlayer',
      explorerAddressBase: 'https://www.oklink.com/xlayer',
    });
  }

  override getInfo() {
    return { ...super.getInfo(), network: 'xlayer-mainnet' as const };
  }

  override async recordDecision(input: XLayerProofV2Input): Promise<XLayerProofV2Result | null> {
    return (await super.recordDecision(input)) as XLayerProofV2Result | null;
  }
}

// Singleton — mirrors sharedZeroGProofService wiring in AuditLogService.
export const sharedXLayerProofV2Service = new XLayerProofV2Service();
