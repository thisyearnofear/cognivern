import { describe, expect, it } from "vitest";

/**
 * Solana settlement service unit tests.
 *
 * Coverage:
 *  - USD → base-units conversion (6-decimal USDC)
 *  - Explorer URL per cluster
 *  - Pure guard evaluation: per-transfer cap, payee allowlist, session
 *    runway, invalid amounts — every violation blocks before broadcast
 *  - Service-level disabled / invalid-payee / policy-block behavior
 *  - Env-driven cluster → default USDC mint selection
 *
 * No live sends — broadcast paths require a funded key and stay out of CI.
 */

import {
  evaluateSettlementGuards,
  explorerUrl,
  MAINNET_USDC_MINT,
  DEVNET_USDC_MINT,
  SolanaSettlementError,
  SolanaSettlementService,
  usdToBaseUnits,
} from "../../src/backend/services/blockchain/solana/SolanaSettlementService.js";

const ALLOWED_PAYEE = "11111111111111111111111111111111";
const guards = (over: Partial<Parameters<typeof evaluateSettlementGuards>[0]> = {}) =>
  evaluateSettlementGuards({
    intent: { payee: ALLOWED_PAYEE, amountUsd: 0.01 },
    maxTransferUsd: 0.05,
    payeeAllowlist: [ALLOWED_PAYEE],
    runwayUsd: 0.25,
    spentUsd: 0,
    ...over,
  });

describe("usdToBaseUnits", () => {
  it("converts USD to 6-decimal base units", () => {
    expect(usdToBaseUnits(1)).toBe(1_000_000n);
    expect(usdToBaseUnits(0.01)).toBe(10_000n);
    expect(usdToBaseUnits(0.000001)).toBe(1n);
  });

  it("rounds sub-micro-cent dust", () => {
    expect(usdToBaseUnits(0.0000004)).toBe(0n);
  });
});

describe("explorerUrl", () => {
  it("mainnet omits cluster param; devnet/testnet include it", () => {
    expect(explorerUrl("sig", "mainnet-beta")).toBe("https://solscan.io/tx/sig");
    expect(explorerUrl("sig", "devnet")).toBe("https://solscan.io/tx/sig?cluster=devnet");
    expect(explorerUrl("sig", "testnet")).toBe("https://solscan.io/tx/sig?cluster=testnet");
  });
});

describe("evaluateSettlementGuards", () => {
  it("allows a compliant intent", () => {
    expect(guards()).toEqual({ allowed: true, violations: [] });
  });

  it("blocks non-positive or non-finite amounts", () => {
    for (const amountUsd of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = guards({ intent: { payee: ALLOWED_PAYEE, amountUsd } });
      expect(r.allowed).toBe(false);
      expect(r.violations.join()).toContain("invalid amountUsd");
    }
  });

  it("blocks amounts above the per-transfer cap", () => {
    const r = guards({ intent: { payee: ALLOWED_PAYEE, amountUsd: 0.06 } });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain("per-transfer cap");
  });

  it("blocks when the allowlist is empty (fail closed)", () => {
    const r = guards({ payeeAllowlist: [] });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain("allowlist is empty");
  });

  it("blocks a payee outside the allowlist", () => {
    const r = guards({ intent: { payee: "NotAllowed111", amountUsd: 0.01 } });
    expect(r.allowed).toBe(false);
    expect(r.violations.join()).toContain("not in allowlist");
  });

  it("blocks when the session runway would be exceeded", () => {
    const r = guards({ spentUsd: 0.2, intent: { payee: ALLOWED_PAYEE, amountUsd: 0.06 - 0.05 } });
    // 0.2 spent + 0.01 > 0.25 is false; test the boundary properly:
    const r2 = guards({ spentUsd: 0.25 });
    expect(r2.allowed).toBe(false);
    expect(r2.violations.join()).toContain("session runway");
    expect(r.allowed).toBe(true);
  });

  it("collects multiple violations", () => {
    const r = guards({
      intent: { payee: "Nope", amountUsd: 0.5 },
      payeeAllowlist: [ALLOWED_PAYEE],
    });
    expect(r.allowed).toBe(false);
    expect(r.violations.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SolanaSettlementService", () => {
  const base = {
    enabled: true,
    privateKey: undefined,
    maxTransferUsd: 0.05,
    payeeAllowlist: [ALLOWED_PAYEE],
    runwayUsd: 0.25,
  };

  it("disabled service throws 'disabled'", async () => {
    const svc = new SolanaSettlementService({ ...base, enabled: false });
    await expect(svc.executeTransfer({ payee: ALLOWED_PAYEE, amountUsd: 0.01 })).rejects.toMatchObject({
      code: "disabled",
    });
  });

  it("rejects a malformed payee before any guard/broadcast", async () => {
    const svc = new SolanaSettlementService(base);
    await expect(svc.executeTransfer({ payee: "not-base58!!!", amountUsd: 0.01 })).rejects.toMatchObject(
      { code: "invalid_input" },
    );
  });

  it("policy block carries violations and never reaches a broadcast", async () => {
    const svc = new SolanaSettlementService({
      ...base,
      payeeAllowlist: ["SomeOtherPayee"],
    });
    const err = await svc
      .executeTransfer({ payee: ALLOWED_PAYEE, amountUsd: 0.01 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SolanaSettlementError);
    expect((err as SolanaSettlementError).code).toBe("policy");
    expect((err as SolanaSettlementError).violations?.join()).toContain("not in allowlist");
  });

  it("getStatus reports disabled cleanly without a key", async () => {
    const svc = new SolanaSettlementService({ enabled: false });
    const status = await svc.getStatus();
    expect(status.enabled).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.payer).toBeNull();
  });
});

describe("env-driven defaults", () => {
  it("mainnet-beta defaults to the mainnet USDC mint", () => {
    const svc = new SolanaSettlementService({ cluster: "mainnet-beta", enabled: false });
    expect(svc.getConfig().usdcMint).toBe(MAINNET_USDC_MINT);
  });

  it("devnet defaults to the devnet USDC mint", () => {
    const svc = new SolanaSettlementService({ cluster: "devnet", enabled: false });
    expect(svc.getConfig().usdcMint).toBe(DEVNET_USDC_MINT);
  });

  it("explicit mint overrides cluster default", () => {
    const svc = new SolanaSettlementService({ cluster: "devnet", usdcMint: "CustomMint111" });
    expect(svc.getConfig().usdcMint).toBe("CustomMint111");
  });
});
