/**
 * A sealed-bid auction round's bounded adaptive state.
 *
 * The UI adapts to a *derivation of round status*, never to inferred preference
 * (see docs/ADAPTIVE_UX.md). This module is the Analyze step of that loop for a
 * single round: it reduces `SealedBidRound.status` (plus the observable winner
 * signal) into one of four states. Surfaces that adapt to a round consume this
 * instead of re-branching. Pure: no React, no hooks, no side effects.
 *
 * `SealedBidRoundStatus` is the explicit contract
 * (`'open' | 'closed' | 'revealed'`). The type has no explicit "reveal in
 * progress" flag, so the closed-round `winner` field is used as the observable
 * signal that bids have been opened and a winner is being resolved before the
 * status flips to `'revealed'`.
 */

import type { SealedBidRound } from '@/lib/api-client';

export type SealedBidState = 'open' | 'closed' | 'revealing' | 'settled';

/**
 * Reduce a sealed-bid round to one bounded adaptive state.
 *
 * Mapping (driven by `SealedBidRound.status` + the `winner` signal):
 * - status `'open'`                       → `'open'` — still accepting bids.
 * - status `'closed'`, `winner` already set → `'revealing'` — the deadline has
 *   passed, bids have been opened, and a winner has been computed even though the
 *   round status has not yet flipped to `'revealed'` (the reveal / resolution
 *   window).
 * - status `'closed'`, `winner` still null  → `'closed'` — sealed, waiting for
 *   the reveal step.
 * - status `'revealed'`                   → `'settled'` — bids revealed and the
 *   round is finalized.
 * - `null`/`undefined`, or unknown status  → `'open'` — the safe default; an
 *   absent/unknown round is treated as openable so the UI never hides a live
 *   auction.
 */
export function deriveSealedBidState(
  round?: SealedBidRound | null,
): SealedBidState {
  if (!round) return 'open';
  switch (round.status) {
    case 'open':
      return 'open';
    case 'closed':
      // A closed round with a known winner is mid-resolution: the reveal has
      // produced a winner but the round is not yet marked 'revealed'.
      return round.winner ? 'revealing' : 'closed';
    case 'revealed':
      return 'settled';
    default:
      return 'open';
  }
}
