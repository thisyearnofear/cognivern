import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    apiKey: "kh_test_api_key",
    baseUrl: "https://app.keeperhub.com",
    enabled: true,
  },
}));

vi.mock("@backend/shared/config/index.js", () => ({
  keeperHubConfig: mockConfig,
  config: { NODE_ENV: "test", LOG_LEVEL: "error" as const, PORT: 3000 },
  apiConfig: { port: 3000, apiKey: "test", corsOrigin: "*", rateLimit: {}, requestTimeout: 30000 },
  sapienceConfig: {},
  databaseConfig: {},
  cacheConfig: {},
  tradingConfig: {},
  mantleConfig: {},
  fhenixConfig: {},
  monitoringConfig: {},
  aiConfig: {},
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

import { KeeperHubExecutionProvider } from "@backend/services/blockchain/KeeperHubExecutionProvider.js";

describe("KeeperHubExecutionProvider", () => {
  let provider: KeeperHubExecutionProvider;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    provider = new KeeperHubExecutionProvider({
      timeoutMs: 500,
      pollIntervalMs: 10,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  it("returns an error when the API key is not configured", async () => {
    mockConfig.apiKey = "";

    const result = await provider.executeTransfer({
      intentId: "intent-1",
      from: "0xSender",
      to: "0xRecipient",
      valueWei: 1_000_000_000_000_000_000n,
      chainId: 84532,
    });

    expect(result).toEqual({ error: "KeeperHub API key is not configured" });
  });

  it("executes a transfer and polls to completion", async () => {
    mockConfig.apiKey = "kh_test_api_key";

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: "exec-123" }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: "exec-123", status: "pending" }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ executionId: "exec-123", status: "completed", txHash: "0xtxhash" }),
        { status: 200 },
      ),
    );

    const result = await provider.executeTransfer({
      intentId: "intent-1",
      from: "0xSender",
      to: "0xRecipient",
      valueWei: 1_000_000_000_000_000_000n,
      chainId: 84532,
    });

    expect(result).toEqual({ txHash: "0xtxhash", from: "0xSender" });

    const calls = fetchMock.mock.calls;
    expect(calls[0][0]).toBe("https://app.keeperhub.com/api/execute/transfer");
    expect(calls[0][1]?.method).toBe("POST");
    expect((calls[0][1]?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer kh_test_api_key",
    );
    expect((calls[0][1]?.headers as Record<string, string>)["Idempotency-Key"]).toBe("intent-1");
  });

  it("returns an error when KeeperHub reports failure", async () => {
    mockConfig.apiKey = "kh_test_api_key";

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: "exec-456" }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ executionId: "exec-456", status: "failed", error: "insufficient funds" }),
        { status: 200 },
      ),
    );

    const result = await provider.executeTransfer({
      intentId: "intent-2",
      from: "0xSender",
      to: "0xRecipient",
      valueWei: 1_000_000_000_000_000_000n,
      chainId: 84532,
    });

    expect(result).toEqual({ error: "KeeperHub execution failed: insufficient funds" });
  });

  it("returns an error when the status poll times out", async () => {
    mockConfig.apiKey = "kh_test_api_key";

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: "exec-789" }), { status: 200 }),
    );
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ executionId: "exec-789", status: "pending" }), { status: 200 }),
    );

    const result = await provider.executeTransfer({
      intentId: "intent-3",
      from: "0xSender",
      to: "0xRecipient",
      valueWei: 1_000_000_000_000_000_000n,
      chainId: 84532,
    });

    expect(result).toEqual({
      error: expect.stringContaining("did not complete within"),
    });
  });

  it("converts wei to ETH exactly", async () => {
    mockConfig.apiKey = "kh_test_api_key";

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ executionId: "exec-000" }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ executionId: "exec-000", status: "completed", txHash: "0xtx" }),
        { status: 200 },
      ),
    );

    await provider.executeTransfer({
      intentId: "intent-wei",
      from: "0xSender",
      to: "0xRecipient",
      valueWei: 123_456_789_012_345_678n,
      chainId: 84532,
    });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.amount).toBe("0.123456789012345678");
    expect(body.chainId).toBe(84532);
    expect(body.recipientAddress).toBe("0xRecipient");
  });
});
