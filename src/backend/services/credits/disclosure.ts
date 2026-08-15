/**
 * Disclosure tiers: the participant chooses how much a sponsor gets to see,
 * and a more open choice unlocks a larger credit allocation.
 *
 * The point is that policing intent is not solvable, but *incentivising*
 * disclosure is. A participant who wants the bigger budget opts into a richer
 * record; one who wants privacy keeps it and accepts the base allocation.
 * Nobody is compelled and nobody is surprised.
 *
 * Two properties make this honest rather than theatre:
 *
 *  1. Storage is tier-gated at WRITE time (see `fieldsPersistedAt`). A
 *     participant on `private` has no task classification and no prompt
 *     excerpt on disk at all — there is no hidden richer copy that a policy
 *     change or a subpoena could later expose.
 *  2. The sponsor projection is derived from the same stored row the
 *     participant can read, so "what the judges see" is computable by the
 *     participant, not asserted by us.
 */

export const DISCLOSURE_TIERS = ["private", "standard", "detailed", "open"] as const;

export type DisclosureTier = (typeof DISCLOSURE_TIERS)[number];

/** Tier ordering, used for `>=` style comparisons. */
const TIER_RANK: Record<DisclosureTier, number> = {
  private: 0,
  standard: 1,
  detailed: 2,
  open: 3,
};

/**
 * Budget multiplier applied to a participant's base allocation.
 *
 * Defaults are deliberately gentle at the low end (privacy is not punished
 * into uselessness) and meaningful at the top (open disclosure doubles the
 * budget). A program can override these — see
 * `credit_programs.disclosure_multipliers`.
 */
export const DEFAULT_DISCLOSURE_MULTIPLIERS: Record<DisclosureTier, number> = {
  private: 1.0,
  standard: 1.25,
  detailed: 1.5,
  open: 2.0,
};

/**
 * "Ceiling" multipliers: the `open` tier gets the full per-participant amount
 * and lower tiers get proportionally less.
 *
 * This exists because the default multipliers and a fixed pool are in tension.
 * With the defaults, "50 participants at $20" is really "50 participants at
 * $20–$40", and a sponsor must fund $2,000 to promise $20 each — otherwise the
 * pool is over-subscribed the moment enough people opt into `open`.
 *
 * These multipliers resolve that by treating the configured base as a ceiling:
 * 50 x $20 needs exactly $1,000, the pool can never be over-committed, and it
 * is still true that raising your tier raises your budget. The tradeoff is
 * framing — privacy now visibly costs budget rather than openness earning a
 * bonus. Same arithmetic, different feeling, and the sponsor should pick
 * deliberately rather than inherit one by accident.
 */
export const CEILING_DISCLOSURE_MULTIPLIERS: Record<DisclosureTier, number> = {
  private: 0.5,
  standard: 0.625,
  detailed: 0.75,
  open: 1.0,
};

export interface DisclosureTierInfo {
  tier: DisclosureTier;
  multiplier: number;
  /** One-line description written for the participant, not the sponsor. */
  summary: string;
  /** Exactly what a sponsor/judge can see at this tier. */
  sponsorSees: string[];
  /** Exactly what is never recorded at this tier. */
  neverRecorded: string[];
}

export function isDisclosureTier(value: unknown): value is DisclosureTier {
  return typeof value === "string" && (DISCLOSURE_TIERS as readonly string[]).includes(value);
}

export function tierAtLeast(tier: DisclosureTier, minimum: DisclosureTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minimum];
}

/**
 * Which optional columns of `inference_records` may be written at a tier.
 * The gateway consults this before building its insert — it is the single
 * source of truth for the tier-gated-storage guarantee.
 */
export function fieldsPersistedAt(tier: DisclosureTier): {
  taskClass: boolean;
  projectTag: boolean;
  promptDigest: boolean;
  responseDigest: boolean;
  excerpts: boolean;
} {
  return {
    // Digests are content-derived but not content-revealing, and they let a
    // participant later prove "this is the call I made" without disclosing it.
    // Withheld at `private` anyway, because a digest plus a guessable prompt
    // is a confirmation oracle.
    promptDigest: tierAtLeast(tier, "standard"),
    responseDigest: tierAtLeast(tier, "standard"),
    taskClass: tierAtLeast(tier, "detailed"),
    projectTag: tierAtLeast(tier, "detailed"),
    excerpts: tierAtLeast(tier, "open"),
  };
}

