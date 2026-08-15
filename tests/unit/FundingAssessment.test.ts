/**
 * Funding reconciliation tests — Layer 1 (real upstream deposit) vs Layer 2
 * (ledger pool). The point of this module is that a sponsor should never
 * discover a funding shortfall via a mid-event 402, so every disagreement
 * between the two numbers must produce a warning a human can act on.
 */

import { describe, expect, it } from "vitest";
import { buildFundingView, type UpstreamStatus } from "@backend/services/credits/funding.js";
import { CEILING_DISCLOSURE_MULTIPLIERS } from "@backend/services/credits/disclosure.js";

const NANO = 1_000_000_000;

function funded(balanceUsd: number, balanceNative = "0"): UpstreamStatus {
  return {
    status: "ok",
    balanceUsd,
    balanceNative,
    nativeUnit: "neuron",
    fetchedAt: new Date().toISOString(),
  };
}

describe("buildFundingView", () => {
  it("reports the pool, commitment, and no warnings when everything agrees", () => {
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 1000 * NANO,
      allocatedNano: 1000 * NANO,
      multipliers: CEILING_DISCLOSURE_MULTIPLIERS,
      upstream: funded(2000),
    });

    expect(view.poolUsd).toBe(1000);
    expect(view.committedUsd).toBe(1000);
    expect(view.allocatedUsd).toBe(1000);
    expect(view.unallocatedUsd).toBe(0);
    expect(view.warnings).toEqual([]);
  });

  it("uses the highest multiplier for the worst-case commitment", () => {
    // Default bonus multipliers: open tier is 2x, so a $1000 base commits $2000.
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 1000 * NANO,
      allocatedNano: 1000 * NANO,
      multipliers: {},
      upstream: funded(2000),
    });

    expect(view.committedUsd).toBe(2000);
  });

  it("warns loudly when committed credits exceed the real deposit", () => {
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 1000 * NANO,
      allocatedNano: 800 * NANO,
      multipliers: {},
      upstream: funded(500),
    });

    expect(view.warnings.some((w) => w.includes("exceed the real upstream balance"))).toBe(true);
    expect(view.warnings.some((w) => w.includes("402"))).toBe(true);
  });

  it("warns softly when the pool exceeds the deposit but commitments still fit", () => {
    // Ceiling multipliers keep the worst-case commitment at the base total, so
    // the pool overruns the deposit while commitments still fit — the soft,
    // "top up before anyone draws the difference" warning, not the loud one.
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 300 * NANO,
      allocatedNano: 300 * NANO,
      multipliers: CEILING_DISCLOSURE_MULTIPLIERS,
      upstream: funded(500),
    });

    expect(view.warnings.some((w) => w.includes("exceeds the current upstream balance"))).toBe(true);
    expect(view.warnings.some((w) => w.includes("exceed the real upstream balance"))).toBe(false);
  });

  it("explains that a missing USD rate disables USD comparisons", () => {
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 100 * NANO,
      allocatedNano: 100 * NANO,
      multipliers: {},
      upstream: funded(null),
    });

    expect(view.warnings.some((w) => w.includes("ZEROG_ZG_USD_RATE"))).toBe(true);
  });

  it("tells the sponsor how to enable balance checking when no key is configured", () => {
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 100 * NANO,
      allocatedNano: 100 * NANO,
      multipliers: {},
      upstream: { status: "not_configured", message: "Set ZEROG_ROUTER_MANAGEMENT_KEY…" },
    });

    expect(view.warnings.some((w) => w.includes("ZEROG_ROUTER_MANAGEMENT_KEY"))).toBe(true);
  });

  it("never pretends a balance exists when the backend cannot report one", () => {
    const view = buildFundingView({
      poolNano: 1000 * NANO,
      baseTotalNano: 100 * NANO,
      allocatedNano: 100 * NANO,
      multipliers: {},
      upstream: { status: "not_supported", message: "no balance endpoint" },
    });

    expect(view.warnings.some((w) => w.includes("cannot be reconciled"))).toBe(true);
    expect(view.upstream.status).toBe("not_supported");
  });
});
