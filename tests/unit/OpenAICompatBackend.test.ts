/**
 * OpenAICompatBackend tests — the provider-agnostic backend behind
 * `backend: "openai-compat"` sponsored-credit programs.
 *
 * fetch is stubbed; assertions cover the contract the gateway depends on:
 * verbatim request relay, real usage extraction, SSE passthrough with
 * observed usage, loud failure when no credential exists, and provider
 * errors surfaced unbilled.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatBackend } from "@backend/services/inference/OpenAICompatBackend.js";
import type { ChatCompletionRequest } from "@backend/services/inference/types.js";

const BASE = "https://provider.example/v1";

function backend(apiKey = "sk-test"): OpenAICompatBackend {
  return new OpenAICompatBackend({ baseUrl: BASE, apiKey });
}

function request(body: Record<string, unknown> = {}, extra: Partial<ChatCompletionRequest> = {}): ChatCompletionRequest {
  return {
    body: { model: "test-model", messages: [{ role: "user", content: "hi" }], ...body },
    ...extra,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const COMPLETION = {
  id: "chatcmpl-1",
  choices: [{ message: { role: "assistant", content: "hello there" } }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAICompatBackend", () => {
  it("is configured by base URL alone — the key may arrive per-program", () => {
    expect(new OpenAICompatBackend({ baseUrl: BASE, apiKey: "" }).isConfigured()).toBe(true);
    expect(new OpenAICompatBackend({ baseUrl: "" }).isConfigured()).toBe(false);
  });

  it("relays the request verbatim with stream forced off and returns usage + text", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(COMPLETION));
    vi.stubGlobal("fetch", fetchMock);

    const result = await backend().chatCompletion(request({ temperature: 0.2 }));

    expect(result.ok).toBe(true);
    expect(result.responseText).toBe("hello there");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5, cachedTokens: 0 });
    expect(result.provider).toBe("openai-compat");
    expect(result.upstreamRequestId).toBe("chatcmpl-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/chat/completions`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const sent = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sent.stream).toBe(false);
    expect(sent.temperature).toBe(0.2);
    expect(sent.model).toBe("test-model");
  });

  it("prefers a per-program upstream key over the platform env key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(COMPLETION));
    vi.stubGlobal("fetch", fetchMock);

    await backend("sk-platform").chatCompletion(request({}, { upstreamApiKey: "sk-program" }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-program");
  });

  it("returns an unbilled 503 when no credential exists anywhere", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await backend("").chatCompletion(request());
    const stream = await backend("").chatCompletionStream(request());

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    expect(result.usage).toBeNull();
    expect(stream.ok).toBe(false);
    expect(stream.collected.usageMissing).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces provider errors as ok:false without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { message: "model_not_found", type: "invalid_request_error" } }, 404),
      ),
    );

    const result = await backend().chatCompletion(request());

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.usage).toBeNull();
    expect((result.body as { error: { message: string } }).error.message).toBe("model_not_found");
  });

  it("streams SSE verbatim while observing usage and assistant text", async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: {"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}\n\n',
      "data: [DONE]\n\n",
    ].join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await backend().chatCompletionStream(request());
    expect(result.ok).toBe(true);

    const sent = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(sent.stream).toBe(true);
    expect(sent.stream_options).toEqual({ include_usage: true });

    const chunks: Uint8Array[] = [];
    for await (const chunk of result.chunks) chunks.push(chunk);
    const relayed = new TextDecoder().decode(
      chunks.reduce((acc, c) => {
        const merged = new Uint8Array(acc.length + c.length);
        merged.set(acc);
        merged.set(c, acc.length);
        return merged;
      }, new Uint8Array(0)),
    );
    expect(relayed).toBe(sse); // verbatim — clients see provider bytes

    expect(result.collected.responseText).toBe("hello");
    expect(result.collected.usage).toEqual({ inputTokens: 7, outputTokens: 3, cachedTokens: 0 });
    expect(result.collected.usageMissing).toBe(false);
  });

  it("lists models from the provider catalog, empty on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ object: "list", data: [{ id: "m1" }, { id: "m2" }, { nope: true }] }),
      ),
    );
    const models = await backend().listModels();
    expect(models.map((m) => m.id)).toEqual(["m1", "m2"]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    expect(await backend().listModels()).toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("dns")));
    expect(await backend().listModels()).toEqual([]);
  });
});
