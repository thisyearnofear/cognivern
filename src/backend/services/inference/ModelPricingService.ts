/**
 * ModelPricingService — turns provider-native token prices into nano-USD.
 *
 * This is the piece that makes the ledger trustworthy. Cognivern's existing
 * `MultiModelRouter` estimates cost as `text.length / 4` tokens multiplied by a
 * hardcoded table, which is fine for a dashboard sparkline and unacceptable for
 * billing a sponsor's money. Here, token counts always come from the provider's
 * own `usage` object and prices always come from the provider's own catalog.
 *
 * Three pricing sources, in precedence order:
 *
 *   catalog  — live prices from the backend's model list. Authoritative.
 *   static   — operator-supplied USD-per-1K overrides (GATEWAY_STATIC_PRICES).
 *              Used when a catalog is unavailable or omits a model.
 *   fallback — a deliberately conservative default so an unpriced model is
 *              billed *something*. Never free: a model that slips through
 *              unpriced would otherwise be an unmetered hole in the budget.
 *
 * Both the nano-USD figure and the raw native cost are recorded on every
 * inference record, so if an FX rate is later found to be wrong the charge can
 * be recomputed from primary data instead of guessed at.
 */

import logger from "@backend/utils/logger.js";
import type { InferenceBackend, ModelCatalogEntry, UpstreamUsage } from "./types.js";
import { NANO_PER_USD } from "@backend/services/credits/money.js";

export type PricingSource = "catalog" | "static" | "fallback";

export interface PricedUsage {
  costNano: number;
  /** Provider-native cost as a decimal string (e.g. neuron), or null. */
  rawCostNative: string | null;
  source: PricingSource;
}

interface StaticPrice {
  promptUsdPer1k: number;
  completionUsdPer1k: number;
}

const CATALOG_TTL_MS = Number(process.env.GATEWAY_CATALOG_TTL_MS || 5 * 60_000);

/**
 * Conservative default, in USD per 1K tokens, for models we cannot price.
 * Set above typical 0G rates on purpose: over-billing a participant slightly is
 * recoverable via `refund`, whereas under-billing silently overspends the
 * sponsor's pool and is not.
 */
const FALLBACK_PROMPT_USD_PER_1K = Number(
  process.env.GATEWAY_FALLBACK_PROMPT_USD_PER_1K || 0.01,
);
const FALLBACK_COMPLETION_USD_PER_1K = Number(
  process.env.GATEWAY_FALLBACK_COMPLETION_USD_PER_1K || 0.03,
);

export class ModelPricingService {
  private catalog = new Map<string, ModelCatalogEntry>();
  private catalogFetchedAt = 0;
  private inFlight: Promise<void> | null = null;
  private staticPrices: Record<string, StaticPrice>;

  constructor(
    private readonly backend: InferenceBackend,
    /**
     * Native-unit → USD rate. For 0G: USD per 1 native token-price unit
     * denominator. See `nativeToNano` for the exact arithmetic.
     */
    private readonly nativeUsdRate: number = Number(process.env.ZEROG_ZG_USD_RATE || 0),
    /** Divisor converting native price units to whole tokens (1e18 neuron/0G). */
    private readonly nativeDecimals: bigint = BigInt(
      process.env.ZEROG_NATIVE_DECIMALS || "1000000000000000000",
    ),
  ) {
    this.staticPrices = parseStaticPrices(process.env.GATEWAY_STATIC_PRICES);
  }

