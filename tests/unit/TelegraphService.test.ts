import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Telegraph service unit tests.
 *
 * Coverage:
 *  - Confidence extraction (signal_mapping.confidence_field, explicit fields,
 *    nested metadata, null when absent — never fabricated)
 *  - Threshold routing (approve / hold / fail-safe on unknown)
 *  - Miner call URL building + param mapping
 *  - Cost conversion from min_price_usdc (micro-USDC)
 *  - Governance helper approve/hold decisions and artifact creation
 */

// ---------------------------------------------------------------------------
// TelegraphService
// ---------------------------------------------------------------------------

describe("TelegraphService", () => {
  const config = {
    enabled: true,
    nodeUrl: "http://test-node:7044",
    engineUrl: "http://test-node:7044/engine",
    daemonUrl: "http://test-node:7044/daemon",
    evmPrivateKey: "0x" + "ab".repeat(32),
    evmNetwork: "eip155:*",
    svmNetwork: "solana:*",
    refreshIntervalMs: 0,
    confidenceThreshold: 0.7,
    inferenceProvider: "",
  };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("meetsConfidenceThreshold: approves above threshold, holds below", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);

    expect(svc.meetsConfidenceThreshold(0.9)).toBe(true);
    expect(svc.meetsConfidenceThreshold(0.7)).toBe(true); // >= threshold
    expect(svc.meetsConfidenceThreshold(0.69)).toBe(false);
    expect(svc.meetsConfidenceThreshold(0.5)).toBe(false);
  });

  it("meetsConfidenceThreshold: null/undefined confidence never auto-approves", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);

    expect(svc.meetsConfidenceThreshold(null)).toBe(false);
    expect(svc.meetsConfidenceThreshold(undefined)).toBe(false);
    expect(svc.meetsConfidenceThreshold(NaN)).toBe(false);
  });

  it("extractConfidenceFromData: uses the miner's declared confidence_field", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);
    const miner = {
      signal_mapping: { confidence_field: "risk" },
    };

    const confidence = svc.extractConfidenceFromData({ risk: 0.82, temp_c: 31 }, miner as never);
    expect(confidence).toBeCloseTo(0.82, 5);
  });

  it("extractConfidenceFromData: falls back to explicit confidence/score fields", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);

    expect(svc.extractConfidenceFromData({ confidence: 0.61 })).toBeCloseTo(0.61, 5);
    expect(svc.extractConfidenceFromData({ score: 0.44 })).toBeCloseTo(0.44, 5);
    expect(svc.extractConfidenceFromData({ metadata: { confidence: 0.93 } })).toBeCloseTo(0.93, 5);
  });

  it("extractConfidenceFromData: returns null (not 0.8) when no confidence exists", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);

    expect(svc.extractConfidenceFromData({ summary: "just a summary" })).toBeNull();
    expect(svc.extractConfidenceFromData("not an object")).toBeNull();
  });

  it("extractConfidenceFromData: clamps to [0,1]", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);

    expect(svc.extractConfidenceFromData({ confidence: 1.4 })).toBe(1);
    expect(svc.extractConfidenceFromData({ confidence: -0.2 })).toBe(0);
  });

  it("callMiner: builds /miner-dispatcher/v1/:id/:path URL and maps params", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService({ ...config, refreshIntervalMs: 0 });

    // Mock the payment fetch to capture the request and return a fake response.
    const captured: Array<{ url: string; init?: RequestInit }> = [];
    vi.spyOn(svc, "getPaymentFetch").mockResolvedValue((async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      captured.push({ url: String(input), init });
      return new Response(JSON.stringify({ risk: 0.9, temp_c: 30 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as never);

    // Seed the miner cache with a fake miner integration.
    const miner = {
      id: "20260821",
      slug: "amanat-weather-risk",
      name: "Amanat Weather Risk",
      description: "test",
      endpoints: [{ path: "/forecast", method: "POST", param_map: { location: "place" } }],
      signal_mapping: { confidence_field: "risk" },
      supported_intents: ["WEATHER_FORECAST"],
      min_price_usdc: 10000,
    };
    // getMiner -> refreshMiners -> fetch(node). Stub fetch for the registry.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/miner-dispatcher/integrations")) {
          return new Response(JSON.stringify([miner]), { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );

    const result = await svc.callMiner({
      minerId: "amanat-weather-risk",
      intent: "WEATHER_FORECAST",
      params: { location: "San Francisco", hours: 24 },
    });

    expect(result.success).toBe(true);
    expect(captured.length).toBe(1);
    expect(captured[0].url).toBe("http://test-node:7044/miner-dispatcher/v1/20260821/forecast");

    // param_map should have mapped location -> place.
    const body = JSON.parse(captured[0].init?.body as string);
    expect(body).toEqual({ place: "San Francisco", hours: 24 });

    // Confidence from signal_mapping.confidence_field ("risk").
    expect(result.metadata.confidence).toBeCloseTo(0.9, 5);
    // Cost from min_price_usdc (10000 micro-USDC == $0.01).
    expect(result.metadata.costUsd).toBe("0.0100");
  });

  it("callMiner: returns failure when no payment signer is available", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService(config);
    vi.spyOn(svc, "getPaymentFetch").mockResolvedValue(null);

    const result = await svc.callMiner({
      minerId: "whatever",
      params: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("payment signer");
  });

  it("getIntents: aggregates miner counts and real request totals", async () => {
    const { TelegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );
    const svc = new TelegraphService({ ...config, refreshIntervalMs: 0 });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify([
            { id: "1", name: "A", supported_intents: ["WEATHER_FORECAST"], total_requests_served: 10 },
            { id: "2", name: "B", supported_intents: ["WEATHER_FORECAST"], total_requests_served: 37 },
            { id: "3", name: "C", supported_intents: ["CRYPTO_PRICE"], total_requests_served: 5 },
          ]),
          { status: 200 },
        ),
      ),
    );

    const intents = await svc.getIntents();
    const weather = intents.find((i) => i.name === "WEATHER_FORECAST");
    expect(weather?.minerCount).toBe(2);
    expect(weather?.requestCount).toBe(47); // real totals, not 0
  });
});

