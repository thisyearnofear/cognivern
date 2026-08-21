import { describe, expect, it } from "vitest";
import {
  __testEvaluateRule,
  sumApprovedSpendToday,
} from "@backend/services/WorkspaceDataService.js";

describe("WorkspaceDataService policy evaluator", () => {
  const agent = { budget: "$1,000" };

  it("enforces amount > budget before the generic amount parser", () => {
    const denied = __testEvaluateRule(
      { condition: "amount > budget", action: "deny" },
      { amount: 1500 },
      agent,
    );
    expect(denied.passed).toBe(false);
    expect(denied.reason).toMatch(/budget/i);

    const allowed = __testEvaluateRule(
      { condition: "amount > budget", action: "deny" },
      { amount: 100 },
      agent,
    );
    expect(allowed.passed).toBe(true);
  });

  it("fails closed on unparseable amount thresholds", () => {
    const result = __testEvaluateRule(
      { condition: "amount > notanumber", action: "deny" },
      { amount: 1 },
      agent,
    );
    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/unparseable/i);
  });

  it("accumulates prior approved spend for daily_total rules", () => {
    const within = __testEvaluateRule(
      { condition: "daily_total > 500", action: "deny" },
      { amount: 100 },
      agent,
      350,
    );
    expect(within.passed).toBe(true);

    const over = __testEvaluateRule(
      { condition: "daily_total > 500", action: "deny" },
      { amount: 100 },
      agent,
      450,
    );
    expect(over.passed).toBe(false);
    expect(over.reason).toMatch(/550/);
  });

  it("sums approved spend for the UTC day only", () => {
    const now = "2026-08-21T15:00:00.000Z";
    const total = sumApprovedSpendToday(
      [
        { amount: 100, decision: "approved", timestamp: "2026-08-21T01:00:00.000Z" },
        { amount: 50, decision: "denied", timestamp: "2026-08-21T02:00:00.000Z" },
        { amount: 200, decision: "approved", timestamp: "2026-08-20T23:00:00.000Z" },
        { amount: 25, decision: "approved", timestamp: "2026-08-21T14:00:00.000Z" },
      ],
      now,
    );
    expect(total).toBe(125);
  });
});