  /** Refresh the catalog if stale. Never throws — falls back to stale/static. */
  async ensureCatalog(force = false): Promise<void> {
    const fresh = Date.now() - this.catalogFetchedAt < CATALOG_TTL_MS;
    if (!force && fresh && this.catalog.size > 0) return;

    // Collapse concurrent refreshes: 50 participants hitting a cold cache
    // simultaneously should produce one upstream call, not 50.
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async () => {
      try {
        const entries = await this.backend.listModels();
        if (entries.length > 0) {
          this.catalog = new Map(entries.map((e) => [e.id, e]));
          this.catalogFetchedAt = Date.now();
        }
      } catch (error) {
        logger.warn(
          `Model catalog refresh failed for backend '${this.backend.id}': ${(error as Error).message}. ` +
            `Falling back to ${this.catalog.size > 0 ? "stale catalog" : "static/fallback pricing"}.`,
        );
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }

  async listModels(): Promise<ModelCatalogEntry[]> {
    await this.ensureCatalog();
    return [...this.catalog.values()];
  }

  async isModelKnown(model: string): Promise<boolean> {
    await this.ensureCatalog();
    return this.catalog.has(model);
  }

  async getEntry(model: string): Promise<ModelCatalogEntry | null> {
    await this.ensureCatalog();
    return this.catalog.get(model) ?? null;
  }

  /**
   * Price real provider-reported usage.
   *
   * Cached tokens are billed at the full input rate for now. 0G documents
   * tiered cached-token pricing as roadmap, not shipped, so discounting them
   * today would under-bill against a rate that does not yet exist.
   */
  async price(model: string, usage: UpstreamUsage): Promise<PricedUsage> {
    await this.ensureCatalog();

    const entry = this.catalog.get(model);
    if (
      entry &&
      entry.promptPriceNative !== null &&
      entry.completionPriceNative !== null &&
      this.canConvertNative()
    ) {
      const native =
        BigInt(usage.inputTokens) * entry.promptPriceNative +
        BigInt(usage.outputTokens) * entry.completionPriceNative;
      return {
        costNano: this.nativeToNano(native),
        rawCostNative: native.toString(),
        source: "catalog",
      };
    }

    const staticPrice = this.staticPrices[model] ?? this.staticPrices["*"];
    if (staticPrice) {
      return {
        costNano: usdPer1kToNano(usage, staticPrice.promptUsdPer1k, staticPrice.completionUsdPer1k),
        rawCostNative: null,
        source: "static",
      };
    }

    // Loud, because an unpriced model in production means the catalog parser or
    // the operator's static table needs attention.
    logger.warn(
      `No catalog or static price for model '${model}' on backend '${this.backend.id}' — ` +
        `billing at conservative fallback rate`,
    );
    return {
      costNano: usdPer1kToNano(
        usage,
        FALLBACK_PROMPT_USD_PER_1K,
        FALLBACK_COMPLETION_USD_PER_1K,
      ),
      rawCostNative: null,
      source: "fallback",
    };
  }

  /**
   * Upper-bound cost for a request, used to size the ledger hold.
   *
   * Input tokens are estimated (we cannot know the provider's tokenisation
   * before calling it) at a deliberately pessimistic ~2.5 chars/token, versus
   * the ~4 chars/token rule of thumb. Output is bounded by the caller's
   * `max_tokens`. A safety factor covers template overhead and tool schemas.
   *
   * Over-estimating only costs a participant temporary headroom; under-
   * estimating lets them overdraw the sponsor, so the bias is intentional.
   */
  async estimateMaxCost(
    model: string,
    promptChars: number,
    maxOutputTokens: number,
  ): Promise<number> {
    const estimatedInput = Math.ceil(promptChars / 2.5) + 64;
    const priced = await this.price(model, {
      inputTokens: estimatedInput,
      outputTokens: Math.max(1, maxOutputTokens),
      cachedTokens: 0,
    });
    const safetyFactor = Number(process.env.GATEWAY_HOLD_SAFETY_FACTOR || 1.25);
    return Math.max(1, Math.ceil(priced.costNano * safetyFactor));
  }

  private canConvertNative(): boolean {
    return Number.isFinite(this.nativeUsdRate) && this.nativeUsdRate > 0;
  }

  /**
   * native units → nano-USD.
   *
   *   tokens_cost_native / nativeDecimals = amount in the chain's native asset
   *   x nativeUsdRate                     = USD
   *   x 1e9                               = nano-USD
   *
   * Done in BigInt up to the final division so a 1e18-scale intermediate never
   * loses precision to float. `nativeUsdRate` is scaled to an integer first
   * (6dp is plenty for a token price) to keep the whole chain exact.
   */
  private nativeToNano(native: bigint): number {
    const rateScaled = BigInt(Math.round(this.nativeUsdRate * 1_000_000));
    const numerator = native * rateScaled * BigInt(NANO_PER_USD);
    const denominator = this.nativeDecimals * 1_000_000n;
    const nano = numerator / denominator;

    // Anything non-zero should cost at least one nano-USD; flooring sub-nano
    // charges to zero across thousands of calls is how a budget leaks.
    if (nano === 0n && native > 0n) return 1;
    return Number(nano);
  }
}

function usdPer1kToNano(
  usage: UpstreamUsage,
  promptUsdPer1k: number,
  completionUsdPer1k: number,
): number {
  const usd =
    ((usage.inputTokens + usage.cachedTokens) / 1000) * promptUsdPer1k +
    (usage.outputTokens / 1000) * completionUsdPer1k;
  const nano = Math.ceil(usd * NANO_PER_USD);
  if (nano === 0 && usage.inputTokens + usage.outputTokens > 0) return 1;
  return Math.max(0, nano);
}

/**
 * Parse `GATEWAY_STATIC_PRICES`.
 *
 * Shape: {"model-id": {"promptUsdPer1k": 0.003, "completionUsdPer1k": 0.009}}
 * The key "*" acts as a default for every model.
 */
function parseStaticPrices(raw: string | undefined): Record<string, StaticPrice> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const out: Record<string, StaticPrice> = {};
    for (const [model, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      const prompt = Number(v.promptUsdPer1k);
      const completion = Number(v.completionUsdPer1k);
      if (Number.isFinite(prompt) && Number.isFinite(completion) && prompt >= 0 && completion >= 0) {
        out[model] = { promptUsdPer1k: prompt, completionUsdPer1k: completion };
      }
    }
    return out;
  } catch (error) {
    logger.warn(`GATEWAY_STATIC_PRICES is not valid JSON — ignoring: ${(error as Error).message}`);
    return {};
  }
}
