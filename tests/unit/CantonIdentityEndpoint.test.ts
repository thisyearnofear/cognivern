import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SealedBidController } from "@backend/modules/api/controllers/SealedBidController.js";
import { SealedBidService } from "@backend/services/blockchain/SealedBidService.js";
import { sharedWalletPartyRegistry } from "@backend/canton/WalletPartyRegistry.js";

vi.mock("@backend/canton/WalletPartyRegistry.js", () => ({
  sharedWalletPartyRegistry: { hasPool: vi.fn(), assign: vi.fn() },
}));

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

function request(walletAddress?: string): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    walletAddress,
    header: () => undefined,
  } as unknown as Request;
}

function createController() {
  const service = new SealedBidService();
  const audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
  return new SealedBidController(service, audit as never);
}

const registry = vi.mocked(sharedWalletPartyRegistry);

describe("SealedBidController.getCantonIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the request has no wallet JWT", async () => {
    const controller = createController();
    const response = new MockResponse();

    await controller.getCantonIdentity(
      request() as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.payload).toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(registry.assign).not.toHaveBeenCalled();
  });

  it("returns 503 when no Canton institution pool is configured", async () => {
    registry.hasPool.mockReturnValue(false);
    const controller = createController();
    const response = new MockResponse();

    await controller.getCantonIdentity(
      request("0xABCdef0000000000000000000000000000000001") as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(503);
    expect(response.payload).toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(registry.assign).not.toHaveBeenCalled();
  });

  it("returns the assigned Canton party for the authenticated wallet", async () => {
    registry.hasPool.mockReturnValue(true);
    registry.assign.mockResolvedValue("meridian-cognivern");
    const controller = createController();
    const response = new MockResponse();

    await controller.getCantonIdentity(
      request("0xABCdef0000000000000000000000000000000001") as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(200);
    expect(registry.assign).toHaveBeenCalledWith(
      "0xABCdef0000000000000000000000000000000001",
    );
    expect(response.payload).toEqual({
      success: true,
      data: {
        walletAddress: "0xabcdef0000000000000000000000000000000001",
        party: "meridian-cognivern",
        backendConfigured: false,
      },
    });
  });
});