export function describeTiers(
  multipliers: Partial<Record<DisclosureTier, number>> = {},
): DisclosureTierInfo[] {
  const resolved = resolveMultipliers(multipliers);

  return [
    {
      tier: "private",
      multiplier: resolved.private,
      summary:
        "Only your totals are shared. The sponsor sees how much you spent and how many requests you made — nothing about what you asked.",
      sponsorSees: ["Total credits spent", "Total request count", "First and last activity date"],
      neverRecorded: [
        "Which models you used",
        "Per-request detail",
        "Prompt or response digests",
        "Any prompt or response content",
      ],
    },
    {
      tier: "standard",
      multiplier: resolved.standard,
      summary:
        "Per-request billing metadata is shared — the same level a normal API provider's usage dashboard shows. No content.",
      sponsorSees: [
        "Per-request model, provider, token counts, cost, timestamp, latency",
        "Content digests (proof a call happened, not what it said)",
      ],
      neverRecorded: ["Task classification", "Project attribution", "Any prompt or response content"],
    },
    {
      tier: "detailed",
      multiplier: resolved.detailed,
      summary:
        "Adds a coarse task label and your project tag, so the sponsor can see the shape of your work without reading it.",
      sponsorSees: [
        "Everything in Standard",
        "Coarse task class (e.g. code, debug, docs, research)",
        "Your declared project tag",
      ],
      neverRecorded: ["Any prompt or response content"],
    },
    {
      tier: "open",
      multiplier: resolved.open,
      summary:
        "Adds short, credential-scrubbed excerpts of your prompts and responses. Highest budget, fullest disclosure.",
      sponsorSees: [
        "Everything in Detailed",
        "Truncated prompt and response excerpts with secrets stripped",
      ],
      neverRecorded: [
        "API keys, tokens, private keys or passwords (removed before storage at every tier)",
        "Full untruncated conversations",
      ],
    },
  ];
}

export type MultipliersMode = "bonus" | "ceiling" | "custom";

/**
 * Which multiplier philosophy a program is running on, derived from the
 * stored overrides rather than stored alongside them.
 *
 * Derivation keeps the label honest: the mode is the multipliers, so it can
 * never drift from them. Anything that is not exactly one of the two presets
 * (including a partial override) is "custom".
 */
export function multipliersModeOf(
  stored: Partial<Record<DisclosureTier, number>> | null | undefined,
): MultipliersMode {
  const resolved = resolveMultipliers(stored);
  if (multipliersEqual(resolved, DEFAULT_DISCLOSURE_MULTIPLIERS)) return "bonus";
  if (multipliersEqual(resolved, CEILING_DISCLOSURE_MULTIPLIERS)) return "ceiling";
  return "custom";
}

function multipliersEqual(
  a: Record<DisclosureTier, number>,
  b: Record<DisclosureTier, number>,
): boolean {
  return DISCLOSURE_TIERS.every((tier) => a[tier] === b[tier]);
}

export function resolveMultipliers(
  overrides: Partial<Record<DisclosureTier, number>> | null | undefined,
): Record<DisclosureTier, number> {
  const resolved = { ...DEFAULT_DISCLOSURE_MULTIPLIERS };
  if (!overrides) return resolved;

  for (const tier of DISCLOSURE_TIERS) {
    const value = overrides[tier];
    // Reject non-finite, negative, and absurd multipliers rather than letting
    // a bad config silently mint credits.
    if (typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 10) {
      resolved[tier] = value;
    }
  }
  return resolved;
}

export function multiplierFor(
  tier: DisclosureTier,
  overrides?: Partial<Record<DisclosureTier, number>> | null,
): number {
  return resolveMultipliers(overrides)[tier];
}

/**
 * Effective allocation for a base amount at a tier, in nano-USD.
 *
 * Floors to an integer so the ledger never holds a fractional nano-USD.
 */
export function allocationForTier(
  baseAllocationNano: number,
  tier: DisclosureTier,
  overrides?: Partial<Record<DisclosureTier, number>> | null,
): number {
  return Math.floor(baseAllocationNano * multiplierFor(tier, overrides));
}
