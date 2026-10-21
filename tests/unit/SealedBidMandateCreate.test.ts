import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-sb-mandate-${process.pid}-${Date.now()}.db`);
const creDir = fs.mkdtempSync(path.join(os.tmpdir(), "cognivern-sb-cre-"));
process.env.DB_PATH = dbPath;
process.env.CRE_RUNS_FILE = path.join(creDir, "cre-runs.jsonl");

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import(
  "@backend/services/governance/FundedMandateService.js"
);
const { buildSpendAttributionReport } = await import(
  "@backend/services/governance/SpendAttributionService.js"
);
const { creRunStore } = await import("@backend/cre/storage/CreRunStore.js");
const { SealedBidController } = await import(
  "@backend/modules/api/controllers/SealedBidController.js"
);
const { SealedBidService } = await import(
  "@backend/services/blockchain/SealedBidService.js"
);
const { sealedBidMandateLedger } = await import(
  "@backend/services/blockchain/sealed-bid/SealedBidMandateLedger.js"
);
const types = await import(
  "@backend/services/blockchain/sealed-bid/types.js"
);

const WORKSPACE = "workspace-sb-mandate";

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)",
  ).run("user-sb-mandate", now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-sb-mandate", now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
  ).run(WORKSPACE, "user-sb-mandate", now);
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

// Minimal settlement-capable backend so effectiveSettlementAmount survives —
// the FHE backend ignores settlement and would zero the attributed amount.
class FakeCantonBackend {
  readonly name = "canton" as const;
  private rounds = new Map<string, types.SealedBidRound>();
  supportsSettlement() {
    return true;
  }
  async createRound(
    request: types.CreateRoundRequest,
    manager: string,
  ): Promise<types.SealedBidRound> {
    const round: types.SealedBidRound = {
      roundId: `0x${randomUUID().replaceAll("-", "")}`,
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
    };
    this.rounds.set(round.roundId, round);
    return round;
  }
  async getRound(roundId: string) {
    return this.rounds.get(roundId) ?? null;
  }
  async listRounds() {
    return [...this.rounds.values()];
  }
  async submitBid(): Promise<never> {
    throw new Error("not implemented");
  }
  async closeRound(): Promise<never> {
    throw new Error("not implemented");
  }
  async revealWinner(): Promise<never> {
    throw new Error("not implemented");
  }
  async cancelRound(): Promise<never> {
    throw new Error("not implemented");
  }
  async withdrawBid(): Promise<never> {
    throw new Error("not implemented");
  }
}

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

function request(
  body: Record<string, unknown>,
  workspaceId?: string,
): Request {
  return {
    body,
    params: {},
    query: {},
    headers: {},
    header: () => undefined,
    workspaceId,
  } as unknown as Request;
}

function createController() {
  const service = new SealedBidService();
  service.registerBackend(new FakeCantonBackend() as never);
  const audit = { logEvent: () => Promise.resolve(undefined) };
  return {
    service,
    controller: new SealedBidController(service, audit as never),
  };
}

const ROUND_BODY = {
  description: "Mandated procurement",
  serviceCategory: "testing",
  deadline: new Date(Date.now() + 3600_000).toISOString(),
  maxBids: 5,
  backend: "canton",
};

function createMandate(authorizedAmount = "10000000") {
  return FundedMandateService.create(WORKSPACE, {
    name: "Procurement pilot",
    objective: "Buy vendor services",
    status: "active",
    budget: { byAsset: { USDC: { authorizedAmount } } },
  });
}

describe("SealedBidController.createRound — mandate linkage", () => {
  it("rejects without a workspace (401)", async () => {
    const { controller } = createController();
    const res = new MockResponse();
    await controller.createRound(
      request({ ...ROUND_BODY, mandateId: "mandate-x" }) as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(401);
    expect(res.payload).toEqual(
      expect.objectContaining({ success: false }),
    );
  });

  it("rejects an unknown mandate (404)", async () => {
    const { controller } = createController();
    const res = new MockResponse();
    await controller.createRound(
      request({ ...ROUND_BODY, mandateId: "mandate-missing" }, WORKSPACE) as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(404);
  });

  it("rejects over-budget and creates no round (400)", async () => {
    const mandate = createMandate("1000000"); // 1 USDC authorized
    const { service, controller } = createController();
    const res = new MockResponse();
    await controller.createRound(
      request(
        {
          ...ROUND_BODY,
          mandateId: mandate.id,
          settlementAmount: 5,
          settlementAssetTag: "USDC",
        },
        WORKSPACE,
      ) as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(400);
    // The mandate check runs before anything touches a ledger — no orphan round.
    expect(await service.listRounds()).toHaveLength(0);
  });

  it("creates a linked round and records the allocation", async () => {
    const mandate = createMandate("20000000"); // 20 USDC authorized
    const { service, controller } = createController();
    const res = new MockResponse();
    await controller.createRound(
      request(
        {
          ...ROUND_BODY,
          mandateId: mandate.id,
          settlementAmount: 5,
          settlementAssetTag: "USDC",
        },
        WORKSPACE,
      ) as Request,
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(201);
    const round = res.payload!.data as types.SealedBidRound;
    expect(round.mandateId).toBe(mandate.id);

    // The allocation lands in the same attribution report the mandate
    // statement aggregates.
    const runs = (await creRunStore.list()).filter(
      (run) => run.projectId === WORKSPACE,
    );
    const report = buildSpendAttributionReport(runs, mandate.id);
    expect(report.totalsByAsset.USDC.allocatedAmount).toBe("5000000");
    expect(report.records[0].status).toBe("allocated");
    expect(sealedBidMandateLedger.getLink(round.roundId)?.mandateId).toBe(
      mandate.id,
    );
  });
});
