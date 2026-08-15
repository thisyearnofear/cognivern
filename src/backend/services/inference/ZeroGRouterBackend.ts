/**
 * ZeroGRouterBackend — 0G Compute Router adapter.
 *
 * The Router is a single OpenAI-compatible endpoint over a decentralised GPU
 * marketplace. Every provider behind it runs inside a TEE and attests the model
 * it serves, and the Router itself keeps zero data retention on prompts and
 * completions — it persists billing metadata only.
 *
 * That last property is precisely why this gateway exists. 0G can tell a
 * sponsor how much was spent; it structurally cannot tell them what it was
 * spent on, and 0G's own docs point callers at logging content themselves. So
 * the *money* is 0G's to meter and the *evidence* is ours.
 *
 * One shared upstream account funds the whole cohort: the organiser deposits
 * once to the 0G Payment Layer and we mint per-participant `cvk_` keys against
 * it. The Router does not document per-key spend caps or per-key rate limits
 * (its rate limits are per-account), which is the specific gap the credit
 * ledger closes — without it, one participant's runaway loop drains the pool
 * and everyone else gets 402.
 *
 * Config:
 *   ZEROG_ROUTER_BASE_URL         default https://router-api.0g.ai/v1
 *   ZEROG_ROUTER_API_KEY           the sponsor's sk- key (server-side only)
 *   ZEROG_ROUTER_MANAGEMENT_KEY    the sponsor's mk- key with account:read
 *                                  scope (server-side only) — required for
 *                                  GET /v1/account/balance; sk- keys 403 there
 *   ZEROG_ZG_USD_RATE              USD per 1 0G, for native → USD conversion
 *   ZEROG_NATIVE_DECIMALS          1e18 neuron = 1 0G
 */

import logger from "@backend/utils/logger.js";
import {
  extractResponseText,
  extractUsage,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ChatCompletionStream,
  type InferenceBackend,
  type ModelCatalogEntry,
  type UpstreamBalanceResult,
  type UpstreamUsage,
} from "./types.js";

const DEFAULT_BASE_URL = "https://router-api.0g.ai/v1";
const TRUST_MODE_HEADER = "X-0G-Provider-Trust-Mode";

export class ZeroGRouterBackend implements InferenceBackend {
  readonly id = "zerog-router";

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly managementKey: string;
  private readonly defaultTimeoutMs: number;
  private readonly zgUsdRate: number;
  private readonly nativeDecimals: bigint;

