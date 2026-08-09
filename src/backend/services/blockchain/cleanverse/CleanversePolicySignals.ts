/**
 * Map Cleanverse A-Pass signals into spend-policy risk parameters.
 * Used so CVI is a risk input to governance, not only a binary gate.
 */

import type { APassRecord, CleanverseIdentityScreening } from "./CleanverseIdentityService.js";
import {
  cleanverseConfig,
  type CleanverseCountryRule,
} from "@backend/shared/config/index.js";

export interface CleanversePolicySignals {
  chain: string;
  senderTier: string;
  recipientTier: string;
  senderGroup: string;
  recipientGroup: string;
  /** ISO 3166-1 alpha-2 country tags on each party's A-Pass (v5.5). */
  senderCountries: string[];
  recipientCountries: string[];
  /** Institutional country rule applied ("allow" | "block" | "none"). */
  countryRule: CleanverseCountryRule["mode"];
  senderCountryOk: boolean;
  recipientCountryOk: boolean;
  /** False when either party fails the configured country rule. */
  countryCompliant: boolean;
  countryDenyReason?: string;
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
  const t = String(tier || "").trim().toUpperCase();
  if (t in TIER_CAPS) return t;
  // Live Cleanverse tiers are numeric strings 0-99 where HIGHER = more vetted
  // (contract rules use "user allowed if tier > min_tier"). Bucket them into
  // the three internal risk tiers so real A-Passes get sensible caps.
  // ASSUMPTION (unvalidated against real A-Pass data): >= 30 → TIER_1
  // (low risk), >= 10 → TIER_2 (medium), else TIER_3 (high). Conservative
  // lower buckets are safe for AML caps; revisit with real A-Pass tiers.
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n >= 30) return "TIER_1";
    if (n >= 10) return "TIER_2";
  }
  return "TIER_3";
}

function weakerTier(a: string, b: string): string {
  const rank = { TIER_1: 1, TIER_2: 2, TIER_3: 3 } as Record<string, number>;
  return (rank[a] || 3) >= (rank[b] || 3) ? a : b;
}

function normalizeCountries(countries?: string[]): string[] {
  return (countries || [])
    .map((c) => String(c).trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
}

/**
 * Evaluate a party's A-Pass country tags against the institutional rule.
 * Fail-closed for allowlists: a party with no readable country tags cannot
 * be proven compliant and is denied. Blocklists only deny on a direct hit.
 */
function evaluatePartyCountry(
  countries: string[] | undefined,
  rule: CleanverseCountryRule,
): { ok: boolean; reason?: string } {
  if (rule.mode === "none") {
    return { ok: true };
  }
  const normalized = normalizeCountries(countries);

  if (rule.mode === "allow") {
    if (normalized.length === 0) {
      return {
        ok: false,
        reason: "A-Pass has no country tags; cannot verify against the allowlist",
      };
    }
    if (normalized.some((c) => rule.countries.includes(c))) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `A-Pass country ${normalized.join(", ")} is not in the allowed list`,
    };
  }

  const blocked = normalized.filter((c) => rule.countries.includes(c));
  if (blocked.length === 0) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: `A-Pass country ${blocked.join(", ")} is blocked`,
  };
}

export function deriveCleanversePolicySignals(
  screening: CleanverseIdentityScreening,
  countryRule: CleanverseCountryRule = cleanverseConfig.countryRule,
): CleanversePolicySignals {
  const senderTier = normalizeTier(screening.sender.aPass?.tier);
  const recipientTier = normalizeTier(screening.recipient.aPass?.tier);
  const effective = weakerTier(senderTier, recipientTier);
  const caps = TIER_CAPS[effective] || TIER_CAPS.TIER_3;
  const senderGroup = screening.sender.aPass?.group || "UNKNOWN";
  const recipientGroup = screening.recipient.aPass?.group || "UNKNOWN";
  const crossGroup = senderGroup !== recipientGroup;

  const senderCountry = evaluatePartyCountry(
    screening.sender.aPass?.countries,
    countryRule,
  );
  const recipientCountry = evaluatePartyCountry(
    screening.recipient.aPass?.countries,
    countryRule,
  );
  const countryCompliant = senderCountry.ok && recipientCountry.ok;
  const countryDenyReason = !countryCompliant
    ? !senderCountry.ok
      ? `Sender failed country compliance: ${senderCountry.reason}`
      : `Recipient failed country compliance: ${recipientCountry.reason}`
    : undefined;

  return {
    chain: screening.chain,
    senderTier,
    recipientTier,
    senderGroup,
    recipientGroup,
    senderCountries: normalizeCountries(screening.sender.aPass?.countries),
    recipientCountries: normalizeCountries(screening.recipient.aPass?.countries),
    countryRule: countryRule.mode,
    senderCountryOk: senderCountry.ok,
    recipientCountryOk: recipientCountry.ok,
    countryCompliant,
    ...(countryDenyReason ? { countryDenyReason } : {}),
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