// ---------------------------------------------------------------------------
// TelegraphGovernanceHelper
// ---------------------------------------------------------------------------

describe("TelegraphGovernanceHelper", () => {
  it("governedMinerCall: approves high-confidence signals", async () => {
    const { telegraphGovernanceHelper } = await import(
      "../../src/backend/services/telegraph/TelegraphGovernanceHelper.js"
    );
    const { telegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );

    vi.spyOn(telegraphService, "callMiner").mockResolvedValue({
      success: true,
      data: { risk: 0.9 },
      metadata: {
        minerId: "20260821",
        minerName: "Amanat Weather Risk",
        confidence: 0.9,
        latencyMs: 100,
        costUsd: "0.0100",
        timestamp: "2026-09-01T00:00:00.000Z",
        paid: true,
      },
    });

    const result = await telegraphGovernanceHelper.governedMinerCall({
      agentId: "agent-1",
      mandateId: "mandate-1",
      minerRequest: { minerId: "20260821", params: { question: "storm?" } },
    });

    expect(result.status).toBe("approved");
    expect(result.decision?.approved).toBe(true);
    expect(result.decision?.actualConfidence).toBe(0.9);
    expect(result.artifact?.type).toBe("telegraph.signal");
    const data = result.artifact!.data as Record<string, unknown>;
    expect((data.cost as Record<string, unknown>).paid).toBe(true);
  });

  it("governedMinerCall: holds low-confidence signals", async () => {
    const { telegraphGovernanceHelper } = await import(
      "../../src/backend/services/telegraph/TelegraphGovernanceHelper.js"
    );
    const { telegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );

    vi.spyOn(telegraphService, "callMiner").mockResolvedValue({
      success: true,
      data: { risk: 0.3 },
      metadata: {
        minerId: "20260821",
        minerName: "Amanat Weather Risk",
        confidence: 0.3,
        latencyMs: 100,
        costUsd: "0.0100",
        timestamp: "2026-09-01T00:00:00.000Z",
        paid: true,
      },
    });

    const result = await telegraphGovernanceHelper.governedMinerCall({
      agentId: "agent-1",
      minerRequest: { minerId: "20260821", params: {} },
    });

    expect(result.status).toBe("held");
    expect(result.decision?.approved).toBe(false);
    expect(result.decision?.reason).toContain("below threshold");
  });

  it("governedMinerCall: holds when confidence is unknown (fail-safe, no fabricated 0.8)", async () => {
    const { telegraphGovernanceHelper } = await import(
      "../../src/backend/services/telegraph/TelegraphGovernanceHelper.js"
    );
    const { telegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );

    vi.spyOn(telegraphService, "callMiner").mockResolvedValue({
      success: true,
      data: { summary: "no confidence signal here" },
      metadata: {
        minerId: "1",
        minerName: "Some Miner",
        confidence: null,
        latencyMs: 100,
        costUsd: "0.0100",
        timestamp: "2026-09-01T00:00:00.000Z",
        paid: true,
      },
    });

    const result = await telegraphGovernanceHelper.governedMinerCall({
      agentId: "agent-1",
      minerRequest: { minerId: "1", params: {} },
    });

    expect(result.status).toBe("held");
    expect(result.decision?.confidenceKnown).toBe(false);
    expect(result.decision?.reason).toContain("Confidence unknown");
  });

  it("governedEngineAsk: wraps engine responses and creates artifact", async () => {
    const { telegraphGovernanceHelper } = await import(
      "../../src/backend/services/telegraph/TelegraphGovernanceHelper.js"
    );
    const { telegraphService } = await import(
      "../../src/backend/services/telegraph/TelegraphService.js"
    );

    vi.spyOn(telegraphService, "engineAsk").mockResolvedValue({
      answer: "Partly cloudy, 18C",
      minerId: "18",
      minerName: "Zeus Weather",
      confidence: 0.85,
      latencyMs: 120,
      costUsd: "0.01",
      timestamp: "2026-09-01T00:00:00.000Z",
    });

    const result = await telegraphGovernanceHelper.governedEngineAsk({
      agentId: "agent-1",
      engineRequest: { query: "weather in Lahore?" },
    });

    expect(result.status).toBe("approved");
    expect(result.response?.data.answer).toBe("Partly cloudy, 18C");
    expect(result.artifact?.type).toBe("telegraph.signal");
  });

  it("createSpendIntentFromSignal: returns null for missing artifact", async () => {
    const { telegraphGovernanceHelper } = await import(
      "../../src/backend/services/telegraph/TelegraphGovernanceHelper.js"
    );

    const intent = telegraphGovernanceHelper.createSpendIntentFromSignal(null, {
      recipient: "0x1234",
      amount: "1000000",
      asset: "USDC",
      reason: "hedge",
    });
    expect(intent).toBeNull();
  });

  it("createSpendIntentFromSignal: builds a spend intent with telegraph attribution", async () => {
    const { telegraphGovernanceHelper } = await import(
      "../../src/backend/services/telegraph/TelegraphGovernanceHelper.js"
    );

    const artifact = {
      id: "artifact-1",
      type: "telegraph.signal" as const,
      createdAt: "2026-09-01T00:00:00.000Z",
      data: {
        agentId: "agent-1",
        mandateId: "mandate-1",
        miner: { id: "18", name: "Zeus Weather" },
        signal: { confidence: 0.85 },
        cost: { usd: "0.01" },
      },
    };

    const intent = telegraphGovernanceHelper.createSpendIntentFromSignal(artifact, {
      recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      amount: "1000000",
      asset: "USDC",
      reason: "Storm hedge based on verified Telegraph signal",
    });

    expect(intent).not.toBeNull();
    expect(intent!.agentId).toBe("agent-1");
    expect(intent!.metadata).toMatchObject({
      source: "telegraph",
      artifactId: "artifact-1",
      minerId: "18",
      confidence: 0.85,
      intelligenceCostUsd: "0.01",
    });
  });
});
