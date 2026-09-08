import { describe, it, expect } from "vitest";
import type { Policy } from "@cognivern/shared";
import { derivePolicyState } from "@/lib/policy-state";

/**
 * A governance policy's bounded adaptive state (docs/ADAPTIVE_UX.md). These
 * tests pin the derivation so surfaces that adapt to a policy read a single
 * source of truth instead of re-branching on raw status + violations.
 */

const basePolicy: Policy = {
  id: "p-1",
  name: "Spend guard",
  type: "spend",
  description: "Caps per-transaction spend",
  status: "active",
  agents: 1,
  violations: 0,
};

describe("derivePolicyState", () => {
  it("is draft while a policy is still being authored", () => {
    expect(derivePolicyState({ ...basePolicy, status: "draft" })).toBe("draft");
  });

  it("is inactive when a policy is disabled", () => {
    expect(derivePolicyState({ ...basePolicy, status: "inactive" })).toBe(
      "inactive",
    );
  });

  it("is active when enforced with no violations", () => {
    expect(
      derivePolicyState({ ...basePolicy, status: "active", violations: 0 }),
    ).toBe("active");
  });

  it("is breached when enforced with one or more violations", () => {
    expect(
      derivePolicyState({ ...basePolicy, status: "active", violations: 1 }),
    ).toBe("breached");
    expect(
      derivePolicyState({ ...basePolicy, status: "active", violations: 5 }),
    ).toBe("breached");
  });

  it("defaults to inactive for null/undefined input", () => {
    expect(derivePolicyState(null)).toBe("inactive");
    expect(derivePolicyState(undefined)).toBe("inactive");
  });

  it("defaults to inactive for an unknown status", () => {
    expect(
      derivePolicyState({ ...basePolicy, status: "phantom" } as unknown as Policy),
    ).toBe("inactive");
  });

  it("boundary: active with violations 0 stays active, never breached (zero is not a breach)", () => {
    expect(
      derivePolicyState({ ...basePolicy, status: "active", violations: 0 }),
    ).toBe("active");
  });
});
