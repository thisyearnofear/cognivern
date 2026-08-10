/**
 * Active confidential-compute rail for spend-policy evaluation.
 * Product language stays "private budgets"; rail is mechanism detail.
 */

import {
  sharedFhenixPolicyService,
  type ConfidentialSpendDecision,
  type ConfidentialSpendInput,
} from './FhenixPolicyService.js';
import {
  createFlareConfig,
  isFlareEvaluatorEnabled,
  sharedFlareConfidentialPolicyService,
} from './FlareConfidentialPolicyService.js';

export type ConfidentialRail = 'flare' | 'fhenix';
export type ConfidentialMechanism = 'tee' | 'fhe';

export interface ConfidentialPolicyEvaluator {
  evaluateEncrypted(input: ConfidentialSpendInput): Promise<ConfidentialSpendDecision>;
}

export interface ConfidentialEvidenceMeta {
  /** True when a confidential evaluator produced the decision. */
  confidentialEvaluated: true;
  /** Legacy Fhenix gate — kept for older audit UIs. */
  fheEvaluated: boolean;
  teeEvaluated: boolean;
  evaluator: ConfidentialRail;
  mechanism: ConfidentialMechanism;
  chain: string;
  chainId: number;
  contractAddress: string | null;
  explorerBase: string;
  decisionIds?: string[];
  attestations?: string[];
  resolved?: boolean;
  [key: string]: unknown;
}

export function getActiveConfidentialRail(): ConfidentialRail {
  return isFlareEvaluatorEnabled() ? 'flare' : 'fhenix';
}

export function getConfidentialPolicyService(): ConfidentialPolicyEvaluator {
  if (getActiveConfidentialRail() === 'flare') {
    return sharedFlareConfidentialPolicyService;
  }
  return sharedFhenixPolicyService;
}

/** Evidence block for CRE / audit / governance responses. */
export function buildConfidentialEvidenceMeta(
  extra: {
    decisionIds?: string[];
    attestations?: string[];
    resolved?: boolean;
  } = {},
): ConfidentialEvidenceMeta {
  const rail = getActiveConfidentialRail();

  if (rail === 'flare') {
    const cfg = createFlareConfig();
    return {
      confidentialEvaluated: true,
      fheEvaluated: false,
      teeEvaluated: true,
      evaluator: 'flare',
      mechanism: 'tee',
      chain: 'flare-coston2',
      chainId: cfg.chainId || 114,
      contractAddress: cfg.contractAddress || null,
      explorerBase: 'https://coston2-explorer.flare.network',
      ...extra,
    };
  }

  const chainId = Number(process.env.FHENIX_CHAIN_ID || '421614');
  return {
    confidentialEvaluated: true,
    fheEvaluated: true,
    teeEvaluated: false,
    evaluator: 'fhenix',
    mechanism: 'fhe',
    chain: chainId === 84532 ? 'fhenix-base-sepolia' : 'fhenix-arbitrum-sepolia',
    chainId,
    contractAddress: process.env.FHENIX_POLICY_CONTRACT || null,
    explorerBase: 'https://explorer.fhenix.zone',
    ...extra,
  };
}
