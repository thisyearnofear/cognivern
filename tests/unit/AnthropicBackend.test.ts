/**
 * AnthropicBackend tests (mocked fetch — no live key).
 *
 * Translation contract: OpenAI-shaped participant requests become Anthropic
 * Messages calls; usage/pricing/metadata come back normalised. Missing keys
 * and untranslatable turns fail closed as unbilled upstream errors.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnthropicBackend } from "@backend/services/inference/AnthropicBackend.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function okResponse(overrides: Record<string, unknown> = {}) {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      id: "msg_abc",
      type: "message",
      content: [{ type: "text", text: "Hello there" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 12, output_tokens: 5, cache_read_input_tokens: 3 },
      ...overrides,
    }),
  });
}

const BODY = {
  model: "claude-haiku-4-5",
  messages: [
    { role: "system", content: "Be brief." },
    { role: "user", content: "Hi" },
  ],
};

describe("AnthropicBackend", () => {
  it("translates system/messages and reports provider usage", async () => {
    okResponse();
    const backend = new AnthropicBackend();
    const result = await backend.chatCompletion({ body: BODY, upstreamApiKey: "sk-ant-x" });
    expect(result.ok).toBe(true);
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 5, cachedTokens: 3 });
    expect(result.provider).toBe("anthropic");
    expect(result.upstreamRequestId).toBe("msg_abc");
    expect(result.responseText).toBe("Hello there");

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = options.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-x");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const sent = JSON.parse(options.body as string);
    expect(sent).toMatchObject({
      model: "claude-haiku-4-5",
      system: "Be brief.",
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(sent.max_tokens).toBeGreaterThan(0);
  });

  it("fails closed without a key (unbilled, no throw)", async () => {
    const backend = new AnthropicBackend();
    const result = await backend.chatCompletion({ body: BODY });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.usage).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects tool turns before any spend", async () => {
    const backend = new AnthropicBackend();
    const result = await backend.chatCompletion({
      body: { model: "x", messages: [{ role: "tool", content: "t" }] },
      upstreamApiKey: "sk-ant-x",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("maps Anthropic errors to upstream errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ type: "error", error: { type: "authentication_error", message: "bad key" } }),
    });
    const backend = new AnthropicBackend();
    const result = await backend.chatCompletion({ body: BODY, upstreamApiKey: "sk-ant-nope" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.usage).toBeNull();
  });

  it("joins text blocks and rejects non-text content", async () => {
    okResponse({ content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] });
    const backend = new AnthropicBackend();
    const direct = await backend.chatCompletion({ body: BODY, upstreamApiKey: "k" });
    expect(direct.responseText).toBe("ab");

    const toolBody = {
      model: "x",
      messages: [{ role: "user", content: [{ type: "tool_use", id: "1", name: "n", input: {} }] }],
    };
    const rejected = await backend.chatCompletion({ body: toolBody, upstreamApiKey: "k" });
    expect(rejected.ok).toBe(false);
  });

  it("lists known models and refuses streaming", async () => {
    const backend = new AnthropicBackend();
    const models = await backend.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.raw !== undefined)).toBe(true);
    const stream = await backend.chatCompletionStream({ body: BODY, upstreamApiKey: "k" });
    expect(stream.ok).toBe(false);
    expect(stream.status).toBe(501);
  });
});
