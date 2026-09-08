/**
 * A governance policy's bounded adaptive state.
 *
 * The UI adapts to a *derivation of policy status + violation count*, never to
 * inferred preference (see docs/ADAPTIVE_UX.md). This module is the Analyze step
 * of that loop for a single policy: it reduces `Policy.status` and
 * `Policy.violations` into one of four states. Surfaces that adapt to a policy
 * consume this instead of re-branching. Pure: no React, no hooks, no side
 * effects.
 */

import type { Policy } from '@cognivern/shared';

export type PolicyState = 'draft' | 'active' | 'breached' | 'inactive';

/**
 * Reduce a policy to one bounded adaptive state.
 *
 * Mapping (driven by `Policy.status` + `Policy.violations`):
 * - status `'draft'`                    → `'draft'` — being authored, not enforced.
 * - status `'inactive'`                 → `'inactive'` — disabled by an operator.
 * - status `'active'`, `violations > 0`  → `'breached'` — enforced but a rule was
 *   tripped; the policy needs operator attention even though it is live.
 * - status `'active'`, `violations === 0`→ `'active'` — enforced and clean.
 * - `null`/`undefined`, or unknown status → `'inactive'` — the safe default; an
 *   absent/unknown policy is treated as off so the UI never implies enforcement
 *   that isn't there.
 */
export function derivePolicyState(policy?: Policy | null): PolicyState {
  if (!policy) return 'inactive';
  switch (policy.status) {
    case 'draft':
      return 'draft';
    case 'inactive':
      return 'inactive';
    case 'active':
      // Enforced policy: breach surfaces the moment any violation is recorded.
      return (policy.violations ?? 0) > 0 ? 'breached' : 'active';
    default:
      return 'inactive';
  }
}
