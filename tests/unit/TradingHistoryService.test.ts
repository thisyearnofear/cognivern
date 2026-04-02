import test from "node:test";
import assert from "node:assert";
import { TradingHistoryService } from "../../src/services/TradingHistoryService.js";
import { TradingDecision } from "../../src/types/Agent.js";

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

test("TradingHistoryService", async (t) => {
  await t.test("should initialize with empty history", () => {
    const service = new TradingHistoryService();
    assert.deepStrictEqual(service.getHistory(), []);
  });

  await t.test("addDecision and getHistory", () => {
    const service = new TradingHistoryService();
    const d1 = makeDecision({ id: "t1" });
    const d2 = makeDecision({ id: "t2" });

    service.addDecision(d1);
    service.addDecision(d2);

    const history = service.getHistory();
    assert.strictEqual(history.length, 2);
    // Most recent first
    assert.strictEqual(history[0].id, "t2");
    assert.strictEqual(history[1].id, "t1");
  });

  await t.test("getHistory with limit", () => {
    const service = new TradingHistoryService();
    for (let i = 0; i < 5; i++) {
      service.addDecision(makeDecision({ id: `t${i}` }));
    }

    assert.strictEqual(service.getHistory(3).length, 3);
    assert.strictEqual(service.getHistory(10).length, 5);
  });

  await t.test("calculatePerformance returns zero for empty history", () => {
    const service = new TradingHistoryService();
    const perf = service.calculatePerformance();

    assert.strictEqual(perf.totalTrades, 0);
    assert.strictEqual(perf.winRate, 0);
    assert.strictEqual(perf.totalReturn, 0);
    assert.strictEqual(perf.sharpeRatio, 0);
    assert.strictEqual(perf.maxDrawdown, 0);
  });

  await t.test("calculatePerformance with mixed trades", () => {
    const service = new TradingHistoryService();
    const trades: TradingDecision[] = [
      makeDecision({ confidence: 0.8 }),
      makeDecision({ confidence: -0.3 }),
      makeDecision({ confidence: 0.6 }),
      makeDecision({ confidence: -0.1 }),
      makeDecision({ confidence: 0.0 }),
    ];

    const perf = service.calculatePerformance(trades);

    assert.strictEqual(perf.totalTrades, 5);
    assert.strictEqual(perf.winningTrades, 2);
    assert.strictEqual(perf.losingTrades, 2);
    assert.strictEqual(perf.winRate, 0.4);
    assert.ok(perf.totalReturn > 0);
  });

  await t.test("calculatePerformance with all wins", () => {
    const service = new TradingHistoryService();
    const trades: TradingDecision[] = [
      makeDecision({ confidence: 0.5 }),
      makeDecision({ confidence: 0.3 }),
    ];

    const perf = service.calculatePerformance(trades);

    assert.strictEqual(perf.winningTrades, 2);
    assert.strictEqual(perf.losingTrades, 0);
    assert.strictEqual(perf.winRate, 1);
  });

  await t.test("calculateHistoryStats groups by day", () => {
    const service = new TradingHistoryService();
    const today = new Date().toISOString().split("T")[0];

    service.addDecision(
      makeDecision({ timestamp: `${today}T10:00:00Z`, confidence: 0.5 }),
    );
    service.addDecision(
      makeDecision({ timestamp: `${today}T14:00:00Z`, confidence: -0.2 }),
    );

    const stats = service.calculateHistoryStats();
    assert.ok(stats.performanceByDay[today]);
    assert.strictEqual(stats.performanceByDay[today].totalTrades, 2);
  });

  await t.test("clearHistory empties the store", () => {
    const service = new TradingHistoryService();
    service.addDecision(makeDecision());
    service.addDecision(makeDecision());

    assert.strictEqual(service.getHistory().length, 2);
    service.clearHistory();
    assert.strictEqual(service.getHistory().length, 0);
  });

  await t.test("importHistory and exportHistory roundtrip", () => {
    const service = new TradingHistoryService();
    const trades = [makeDecision({ id: "a" }), makeDecision({ id: "b" })];

    service.importHistory(trades);
    const exported = service.exportHistory();

    assert.strictEqual(exported.length, 2);
    assert.strictEqual(exported[0].id, "a");
  });

  await t.test("generateChartData returns empty for no history", () => {
    const service = new TradingHistoryService();
    const data = service.generateChartData();

    assert.deepStrictEqual(data.equityCurve, []);
    assert.deepStrictEqual(data.drawdownCurve, []);
    assert.deepStrictEqual(data.returnDistribution, []);
    assert.deepStrictEqual(data.winLossRatio, []);
  });

  await t.test("generateChartData builds equity curve", () => {
    const service = new TradingHistoryService();
    service.addDecision(
      makeDecision({ confidence: 0.5, timestamp: "2024-01-01T00:00:00Z" }),
    );
    service.addDecision(
      makeDecision({ confidence: 0.3, timestamp: "2024-01-02T00:00:00Z" }),
    );

    const data = service.generateChartData();
    assert.strictEqual(data.equityCurve.length, 2);
    assert.strictEqual(data.winLossRatio.length, 1); // All wins
  });
});
