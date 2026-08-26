import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SealedBidController } from "@backend/modules/api/controllers/SealedBidController.js";
import { SealedBidService } from "@backend/services/blockchain/SealedBidService.js";
import type { SealedBidBackend } from "@backend/services/blockchain/sealed-bid/SealedBidBackend.js";
import type {
  BidRecord,
  CreateRoundRequest,
  RevealRequest,
  SealedBidRound,
  SubmitBidRequest,
} from "@backend/services/blockchain/sealed-bid/types.js";

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

class TestCantonBackend implements SealedBidBackend {
  readonly name = "canton" as const;
  readonly rounds = new Map<string, SealedBidRound>();
  lastCreateRequest: CreateRoundRequest | undefined;

  constructor(private readonly settlementEnabled: boolean) {}

  supportsSettlement(): boolean {
    return this.settlementEnabled;
  }

  async createRound(
    request: CreateRoundRequest,
    manager: string,
  ): Promise<SealedBidRound> {
    this.lastCreateRequest = request;
    const round: SealedBidRound = {
      roundId: `test-round-${this.rounds.size + 1}`,
      description: request.description,
      serviceCategory: request.serviceCategory,
      manager,
      deadline: request.deadline,
      maxBids: request.maxBids,
      status: "open",
      bids: [],
      winner: null,
      winningBid: null,
      winningProposalHash: null,
      createdAt: new Date().toISOString(),
      backend: "canton",
      settlementAmount: request.settlementAmount ?? null,
      settlementAssetTag: request.settlementAssetTag ?? null,
    };
    this.rounds.set(round.roundId, round);
    return round;
  }

  async submitBid(_roundId: string, _request: SubmitBidRequest): Promise<BidRecord> {
    throw new Error("Not used by controller settlement tests");
  }

  async closeRound(_roundId: string, _caller: string): Promise<SealedBidRound> {
    throw new Error("Not used by controller settlement tests");
  }

  async revealWinner(_roundId: string, _request: RevealRequest): Promise<SealedBidRound> {
    throw new Error("Not used by controller settlement tests");
  }

  async getRound(roundId: string): Promise<SealedBidRound | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async listRounds(): Promise<SealedBidRound[]> {
    return [...this.rounds.values()];
  }
}

const baseBody = {
  description: "Security audit RFP",
  serviceCategory: "security-audit",
  deadline: "2026-09-01T12:00:00.000Z",
  maxBids: 3,
  backend: "canton" as const,
  settlementAmount: 50_000,
  settlementAssetTag: "USDC",
};

function request(
  workspaceMode: "sandbox" | "production",
  body = baseBody,
): Request {
  return {
    body,
    params: {},
    query: {},
    headers: { "x-workspace-mode": workspaceMode },
    header: () => undefined,
  } as unknown as Request;
}

function createController(settlementEnabled: boolean) {
  const backend = new TestCantonBackend(settlementEnabled);
  const service = new SealedBidService();
  service.registerBackend(backend);
  const audit = { logEvent: vi.fn().mockResolvedValue(undefined) };
  const controller = new SealedBidController(service, audit as never);
  return { backend, controller };
}

describe("SealedBidController settlement safeguards", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns 409 before creating a round in Production without PaymentDeposit", async () => {
    const { backend, controller } = createController(false);
    const response = new MockResponse();

    await controller.createRound(
      request("production") as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(409);
    expect(response.payload).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("PaymentDeposit"),
      }),
    );
    expect(backend.lastCreateRequest).toBeUndefined();
  });

  it("strips settlement fields safely in Demo/Sandbox without PaymentDeposit", async () => {
    const { backend, controller } = createController(false);
    const response = new MockResponse();

    await controller.createRound(
      request("sandbox") as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(201);
    expect(backend.lastCreateRequest).toEqual(
      expect.not.objectContaining({
        settlementAmount: expect.anything(),
        settlementAssetTag: expect.anything(),
      }),
    );
    expect(response.payload?.data).toEqual(
      expect.objectContaining({
        settlementAmount: null,
        settlementAssetTag: null,
      }),
    );
  });

  it("passes settlement through in Production when PaymentDeposit is configured", async () => {
    const { backend, controller } = createController(true);
    const response = new MockResponse();

    await controller.createRound(
      request("production") as Request,
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(201);
    expect(backend.lastCreateRequest).toEqual(
      expect.objectContaining({
        settlementAmount: 50_000,
        settlementAssetTag: "USDC",
      }),
    );
    expect(response.payload?.data).toEqual(
      expect.objectContaining({
        settlementAmount: 50_000,
        settlementAssetTag: "USDC",
      }),
    );
  });

  it("reports workspace mode and settlement capability without creating a round", async () => {
    const { controller } = createController(true);
    const productionResponse = new MockResponse();
    const sandboxResponse = new MockResponse();

    await controller.getCapabilities(
      request("production") as Request,
      productionResponse as unknown as Response,
    );
    await controller.getCapabilities(
      request("sandbox") as Request,
      sandboxResponse as unknown as Response,
    );

    expect(productionResponse.payload?.data).toEqual(
      expect.objectContaining({
        workspaceMode: "production",
        backend: "canton",
        backendConfigured: true,
        settlementSupported: true,
      }),
    );
    expect(sandboxResponse.payload?.data).toEqual(
      expect.objectContaining({
        workspaceMode: "sandbox",
        settlementSupported: false,
      }),
    );
  });
});
