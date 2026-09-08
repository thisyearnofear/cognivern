import { describe, it, expect } from "vitest";
import type { FundedMandate } from "@/lib/api-client";
import { deriveMandateState } from "@/lib/mandate-state";

/**
 * A funded mandate's bounded adaptive state (docs/ADAPTIVE_UX.md). These tests
 * pin the derivation so surfaces that adapt to a mandate read a single source
 * of truth instead of re-branching on raw status + budget fields.
 */

const budgetAsset = (overrides: Partial<{
  authorizedAmount: string;
  allocatedAmount: string;
  consumedAmount: string;
  pendingAmount: string;
}> = {}) => ({
  authorizedAmount: "0",
  allocatedAmount: "0",
  consumedAmount: "0",
  pendingAmount: "0",
  ...overrides,
});

const baseMandate: FundedMandate = {
  id: "m-1",
  workspaceId: "ws-1",
  name: "Market making",
  objective: "Provide liquidity",
  agentIds: ["a-1"],
  status: "active",
  budget: { byAsset: { USD: budgetAsset() } },
  policyIds: ["p-1"],
  successMetrics: [],
  createdAt: "2026-09-08T00:00:00Z",
  updatedAt: "2026-09-08T00:00:00Z",
};

describe("deriveMandateState", () => {
  it("is setup while draft", () => {
    expect(deriveMandateState({ ...baseMandate, status: "draft" })).toBe("setup");
  });

  it("is closed when the mandate is closed", () => {
    expect(deriveMandateState({ ...baseMandate, status: "closed" })).toBe("closed");
  });

  it("is under_review when paused", () => {
    expect(deriveMandateState({ ...baseMandate, status: "paused" })).toBe(
      "under_review",
    );
  });

  it("is funded when active but no capital is allocated yet", () => {
    expect(
      deriveMandateState({
        ...baseMandate,
        status: "active",
        budget: { byAsset: { USD: budgetAsset({ authorizedAmount: "1000" }) } },
      }),
    ).toBe("funded");
  });

  it("is active when active and capital is allocated", () => {
    expect(
      deriveMandateState({
        ...baseMandate,
        status: "active",
        budget: { byAsset: { USD: budgetAsset({ allocatedAmount: "250" }) } },
      }),
    ).toBe("active");
  });

  it("defaults to setup for null/undefined input", () => {
    expect(deriveMandateState(null)).toBe("setup");
    expect(deriveMandateState(undefined)).toBe("setup");
  });

  it("defaults to setup for an unknown status", () => {
    expect(
      deriveMandateState({
        ...baseMandate,
        status: "phantom",
      } as unknown as FundedMandate),
    ).toBe("setup");
  });

  it("boundary: active with only a zero allocated amount is funded, not active", () => {
    // Number("0") === 0 — neither zero nor an empty allocation counts as deployed.
    expect(
      deriveMandateState({
        ...baseMandate,
        status: "active",
        budget: { byAsset: { USD: budgetAsset({ allocatedAmount: "0" }) } },
      }),
    ).toBe("funded");
  });

  it("boundary: active is reached by the first asset with a positive allocation", () => {
    expect(
      deriveMandateState({
        ...baseMandate,
        status: "active",
        budget: {
          byAsset: {
            USD: budgetAsset({ allocatedAmount: "0" }),
            ETH: budgetAsset({ allocatedAmount: "1.5" }),
          },
        },
      }),
    ).toBe("active");
  });
});
