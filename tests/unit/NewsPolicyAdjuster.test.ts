import { describe, expect, it, vi } from "vitest";

vi.mock("@backend/services/NotificationService.js", () => ({
  NotificationService: {
    fireDecisionNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

import { NewsPolicyAdjuster } from "@backend/services/NewsPolicyAdjuster.js";
import { PolicyService } from "@backend/services/governance/PolicyService.js";
import { InMemoryPolicyPersistence } from "@backend/persistence/PolicyPersistence.js";
import type { PolicyRule } from "@backend/types/Policy.js";

function makeRule(): PolicyRule {
  return {
    id: "rule-1",
    type: "allow",
    condition: "true",
    action: { type: "log", parameters: {} },
    metadata: {},
  };
}

describe("NewsPolicyAdjuster tenant scope", () => {
  it("lists and releases holds only for the caller's workspace", async () => {
    const service = new PolicyService(new InMemoryPolicyPersistence());
    const policy = await service.createPolicy("Uniswap spend", "desc", [makeRule()], {
      workspaceId: "ws-a",
      allowedVendors: ["uniswap"],
    });
    const adjuster = new NewsPolicyAdjuster(service);

    await adjuster.handleNewsEvent({
      id: "news-1",
      type: "exploit",
      title: "Uniswap exploit",
      summary: "test",
      affectedProtocols: ["uniswap"],
      affectedTokens: [],
      severity: "critical",
      timestamp: new Date().toISOString(),
    });

    expect(adjuster.getActiveHolds("ws-a")).toHaveLength(1);
    expect(adjuster.getActiveHolds("ws-b")).toHaveLength(0);

    expect(await adjuster.releasePolicyHold(policy.id, "user-b", "ws-b")).toBe(false);
    expect(adjuster.getActiveHolds("ws-a")).toHaveLength(1);

    expect(await adjuster.releasePolicyHold(policy.id, "user-a", "ws-a")).toBe(true);
    expect(adjuster.getActiveHolds("ws-a")).toHaveLength(0);
  });
});
