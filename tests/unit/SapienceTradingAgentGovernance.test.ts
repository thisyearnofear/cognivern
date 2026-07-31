import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@backend/services/blockchain/OwsWalletService.js", () => ({
  owsWalletService: {},
}));

import { SapienceTradingAgent } from "@backend/modules/agents/implementations/SapienceTradingAgent.js";
import type { GovernanceClient } from "@backend/services/governance/GovernanceClient.js";
import type { TradingDecision } from "@backend/modules/agents/types/TradingAgent.js";

const previewSpendMock = vi.fn();
const executeSpendMock = vi.fn();
const submitForecastMock = vi.fn();

function makeAgent(): SapienceTradingAgent {
  const governance = {
    previewSpend: previewSpendMock,
    executeSpend: executeSpendMock,
  } as unknown as GovernanceClient;

  const agent = new SapienceTradingAgent(
    "test-agent",
    { maxRiskPerTrade: 0.1 } as any,
    governance,
  );
  // Bypass ensureServices/start so the test never touches real Sapience infra.
  (agent as any).status = "active";
  (agent as any).sapienceService = { submitForecast: submitForecastMock };
  (agent as any).forecastingService = {};
  return agent;
}

// Small trade (price * quantity = 1 USDe) so the auto-confirm path applies.
const decision: TradingDecision = {
  id: "d1",
  agentId: "sapience-agent-1",
  timestamp: new Date(),
  action: "buy",
  symbol: "0xcondition",
  quantity: 1,
  price: 1,
  confidence: 0.8,
  reasoning: "unit test",
  riskScore: 0.1,
};

beforeEach(() => {
  previewSpendMock.mockReset();
  executeSpendMock.mockReset();
  submitForecastMock.mockReset();
  previewSpendMock.mockResolvedValue({
    status: "approved",
    reason: "within limits",
    attestationHash: "a".repeat(64),
  });
  submitForecastMock.mockResolvedValue("0xtxhash");
});

describe("SapienceTradingAgent executeTrade governance gating", () => {
  it("does not touch Sapience when the spend comes back held", async () => {
    executeSpendMock.mockResolvedValue({
      status: "held",
      reason: "held for operator review",
    });
    const agent = makeAgent();

    const result = await agent.executeTrade(decision);

    expect(result.status).toBe("pending");
    expect(submitForecastMock).not.toHaveBeenCalled();
  });

  it("fails the trade when the spend is denied", async () => {
    executeSpendMock.mockResolvedValue({
      status: "denied",
      reason: "policy denied",
    });
    const agent = makeAgent();

    const result = await agent.executeTrade(decision);

    expect(result.status).toBe("failed");
    expect(submitForecastMock).not.toHaveBeenCalled();
  });

  it("fails closed when preview returns no attestationHash", async () => {
    previewSpendMock.mockResolvedValue({
      status: "approved",
      reason: "ok",
      attestationHash: undefined,
    });
    const agent = makeAgent();

    const result = await agent.executeTrade(decision);

    expect(result.status).toBe("failed");
    expect(executeSpendMock).not.toHaveBeenCalled();
    expect(submitForecastMock).not.toHaveBeenCalled();
  });

  it("executes only after an approved spend", async () => {
    executeSpendMock.mockResolvedValue({ status: "approved" });
    const agent = makeAgent();

    const result = await agent.executeTrade(decision);

    expect(result.status).toBe("executed");
    expect(submitForecastMock).toHaveBeenCalledTimes(1);
    // The executed spend must carry the previewed attestation binding.
    const spendReq = executeSpendMock.mock.calls[0][0];
    expect(spendReq.attestationHash).toBe("a".repeat(64));
  });
});
