/**
 * OpenAICompatBackend — metered inference through any provider that speaks
 * the OpenAI chat-completions dialect (OpenAI, Groq, Cerebras, Venice, …).
 *
 * Configuration is deliberately minimal: a base URL and an optional platform
 * key from env, with a per-program upstream credential (the existing
 * `program_upstream_credentials` store) able to override the key per
 * sponsor — same BYO-compute contract as the Anthropic backend.
 *
 *   OPENAI_COMPAT_BASE_URL   e.g. https://api.groq.com/openai/v1
 *   OPENAI_COMPAT_API_KEY    platform fallback key (optional if every
 *                            program supplies its own credential)
 *
 * The request body is relayed essentially verbatim: it is already
 * OpenAI-shaped, which is the whole point of the dialect. `stream:false` is
 * forced on the non-streaming path; the streaming path forces
 * `stream_options.include_usage` so the ledger always sees real usage.
 */

import {
  extractResponseText,
  extractUsage,
  type ChatCompletionRequest,
  type ChatCompletionResult,
  type ChatCompletionStream,
  type InferenceBackend,
  type ModelCatalogEntry,
  type UpstreamUsage,
} from "./types.js";

const PROVIDER = "openai-compat";
const DEFAULT_TIMEOUT_MS = 120_000;

export class OpenAICompatBackend implements InferenceBackend {
  readonly id: string;

  private readonly baseUrl: string;
  private readonly envApiKey: string;
  private readonly apiKeyEnvName: string;
  private readonly defaultTimeoutMs: number;

  constructor(
    options: {
      baseUrl?: string;
      apiKey?: string;
      timeoutMs?: number;
      id?: string;
      apiKeyEnvName?: string;
    } = {},
  ) {
    this.id = options.id ?? PROVIDER;
    this.baseUrl = (
      options.baseUrl ||
      process.env.OPENAI_COMPAT_BASE_URL ||
      ""
    ).replace(/\/+$/, "");
    this.apiKeyEnvName = options.apiKeyEnvName ?? "OPENAI_COMPAT_API_KEY";
    this.envApiKey = options.apiKey || process.env[this.apiKeyEnvName] || "";
    this.defaultTimeoutMs =
      options.timeoutMs ??
      Number(process.env.GATEWAY_UPSTREAM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  }

  /** Configured when a base URL exists — the key may arrive per-program. */
  isConfigured(): boolean {
    return this.baseUrl.length > 0;
  }

  private apiKeyFor(request: ChatCompletionRequest): string {
    return request.upstreamApiKey || this.envApiKey;
  }

  private noKeyResult(): ChatCompletionResult {
    return {
      ok: false,
      status: 503,
      body: {
        error:
          `No upstream credential for this program — add an API key for this provider in the sponsor console, or set ${this.apiKeyEnvName}.`,
      },
      usage: null,
      provider: this.id,
      trustTier: null,
      upstreamRequestId: null,
      responseText: "",
    };
  }

  async listModels(): Promise<ModelCatalogEntry[]> {
    const apiKey = this.envApiKey;
    if (!apiKey) return [];
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { data?: Array<{ id?: string }> };
      return (data.data ?? [])
        .filter((m): m is { id: string } => typeof m?.id === "string")
        .map((m) => ({
          id: m.id,
          promptPriceNative: null,
          completionPriceNative: null,
          contextWindow: null,
          verifiability: null,
          raw: { provider: this.id },
        }));
    } catch {
      return [];
    }
  }

  async chatCompletion(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResult> {
    const apiKey = this.apiKeyFor(request);
    if (!apiKey) return this.noKeyResult();

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...(request.body ?? {}), stream: false }),
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
        provider: this.id,
        trustTier: null,
        upstreamRequestId: response.headers.get("x-request-id"),
        responseText: "",
      };
    }

    return {
      ok: true,
      status: response.status,
      body,
      usage: extractUsage(body),
      provider: this.id,
      trustTier: null,
      upstreamRequestId: extractRequestId(body, response),
      responseText: extractResponseText(body),
    };
  }

  /**
   * Streaming completion — same verbatim-SSE relay contract as the 0G
   * backend: bytes pass through untouched while usage and assistant text are
   * observed line-by-line. `stream_options.include_usage` is forced so the
   * ledger always settles against real usage.
   */
  async chatCompletionStream(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionStream> {
    const apiKey = this.apiKeyFor(request);
    if (!apiKey) {
      return {
        ok: false,
        status: 503,
        errorBody: {
          error:
            `No upstream credential for this program — add an API key for this provider in the sponsor console, or set ${this.apiKeyEnvName}.`,
        },
        chunks: (async function* () {})(),
        collected: {
          usage: null,
          provider: this.id,
          trustTier: null,
          upstreamRequestId: null,
          responseText: "",
          usageMissing: true,
        },
      };
    }

    const existingOptions =
      request.body?.stream_options && typeof request.body.stream_options === "object"
        ? (request.body.stream_options as Record<string, unknown>)
        : {};

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          ...(request.body ?? {}),
          stream: true,
          stream_options: { ...existingOptions, include_usage: true },
        }),
      },
      request.timeoutMs ?? this.defaultTimeoutMs,
    );

    const collected: ChatCompletionStream["collected"] = {
      usage: null,
      provider: this.id,
      trustTier: null,
      upstreamRequestId: response.headers.get("x-request-id"),
      responseText: "",
      usageMissing: true,
    };

    if (!response.ok || !response.body) {
      return {
        ok: false,
        status: response.status,
        errorBody: await safeJson(response),
        chunks: (async function* () {})(),
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
      clearTimeout(timer);
    }
  }
}

let shared: OpenAICompatBackend | null = null;
export function sharedOpenAICompatBackend(): OpenAICompatBackend {
  if (!shared) shared = new OpenAICompatBackend();
  return shared;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractRequestId(body: unknown, response: Response): string | null {
  if (body && typeof body === "object") {
    const id = (body as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }
  return response.headers.get("x-request-id");
}

/**
 * Relay an SSE stream verbatim while extracting usage and assistant text.
 * Line-oriented because an SSE event can split across TCP reads.
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
    return;
  }

  const usage: UpstreamUsage | null = extractUsage(parsed);
  if (usage) {
    collected.usage = usage;
    collected.usageMissing = false;
  }

  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
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
