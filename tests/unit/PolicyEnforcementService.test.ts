import { describe, it, expect } from "vitest";
import { PolicyEnforcementService } from "../../src/backend/services/governance/PolicyEnforcementService.js";
import { Policy, PolicyRule } from "../../src/backend/types/Policy.js";
import { AgentAction } from "../../src/backend/types/Agent.js";

function makeRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: `rule-${Math.random().toString(36).slice(2)}`,
    type: "allow",
    condition: 'action.type === "analysis"',
    action: { type: "log", parameters: {} },
    metadata: {},
    ...overrides,
  };
}

function makePolicy(rules: PolicyRule[] = [makeRule()]): Policy {
  return {
    id: "test-policy",
    name: "Test Policy",
    description: "A test policy",
    version: "1.0.0",
    rules,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
  };
}

function makeAction(overrides: Partial<AgentAction> = {}): AgentAction {
  return {
    id: "action-1",
    timestamp: new Date().toISOString(),
    type: "analysis",
    description: "Test action",
    metadata: {},
    policyChecks: [],
    ...overrides,
  };
}

const mockPolicyService = {
  getPolicy: async (id: string) => {
    if (id === "test-policy") return makePolicy();
    return null;
  },
} as any;

describe("PolicyEnforcementService", () => {
  it("should throw if no policy loaded when evaluating", async () => {
    const service = new PolicyEnforcementService();
    await expect(() => service.evaluateAction(makeAction())).rejects.toThrow(
      /No policy loaded/,
    );
  });

  it("should throw if no policy loaded when enforcing", async () => {
    const service = new PolicyEnforcementService();
    await expect(() => service.enforcePolicy(makeAction())).rejects.toThrow(
      /No policy loaded/,
    );
  });

  it("loadPolicy throws without PolicyService", async () => {
    const service = new PolicyEnforcementService();
    await expect(() => service.loadPolicy("any-id")).rejects.toThrow(
      /PolicyService not initialized/,
    );
  });

  it("loadPolicy succeeds with PolicyService", async () => {
    const service = new PolicyEnforcementService(mockPolicyService);
    await service.loadPolicy("test-policy");
    expect(service.getCurrentPolicy()).toBeTruthy();
    expect(service.getCurrentPolicy()?.id).toBe("test-policy");
  });

  it("loadPolicy throws for non-existent policy", async () => {
    const service = new PolicyEnforcementService(mockPolicyService);
    await expect(() => service.loadPolicy("missing")).rejects.toThrow(
      /not found/,
    );
  });

  it("evaluateAction returns checks for each rule", async () => {
    const service = new PolicyEnforcementService();
    const policy = makePolicy([
      makeRule({ id: "r1", type: "allow" }),
      makeRule({ id: "r2", type: "deny" }),
    ]);
    // Inject policy directly via initialize trick
    (service as any).currentPolicy = policy;

    const checks = await service.evaluateAction(makeAction());
    expect(checks.length).toBe(2);
    expect(checks.every((c) => typeof c.result === "boolean")).toBeTruthy();
  });

  it("evaluateAction fails non-matching expressions", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({
        id: "r1",
        type: "allow",
        condition: 'action.type === "trade"',
      }),
    ]);

    const [check] = await service.evaluateAction(
      makeAction({ type: "analysis" }),
    );
    expect(check.result).toBe(false);
  });

  it("evaluateAction supports arithmetic and includes expressions", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({
        id: "r1",
        type: "deny",
        condition:
          "['ETH', 'BTC'].includes(action.metadata.symbol) && action.metadata.quantity * action.metadata.price > 1000",
      }),
    ]);

    const checks = await service.evaluateAction(
      makeAction({
        type: "trade",
        metadata: { symbol: "ETH", quantity: 2, price: 600 },
      }),
    );
    expect(checks[0].result).toBe(false);
  });

  it("enforcePolicy passes for allow rules", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({ id: "r1", type: "allow" }),
    ]);

    const result = await service.enforcePolicy(makeAction());
    expect(result).toBe(true);
  });

  it("enforcePolicy fails when deny rule triggers", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({ id: "r1", type: "deny" }),
    ]);

    const result = await service.enforcePolicy(makeAction());
    expect(result).toBe(false);
  });

  it("rate limit rule allows within limit", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({
        id: "rl1",
        type: "rate_limit",
        metadata: { windowMs: 60000, maxRequests: 2 },
      }),
    ]);

    const action = makeAction();
    const result1 = await service.enforcePolicy(action);
    expect(result1).toBe(true);

    const result2 = await service.enforcePolicy(action);
    expect(result2).toBe(true);
  });

  it("rate limit rule blocks when exceeded (via evaluateAction)", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({
        id: "rl2",
        type: "rate_limit",
        metadata: { windowMs: 60000, maxRequests: 1 },
      }),
    ]);

    const action = makeAction();
    const checks1 = await service.evaluateAction(action);
    expect(checks1[0].result).toBe(true); // 1st allowed

    const checks2 = await service.evaluateAction(action);
    expect(checks2[0].result).toBe(false); // 2nd blocked
  });

  it("clearRateLimitCounters resets state", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({
        id: "rl3",
        type: "rate_limit",
        metadata: { windowMs: 60000, maxRequests: 1 },
      }),
    ]);

    const action = makeAction();
    await service.enforcePolicy(action); // 1st allowed
    await service.enforcePolicy(action); // 2nd blocked

    service.clearRateLimitCounters();
    const result = await service.enforcePolicy(action); // allowed again
    expect(result).toBe(true);
  });

  it("getCurrentPolicy returns null initially", () => {
    const service = new PolicyEnforcementService();
    expect(service.getCurrentPolicy()).toBeNull();
  });
});
