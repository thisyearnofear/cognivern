import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";

const listMock = vi.fn();
const verifyChainMock = vi.fn();
const latestRunHashesMock = vi.fn();
const zeroGVerifyDetailedMock = vi.fn();
const filecoinVerifyDetailedMock = vi.fn();

vi.mock("@backend/cre/storage/CreRunStore.js", () => ({
  creRunStore: {
    list: (...a: unknown[]) => listMock(...a),
  },
}));

vi.mock("@backend/cre/persistence/CreLedgerChain.js", () => ({
  creLedgerChain: {
    verify: (...a: unknown[]) => verifyChainMock(...a),
    latestRunHashes: (...a: unknown[]) => latestRunHashesMock(...a),
  },
  // Keep the run "chained" (not tampered): hash equals the map value.
  hashRun: (run: { runId: string }) =>
    run.runId === "run-1" ? "h1" : "h2",
}));

vi.mock("@backend/services/blockchain/ZeroGStorageService.js", () => ({
  zeroGStorageService: {
    verifyDetailed: (...a: unknown[]) => zeroGVerifyDetailedMock(...a),
  },
}));

vi.mock("@backend/services/blockchain/FilecoinStorageService.js", () => ({
  filecoinStorageService: {
    verifyDetailed: (...a: unknown[]) => filecoinVerifyDetailedMock(...a),
  },
}));

vi.mock("@backend/services/blockchain/OwsWalletService.js", () => ({
  owsWalletService: {},
}));

vi.mock("@backend/cre/workflows/forecasting.js", () => ({
  runForecastingWorkflow: vi.fn(),
}));

vi.mock("@backend/utils/logger.js", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { CreController } from "@backend/modules/api/controllers/CreController.js";

interface CapturedResponse {
  statusCode: number;
  body: any;
}

function makeRes(): { res: Response; captured: CapturedResponse } {
  const captured: CapturedResponse = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, captured };
}

function makeReq(query: Record<string, unknown>): Request {
  return { query, params: {}, headers: {} } as unknown as Request;
}

const controller = new CreController();

beforeEach(() => {
  listMock.mockReset();
  verifyChainMock.mockReset();
  latestRunHashesMock.mockReset();
  zeroGVerifyDetailedMock.mockReset();
  filecoinVerifyDetailedMock.mockReset();

  verifyChainMock.mockResolvedValue({
    valid: true,
    entries: 2,
    headHash: "0xhead",
  });
  latestRunHashesMock.mockResolvedValue(
    new Map([
      ["run-1", "h1"],
      ["run-2", "h2"],
    ]),
  );
});

describe("CreController.verifyLedger deep anchor verification", () => {
  it("omits anchors and stays valid when deep is not requested", async () => {
    listMock.mockResolvedValue([
      {
        runId: "run-1",
        evidence: {
          zeroGRootHash: "0xroot",
          zeroGLocalHash: "localhash",
        },
      },
    ]);
    const { res, captured } = makeRes();
    await controller.verifyLedger(makeReq({}), res);

    expect(captured.body.success).toBe(true);
    expect(captured.body.valid).toBe(true);
    expect(captured.body.anchors).toBeUndefined();
    expect(captured.body.anchorSummary).toBeUndefined();
    expect(zeroGVerifyDetailedMock).not.toHaveBeenCalled();
  });

  it("verifies anchors and stays valid when all anchors match", async () => {
    listMock.mockResolvedValue([
      {
        runId: "run-1",
        evidence: {
          zeroGRootHash: "0xroot",
          zeroGLocalHash: "localhash",
          filecoinCid: "sha256:fchash",
          filecoinActionId: "0xaction",
        },
      },
    ]);
    zeroGVerifyDetailedMock.mockResolvedValue({
      status: "verified",
      actual: "localhash",
    });
    filecoinVerifyDetailedMock.mockResolvedValue({
      status: "verified",
      actual: "sha256:fchash",
    });

    const { res, captured } = makeRes();
    await controller.verifyLedger(makeReq({ deep: "true" }), res);

    expect(captured.body.valid).toBe(true);
    expect(captured.body.anchorSummary).toMatchObject({
      checked: 2,
      verified: 2,
      mismatch: 0,
    });
    // Filecoin verify gets the expected hash with the sha256: prefix stripped.
    expect(filecoinVerifyDetailedMock).toHaveBeenCalledWith(
      "0xaction",
      "fchash",
    );
  });

  it("fails the ledger when an anchor content-mismatches (real tamper)", async () => {
    listMock.mockResolvedValue([
      {
        runId: "run-1",
        evidence: { zeroGRootHash: "0xroot", zeroGLocalHash: "localhash" },
      },
    ]);
    zeroGVerifyDetailedMock.mockResolvedValue({
      status: "mismatch",
      actual: "otherhash",
      expected: "localhash",
    });

    const { res, captured } = makeRes();
    await controller.verifyLedger(makeReq({ deep: "1" }), res);

    expect(captured.body.valid).toBe(false);
    expect(captured.body.anchorSummary.mismatch).toBe(1);
  });

  it("treats a network miss as unavailable, not a failure", async () => {
    listMock.mockResolvedValue([
      {
        runId: "run-1",
        evidence: { zeroGRootHash: "0xroot", zeroGLocalHash: "localhash" },
      },
    ]);
    zeroGVerifyDetailedMock.mockResolvedValue({ status: "unavailable" });

    const { res, captured } = makeRes();
    await controller.verifyLedger(makeReq({ deep: "true" }), res);

    expect(captured.body.valid).toBe(true);
    expect(captured.body.anchorSummary.unavailable).toBe(1);
    expect(captured.body.anchorSummary.mismatch).toBe(0);
  });

  it("skips anchors whose retrieval key/expected hash was never persisted", async () => {
    listMock.mockResolvedValue([
      {
        runId: "run-1",
        evidence: {
          // zeroGRootHash present but no zeroGLocalHash → can't verify
          zeroGRootHash: "0xroot",
          // filecoinCid present but no filecoinActionId → can't verify
          filecoinCid: "sha256:fchash",
        },
      },
    ]);

    const { res, captured } = makeRes();
    await controller.verifyLedger(makeReq({ deep: "true" }), res);

    expect(captured.body.valid).toBe(true);
    expect(captured.body.anchorSummary).toMatchObject({
      checked: 2,
      verified: 0,
      mismatch: 0,
      skipped: 2,
    });
    expect(zeroGVerifyDetailedMock).not.toHaveBeenCalled();
    expect(filecoinVerifyDetailedMock).not.toHaveBeenCalled();
    const entry = captured.body.anchors.find(
      (a: { runId: string }) => a.runId === "run-1",
    );
    expect(entry.zeroG).toBe("no_expected_hash");
    expect(entry.filecoin).toBe("no_retrieval_key");
  });
});
