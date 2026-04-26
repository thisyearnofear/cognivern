import test from "node:test";
import assert from "node:assert/strict";

const { SpendController } = await import(
  "../../src/modules/api/controllers/SpendController.js"
);
const { owsWalletService } = await import("../../src/services/OwsWalletService.js");

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

test("SpendController.requestEncryptedSpend forwards confidential context", async () => {
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

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.success, true);
  assert.equal(capturedContext?.confidential, true);
  assert.equal(capturedContext?.encryptedAmount, "0xdeadbeef");
  assert.equal(capturedContext?.vendorHash, "0x1234");
  assert.equal(capturedContext?.apiKeyToken, "ows_tok_123");
  assert.equal(capturedIntent?.metadata?.encryptedAmount, "0xdeadbeef");
});

test("SpendController.requestEncryptedSpend validates payload", async () => {
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

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload?.success, false);
});
