import { describe, it, expect } from "vitest";

const { SpendController } = await import(
  "../../src/backend/modules/api/controllers/SpendController.js"
);
const { owsWalletService } = await import(
  "../../src/backend/services/OwsWalletService.js"
);

class MockRes {
  statusCode = 200;
  payload: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: any) {
    this.payload = body;
    return this;
  }
}

function makeReq(body: any, headers: Record<string, string> = {}) {
  return {
    body,
    headers,
  } as any;
}

describe("SpendController", () => {
  it("requestEncryptedSpend forwards confidential context", async () => {
    const controller = new SpendController();
    const res = new MockRes();

    const originalExecuteSpend = owsWalletService.executeSpend;
    let capturedContext: any;
    let capturedIntent: any;

    owsWalletService.executeSpend = (async (intent: any, context: any) => {
      capturedIntent = intent;
      capturedContext = context;
      return {
        intentId: intent.id,
        status: "denied",
        policyId: "spend-policy",
        reason: "Confidential policy denied this spend.",
      };
    }) as any;

    try {
      await controller.requestEncryptedSpend(
        makeReq(
          {
            agentId: "agent-1",
            recipient: "0xabc",
            amount: "1000000000000000000",
            asset: "ETH",
            reason: "Vendor payment",
            encryptedAmount: "0xdeadbeef",
            vendorHash: "0x1234",
          },
          { "x-ows-scoped-access": "ows_tok_123" },
        ),
        res as any,
      );
    } finally {
      owsWalletService.executeSpend = originalExecuteSpend;
    }

    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(capturedContext?.confidential).toBe(true);
    expect(capturedContext?.encryptedAmount).toBe("0xdeadbeef");
    expect(capturedContext?.vendorHash).toBe("0x1234");
    expect(capturedContext?.apiKeyToken).toBe("ows_tok_123");
    expect(capturedIntent?.metadata?.encryptedAmount).toBe("0xdeadbeef");
  });

  it("requestEncryptedSpend validates payload", async () => {
    const controller = new SpendController();
    const res = new MockRes();

    await controller.requestEncryptedSpend(
      makeReq({
        agentId: "agent-1",
        recipient: "0xabc",
        amount: "100",
        asset: "ETH",
        reason: "Missing encrypted amount",
      }),
      res as any,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload?.success).toBe(false);
  });
});
