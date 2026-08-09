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
  senderCountries?: string[],
  recipientCountries?: string[],
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
        countries: senderCountries,
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
        countries: recipientCountries,
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

  it("buckets numeric Cleanverse tiers (higher = more vetted)", () => {
    const signals = deriveCleanversePolicySignals(screening("45", "5"));
    expect(signals.senderTier).toBe("TIER_1");
    expect(signals.recipientTier).toBe("TIER_3");
    expect(signals.amlCapUsd).toBe(1000);
    expect(signals.riskTier).toBe("high");

    const top = deriveCleanversePolicySignals(screening("40", "60"));
    expect(top.amlCapUsd).toBe(10000);
    expect(top.riskTier).toBe("low");

    const mid = deriveCleanversePolicySignals(screening("15", "20"));
    expect(mid.amlCapUsd).toBe(3000);
    expect(mid.riskTier).toBe("medium");
  });

  it("requires a travel-rule note when groups differ", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "ALPHA", "BETA"),
    );
    expect(signals.travelRuleRequired).toBe(true);
  });

  it("applies no country constraint when no rule is configured", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1", ["US"], ["SG"]),
      { mode: "none", countries: [] },
    );
    expect(signals.countryRule).toBe("none");
    expect(signals.countryCompliant).toBe(true);
    expect(signals.senderCountries).toEqual(["US"]);
    expect(signals.recipientCountries).toEqual(["SG"]);
  });

  it("allowlist passes when both parties hold an allowed country tag", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1", ["us"], ["SG", "US"]),
      { mode: "allow", countries: ["US", "SG"] },
    );
    expect(signals.countryRule).toBe("allow");
    expect(signals.senderCountryOk).toBe(true);
    expect(signals.recipientCountryOk).toBe(true);
    expect(signals.countryCompliant).toBe(true);
  });

  it("allowlist denies a party whose country is not in the list", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1", ["US"], ["CN"]),
      { mode: "allow", countries: ["US", "SG"] },
    );
    expect(signals.countryCompliant).toBe(false);
    expect(signals.senderCountryOk).toBe(true);
    expect(signals.recipientCountryOk).toBe(false);
    expect(signals.countryDenyReason).toMatch(/Recipient failed country compliance/);
    expect(signals.countryDenyReason).toMatch(/CN/);
  });

  it("allowlist fails closed when an A-Pass has no country tags", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1", undefined, ["US"]),
      { mode: "allow", countries: ["US"] },
    );
    expect(signals.senderCountryOk).toBe(false);
    expect(signals.countryCompliant).toBe(false);
    expect(signals.countryDenyReason).toMatch(/no country tags/);
  });

  it("blocklist denies a blocked tag and passes a clean party", () => {
    const denied = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1", ["US"], ["RU"]),
      { mode: "block", countries: ["RU", "KP"] },
    );
    expect(denied.countryCompliant).toBe(false);
    expect(denied.senderCountryOk).toBe(true);
    expect(denied.recipientCountryOk).toBe(false);
    expect(denied.countryDenyReason).toMatch(/RU is blocked/);

    const clean = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1", ["US"], ["SG"]),
      { mode: "block", countries: ["RU", "KP"] },
    );
    expect(clean.countryCompliant).toBe(true);
  });

  it("blocklist does not fail a party with no country tags", () => {
    const signals = deriveCleanversePolicySignals(
      screening("TIER_1", "TIER_1", "G1", "G1"),
      { mode: "block", countries: ["RU"] },
    );
    expect(signals.countryCompliant).toBe(true);
  });

  it("country verdict combines with tier buckets in the same signals", () => {
    const signals = deriveCleanversePolicySignals(
      screening("45", "5", "G1", "G1", ["US"], ["RU"]),
      { mode: "allow", countries: ["US", "SG"] },
    );
    // Tier buckets still derived from A-Pass tiers...
    expect(signals.senderTier).toBe("TIER_1");
    expect(signals.recipientTier).toBe("TIER_3");
    expect(signals.amlCapUsd).toBe(1000);
    // ...and the country rule is enforced independently.
    expect(signals.countryCompliant).toBe(false);
    expect(signals.countryDenyReason).toMatch(/RU/);
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
