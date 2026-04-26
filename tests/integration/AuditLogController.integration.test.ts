import test from "node:test";
import assert from "node:assert/strict";

const { AuditLogController } = await import(
  "../../src/modules/api/controllers/AuditLogController.js"
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

function makeReq(body: any = {}) {
  return { body } as any;
}

test("AuditLogController.issuePermit returns permit payload", async () => {
  const controller = new AuditLogController();
  const res = new MockRes();

  const originalIssue = owsWalletService.issueAuditPermit;
  owsWalletService.issueAuditPermit = (async () => "0xabc123") as any;

  try {
    await controller.issuePermit(
      makeReq({
        auditor: "0xAuditor",
        policyId: "policy-confidential",
      }),
      res as any,
    );
  } finally {
    owsWalletService.issueAuditPermit = originalIssue;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.success, true);
  assert.equal(res.payload?.data?.permit, "0xabc123");
});

test("AuditLogController.issuePermit validates payload", async () => {
  const controller = new AuditLogController();
  const res = new MockRes();

  await controller.issuePermit(makeReq({ policyId: "missing-auditor" }), res as any);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload?.success, false);
});
