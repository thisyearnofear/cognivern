import { describe, it, expect, beforeEach } from "vitest";
import { PolicyService } from "../../src/backend/services/governance/PolicyService.js";
import { InMemoryPolicyPersistence } from "../../src/backend/persistence/PolicyPersistence.js";
import type { PolicyRule } from "../../src/backend/types/Policy.js";

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

describe("PolicyService", () => {
  let service: PolicyService;

  beforeEach(() => {
    service = new PolicyService(new InMemoryPolicyPersistence());
  });

  it("creates a policy and returns it", async () => {
    const policy = await service.createPolicy("Test", "desc", [makeRule()]);
    expect(policy.id).toBeTruthy();
    expect(policy.name).toBe("Test");
    expect(policy.status).toBe("active");
    expect(policy.version).toBe("1.0.0");
  });

  it("getPolicy returns null for nonexistent", async () => {
    const result = await service.getPolicy("nonexistent");
    expect(result).toBeNull();
  });

  it("getPolicy returns created policy by id", async () => {
    const created = await service.createPolicy("Test", "desc", [makeRule()]);
    const fetched = await service.getPolicy(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe("Test");
  });

  it("listPolicies returns created policies", async () => {
    await service.createPolicy("Custom A", "desc", [makeRule()]);
    await new Promise((r) => setTimeout(r, 5));
    await service.createPolicy("Custom B", "desc", [makeRule()]);
    const list = await service.listPolicies();
    const names = list.map((p) => p.name);
    expect(names).toContain("Custom A");
    expect(names).toContain("Custom B");
  });

  it("listPolicies is isolated per instance", async () => {
    const s1 = new PolicyService(new InMemoryPolicyPersistence());
    const s2 = new PolicyService(new InMemoryPolicyPersistence());
    await s1.createPolicy("S1 Only", "desc", [makeRule()]);
    const list1 = await s1.listPolicies();
    const list2 = await s2.listPolicies();
    expect(list1.some((p) => p.name === "S1 Only")).toBe(true);
    expect(list2.some((p) => p.name === "S1 Only")).toBe(false);
  });

  it("updatePolicy merges fields", async () => {
    const created = await service.createPolicy("Original", "desc", [makeRule()]);
    const updated = await service.updatePolicy(created.id, {
      name: "Renamed",
      description: "New desc",
    });
    expect(updated.name).toBe("Renamed");
    expect(updated.description).toBe("New desc");
  });

  it("updatePolicy throws for nonexistent policy", async () => {
    await expect(
      service.updatePolicy("nonexistent", { name: "x" }),
    ).rejects.toThrow("not found");
  });

  it("updatePolicyStatus changes status", async () => {
    const created = await service.createPolicy("Test", "desc", [makeRule()]);
    expect(created.status).toBe("active");

    await service.updatePolicyStatus(created.id, "archived");
    const fetched = await service.getPolicy(created.id);
    expect(fetched!.status).toBe("archived");
  });
});
