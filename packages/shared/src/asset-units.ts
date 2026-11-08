/**
 * Asset unit registry — canonical decimals/kind metadata for spend assets.
 *
 * Mandate budgets, spend intents, and attribution records carry amounts as
 * integer *base-unit* strings. To compare population authority (agent "$/day"
 * budgets) against a mandate's authorized treasury, callers must convert
 * base units → human units. This registry is the single place that knows
 * which assets are fiat-comparable and at what precision.
 *
 * Deployment-configured assets (e.g. the Cleanverse aToken, whose decimals
 * come from `CLEANVERSE_ATOKEN_DECIMALS`) should be passed as overrides via
 * `resolveAssetUnit(asset, overrides)` — the registry holds defaults only.
 */

export type AssetKind =
  /** Fiat-denominated or USD-pegged — comparable to agent "$" budgets. */
  | "fiat"
  /** On-chain native/gas token — has decimals but is NOT USD-comparable. */
  | "native"
  /** Unknown asset — amounts cannot be safely interpreted. */
  | "unknown";

export interface AssetUnit {
  kind: AssetKind;
  /** Base-unit decimals (10^decimals per whole unit). */
  decimals: number;
  /** True when the whole unit tracks ~USD, enabling authority comparisons. */
  usdPegged: boolean;
}

const REGISTRY: Record<string, AssetUnit> = {
  // Fiat / USD-pegged stables — whole units are dollars.
  USD: { kind: "fiat", decimals: 0, usdPegged: true },
  USDC: { kind: "fiat", decimals: 6, usdPegged: true },
  USDT: { kind: "fiat", decimals: 6, usdPegged: true },
  DAI: { kind: "fiat", decimals: 18, usdPegged: true },
  aUSDC: { kind: "fiat", decimals: 6, usdPegged: true },
  AUSDC: { kind: "fiat", decimals: 6, usdPegged: true },
  // Native / gas tokens — decimal-aware but not USD-comparable.
  ETH: { kind: "native", decimals: 18, usdPegged: false },
  OKB: { kind: "native", decimals: 18, usdPegged: false },
  FIL: { kind: "native", decimals: 18, usdPegged: false },
  TFIL: { kind: "native", decimals: 18, usdPegged: false },
};

export interface AssetUnitOverride {
  decimals?: number;
  kind?: AssetKind;
  usdPegged?: boolean;
}

/**
 * Resolve the unit metadata for an asset symbol. Case-insensitive for
 * registry lookup; `overrides` (e.g. from deployment config) take
 * precedence over registry defaults field-by-field.
 */
export function resolveAssetUnit(
  asset: string,
  overrides?: AssetUnitOverride,
): AssetUnit {
  const key = asset.trim();
  const base =
    REGISTRY[key] ??
    REGISTRY[key.toUpperCase()] ??
    REGISTRY[key.toLowerCase()] ?? { kind: "unknown" as const, decimals: 0, usdPegged: false };
  return {
    kind: overrides?.kind ?? base.kind,
    decimals: overrides?.decimals ?? base.decimals,
    usdPegged: overrides?.usdPegged ?? base.usdPegged,
  };
}

/** Convert an integer base-unit string to human units. Null on bad input. */
export function baseUnitsToHuman(baseUnits: string, decimals: number): number | null {
  if (!/^\d+$/.test(baseUnits)) return null;
  const value = Number(BigInt(baseUnits));
  if (!Number.isFinite(value)) return null;
  return value / 10 ** decimals;
}

/** Convert a human-unit amount to an integer base-unit string. */
export function humanToBaseUnits(human: number, decimals: number): string | null {
  if (!Number.isFinite(human) || human < 0) return null;
  const scaled = human * 10 ** decimals;
  if (!Number.isSafeInteger(Math.round(scaled))) return null;
  return BigInt(Math.round(scaled)).toString();
}
