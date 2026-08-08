/**
 * Map Cleanverse A-Pass signals into spend-policy risk parameters.
 * Used so CVI is a risk input to governance, not only a binary gate.
 */

import type { APassRecord, CleanverseIdentityScreening } from "./CleanverseIdentityService.js";

export interface CleanversePolicySignals {
  chain: string;
  senderTier: string;
  recipientTier: string;
  senderGroup: string;
  recipientGroup: string;
  /** Soft AML-style USD cap derived from the weaker (higher) of sender/recipient tiers. */
  amlCapUsd: number;
  /** Mid-range review threshold in USD. */
  reviewAboveUsd: number;
  travelRuleRequired: boolean;
  riskTier: "low" | "medium" | "high";
}

const TIER_CAPS: Record<string, { amlCapUsd: number; reviewAboveUsd: number; risk: CleanversePolicySignals["riskTier"] }> = {
  TIER_1: { amlCapUsd: 10000, reviewAboveUsd: 2500, risk: "low" },
  TIER_2: { amlCapUsd: 3000, reviewAboveUsd: 750, risk: "medium" },
  TIER_3: { amlCapUsd: 1000, reviewAboveUsd: 200, risk: "high" },
};

function normalizeTier(tier?: string): string {
  const t = (tier || "TIER_3").toUpperCase();
  if (t in TIER_CAPS) return t;
  return "TIER_3";
}

function weakerTier(a: string, b: string): string {
  const rank = { TIER_1: 1, TIER_2: 2, TIER_3: 3 } as Record<string, number>;
  return (rank[a] || 3) >= (rank[b] || 3) ? a : b;
}

export function deriveCleanversePolicySignals(
  screening: CleanverseIdentityScreening,
): CleanversePolicySignals {
  const senderTier = normalizeTier(screening.sender.aPass?.tier);
  const recipientTier = normalizeTier(screening.recipient.aPass?.tier);
  const effective = weakerTier(senderTier, recipientTier);
  const caps = TIER_CAPS[effective] || TIER_CAPS.TIER_3;
  const senderGroup = screening.sender.aPass?.group || "UNKNOWN";
  const recipientGroup = screening.recipient.aPass?.group || "UNKNOWN";
  const crossGroup = senderGroup !== recipientGroup;

  return {
    chain: screening.chain,
    senderTier,
    recipientTier,
    senderGroup,
    recipientGroup,
    amlCapUsd: caps.amlCapUsd,
    reviewAboveUsd: caps.reviewAboveUsd,
    travelRuleRequired: crossGroup || effective === "TIER_3",
    riskTier: caps.risk,
  };
}

export function summarizeAPass(record?: APassRecord): Record<string, unknown> | undefined {
  if (!record) return undefined;
  return {
    status: record.status,
    tier: record.tier,
    group: record.group,
    subGroup: record.subGroup,
    isBlacklisted: record.isBlacklisted,
    isPaused: record.isPaused,
  };
}
