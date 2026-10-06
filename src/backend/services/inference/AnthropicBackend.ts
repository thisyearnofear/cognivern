/**
 * AnthropicBackend — bring-your-own Anthropic compute behind the gateway.
 *
 * Participants keep speaking OpenAI chat-completions to `/v1`; this adapter
 * translates to the Anthropic Messages API using the *program's* stored key
 * (see services/credits/UpstreamCredentialService.ts), then normalises
 * usage/pricing/metadata back into the backend-agnostic contract. Ledger,
 * disclosure, receipts, and the report never learn which provider served.
 *
 * Deliberate limits (Phase 1):
 * - Non-streaming only. Anthropic SSE dialects differ from OpenAI's and the
 *   gateway relays stream bytes verbatim — translating streams is Phase 3.
 *   Streaming requests fail closed as an upstream error (participant unbilled).
 * - No credential of its own: the key arrives per request as
 *   `upstreamApiKey` from the gateway's credential lookup. Missing key is an
 *   upstream error, never a throw — the money path treats it as unbilled.
 * - No funding reconciliation: Anthropic spend visibility needs a separate
 *   admin key. Layer 1 stays organiser-reported for this backend.
 * - Pricing resolves through GATEWAY_STATIC_PRICES (Anthropic publishes USD
 *   per MTok). Set entries per model id or the `*` wildcard.
 */

import logger from "@backend/utils/logger.js";
import type {
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatCompletionStream,
  InferenceBackend,
  ModelCatalogEntry,
  UpstreamUsage,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 1024;

/**
 * Model ids this adapter accepts. Refresh as Anthropic ships — pricing does
 * not come from here (see GATEWAY_STATIC_PRICES), so a stale list fails
 * closed on unknown ids rather than mispricing them.
 */
const KNOWN_MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-5",
  "claude-opus-5-5",
  "claude-sonnet-5",
  "claude-sonnet-5-5",
];

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

function blockText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (
      typeof block === "object" &&
      block !== null &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      parts.push((block as { text: string }).text);
    } else {
      return null;
    }
  }
  return parts.join("");
}

/**
 * Split OpenAI-style messages into an Anthropic system prompt + turns.
 * Returns null when the body contains roles Anthropic cannot serve
 * (tool/developer turns) — the caller fails closed as an upstream error.
 */
function translateMessages(
  messages: unknown,
): { system: string | null; turns: AnthropicMessage[] } | null {
  if (!Array.isArray(messages)) return null;
  const systems: string[] = [];
  const turns: AnthropicMessage[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) return null;
    const { role, content } = message as { role?: unknown; content?: unknown };
    const text = blockText(content);
    if (text === null) return null;
    if (role === "system") {
      systems.push(text);
    } else if (role === "user" || role === "assistant") {
      turns.push({ role, content: text });
    } else {
      return null;
    }
  }
  if (turns.length === 0) return null;
  return { system: systems.length > 0 ? systems.join("\n\n") : null, turns };
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

export class AnthropicBackend implements InferenceBackend {
  readonly id = "anthropic";

  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(
    options: { baseUrl?: string; timeoutMs?: number } = {},
  ) {
    this.baseUrl = (options.baseUrl || process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.defaultTimeoutMs =
      options.timeoutMs ?? Number(process.env.GATEWAY_UPSTREAM_TIMEOUT_MS || 120_000);
  }

  /**
   * Capability check only: the adapter code is ready. Whether a *program*
   * can serve is decided by the gateway's per-program credential lookup —
   * a missing key denies with backend_not_configured, naming the fix.
   */
  isConfigured(): boolean {
    return true;
  }

  async listModels(): Promise<ModelCatalogEntry[]> {
    return KNOWN_MODELS.map((id) => ({
      id,
      promptPriceNative: null,
      completionPriceNative: null,
      contextWindow: null,
      verifiability: null,
      raw: { provider: "anthropic" },
    }));
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    const apiKey = request.upstreamApiKey || "";
    if (!apiKey) {
      return {
        ok: false,
        status: 503,
        body: {
          error: "No upstream credential for this program — add an Anthropic API key in the sponsor console.",
        },
        usage: null,
        provider: "anthropic",
        trustTier: null,
        upstreamRequestId: null,
        responseText: "",
      };
    }

    const body = request.body ?? {};
    const model = typeof body.model === "string" ? body.model : "";
    const translated = translateMessages(body.messages);
    const maxTokens =
      readPositiveInt(body.max_tokens ?? body.max_completion_tokens) ?? DEFAULT_MAX_TOKENS;
    if (!model || !translated) {
      return {
        ok: false,
        status: 400,
        body: {
          error:
            "Anthropic serves user/assistant turns (plus an optional system prompt) only — " +
            "tool/developer turns and non-text blocks are rejected before any spend.",
        },
        usage: null,
        provider: "anthropic",
        trustTier: null,
        upstreamRequestId: null,
        responseText: "",
      };
    }

    const payload: Record<string, unknown> = {
      model,
      max_tokens: maxTokens,
      messages: translated.turns,
    };
    if (translated.system) payload.system = translated.system;
    if (typeof body.temperature === "number") payload.temperature = body.temperature;
    if (typeof body.top_p === "number") payload.top_p = body.top_p;
    if (Array.isArray(body.stop)) payload.stop_sequences = body.stop;

    const timeoutMs = request.timeoutMs ?? this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (!response.ok || !data || data.type === "error") {
        const message =
          (data?.error as { message?: unknown } | undefined)?.message ??
          `Anthropic HTTP ${response.status}`;
        return {
          ok: false,
          status: response.status,
          body: { error: String(message) },
          usage: null,
          provider: "anthropic",
          trustTier: null,
          upstreamRequestId: null,
          responseText: "",
        };
      }
      const text = blockText(data.content) ?? "";
      const usage = (data.usage ?? {}) as Record<string, unknown>;
      const normalized: UpstreamUsage = {
        inputTokens: Number(usage.input_tokens ?? 0),
        outputTokens: Number(usage.output_tokens ?? 0),
        cachedTokens: Number(usage.cache_read_input_tokens ?? 0),
      };
      return {
        ok: true,
        status: 200,
        body: data,
        usage: normalized,
        provider: "anthropic",
        trustTier: null,
        upstreamRequestId: typeof data.id === "string" ? data.id : null,
        responseText: text,
      };
    } catch (error) {
      logger.warn(`Anthropic backend request failed: ${(error as Error).message}`);
      return {
        ok: false,
        status: 502,
        body: { error: "Anthropic request failed before any spend was recorded." },
        usage: null,
        provider: "anthropic",
        trustTier: null,
        upstreamRequestId: null,
        responseText: "",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async chatCompletionStream(_request: ChatCompletionRequest): Promise<ChatCompletionStream> {
    // Phase 3: Anthropic SSE dialects differ and the gateway relays bytes
    // verbatim. Fail closed — the hold is released and nothing is billed.
    return {
      ok: false,
      status: 501,
      errorBody: {
        error: "Streaming is not served on the Anthropic backend yet — retry without stream.",
      },
      chunks: (async function* () {})(),
      collected: {
        usage: null,
        provider: "anthropic",
        trustTier: null,
        upstreamRequestId: null,
        responseText: "",
        usageMissing: true,
      },
    };
  }
}

let shared: AnthropicBackend | null = null;
export function sharedAnthropicBackend(): AnthropicBackend {
  if (!shared) shared = new AnthropicBackend();
  return shared;
}
