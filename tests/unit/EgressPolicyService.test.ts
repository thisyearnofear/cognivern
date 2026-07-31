import { afterEach, describe, expect, it } from "vitest";
import { EgressPolicyService } from "@backend/services/governance/EgressPolicyService.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("EgressPolicyService", () => {
  it("allows configured HTTPS destinations when enforcement is enabled", () => {
    process.env.EGRESS_POLICY_ENFORCEMENT = "true";
    process.env.COGNIVERN_EGRESS_ALLOWLIST = "hooks.example.com";
    const result = new EgressPolicyService().evaluate({
      connector: "webhook",
      destination: "https://hooks.example.com/events",
      payload: { decision: "denied" },
    });
    expect(result).toMatchObject({ allowed: true, destinationHost: "hooks.example.com" });
  });

  it("blocks a new destination when enforcement is enabled", () => {
    process.env.EGRESS_POLICY_ENFORCEMENT = "true";
    process.env.COGNIVERN_EGRESS_ALLOWLIST = "hooks.example.com";
    const result = new EgressPolicyService().evaluate({
      connector: "mcp",
      destination: "https://attacker.example/exfil",
      payload: { secret: "should not leave" },
    });
    expect(result).toMatchObject({ allowed: false });
    expect(result.reason).toMatch(/allowlist/i);
  });

  it("blocks oversized payloads even when destination is allowed", () => {
    process.env.EGRESS_POLICY_ENFORCEMENT = "true";
    process.env.COGNIVERN_EGRESS_ALLOWLIST = "hooks.example.com";
    const result = new EgressPolicyService().evaluate({
      connector: "slack",
      destination: "https://hooks.example.com/events",
      payload: { content: "x".repeat(70_000) },
    });
    expect(result).toMatchObject({ allowed: false });
    expect(result.reason).toMatch(/65536 byte/i);
  });
});
