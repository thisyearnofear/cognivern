/**
 * A run's bounded adaptive state.
 *
 * The UI adapts to a *derivation of run status*, never to inferred preference
 * (see docs/ADAPTIVE_UX.md). This module is the Analyze step of that loop for a
 * single execution: it reduces `Run.status` (plus the observable proof anchors
 * on `Run.evidence`) into one of four states. Any surface that adapts to a run
 * (detail approval controls, run-list attention flags) should consume the
 * result rather than re-derive its own status ladder, keeping those surfaces
 * from contradicting each other. Pure: no React, no hooks, no side effects.
 */

import type { Run } from '@cognivern/shared';

export type RunState = 'active' | 'paused_for_approval' | 'awaiting_receipt' | 'done';

/**
 * Reduce a run's observable facts to one bounded adaptive state.
 *
 * Mapping (driven by `Run.status`; `Run.evidence` only refines the running case):
 * - `'paused_for_approval'`                    → `'paused_for_approval'` — an
 *   operator review gate owns the run; approval controls surface in this state.
 * - `'running'` with an anchored governance proof in `run.evidence`
 *   (`zeroGProofV2` or `xlayerProofV2`)         → `'awaiting_receipt'` —
 *   execution continues while the receipt/proof has already settled, so the UI
 *   treats this as "running, receipt in hand" rather than plain active.
 * - `'running'` (no anchor) | `'queued'`        → `'active'` — work in flight.
 * - `'completed'` | `'failed'` | `'cancelled'`  → `'done'` — terminal.
 * - `null`/`undefined`, or any unknown status   → `'active'` — the safe default
 *   (never an undefined badge); an unknown status is surfaced as a live run so
 *   an operator is never told a stale payload is already finished.
 */
export function deriveRunState(run?: Run | null): RunState {
  if (!run) return 'active';
  switch (run.status) {
    case 'paused_for_approval':
      return 'paused_for_approval';
    case 'running':
      // A running run that already has an on-chain proof anchor has its receipt
      // settled even though steps may still be streaming — surface it as such.
      if (run.evidence?.zeroGProofV2 || run.evidence?.xlayerProofV2) {
        return 'awaiting_receipt';
      }
      return 'active';
    case 'queued':
      return 'active';
    case 'completed':
    case 'failed':
    case 'cancelled':
      return 'done';
    default:
      // Unknown/extra status (e.g. a stale payload) — safe-default to active.
      return 'active';
  }
}
