import { describe, it, expect, beforeEach } from "vitest";

const { PolicyService } = await import(
  "../../src/backend/services/governance/PolicyService.js"
);
const { InMemoryPolicyPersistence } = await import(
  "../../src/backend/persistence/PolicyPersistence.js"
);
const { PolicyEnforcementService } = await import(
  "../../src/backend/services/governance/PolicyEnforcementService.js"
);

describe("Governance Pipeline Integration", () => {
  let policyService: PolicyService;
  let enforcement: PolicyEnforcementService;
  let testSpendPolicyId: string;

  beforeEach(async () => {
    policyService = new PolicyService(new InMemoryPolicyPersistence());

    const policy1 = await policyService.createPolicy(
      "test-spend-policy",
      "Integration test spend policy",
      [
        {
          id: "rule-1",
          type: "allow",
          condition: "action.metadata.amountValue < 1000",
          action: { type: "log", parameters: { effect: "allowed" } },
          metadata: {},
        },
        {
          id: "rule-2",
          type: "deny",
          condition: "action.metadata.amountValue >= 10000",
          action: { type: "block", parameters: { effect: "denied" } },
          metadata: {},
        },
      ],
      { category: "spend" },
    );
    testSpendPolicyId = policy1.id;

    await policyService.createPolicy(
      "test-contract-audit-policy",
      "Policy with contract audit rule",
      [
        {
          id: "rule-audit",
          type: "contract_audit",
          condition: "true",
          action: { type: "block", parameters: { effect: "denied" } },
          metadata: { requireAudit: true },
        },
      ],
      { category: "spend" },
    );

    enforcement = new PolicyEnforcementService(policyService as any);
    await enforcement.loadPolicy(testSpendPolicyId);
  });

  it("approves spend under the allowance threshold", async () => {
    const result = await enforcement.evaluateDecision({
      id: "action-1",
      timestamp: new Date().toISOString(),
      type: "spend",
      description: "Small vendor payment",
      metadata: { amountValue: 500, amount: "500", asset: "USDC", recipient: "0xvendor" },
      policyChecks: [],
    });

    expect(result.allowed).toBe(true);
  });

  it("denies spend over the hard limit", async () => {
    const result = await enforcement.evaluateDecision({
      id: "action-2",
      timestamp: new Date().toISOString(),
      type: "spend",
      description: "Large payment",
      metadata: { amountValue: 50000, amount: "50000", asset: "USDC", recipient: "0xlarge" },
      policyChecks: [],
    });

    expect(result.allowed).toBe(false);
  });

  it("enforces policy lifecycle: rules evaluated → checks returned", async () => {
    const result = await enforcement.evaluateDecision({
      id: "action-3",
      timestamp: new Date().toISOString(),
      type: "spend" as const,
      description: "Within limits",
      metadata: { amountValue: 250, amount: "250", asset: "USDC", recipient: "0xnormal" },
      policyChecks: [],
    });

    expect(result.allowed).toBe(true);
    expect(result.policyChecks.length).toBeGreaterThanOrEqual(1);
    for (const check of result.policyChecks) {
      expect(check).toHaveProperty("policyId");
      expect(check).toHaveProperty("result");
    }
  });

  it("rejects non-existent policy", async () => {
    await expect(
      enforcement.loadPolicy("non-existent-policy-id"),
    ).rejects.toThrow();
  });

  it("handles policy status change (active → held)", async () => {
    const fetched = await policyService.getPolicy(testSpendPolicyId);
    expect(fetched).toBeDefined();
    expect(fetched!.status).toBe("active");

    await policyService.updatePolicyStatus(testSpendPolicyId, "held");
    const updatedPolicy = await policyService.getPolicy(testSpendPolicyId);
    expect(updatedPolicy?.status).toBe("held");
  });

  it("returns structured audit evidence in policy checks", async () => {
    const result = await enforcement.evaluateDecision({
      id: "action-audit-1",
      timestamp: new Date().toISOString(),
      type: "spend",
      description: "Audited spend",
      metadata: { amountValue: 100, amount: "100", asset: "USDC", recipient: "0xaudit" },
      policyChecks: [],
    });

    expect(result).toHaveProperty("allowed");
    expect(result).toHaveProperty("policyChecks");
    for (const check of result.policyChecks) {
      expect(check).toHaveProperty("policyId");
      expect(check).toHaveProperty("result");
    }
  });
});
