/**
 * A funded mandate's bounded adaptive state.
 *
 * The UI adapts to a *derivation of mandate status + capital allocation*,
 * never to inferred preference (see docs/ADAPTIVE_UX.md). This module is the
 * Analyze step of that loop for a single mandate: it reduces `FundedMandate`
 * status and its per-asset budget allocation into one of five states. Surfaces
 * that adapt to a mandate consume this instead of re-branching. Pure: no React,
 * no hooks, no side effects.
 *
 * `FundedMandate.status` is the explicit contract (`'draft' | 'active' |
 * 'paused' | 'closed'`); the capital signal then refines the `'active'` case
 * into "funded but not yet deployed" vs "actively deployed". There is no
 * inferred preference: the only inputs are the mandate's own status and the
 * budget amounts it reports.
 */

import type { FundedMandate } from '@/lib/api-client';

export type MandateState =
  | 'setup'
  | 'funded'
  | 'active'
  | 'under_review'
  | 'closed';

/**
 * True when any asset budget reports a positive `allocatedAmount` (capital
 * deployed to agents). Non-numeric / empty strings collapse to false.
 */
function hasAllocatedCapital(mandate: FundedMandate): boolean {
  const assets = Object.values(mandate.budget?.byAsset ?? {});
  return assets.some((asset) => Number(asset?.allocatedAmount) > 0);
}

/**
 * Reduce a funded mandate to one bounded adaptive state.
 *
 * Mapping (driven by `FundedMandate.status` + capital allocation):
 * - status `'closed'`                          → `'closed'` — terminal.
 * - status `'paused'`                          → `'under_review'` — operator hold.
 * - status `'draft'`                           → `'setup'` — still being defined.
 * - status `'active'`, any asset allocated > 0  → `'active'` — capital deployed,
 *   mandate is operating.
 * - status `'active'`, nothing allocated yet    → `'funded'` — mandate is live
 *   but capital is staged, not yet allocated to agents.
 * - `null`/`undefined`, or unknown status       → `'setup'` — the safe default;
 *   before a mandate exists the workspace is in the mandate-setup state.
 */
export function deriveMandateState(
  mandate?: FundedMandate | null,
): MandateState {
  if (!mandate) return 'setup';
  switch (mandate.status) {
    case 'closed':
      return 'closed';
    case 'paused':
      return 'under_review';
    case 'draft':
      return 'setup';
    case 'active':
      // Live mandate: 'active' once capital is deployed, else 'funded' (staged).
      return hasAllocatedCapital(mandate) ? 'active' : 'funded';
    default:
      return 'setup';
  }
}
