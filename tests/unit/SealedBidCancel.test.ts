import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { SealedBidController } from "@backend/modules/api/controllers/SealedBidController.js";
import { SealedBidService } from "@backend/services/blockchain/SealedBidService.js";

class MockResponse {
  statusCode = 200;
  payload: Record<string, unknown> | undefined;
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(payload: Record<string, unknown>) {
    this.payload = payload;
    return this;
  }
}

function request(roundId: string, manager?: string): Request {
  return {
    body: manager ? { manager } : {},
    params: { roundId },
    query: {},
    headers: {},
    header: () => undefined,
  } as unknown as Request;
}

function createController() {
  const service = new SealedBidService();
  const audit = { logEvent: () => Promise.resolve(undefined) };
  return {
    service,
    controller: new SealedBidController(service, audit as never),
  };
}

describe("SealedBidController.cancelRound", () => {
  it("returns 404 for an unknown round", async () => {
    const { controller } = createController();
    const res = new MockResponse();
    await controller.cancelRound(request("0xmissing") as Request, res as unknown as Response);
    expect(res.statusCode).toBe(404);
  });

  it("cancels an open round (FHE backend path)", async () => {
    const { service, controller } = createController();
    const round = await service.createRound(
      {
        description: "Cancel me",
        serviceCategory: "testing",
        deadline: new Date(Date.now() + 3600_000).toISOString(),
        maxBids: 5,
      },
      "demo-manager",
    );

    const res = new MockResponse();
    await controller.cancelRound(
      request(round.roundId, "demo-manager") as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect((res.payload as { data: { status: string } }).data.status).toBe("cancelled");
  });

  it("rejects a second cancel", async () => {
    const { service, controller } = createController();
    const round = await service.createRound(
      {
        description: "Cancel twice",
        serviceCategory: "testing",
        deadline: new Date(Date.now() + 3600_000).toISOString(),
        maxBids: 5,
      },
      "demo-manager",
    );
    await service.cancelRound(round.roundId, "demo-manager");

    const res = new MockResponse();
    await controller.cancelRound(
      request(round.roundId, "demo-manager") as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual(expect.objectContaining({ success: false }));
  });
});
