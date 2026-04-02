import test from "node:test";
import assert from "node:assert";
import { SapienceService } from "../../src/services/SapienceService.js";

test("SapienceService", async (t) => {
  await t.test("should initialize with default config", () => {
    const service = new SapienceService();
    assert.ok(service.getAddress());
  });

  await t.test("should accept custom config", () => {
    const service = new SapienceService({
      arbitrumRpcUrl: "https://custom-rpc.example.com",
      etherealRpcUrl: "https://custom-ethereal.example.com",
    });
    assert.ok(service.getAddress());
  });

  await t.test("calculateEdge returns positive for YES advantage", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(80, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "1000",
    });
    assert.ok(Math.abs(edge - 0.3) < 1e-10);
  });

  await t.test("calculateEdge returns negative for NO advantage", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(20, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "1000",
    });
    assert.ok(Math.abs(edge - -0.3) < 1e-10);
  });

  await t.test("calculateEdge returns zero for fair market", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(50, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "1000",
    });
    assert.ok(Math.abs(edge) < 1e-10);
  });

  await t.test("calculateEdge handles edge case with no liquidity", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(70, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "0",
    });
    assert.ok(Math.abs(edge - 0.2) < 1e-10);
  });
});
