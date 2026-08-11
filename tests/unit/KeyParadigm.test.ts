import { requiredScopeForRoute, isKeyManagementPath } from "@backend/modules/api/keyScopes";
import {
  deriveKeyPolicyId,
  validateMandateLimits,
} from "@backend/services/keys/KeyMandateService";

describe("requiredScopeForRoute", () => {
  it("maps read methods to read scopes", () => {
    expect(requiredScopeForRoute("GET", "/api/agents")).toBe("agents:read");
    expect(requiredScopeForRoute("HEAD", "/api/agents/123")).toBe("agents:read");
    expect(requiredScopeForRoute("GET", "/api/governance/policies")).toBe("governance:read");
    expect(requiredScopeForRoute("GET", "/api/audit/logs")).toBe("audit:read");
  });

  it("maps write methods to write scopes", () => {
    expect(requiredScopeForRoute("POST", "/api/agents")).toBe("agents:write");
    expect(requiredScopeForRoute("DELETE", "/api/agents/123")).toBe("agents:write");
    expect(requiredScopeForRoute("POST", "/api/governance/evaluate")).toBe("governance:write");
  });

  it("requires spend:execute for spend writes", () => {
    expect(requiredScopeForRoute("POST", "/api/spend")).toBe("spend:execute");
    expect(requiredScopeForRoute("POST", "/api/spend/encrypted")).toBe("spend:execute");
  });

  it("ignores query strings and lets unmapped families through", () => {
    expect(requiredScopeForRoute("GET", "/api/governance/policies?limit=5")).toBe("governance:read");
    expect(requiredScopeForRoute("GET", "/api/observability/status")).toBeNull();
    expect(requiredScopeForRoute("POST", "/api/intents")).toBeNull();
  });
});

describe("isKeyManagementPath", () => {
  it("matches the collection and member routes in both mount spellings", () => {
    expect(isKeyManagementPath("/api/api-keys")).toBe(true);
    expect(isKeyManagementPath("/api/api-keys/abc123")).toBe(true);
    expect(isKeyManagementPath("/api/api-keys/import")).toBe(true);
    expect(isKeyManagementPath("/api-keys")).toBe(true);
    expect(isKeyManagementPath("/api-keys/import")).toBe(true);
    expect(isKeyManagementPath("/api-keys/abc123")).toBe(true);
  });

  it("does not match similar prefixes", () => {
    expect(isKeyManagementPath("/api/keys")).toBe(false);
    expect(isKeyManagementPath("/api/api-keysx")).toBe(false);
    expect(isKeyManagementPath("/api/agents")).toBe(false);
  });
});

describe("deriveKeyPolicyId", () => {
  it("produces a stable bytes32 hex per key id", () => {
    const a = deriveKeyPolicyId("key-uuid-1");
    const b = deriveKeyPolicyId("key-uuid-1");
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("never collides with the public demo policy or other keys", () => {
    expect(deriveKeyPolicyId("key-uuid-1")).not.toBe(deriveKeyPolicyId("key-uuid-2"));
    expect(deriveKeyPolicyId("0x01")).not.toBe(
      "0x" + "0".repeat(62) + "01",
    );
  });
});

describe("validateMandateLimits", () => {
  it("accepts the demo-scale presets", () => {
    expect(
      validateMandateLimits({ budgetUsd: 5000, perTxUsd: 2000, approvalThresholdUsd: 500 }),
    ).toEqual({ budgetUsd: 5000, perTxUsd: 2000, approvalThresholdUsd: 500 });
  });

  it("rejects non-positive or missing values", () => {
    for (const input of [
      {},
      { budgetUsd: 0, perTxUsd: 2000, approvalThresholdUsd: 500 },
      { budgetUsd: 5000, perTxUsd: -1, approvalThresholdUsd: 500 },
      { budgetUsd: 5000, perTxUsd: 2000 },
      { budgetUsd: "lots", perTxUsd: 2000, approvalThresholdUsd: 500 },
    ]) {
      expect(() => validateMandateLimits(input)).toThrow();
    }
  });

  it("enforces threshold < perTx <= budget (TEE approve/hold/deny semantics)", () => {
    expect(() =>
      validateMandateLimits({ budgetUsd: 5000, perTxUsd: 500, approvalThresholdUsd: 500 }),
    ).toThrow(/approvalThresholdUsd/);
    expect(() =>
      validateMandateLimits({ budgetUsd: 100, perTxUsd: 200, approvalThresholdUsd: 50 }),
    ).toThrow(/perTxUsd/);
    expect(() =>
      validateMandateLimits({ budgetUsd: 2_000_000, perTxUsd: 2000, approvalThresholdUsd: 500 }),
    ).toThrow(/budgetUsd/);
  });
});
