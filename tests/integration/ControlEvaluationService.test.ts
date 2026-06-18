import { describe, it, expect } from "vitest";

const { ControlEvaluationService } = await import(
  "../../src/backend/services/ControlEvaluationService.js"
);

function action(overrides: Record<string, any> = {}) {
  return {
    id: "a1",
    type: "spend",
    timestamp: new Date().toISOString(),
    description: "test action",
    policyChecks: [],
    metadata: { amountValue: 100, amount: "100", asset: "USDC" },
    ...overrides,
  };
}

describe("ControlEvaluationService.score", () => {
  const svc = new ControlEvaluationService();

  it("returns normal for a clean business-hours action with no failed checks", () => {
    const result = svc.score({
      action: action({
        timestamp: new Date(2026, 5, 13, 12, 0, 0).toISOString(),
      }),
      policyChecks: [{ policyId: "p1", result: true, reason: "ok" }],
    });

    expect(result.composite).toBeLessThan(0.3);
    expect(result.label).toBe("normal");
    expect(result.escalated).toBe(false);
  });

  it("returns behavioralDeviation=0 when no preferences are provided", () => {
    const result = svc.score({
      action: action(),
      policyChecks: [],
      preferences: null,
    });

    expect(result.dimensions.behavioralDeviation).toBe(0);
  });

  it("scores rule violations heavily when deny rules fail", () => {
    const result = svc.score({
      action: action(),
      policyChecks: [
        { policyId: "deny-over-budget", result: false, reason: "amount too high" },
        { policyId: "deny-bad-recipient", result: false, reason: "bad recipient" },
        { policyId: "allow-default", result: true, reason: "ok" },
      ],
    });

    expect(result.dimensions.ruleViolations).toBeGreaterThanOrEqual(0.6);
    expect(result.composite).toBeGreaterThan(0);
  });

  it("detects off-hours + burst via temporal anomaly", () => {
    const base = new Date(2026, 5, 13, 3, 0, 0); // 3 AM
    const recent = Array.from({ length: 12 }).map((_, i) => ({
      type: "spend",
      timestamp: new Date(base.getTime() - (12 - i) * 20_000).toISOString(),
    }));

    const result = svc.score({
      action: action({ timestamp: base.toISOString() }),
      policyChecks: [],
      recentActions: recent,
    });

    expect(result.dimensions.temporalAnomaly).toBeGreaterThanOrEqual(0.5);
  });

  it("detects scope creep when touchedResources exceed requestedScope", () => {
    const result = svc.score({
      action: action({
        metadata: {
          touchedResources: ["a", "b", "c", "d", "e"],
        },
      }),
      policyChecks: [],
      requestedScope: ["a"],
    });

    expect(result.dimensions.scopeCreep).toBeGreaterThanOrEqual(0.5);
  });

  it("label boundaries match spec: normal / elevated / high / critical", () => {
    const labels = [
      { composite: 0.0, expected: "normal" },
      { composite: 0.29, expected: "normal" },
      { composite: 0.31, expected: "elevated" },
      { composite: 0.59, expected: "elevated" },
      { composite: 0.61, expected: "high" },
      { composite: 0.79, expected: "high" },
      { composite: 0.81, expected: "critical" },
      { composite: 1.0, expected: "critical" },
    ];
    for (const { composite, expected } of labels) {
      // Reach into the private labelFor helper via type escape for coverage.
      const label = (svc as unknown as { labelFor: (n: number) => string }).labelFor(
        composite,
      );
      expect(label).toBe(expected);
    }
  });

  it("escalated=true when composite >= 0.6", () => {
    // Force a high score: 2 deny-rule failures + off-hours burst + scope creep + sabotage patterns.
    const base = new Date(2026, 5, 13, 3, 0, 0);
    const recent = Array.from({ length: 12 }).map((_, i) => ({
      type: "spend",
      timestamp: new Date(base.getTime() - (12 - i) * 20_000).toISOString(),
    }));
    const result = svc.score({
      action: action({
        timestamp: base.toISOString(),
        metadata: {
          touchedResources: ["credentials.env", "vault/secrets.db"],
          leakedSecrets: ["API_KEY"],
        },
      }),
      policyChecks: [
        { policyId: "deny-over-budget", result: false, reason: "over budget" },
        { policyId: "deny-bad-recipient", result: false, reason: "bad recipient" },
      ],
      recentActions: recent,
      requestedScope: ["auth/config.ts"],
    });

    expect(result.composite).toBeGreaterThanOrEqual(0.6);
    expect(result.escalated).toBe(true);
    expect(["high", "critical"]).toContain(result.label);
  });

  it("scores behavioral deviation when conservative agent takes aggressive action", () => {
    const result = svc.score({
      action: action({
        metadata: {
          amountValue: 5000,
          amount: 5000,
          chain: "Solana",
          model: "gpt-5",
        },
      }),
      policyChecks: [],
      preferences: {
        style: "conservative",
        riskTolerance: 0.2,
        preferredChains: ["Ethereum", "Base"],
        preferredModels: ["gpt-4"],
      } as any,
    });

    expect(result.dimensions.behavioralDeviation).toBeGreaterThanOrEqual(0.6);
  });
});
