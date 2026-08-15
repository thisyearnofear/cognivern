/**
 * Nano-USD money helpers.
 *
 * The credit ledger stores every amount as an integer number of nano-USD
 * (1e-9 USD). Rationale:
 *
 *  - Inference is priced per token at magnitudes where cents are far too
 *    coarse: a 0G model at ~$0.003 / 1K tokens costs 3 nano-USD per token.
 *    Micro-USD would round most single-token deltas to zero.
 *  - Integers mean the ledger's invariants are exact. Summing float dollars
 *    across 50 participants x thousands of calls accumulates drift, and a
 *    balance check that is "off by 1e-12" is a balance check that fails.
 *
 * Range is not a concern: a $1,000 pool is 1e12 nano-USD, and
 * Number.MAX_SAFE_INTEGER is ~9.007e15, so we have ~9,000x headroom before
 * needing BigInt.
 */

export const NANO_PER_USD = 1_000_000_000;

/** Largest nano-USD value we accept, ~$9,007,199 — well inside float safety. */
const MAX_NANO = Number.MAX_SAFE_INTEGER;

export function usdToNano(usd: number): number {
  if (!Number.isFinite(usd)) {
    throw new Error(`Invalid USD amount: ${usd}`);
  }
  const nano = Math.round(usd * NANO_PER_USD);
  if (Math.abs(nano) > MAX_NANO) {
    throw new Error(`USD amount out of representable range: ${usd}`);
  }
  return nano;
}

export function nanoToUsd(nano: number): number {
  return nano / NANO_PER_USD;
}

/** Human-facing dollar string. Uses 6dp because 2dp hides real inference costs. */
export function formatNanoUsd(nano: number): string {
  return `$${(nano / NANO_PER_USD).toFixed(6)}`;
}

/**
 * Assert a value is a safe non-negative integer amount.
 *
 * Used at every ledger boundary: a NaN or fractional amount reaching the
 * counters would silently corrupt balances, and SQLite would happily store it.
 */
export function assertNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of nano-USD, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${label} must not be negative, got ${value}`);
  }
  if (value > MAX_NANO) {
    throw new Error(`${label} exceeds the representable range, got ${value}`);
  }
  return value;
}
