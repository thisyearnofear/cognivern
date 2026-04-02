import test from "node:test";
import assert from "node:assert";
import { PolicyEnforcementService } from "../../src/services/PolicyEnforcementService.js";
import { Policy, PolicyRule } from "../../src/types/Policy.js";
import { AgentAction } from "../../src/types/Agent.js";

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

test("PolicyEnforcementService", async (t) => {
  await t.test("should throw if no policy loaded when evaluating", async () => {
    const service = new PolicyEnforcementService();
    await assert.rejects(
      () => service.evaluateAction(makeAction()),
      /No policy loaded/,
    );
  });

  await t.test("should throw if no policy loaded when enforcing", async () => {
    const service = new PolicyEnforcementService();
    await assert.rejects(
      () => service.enforcePolicy(makeAction()),
      /No policy loaded/,
    );
  });

  await t.test("loadPolicy throws without PolicyService", async () => {
    const service = new PolicyEnforcementService();
    await assert.rejects(
      () => service.loadPolicy("any-id"),
      /PolicyService not initialized/,
    );
  });

  await t.test("loadPolicy succeeds with PolicyService", async () => {
    const service = new PolicyEnforcementService(mockPolicyService);
    await service.loadPolicy("test-policy");
    assert.ok(service.getCurrentPolicy());
    assert.strictEqual(service.getCurrentPolicy()?.id, "test-policy");
  });

  await t.test("loadPolicy throws for non-existent policy", async () => {
    const service = new PolicyEnforcementService(mockPolicyService);
    await assert.rejects(() => service.loadPolicy("missing"), /not found/);
  });

  await t.test("evaluateAction returns checks for each rule", async () => {
    const service = new PolicyEnforcementService();
    const policy = makePolicy([
      makeRule({ id: "r1", type: "allow" }),
      makeRule({ id: "r2", type: "deny" }),
    ]);
    // Inject policy directly via initialize trick
    (service as any).currentPolicy = policy;

    const checks = await service.evaluateAction(makeAction());
    assert.strictEqual(checks.length, 2);
    assert.ok(checks.every((c) => typeof c.result === "boolean"));
  });

  await t.test("evaluateAction fails non-matching expressions", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({ id: "r1", type: "allow", condition: 'action.type === "trade"' }),
    ]);

    const [check] = await service.evaluateAction(makeAction({ type: "analysis" }));
    assert.strictEqual(check.result, false);
  });

  await t.test("evaluateAction supports arithmetic and includes expressions", async () => {
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
    assert.strictEqual(checks[0].result, false);
  });

  await t.test("enforcePolicy passes for allow rules", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({ id: "r1", type: "allow" }),
    ]);

    const result = await service.enforcePolicy(makeAction());
    assert.strictEqual(result, true);
  });

  await t.test("enforcePolicy fails when deny rule triggers", async () => {
    const service = new PolicyEnforcementService();
    (service as any).currentPolicy = makePolicy([
      makeRule({ id: "r1", type: "deny" }),
    ]);

    const result = await service.enforcePolicy(makeAction());
    assert.strictEqual(result, false);
  });

  await t.test("rate limit rule allows within limit", async () => {
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
    assert.strictEqual(result1, true);

    const result2 = await service.enforcePolicy(action);
    assert.strictEqual(result2, true);
  });

  await t.test(
    "rate limit rule blocks when exceeded (via evaluateAction)",
    async () => {
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
      assert.strictEqual(checks1[0].result, true); // 1st allowed

      const checks2 = await service.evaluateAction(action);
      assert.strictEqual(checks2[0].result, false); // 2nd blocked
    },
  );

  await t.test("clearRateLimitCounters resets state", async () => {
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
    assert.strictEqual(result, true);
  });

  await t.test("getCurrentPolicy returns null initially", () => {
    const service = new PolicyEnforcementService();
    assert.strictEqual(service.getCurrentPolicy(), null);
  });
});
