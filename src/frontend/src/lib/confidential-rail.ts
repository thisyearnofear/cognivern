/**
 * Confidential compute rail — product copy helpers.
 * Prefer "private budgets" / "confidential"; rail is secondary.
 */

export type ConfidentialRail = 'flare' | 'fhenix';

export interface FlareStatusPayload {
  evaluator: string;
  enabled: boolean;
  configured: boolean;
  chainId: number;
  contractAddress: string | null;
  teeManager?: string | null;
  extensionId?: string | null;
  extProxyUrl?: string | null;
  rpcUrl?: string;
}

export interface ConfidentialRailView {
  rail: ConfidentialRail;
  /** Short badge label */
  badge: string;
  /** One-line policy list hint */
  policyHint: string;
  /** Create-form toggle title */
  encryptTitle: string;
  /** Create-form toggle subtitle (off state) */
  encryptOffHint: string;
  /** Create-form toggle subtitle (on state) */
  encryptOnHint: string;
  /** Expanded create-form explanation */
  encryptDetail: string;
  /** Audit / governance panel title */
  evalTitle: string;
  /** Audit / governance body */
  evalBody: string;
  /** Progress panel while evaluating */
  progressTitle: string;
  progressBody: string;
  /** Settings / architecture one-liner */
  architectureLine: string;
  /** Integrate footer fragment */
  integrateFragment: string;
  explorerBase: string;
  contractAddress: string | null;
}

const FLARE_VIEW = (contractAddress: string | null): ConfidentialRailView => ({
  rail: 'flare',
  badge: 'Private',
  policyHint: 'Private budgets evaluated in a Flare TEE on Coston2',
  encryptTitle: 'Keep limits private',
  encryptOffHint: 'Hide spending caps from agents during evaluation',
  encryptOnHint: 'Limits stay inside the enclave — agents see only the decision',
  encryptDetail:
    'Budget limits and spend counters are evaluated privately in a Flare Confidential Compute enclave. Only approve, hold, or deny is published on-chain.',
  evalTitle: 'Confidential policy evaluation',
  evalBody:
    'Spend checked against private budget limits in a Flare TEE. Thresholds never left the enclave.',
  progressTitle: 'Confidential evaluation',
  progressBody: 'Evaluating private budget limits in a Flare TEE…',
  architectureLine: 'Flare TEE — private budget eval on Coston2',
  integrateFragment: 'private budgets via Flare confidential compute (Coston2)',
  explorerBase: 'https://coston2-explorer.flare.network',
  contractAddress,
});

const FHENIX_VIEW: ConfidentialRailView = {
  rail: 'fhenix',
  badge: 'Private',
  policyHint: 'Private budgets evaluated in ciphertext on Fhenix',
  encryptTitle: 'Keep limits private',
  encryptOffHint: 'Hide spending caps from agents during evaluation',
  encryptOnHint: 'Budget limits encrypted on-chain — agents cannot see caps',
  encryptDetail:
    'Budget limits are evaluated in ciphertext. Agents receive only the decision; designated auditors can unseal limits via permit.',
  evalTitle: 'Confidential policy evaluation',
  evalBody:
    'Spend checked against encrypted budget limits. Thresholds were never exposed to the agent or the open network.',
  progressTitle: 'Confidential evaluation',
  progressBody: 'Evaluating encrypted budget limits…',
  architectureLine: 'Fhenix FHE — encrypted eval on Arbitrum Sepolia',
  integrateFragment: 'private budgets via confidential compute',
  explorerBase: 'https://explorer.fhenix.zone',
  contractAddress: null,
};

export function railViewFromFlareStatus(
  status: FlareStatusPayload | null | undefined,
): ConfidentialRailView {
  if (status?.enabled && status?.configured) {
    return FLARE_VIEW(status.contractAddress ?? null);
  }
  return FHENIX_VIEW;
}

export function isConfidentialEvidence(
  conf: Record<string, unknown> | null | undefined | object,
): boolean {
  if (!conf || typeof conf !== 'object') return false;
  const c = conf as Record<string, unknown>;
  return (
    c.confidentialEvaluated === true ||
    c.fheEvaluated === true ||
    c.teeEvaluated === true
  );
}

export function railViewFromEvidence(
  conf: Record<string, unknown> | null | undefined | object,
  fallback: ConfidentialRailView = FHENIX_VIEW,
): ConfidentialRailView {
  if (!conf || typeof conf !== 'object') return fallback;
  const c = conf as Record<string, unknown>;
  const evaluator = String(c.evaluator || '').toLowerCase();
  if (evaluator === 'flare' || c.teeEvaluated === true || c.chain === 'flare-coston2') {
    return FLARE_VIEW(
      typeof c.contractAddress === 'string' ? c.contractAddress : null,
    );
  }
  if (c.fheEvaluated === true || evaluator === 'fhenix') {
    return {
      ...FHENIX_VIEW,
      contractAddress:
        typeof c.contractAddress === 'string' ? c.contractAddress : null,
    };
  }
  return fallback;
}

export function confidentialExplorerHref(
  view: ConfidentialRailView,
  decisionId?: string | null,
): string | null {
  if (view.rail === 'flare') {
    if (view.contractAddress) {
      return `${view.explorerBase}/address/${view.contractAddress}`;
    }
    return view.explorerBase;
  }
  if (decisionId && decisionId.startsWith('0x') && decisionId.length >= 66) {
    // Fhenix historically linked decision ids as txs when available.
    return `${view.explorerBase}/tx/${decisionId}`;
  }
  return null;
}
