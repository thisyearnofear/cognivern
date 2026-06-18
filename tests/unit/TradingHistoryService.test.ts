import { describe, it, expect } from "vitest";
import { TradingHistoryService } from "@backend/services/TradingHistoryService.js";
import { TradingDecision } from "@backend/types/Agent.js";

function makeDecision(
  overrides: Partial<TradingDecision> = {},
): TradingDecision {
  return {
    id: `trade-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    action: "buy",
    asset: "ETH",
    amount: 1,
    price: 2000,
    confidence: 0.5,
    ...overrides,
  };
}

describe("TradingHistoryService", () => {
  it("should initialize with empty history", () => {
    const service = new TradingHistoryService();
    expect(service.getHistory()).toEqual([]);
  });

  it("addDecision and getHistory", () => {
    const service = new TradingHistoryService();
    const d1 = makeDecision({ id: "t1" });
    const d2 = makeDecision({ id: "t2" });

    service.addDecision(d1);
    service.addDecision(d2);

    const history = service.getHistory();
    expect(history.length).toBe(2);
    // Most recent first
    expect(history[0].id).toBe("t2");
    expect(history[1].id).toBe("t1");
  });

  it("getHistory with limit", () => {
    const service = new TradingHistoryService();
    for (let i = 0; i < 5; i++) {
      service.addDecision(makeDecision({ id: `t${i}` }));
    }

    expect(service.getHistory(3).length).toBe(3);
    expect(service.getHistory(10).length).toBe(5);
  });

  it("calculatePerformance returns zero for empty history", () => {
    const service = new TradingHistoryService();
    const perf = service.calculatePerformance();

    expect(perf.totalTrades).toBe(0);
    expect(perf.winRate).toBe(0);
    expect(perf.totalReturn).toBe(0);
    expect(perf.sharpeRatio).toBe(0);
    expect(perf.maxDrawdown).toBe(0);
  });

  it("calculatePerformance with mixed trades", () => {
    const service = new TradingHistoryService();
    const trades: TradingDecision[] = [
      makeDecision({ confidence: 0.8 }),
      makeDecision({ confidence: -0.3 }),
      makeDecision({ confidence: 0.6 }),
      makeDecision({ confidence: -0.1 }),
      makeDecision({ confidence: 0.0 }),
    ];

    const perf = service.calculatePerformance(trades);

    expect(perf.totalTrades).toBe(5);
    expect(perf.winningTrades).toBe(2);
    expect(perf.losingTrades).toBe(2);
    expect(perf.winRate).toBe(0.4);
    expect(perf.totalReturn > 0).toBeTruthy();
  });

  it("calculatePerformance with all wins", () => {
    const service = new TradingHistoryService();
    const trades: TradingDecision[] = [
      makeDecision({ confidence: 0.5 }),
      makeDecision({ confidence: 0.3 }),
    ];

    const perf = service.calculatePerformance(trades);

    expect(perf.winningTrades).toBe(2);
    expect(perf.losingTrades).toBe(0);
    expect(perf.winRate).toBe(1);
  });

  it("calculateHistoryStats groups by day", () => {
    const service = new TradingHistoryService();
    const today = new Date().toISOString().split("T")[0];

    service.addDecision(
      makeDecision({ timestamp: `${today}T10:00:00Z`, confidence: 0.5 }),
    );
    service.addDecision(
      makeDecision({ timestamp: `${today}T14:00:00Z`, confidence: -0.2 }),
    );

    const stats = service.calculateHistoryStats();
    expect(stats.performanceByDay[today]).toBeTruthy();
    expect(stats.performanceByDay[today].totalTrades).toBe(2);
  });

  it("clearHistory empties the store", () => {
    const service = new TradingHistoryService();
    service.addDecision(makeDecision());
    service.addDecision(makeDecision());

    expect(service.getHistory().length).toBe(2);
    service.clearHistory();
    expect(service.getHistory().length).toBe(0);
  });

  it("importHistory and exportHistory roundtrip", () => {
    const service = new TradingHistoryService();
    const trades = [makeDecision({ id: "a" }), makeDecision({ id: "b" })];

    service.importHistory(trades);
    const exported = service.exportHistory();

    expect(exported.length).toBe(2);
    expect(exported[0].id).toBe("a");
  });

  it("generateChartData returns empty for no history", () => {
    const service = new TradingHistoryService();
    const data = service.generateChartData();

    expect(data.equityCurve).toEqual([]);
    expect(data.drawdownCurve).toEqual([]);
    expect(data.returnDistribution).toEqual([]);
    expect(data.winLossRatio).toEqual([]);
  });

  it("generateChartData builds equity curve", () => {
    const service = new TradingHistoryService();
    service.addDecision(
      makeDecision({ confidence: 0.5, timestamp: "2024-01-01T00:00:00Z" }),
    );
    service.addDecision(
      makeDecision({ confidence: 0.3, timestamp: "2024-01-02T00:00:00Z" }),
    );

    const data = service.generateChartData();
    expect(data.equityCurve.length).toBe(2);
    expect(data.winLossRatio.length).toBe(1); // All wins
  });
});
