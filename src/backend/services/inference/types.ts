/**
 * Backend-agnostic contract for metered inference.
 *
 * The gateway deliberately does not know it is talking to 0G. The credit
 * ledger, disclosure tiers, and audit trail are the product; the compute
 * provider is a swappable detail. That matters commercially — a sponsor whose
 * participants need a model 0G does not serve should be a config change, not a
 * rewrite — and architecturally, because coupling the ledger to one provider's
 * response shape is how you end up unable to price a second one.
 */

/** Normalised token usage. Always sourced from the provider, never estimated. */
export interface UpstreamUsage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
}

export interface ModelCatalogEntry {
  id: string;
  /** Native price units per input token (e.g. neuron/token for 0G). */
  promptPriceNative: bigint | null;
  completionPriceNative: bigint | null;
  contextWindow: number | null;
  /** Provider's verifiability claim, e.g. "TeeML" / "TeeTLS". */
  verifiability: string | null;
  /** Untouched upstream entry, relayed to clients by GET /v1/models. */
  raw: unknown;
}

export interface ChatCompletionRequest {
  /** Full OpenAI-shaped request body, relayed with minimal modification. */
  body: Record<string, unknown>;
  /** Provider trust tier, e.g. 0G's "private" | "verified" | "standard". */
  trustMode?: string | null;
  timeoutMs?: number;
  /** Opaque correlation id echoed into upstream headers where supported. */
  correlationId?: string;
}

export interface ChatCompletionResult {
  ok: boolean;
  status: number;
  /** Parsed response body on success, or the upstream error body on failure. */
  body: unknown;
  usage: UpstreamUsage | null;
  provider: string | null;
  trustTier: string | null;
  upstreamRequestId: string | null;
  /** Assistant text, used for digesting and (at `open` tier) excerpting. */
  responseText: string;
}

/**
 * Streaming variant.
 *
 * `chunks` yields raw SSE bytes for verbatim relay to the client — we do not
 * re-serialise the stream, so clients see exactly what the provider sent.
 * `collected` is mutated as the stream drains and is only complete once
 * `chunks` is exhausted; the gateway reads it afterwards to settle the ledger.
 */
export interface ChatCompletionStream {
  ok: boolean;
  status: number;
  /** Present only when `ok` is false. */
  errorBody?: unknown;
  chunks: AsyncIterable<Uint8Array>;
  collected: {
    usage: UpstreamUsage | null;
    provider: string | null;
    trustTier: string | null;
    upstreamRequestId: string | null;
    responseText: string;
    /** Set if the stream ended without a usage payload. */
    usageMissing: boolean;
  };
}

/**
 * The sponsor's real, spendable upstream balance (Layer 1).
 *
 * This is the number that must be reconciled against the ledger's `poolNano`
 * (Layer 2): the pool is our bookkeeping, the deposit is someone else's money,
 * and nothing enforces that they agree. Exposing it is what turns a silent
 * mid-event 402 into a warning the sponsor can act on before the event.
 */
export interface UpstreamBalance {
  /** Spendable balance as a decimal string in the provider's native unit. */
  balanceNative: string;
  /** The native unit, e.g. "neuron" for 0G. */
  nativeUnit: string;
  /** USD value of the spendable balance, or null when no rate is configured. */
  balanceUsd: number | null;
  /** Currency the native unit converts to, e.g. "0G". */
  currency: string;
  fetchedAt: string;
  raw: unknown;
}

export type UpstreamBalanceResult =
  | { ok: true; balance: UpstreamBalance }
  | {
      ok: false;
      code: "not_configured" | "http_error" | "parse_error" | "network_error";
      message: string;
    };

export interface InferenceBackend {
  /** Stable identifier persisted on every inference record. */
  readonly id: string;

  /** True when the backend has the credentials/config it needs to serve. */
  isConfigured(): boolean;

  listModels(): Promise<ModelCatalogEntry[]>;

  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult>;

  chatCompletionStream(request: ChatCompletionRequest): Promise<ChatCompletionStream>;

  /**
   * Optional: report the sponsor's actual upstream funding.
   *
   * Absent from providers that cannot expose one (or where the sponsor never
   * gave us a read-only credential). The reconciliation view treats an absent
   * method as "not supported" rather than pretending a balance exists.
   */
  fetchUpstreamBalance?(): Promise<UpstreamBalanceResult>;
}

/** Zeroed usage, for error paths where nothing was billed. */
export const ZERO_USAGE: UpstreamUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedTokens: 0,
};

/**
 * Pull usage out of an OpenAI-compatible payload.
 *
 * Field naming is inconsistent across providers and across OpenAI's own API
 * versions (`prompt_tokens` vs `input_tokens`), so accept both. Returns null
 * rather than zeros when nothing usable is present, because "no usage reported"
 * and "zero tokens used" must not be conflated — one is a metering failure we
 * need to know about, the other is free.
 */
export function extractUsage(payload: unknown): UpstreamUsage | null {
  if (!payload || typeof payload !== "object") return null;
  const usage = (payload as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object") return null;

  const u = usage as Record<string, unknown>;
  const input = firstNumber(u.prompt_tokens, u.input_tokens);
  const output = firstNumber(u.completion_tokens, u.output_tokens);

  if (input === null && output === null) return null;

  // Cached tokens appear nested on OpenAI-style payloads and flat elsewhere.
  const details = u.prompt_tokens_details;
  const nestedCached =
    details && typeof details === "object"
      ? firstNumber((details as Record<string, unknown>).cached_tokens)
      : null;

  return {
    inputTokens: input ?? 0,
    outputTokens: output ?? 0,
    cachedTokens: nestedCached ?? firstNumber(u.cached_tokens) ?? 0,
  };
}

function firstNumber(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return Math.floor(candidate);
    }
  }
  return null;
}

/** Concatenate assistant text from a non-streaming chat completion body. */
export function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as Record<string, unknown>).choices;
  if (!Array.isArray(choices)) return "";

  const parts: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as Record<string, unknown>).message;
    if (message && typeof message === "object") {
      const content = (message as Record<string, unknown>).content;
      if (typeof content === "string") parts.push(content);
    }
  }
  return parts.join("\n");
}
