import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";

const previewSpendMock = vi.fn();
const executeSpendMock = vi.fn();

vi.mock("@backend/services/blockchain/OwsWalletService.js", () => ({
  owsWalletService: {
    previewSpend: (...args: unknown[]) => previewSpendMock(...args),
    executeSpend: (...args: unknown[]) => executeSpendMock(...args),
  },
}));

vi.mock("@backend/services/blockchain/FhenixPolicyService.js", () => ({
  sharedFhenixPolicyService: {},
}));

vi.mock("@backend/services/blockchain/FlareConfidentialPolicyService.js", () => ({
  isFlareEvaluatorEnabled: () => false,
  sharedFlareConfidentialPolicyService: { status: () => ({}) },
}));

vi.mock("@backend/services/blockchain/confidentialEvaluator.ts", () => ({
  getConfidentialPolicyService: () => ({
    evaluateEncrypted: vi.fn(),
  }),
}));

vi.mock("@backend/services/blockchain/confidentialEvaluator.js", () => ({
  getConfidentialPolicyService: () => ({
    evaluateEncrypted: vi.fn(),
  }),
}));

vi.mock("@backend/services/ai/ChainGPTAuditService.js", () => ({
  getChainGPTAuditService: () => null,
}));

import { SpendController } from "@backend/modules/api/controllers/SpendController.js";

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

function makeReq(body: Record<string, unknown>): Request {
  return { body, headers: {}, params: {} } as unknown as Request;
}

const basePayload = {
  agentId: "agent-1",
  recipient: "vendor.example",
  amount: "1000000000000000000",
  asset: "USDe",
  reason: "unit test spend",
};

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  previewSpendMock.mockReset();
  executeSpendMock.mockReset();
  previewSpendMock.mockResolvedValue({
    status: "approved",
    reason: "within limits",
    simulation: { wouldExecute: true, warnings: [] },
  });
  executeSpendMock.mockResolvedValue({
    intentId: "spend_x",
    status: "approved",
  });
  delete process.env.COGNIVERN_HUMAN_CONFIRM_TOKEN;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function getPreviewAttestation(
  controller: SpendController,
  payload = basePayload,
): Promise<string> {
  const { res, captured } = makeRes();
  await controller.previewSpend(makeReq(payload), res);
  return captured.body.data.attestationHash;
}

describe("SpendController preview→execute attestation binding", () => {
  it("preview mints an attestationHash for non-denied intents", async () => {
    const controller = new SpendController();
    const hash = await getPreviewAttestation(controller);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("preview omits the attestationHash for denied intents", async () => {
    previewSpendMock.mockResolvedValue({
      status: "denied",
      reason: "over limit",
      simulation: { wouldExecute: false, warnings: [] },
    });
    const controller = new SpendController();
    const { res, captured } = makeRes();
    await controller.previewSpend(makeReq(basePayload), res);
    expect(captured.body.data.attestationHash).toBeUndefined();
  });

  it("executes when the attestationHash matches the previewed intent", async () => {
    const controller = new SpendController();
    const attestationHash = await getPreviewAttestation(controller);

    const { res, captured } = makeRes();
    await controller.requestSpend(
      makeReq({ ...basePayload, attestationHash }),
      res,
    );

    expect(captured.statusCode).toBe(200);
    expect(executeSpendMock).toHaveBeenCalledTimes(1);
    const intent = executeSpendMock.mock.calls[0][0];
    expect(intent.metadata.attestation).toEqual({
      provided: true,
      verified: true,
    });
  });

  it("rejects execution with 403 when the intent was tampered after preview", async () => {
    const controller = new SpendController();
    const attestationHash = await getPreviewAttestation(controller);

    const { res, captured } = makeRes();
    await controller.requestSpend(
      makeReq({
        ...basePayload,
        amount: "9000000000000000000000", // tampered
        attestationHash,
      }),
      res,
    );

    expect(captured.statusCode).toBe(403);
    expect(captured.body.success).toBe(false);
    expect(executeSpendMock).not.toHaveBeenCalled();
  });

  it("records an unverified human confirmation when the token is self-minted", async () => {
    process.env.COGNIVERN_HUMAN_CONFIRM_TOKEN = "real-operator-token";
    const controller = new SpendController();

    const { res } = makeRes();
    await controller.requestSpend(
      makeReq({
        ...basePayload,
        humanConfirmationToken: "auto-confirm-1234567890",
      }),
      res,
    );

    const intent = executeSpendMock.mock.calls[0][0];
    expect(intent.metadata.humanConfirmation).toEqual({
      provided: true,
      verified: false,
    });
    // The raw token is a claim; it must never be persisted.
    expect(JSON.stringify(intent)).not.toContain("auto-confirm-1234567890");
  });

  it("records a verified human confirmation only for the configured token", async () => {
    process.env.COGNIVERN_HUMAN_CONFIRM_TOKEN = "real-operator-token";
    const controller = new SpendController();

    const { res } = makeRes();
    await controller.requestSpend(
      makeReq({
        ...basePayload,
        humanConfirmationToken: "real-operator-token",
      }),
      res,
    );

    const intent = executeSpendMock.mock.calls[0][0];
    expect(intent.metadata.humanConfirmation).toEqual({
      provided: true,
      verified: true,
    });
  });
});

describe("SpendController confirmDecision", () => {
  it("refuses with 501 and points at the canonical CRE approval endpoint", async () => {
    const controller = new SpendController();
    const { res, captured } = makeRes();
    const req = {
      body: { action: "confirm" },
      headers: {},
      params: { decisionId: "run-123" },
    } as unknown as Request;

    await controller.confirmDecision(req, res);

    expect(captured.statusCode).toBe(501);
    expect(captured.body.success).toBe(false);
    expect(captured.body.canonicalEndpoint).toBe(
      "/api/cre/runs/run-123/approval",
    );
  });
});
