import { describe, it, expect } from "vitest";
import { SapienceService } from "../../src/backend/services/SapienceService.js";

describe("SapienceService", () => {
  it("should initialize with default config", () => {
    const service = new SapienceService();
    expect(service.getAddress()).toBeTruthy();
  });

  it("should accept custom config", () => {
    const service = new SapienceService({
      arbitrumRpcUrl: "https://custom-rpc.example.com",
      etherealRpcUrl: "https://custom-ethereal.example.com",
    });
    expect(service.getAddress()).toBeTruthy();
  });

  it("calculateEdge returns positive for YES advantage", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(80, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "1000",
    });
    expect(Math.abs(edge - 0.3) < 1e-10).toBeTruthy();
  });

  it("calculateEdge returns negative for NO advantage", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(20, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "1000",
    });
    expect(Math.abs(edge - -0.3) < 1e-10).toBeTruthy();
  });

  it("calculateEdge returns zero for fair market", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(50, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "1000",
    });
    expect(Math.abs(edge) < 1e-10).toBeTruthy();
  });

  it("calculateEdge handles edge case with no liquidity", () => {
    const service = new SapienceService();
    const edge = service.calculateEdge(70, {
      yesPrice: 0.5,
      noPrice: 0.5,
      liquidity: "0",
    });
    expect(Math.abs(edge - 0.2) < 1e-10).toBeTruthy();
  });
});