  constructor(
    options: {
      baseUrl?: string;
      apiKey?: string;
      managementKey?: string;
      timeoutMs?: number;
      zgUsdRate?: number;
      nativeDecimals?: bigint;
    } = {},
  ) {
    this.baseUrl = (options.baseUrl || process.env.ZEROG_ROUTER_BASE_URL || DEFAULT_BASE_URL)
      .replace(/\/+$/, "");
    this.apiKey = options.apiKey || process.env.ZEROG_ROUTER_API_KEY || "";
    this.managementKey = options.managementKey || process.env.ZEROG_ROUTER_MANAGEMENT_KEY || "";
    this.defaultTimeoutMs = options.timeoutMs ?? Number(process.env.GATEWAY_UPSTREAM_TIMEOUT_MS || 120_000);

    const rate = Number(process.env.ZEROG_ZG_USD_RATE);
    this.zgUsdRate = options.zgUsdRate ?? (Number.isFinite(rate) && rate > 0 ? rate : 0);
    this.nativeDecimals =
      options.nativeDecimals ?? BigInt(process.env.ZEROG_NATIVE_DECIMALS || "1000000000000000000");
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  /**
   * Read the sponsor's real spendable balance on the Router (Layer 1 money).
   *
   * Requires a management key (`mk-`) with the `account:read` scope — 0G
   * deliberately 403s `sk-` keys on /v1/account/*. The balance arrives in
   * neuron (a decimal string); we convert to USD using ZEROG_ZG_USD_RATE when
   * one is configured, and report the native number regardless.
   *
   * Failures return a structured result rather than throwing, so the funding
   * view can distinguish "no key configured" (fixable config) from "endpoint
   * down" (transient) from "could not parse" (0G changed the shape).
   */
  async fetchUpstreamBalance(): Promise<UpstreamBalanceResult> {
    if (!this.managementKey) {
      return {
        ok: false,
        code: "not_configured",
        message:
          "Set ZEROG_ROUTER_MANAGEMENT_KEY to an mk- key with the account:read scope " +
          "(pc.0g.ai → Settings → Management Keys, Read-only preset). sk- keys are " +
          "403 on /v1/account/* by design.",
      };
    }

    let response: Response;
    try {
      response = await this.fetchWithTimeout(
        `${this.baseUrl}/account/balance`,
        { method: "GET", headers: this.balanceHeaders() },
        Number(process.env.GATEWAY_CATALOG_TIMEOUT_MS || 15_000),
      );
    } catch (error) {
      return {
        ok: false,
        code: "network_error",
        message: `Could not reach the 0G Router balance endpoint: ${(error as Error).message}`,
      };
    }

    if (!response.ok) {
      const hint =
        response.status === 403
          ? "The management key is missing the account:read scope, or an sk- key was used."
          : "";
      return {
        ok: false,
        code: "http_error",
        message: `0G Router /account/balance returned ${response.status}. ${hint}`.trim(),
      };
    }

    const body = await safeJson(response);
    const balance = parseAccountBalance(body);
    if (!balance) {
      return {
        ok: false,
        code: "parse_error",
        message: "0G Router /account/balance returned an unrecognisable shape.",
      };
    }

    const balanceUsd = this.toUsd(balance.totalBalanceNeuron);
    return {
      ok: true,
      balance: {
        balanceNative: balance.totalBalanceNeuron.toString(),
        nativeUnit: "neuron",
        balanceUsd,
        currency: "0G",
        fetchedAt: new Date().toISOString(),
        raw: body,
      },
    };
  }

  private toUsd(neuron: bigint): number | null {
    if (!(this.zgUsdRate > 0) || this.nativeDecimals <= 0n) return null;
    const zg = Number(neuron) / Number(this.nativeDecimals);
    return zg * this.zgUsdRate;
  }

  /**
   * Fetch the live model catalog.
   *
   * 0G documents `GET /v1/models` as unauthenticated, with per-model pricing
   * "quoted in neuron per token". The exact JSON field names for those prices
   * are not pinned down in the docs, so `parseCatalogEntry` accepts several
   * plausible spellings and reports models it could not price rather than
   * silently treating them as free. If 0G renames a field, pricing degrades to
   * the static/fallback table and logs — it does not go to zero.
   */
  async listModels(): Promise<ModelCatalogEntry[]> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/models`,
      { method: "GET", headers: this.headers({ json: false }) },
      Number(process.env.GATEWAY_CATALOG_TIMEOUT_MS || 15_000),
    );

    if (!response.ok) {
      throw new Error(`0G Router /models returned ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as Record<string, unknown>)?.data)
        ? ((payload as Record<string, unknown>).data as unknown[])
        : [];

    const entries: ModelCatalogEntry[] = [];
    const unpriced: string[] = [];

    for (const raw of list) {
      const entry = parseCatalogEntry(raw);
      if (!entry) continue;
      if (entry.promptPriceNative === null || entry.completionPriceNative === null) {
        unpriced.push(entry.id);
      }
      entries.push(entry);
    }

    if (unpriced.length > 0) {
      logger.warn(
        `0G Router catalog: ${unpriced.length} model(s) returned without parseable prices ` +
          `(${unpriced.slice(0, 5).join(", ")}${unpriced.length > 5 ? ", …" : ""}). ` +
          `These will bill at static/fallback rates.`,
      );
    }

    return entries;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: this.headers({ json: true, trustMode: request.trustMode }),
        body: JSON.stringify({ ...request.body, stream: false }),
      },
      request.timeoutMs ?? this.defaultTimeoutMs,
    );

    const body = await safeJson(response);

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        usage: null,
        provider: null,
        trustTier: response.headers.get("x-0g-provider-trust-mode"),
        upstreamRequestId: response.headers.get("x-request-id"),
        responseText: "",
      };
    }

    return {
      ok: true,
      status: response.status,
      body,
      usage: extractUsage(body),
      provider: extractProvider(body, response),
      trustTier: extractTrustTier(body, response),
      upstreamRequestId: extractRequestId(body, response),
      responseText: extractResponseText(body),
    };
  }

  /**
   * Streaming completion.
   *
   * `stream_options.include_usage` is forced on: without it the provider never
   * emits a usage payload and we would have to fall back to estimating tokens,
   * which defeats the entire point of real metering. It is set rather than
   * merged over the caller's value deliberately — a client cannot opt out of
   * being metered.
   */
  async chatCompletionStream(request: ChatCompletionRequest): Promise<ChatCompletionStream> {
    const existingOptions =
      request.body.stream_options && typeof request.body.stream_options === "object"
        ? (request.body.stream_options as Record<string, unknown>)
        : {};

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: this.headers({ json: true, trustMode: request.trustMode }),
        body: JSON.stringify({
          ...request.body,
          stream: true,
          stream_options: { ...existingOptions, include_usage: true },
        }),
      },
      request.timeoutMs ?? this.defaultTimeoutMs,
    );

    const collected: ChatCompletionStream["collected"] = {
      usage: null,
      provider: null,
      trustTier: response.headers.get("x-0g-provider-trust-mode"),
      upstreamRequestId: response.headers.get("x-request-id"),
      responseText: "",
      usageMissing: true,
    };

    if (!response.ok || !response.body) {
      return {
        ok: false,
        status: response.status,
        errorBody: await safeJson(response),
        chunks: emptyAsyncIterable(),
        collected,
      };
    }

    return {
      ok: true,
      status: response.status,
      chunks: tapSseStream(response.body, collected),
      collected,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private headers(options: { json: boolean; trustMode?: string | null }): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (options.json) headers["Content-Type"] = "application/json";
    if (options.trustMode) headers[TRUST_MODE_HEADER] = options.trustMode;
    return headers;
  }

  /** Balance calls use the mk- credential, never the billing sk- key. */
  private balanceHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.managementKey}` };
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      // Cleared on both paths: a lingering timer holds the event loop open and
      // would abort a later reuse of the controller.
      clearTimeout(timer);
    }
  }
}

/**
 * Relay an SSE stream verbatim while extracting usage and assistant text.
 *
 * The bytes yielded are exactly the bytes received — clients get the provider's
 * own framing, including any fields we don't understand. We only observe.
 *
 * Buffering is line-oriented because an SSE event can be split across TCP
 * reads; parsing per-chunk would drop events that straddle a boundary.
 */
async function* tapSseStream(
  body: ReadableStream<Uint8Array>,
  collected: ChatCompletionStream["collected"],
): AsyncGenerator<Uint8Array> {
  const decoder = new TextDecoder();
  const textParts: string[] = [];
  let buffer = "";

  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      yield value;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        observeSseLine(line, collected, textParts);
      }
    }

    // Trailing line with no terminating newline.
    if (buffer.trim().length > 0) observeSseLine(buffer.trim(), collected, textParts);
  } finally {
    collected.responseText = textParts.join("");
    reader.releaseLock();
  }
}

function observeSseLine(
  line: string,
  collected: ChatCompletionStream["collected"],
  textParts: string[],
): void {
  if (!line.startsWith("data:")) return;

  const payload = line.slice(5).trim();
  if (payload.length === 0 || payload === "[DONE]") return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    // A provider may emit keep-alives or comments; ignore unparseable frames
    // rather than failing the relay.
    return;
  }

  const usage = extractUsage(parsed);
  if (usage) {
    collected.usage = usage;
    collected.usageMissing = false;
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (collected.provider === null) collected.provider = readProviderField(obj);
    if (collected.upstreamRequestId === null && typeof obj.id === "string") {
      collected.upstreamRequestId = obj.id;
    }

    const choices = obj.choices;
    if (Array.isArray(choices)) {
      for (const choice of choices) {
        if (!choice || typeof choice !== "object") continue;
        const delta = (choice as Record<string, unknown>).delta;
        if (delta && typeof delta === "object") {
          const content = (delta as Record<string, unknown>).content;
          if (typeof content === "string") textParts.push(content);
        }
      }
    }
  }
}

/**
 * Parse one catalog entry.
 *
 * Tolerant by necessity — see `listModels`. Prices are read as BigInt because
 * neuron values are 1e18-scaled and would lose precision as JS numbers.
 */
function parseCatalogEntry(raw: unknown): ModelCatalogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id : typeof r.name === "string" ? r.name : null;
  if (!id) return null;

  // Prices may be flat or nested under `pricing`.
  const pricing =
    r.pricing && typeof r.pricing === "object" ? (r.pricing as Record<string, unknown>) : {};

  const promptPriceNative = readBigIntField(
    r.prompt_price,
    r.input_price,
    r.promptPrice,
    pricing.prompt,
    pricing.input,
    pricing.prompt_price,
  );
  const completionPriceNative = readBigIntField(
    r.completion_price,
    r.output_price,
    r.completionPrice,
    pricing.completion,
    pricing.output,
    pricing.completion_price,
  );

  const contextWindow = readNumberField(r.context_window, r.context_length, r.contextWindow);

  return {
    id,
    promptPriceNative,
    completionPriceNative,
    contextWindow,
    verifiability: typeof r.verifiability === "string" ? r.verifiability : null,
    raw,
  };
}

interface ParsedAccountBalance {
  totalBalanceNeuron: bigint;
}

/**
 * Parse GET /v1/account/balance.
 *
 * Documented shape (neuron, decimal strings):
 *   { "address": "0x…", "deposit_balance": "2000000000000000000",
 *     "total_balance": "2000000000000000000" }
 * `total_balance` is what is available to spend right now; `deposit_balance`
 * may lag it because the Router pulls from the Payment Layer in batches.
 */
function parseAccountBalance(body: unknown): ParsedAccountBalance | null {
  if (!body || typeof body !== "object") return null;
  const r = body as Record<string, unknown>;

  const total = readBigIntField(r.total_balance, r.balance, r.available_balance);
  if (total === null) return null;
  return { totalBalanceNeuron: total };
}

function readBigIntField(...candidates: unknown[]): bigint | null {
  for (const candidate of candidates) {
    if (typeof candidate === "bigint") return candidate;
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return BigInt(Math.floor(candidate));
    }
    // Prices arrive as decimal strings when they exceed Number range.
    if (typeof candidate === "string" && /^\d+$/.test(candidate.trim())) {
      return BigInt(candidate.trim());
    }
  }
  return null;
}

function readNumberField(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function readProviderField(obj: Record<string, unknown>): string | null {
  for (const key of ["provider", "provider_address", "served_by"]) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function extractProvider(body: unknown, response: Response): string | null {
  if (body && typeof body === "object") {
    const fromBody = readProviderField(body as Record<string, unknown>);
    if (fromBody) return fromBody;
  }
  return response.headers.get("x-0g-provider") ?? response.headers.get("x-0g-provider-address");
}

function extractTrustTier(body: unknown, response: Response): string | null {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>).trust_mode;
    if (typeof value === "string") return value;
  }
  return response.headers.get("x-0g-provider-trust-mode");
}

function extractRequestId(body: unknown, response: Response): string | null {
  if (body && typeof body === "object") {
    const value = (body as Record<string, unknown>).id;
    if (typeof value === "string") return value;
  }
  return response.headers.get("x-request-id");
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

async function* emptyAsyncIterable(): AsyncGenerator<Uint8Array> {
  // Intentionally yields nothing.
}

let shared: ZeroGRouterBackend | null = null;
export function sharedZeroGRouterBackend(): ZeroGRouterBackend {
  if (!shared) shared = new ZeroGRouterBackend();
  return shared;
}
