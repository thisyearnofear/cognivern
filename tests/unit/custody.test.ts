import { describe, expect, it } from "vitest";
import {
  custodyToProviders,
  deriveCustodyMode,
  CUSTODY_MODE_META,
} from "@cognivern/shared";

describe("custody helpers", () => {
  it("maps modes to provider pairs", () => {
    expect(custodyToProviders("vault")).toEqual({
      executionProvider: "local",
      signingProvider: "local",
    });
    expect(custodyToProviders("managed_mpc")).toEqual({
      executionProvider: "dynamic",
      signingProvider: "dynamic",
    });
    expect(custodyToProviders("hosted_execution")).toEqual({
      executionProvider: "keeperhub",
      signingProvider: "local",
    });
    expect(custodyToProviders("verified_settlement")).toEqual({
      executionProvider: "cleanverse",
      signingProvider: "local",
    });
    expect(custodyToProviders("custom")).toBeNull();
  });

  it("derives modes from metadata", () => {
    expect(
      deriveCustodyMode({
        executionProvider: "dynamic",
        signingProvider: "dynamic",
      }),
    ).toBe("managed_mpc");
    expect(
      deriveCustodyMode({
        executionProvider: "local",
        signingProvider: "ledger",
      }),
    ).toBe("vault");
    expect(
      deriveCustodyMode({
        executionProvider: "keeperhub",
        signingProvider: "local",
      }),
    ).toBe("hosted_execution");
    expect(
      deriveCustodyMode({
        executionProvider: "dynamic",
        signingProvider: "local",
      }),
    ).toBe("custom");
  });

  it("keeps labels need-oriented", () => {
    expect(CUSTODY_MODE_META.managed_mpc.label).toBe("Managed MPC");
    expect(CUSTODY_MODE_META.managed_mpc.poweredBy).toMatch(/Dynamic/i);
  });
});
