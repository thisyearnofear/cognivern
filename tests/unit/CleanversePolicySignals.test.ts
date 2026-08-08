import { describe, expect, it } from "vitest";
import {
  deriveCleanversePolicySignals,
  summarizeAPass,
} from "@backend/services/blockchain/cleanverse/CleanversePolicySignals.js";
import type { CleanverseIdentityScreening } from "@backend/services/blockchain/cleanverse/CleanverseIdentityService.js";

function screening(
  senderTier: string,
  recipientTier: string,
  senderGroup = "G1",
  recipientGroup = "G1",
): CleanverseIdentityScreening {
  return {
    required: true,
    chain: "monad",
    ok: true,
    sender: {
      address: "0xSender",
      ok: true,
      aPass: {
        chain: "monad",
        address: "0xSender",
        status: "ACTIVE",
        tier: senderTier,
        group: senderGroup,
        isBlacklisted: false,
        isPaused: false,
      },
    },
    recipient: {
      address: "0xRecipient",
      ok: true,
      aPass: {
        chain: "monad",
        address: "0xRecipient",
        status: "ACTIVE",
        tier: recipientTier,
        group: recipientGroup,
        isBlacklisted: false,
        isPaused: false,
      },
    },
  };
}

describe("deriveCleanversePolicySignals", () => {
  it("uses the weaker (higher) tier for AML / review caps", () => {
    const signals = deriveCleanversePolicySignals(screening("TIER_1", "TIER_3"));
    expect(signals.senderTier).toBe("TIER_1");
    expect(signals.recipientTier).toBe("TIER_3");
    expect(signals.amlCapUsd).toBe(1000);
    expect(signals.reviewAboveUsd).toBe(200);
    expect(signals.riskTier).toBe("high");
    expect(signals.travelRuleRequired).toBe(true);
  });

  it("keeps higher caps for matching TIER_1 parties in the same group", () => {
    const signals = deriveCleanversePolicySignals(screening("TIER_1", "TIER_1"));
    expect(signals.amlCapUsd).toBe(10000);
    expect(signals.reviewAboveUsd).toBe(2500);
    expect(signals.riskTier).toBe("low");
    expect(signals.travelRuleRequired).toBe(false);
  });

  it("requires a travel-rule note when groups differ", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "ALPHA", "BETA"),
    );
    expect(signals.travelRuleRequired).toBe(true);
  });

  it("summarizes A-Pass fields for attribution", () => {
    expect(
      summarizeAPass({
        chain: "monad",
        address: "0xabc",
        status: "ACTIVE",
        tier: "TIER_2",
        group: "G1",
        isBlacklisted: false,
        isPaused: false,
      }),
    ).toMatchObject({ status: "ACTIVE", tier: "TIER_2", group: "G1" });
    expect(summarizeAPass(undefined)).toBeUndefined();
  });
});
