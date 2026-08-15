/**
 * ZeroGRouterBackend.fetchUpstreamBalance tests.
 *
 * The balance endpoint is the reconciliation source of truth: the sponsor's
 * real 0G deposit (Layer 1) that the ledger pool (Layer 2) must be compared
 * against. The interesting behaviours are the failure modes — sk- keys are 403
 * on /v1/account/* by design, so a missing or wrong-scoped management key must
 * surface as a distinct, actionable state rather than a crash.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZeroGRouterBackend } from "@backend/services/inference/ZeroGRouterBackend.js";

const BASE = "https://router-api.0g.ai/v1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ZeroGRouterBackend.fetchUpstreamBalance", () => {
  it("returns not_configured when no management key is set", async () => {
    const backend = new ZeroGRouterBackend({ apiKey: "sk-test", managementKey: "" });
    const result = await backend.fetchUpstreamBalance();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_configured");
      expect(result.message).toContain("ZEROG_ROUTER_MANAGEMENT_KEY");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the spendable balance and converts neuron to USD", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        deposit_balance: "3000000000000000000",
        total_balance: "2000000000000000000",
      }),
    );

    const backend = new ZeroGRouterBackend({
      apiKey: "sk-test",
      managementKey: "mk-test",
      zgUsdRate: 0.5,
    });
    const result = await backend.fetchUpstreamBalance();

    expect(result.ok).toBe(true);
    if (result.ok) {
      // 2 0G (2e18 neuron) at $0.50/0G.
      expect(result.balance.balanceNative).toBe("2000000000000000000");
      expect(result.balance.nativeUnit).toBe("neuron");
      expect(result.balance.balanceUsd).toBe(1);
      expect(result.balance.currency).toBe("0G");
    }

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/account/balance`);
    expect((init?.headers as Record<string, string>)?.Authorization).toBe("Bearer mk-test");
  });

  it("reports null USD when no ZG/USD rate is configured", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ total_balance: "1000000000000000000" }),
    );

    const backend = new ZeroGRouterBackend({
      apiKey: "sk-test",
      managementKey: "mk-test",
      zgUsdRate: 0,
    });
    const result = await backend.fetchUpstreamBalance();

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.balance.balanceUsd).toBeNull();
  });

  it("maps a 403 into an actionable scope hint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { code: "insufficient_scope" } }, 403),
    );

    const backend = new ZeroGRouterBackend({
      apiKey: "sk-test",
      managementKey: "mk-test",
    });
    const result = await backend.fetchUpstreamBalance();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("http_error");
      expect(result.message).toContain("account:read");
    }
  });

  it("returns network_error when the endpoint cannot be reached", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const backend = new ZeroGRouterBackend({
      apiKey: "sk-test",
      managementKey: "mk-test",
    });
    const result = await backend.fetchUpstreamBalance();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("network_error");
  });

  it("returns parse_error when 0G changes the response shape", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: "shape" }));

    const backend = new ZeroGRouterBackend({
      apiKey: "sk-test",
      managementKey: "mk-test",
    });
    const result = await backend.fetchUpstreamBalance();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("parse_error");
  });
});
