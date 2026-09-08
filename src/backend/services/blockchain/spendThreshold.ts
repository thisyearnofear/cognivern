/**
 * Threshold-gated approval — pure, side-effect-free helpers.
 *
 * A policy can set `approvalThreshold` (a spend amount in the spend's smallest
 * unit / wei, as a string so precision is never lost). A spend at or above that
 * threshold is held pending explicit operator approval, then signed by the
 * wallet's configured signing provider and executed. Below the threshold the
 * default (non-held) path applies. Ledger is one supported signing provider;
 * it is never required.
 *
 * Kept pure so the threshold decision can be unit-tested without a wallet,
 * policy service, or chain.
 */

/** True when `value` is a string encoding a non-negative integer (wei). */
function isNonNegativeIntegerString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}

/**
 * Does `amountWei` meet or exceed the policy's `approvalThreshold`?
 *
 * Returns false (no gating) when the threshold is absent, empty, zero, or not a
 * valid non-negative integer string — so an invalid threshold never blocks a
 * spend, and existing policies without a threshold behave exactly as before.
 * Returns false when the amount itself is not a valid integer (the caller's own
 * validation handles malformed amounts separately).
 */
export function meetsApprovalThreshold(
  amountWei: string | undefined,
  threshold: string | undefined,
): boolean {
  if (!isNonNegativeIntegerString(amountWei)) return false;
  if (!isNonNegativeIntegerString(threshold)) return false;
  if (threshold === '0') return false;
  // BigInt comparison preserves full precision (no Number overflow).
  return BigInt(amountWei) >= BigInt(threshold);
}
