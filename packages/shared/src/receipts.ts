/**
 * Typed async-flow receipts — the wire contract for receipt-driven UI.
 *
 * T3-style discipline: wait on *named* receipts, never on sleeps or polling.
 * Every async rail (FHE evaluation, Canton round close, x402 payment, 0G /
 * Filecoin evidence anchor) emits one of these. The backend persists them and
 * pushes them over the existing SSE channel; the frontend pattern-matches on
 * `type` and stops waiting. The `type` strings mirror `CreRunEventType` so a
 * run's event log and its receipts share one vocabulary.
 *
 * @see src/backend/services/EventBus.ts (SSE transport)
 * @see src/backend/cre/types.ts (CreRunEventType)
 */

export type ReceiptStatus = 'pending' | 'succeeded' | 'failed';

/** Common fields every receipt shares. Discriminated by `type`. */
export interface RailReceiptBase {
  /** Stable receipt name — pattern-match on this over SSE, never on a runId poll. */
  type: string;
  /** Links the receipt back to the originating run for UI correlation. */
  runId?: string;
  status: ReceiptStatus;
  timestamp: string;
  /** Human-readable context (reason on failure, summary on success). */
  message?: string;
  /** External reference (tx hash, ledger contract id, etc.). */
  ref?: string;
}

// ── Governance ────────────────────────────────────────────────────────────

export type GovernanceReceiptType =
  | 'governance.decision_approved'
  | 'governance.decision_held'
  | 'governance.decision_denied';

export interface GovernanceDecisionReceipt extends RailReceiptBase {
  type: GovernanceReceiptType;
  intentId: string;
  policyId?: string;
}

// ── Spend ──────────────────────────────────────────────────────────────────

export interface SpendReceiptAnchored extends RailReceiptBase {
  type: 'spend.receipt_anchored';
  intentId: string;
  txHash?: string;
  railId?: string;
}

// ── Sealed bid ──────────────────────────────────────────────────────────────

export type SealedBidReceiptType =
  | 'sealed_bid.round_created'
  | 'sealed_bid.round_closed'
  | 'sealed_bid.winner_revealed';

export interface SealedBidReceipt extends RailReceiptBase {
  type: SealedBidReceiptType;
  roundId: string;
  winner?: string;
}

// ── Evidence anchor ─────────────────────────────────────────────────────────

export interface EvidenceAnchorReceipt extends RailReceiptBase {
  type: 'evidence.anchored';
  runIdHash?: string;
  network: string;
  blockNumber?: number | null;
}

/** Union of every receipt the UI may receive. Extend by adding members here. */
export type RailReceipt =
  | GovernanceDecisionReceipt
  | SpendReceiptAnchored
  | SealedBidReceipt
  | EvidenceAnchorReceipt;

/** Every receipt `type` the system knows — used for inbound SSE validation. */
export const RECEIPT_EVENT_NAMES = [
  'governance.decision_approved',
  'governance.decision_held',
  'governance.decision_denied',
  'spend.receipt_anchored',
  'sealed_bid.round_created',
  'sealed_bid.round_closed',
  'sealed_bid.winner_revealed',
  'evidence.anchored',
] as const;

export type ReceiptEventName = (typeof RECEIPT_EVENT_NAMES)[number];

/** Narrow an unknown SSE event name to a known receipt, or null. */
export function isReceiptEventName(value: unknown): value is ReceiptEventName {
  return (
    typeof value === 'string' &&
    (RECEIPT_EVENT_NAMES as readonly string[]).includes(value)
  );
}
