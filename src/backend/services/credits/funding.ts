/**
 * Funding reconciliation — Layer 1 vs Layer 2 money.
 *
 * Layer 1 is the sponsor's actual deposit at the upstream provider (for 0G,
 * the Payment Layer balance the Router draws from). Layer 2 is our ledger:
 * `pool_nano` and the per-participant allocations. Nothing except this module
 * ever brings the two numbers into the same frame, and that is exactly the gap
 * that ends a live pilot: the ledger happily authorises spend the upstream
 * account cannot fund, and the first signal is a 402 mid-event.
 *
 * The output is deliberately a set of warnings, not a hard gate. The deposit
 * and the pool can legitimately disagree (a sponsor may fund more than they
 * allocated, or intend to top up later), so we surface the comparison and the
 * arithmetic behind it and let the sponsor decide. What we never do is pretend
 * the two are the same number.
 */

import {
  DISCLOSURE_TIERS,
  resolveMultipliers,
  type DisclosureTier,
} from "./disclosure.js";
import { nanoToUsd } from "./money.js";

export type UpstreamStatus =
  | {
      status: "ok";
      /** USD value of the spendable balance, or null when no rate is set. */
      balanceUsd: number | null;
      balanceNative: string;
      nativeUnit: string;
      fetchedAt: string;
    }
  | { status: "not_configured"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "not_supported"; message: string };

export interface FundingView {
  upstream: UpstreamStatus;
  poolUsd: number;
  /** Worst-case committed: total base x highest disclosure multiplier. */
  committedUsd: number;
  /** Actually allocated today (base x each participant's own tier). */
  allocatedUsd: number;
  unallocatedUsd: number;
  warnings: string[];
}

export function buildFundingView(input: {
  poolNano: number;
  baseTotalNano: number;
  allocatedNano: number;
  multipliers: Partial<Record<DisclosureTier, number>>;
  upstream: UpstreamStatus;
}): FundingView {
  const { poolNano, baseTotalNano, allocatedNano, multipliers, upstream } = input;

  const resolved = resolveMultipliers(multipliers);
  const maxMultiplier = Math.max(...DISCLOSURE_TIERS.map((t) => resolved[t]));
  const committedNano = Math.floor(baseTotalNano * maxMultiplier);

  const poolUsd = nanoToUsd(poolNano);
  const committedUsd = nanoToUsd(committedNano);
  const allocatedUsd = nanoToUsd(allocatedNano);
  const unallocatedUsd = nanoToUsd(Math.max(0, poolNano - allocatedNano));

  const warnings: string[] = [];

  switch (upstream.status) {
    case "not_configured":
      warnings.push(
        "Upstream balance is not checked. Set ZEROG_ROUTER_MANAGEMENT_KEY (an mk- key with account:read scope, from pc.0g.ai → Settings → Management Keys) so the ledger pool can be compared against the real 0G deposit.",
      );
      break;
    case "unavailable":
      warnings.push(`Upstream balance unavailable right now: ${upstream.message}`);
      break;
    case "not_supported":
      warnings.push(
        `${upstream.message || "This backend does not expose an upstream balance."} ` +
          `The pool cannot be reconciled against real funding.`,
      );
      break;
    case "ok": {
      if (upstream.balanceUsd === null) {
        warnings.push(
          "No ZEROG_ZG_USD_RATE is configured, so the upstream balance is reported in native units (neuron) only — USD comparisons are disabled.",
        );
      } else if (committedUsd > upstream.balanceUsd) {
        warnings.push(
          `Committed credits ($${committedUsd.toFixed(2)}) exceed the real upstream balance ($${upstream.balanceUsd.toFixed(2)}). ` +
            `Participants will hit 402 insufficient_balance once the deposit runs out. Top up at pc.0g.ai before the event.`,
        );
      } else if (poolUsd > upstream.balanceUsd) {
        warnings.push(
          `The configured pool ($${poolUsd.toFixed(2)}) exceeds the current upstream balance ($${upstream.balanceUsd.toFixed(2)}). ` +
            `Current commitments ($${committedUsd.toFixed(2)}) still fit, but top up before anyone draws the difference.`,
        );
      }
      break;
    }
  }

  return {
    upstream,
    poolUsd,
    committedUsd,
    allocatedUsd,
    unallocatedUsd,
    warnings,
  };
}
