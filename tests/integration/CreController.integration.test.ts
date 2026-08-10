import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";

process.env.CRE_RUNS_FILE = path.join(
  os.tmpdir(),
  `cognivern-cre-runs-${Date.now()}.jsonl`,
);
process.env.IDEMPOTENCY_STORE_FILE = path.join(
  os.tmpdir(),
  `cognivern-idempotency-${Date.now()}.json`,
);
process.env.UX_EVENTS_FILE = path.join(
  os.tmpdir(),
  `cognivern-ux-events-${Date.now()}.jsonl`,
);
// Isolate the vault for the spend-workflow tests below. These vars must be set
// BEFORE any module import so the vault singleton picks them up.
process.env.OWS_VAULT_PATH = path.join(
  os.tmpdir(),
  `cognivern-vault-${Date.now()}.json`,
);
process.env.OWS_VAULT_SECRET = "test-vault-secret-controller-integration";
// Keep offline: empty MONGODB_URI → JSONL-only run store; empty
// XLAYER_PRIVATE_KEY → recordOnChainApproval short-circuits.
process.env.MONGODB_URI = "";
process.env.XLAYER_PRIVATE_KEY = "";

const { CreController } = await import(
  "../../src/backend/modules/api/controllers/CreController.js"
);
const { creRunStore } = await import(
  "../../src/backend/cre/storage/CreRunStore.js"
);
const { owsLocalVaultService } = await import(
  "../../src/backend/services/blockchain/OwsLocalVaultService.js"
);
const { owsWalletService } = await import(
  "../../src/backend/services/blockchain/OwsWalletService.js"
);
const { keeperHubExecutionProvider } = await import(
  "../../src/backend/services/blockchain/KeeperHubExecutionProvider.js"
);

type MockReq = {
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  body: any;
  headers: Record<string, string | undefined>;
  header: (name: string) => string | undefined;
  on: (event: string, handler: () => void) => void;
};

class MockRes {
  statusCode = 200;
  payload: any = null;
  chunks: string[] = [];
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(body: any) {
    this.payload = body;
    return this;
  }
  setHeader(_k: string, _v: string) {}
  flushHeaders() {}
  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }
  end() {}
}

function makeReq(overrides: Partial<MockReq> = {}): MockReq {
  const headers = overrides.headers || {};
  const emitter = new EventEmitter();
  const req = {
    params: overrides.params || {},
    query: overrides.query || {},
    body: overrides.body || {},
    headers,
    header: (name: string) => headers[name] || headers[name.toLowerCase()],
    on: (event: string, handler: () => void) => {
      emitter.on(event, handler);
      if (event === "close" && (overrides as any).__triggerClose) {
        setImmediate(() => emitter.emit("close"));
      }
    },
  };
  // Default workspaceId matches the default projectId in makeRun ("default")
  // so ownership checks pass. Individual tests can override.
  (req as any).workspaceId = (overrides as any).workspaceId ?? "default";
  (req as any).userId = (overrides as any).userId ?? undefined;
  return req;
}

function makeRun(
  status: "running" | "paused_for_approval" | "failed" = "running",
) {
  const runId = crypto.randomUUID();
  const now = Date.now();
  const startedAt = new Date(now - 10_000).toISOString();
  const event1Ts = new Date(now - 9000).toISOString();
  const event2Ts = new Date(now - 8000).toISOString();
  return {
    runId,
    projectId: "default",
    workflow: "forecasting" as const,
    mode: "local" as const,
    startedAt,
    ok: status === "failed" ? false : true,
    status,
    approvalState:
      status === "paused_for_approval" ? "pending" : "not_required",
    requiresApproval: status === "paused_for_approval",
    steps: [
      {
        kind: "http",
        name: "fetch",
        startedAt,
        finishedAt: event1Ts,
        ok: true,
      },
    ],
    artifacts: [],
    plan: {
      version: 1,
      updatedAt: startedAt,
      summary: "Test plan",
      steps: [
        {
          id: "p1",
          title: "Step 1",
          enabled: true,
          status: "pending" as const,
        },
        {
          id: "p2",
          title: "Step 2",
          enabled: true,
          status: "pending" as const,
        },
      ],
    },
    events: [
      {
        id: crypto.randomUUID(),
        runId,
        type: "run_started" as const,
        timestamp: event1Ts,
      },
      {
        id: crypto.randomUUID(),
        runId,
        type: "tool_result" as const,
        timestamp: event2Ts,
      },
    ],
  };
}

beforeEach(async () => {
  await creRunStore.reset();
});

afterAll(async () => {
  const files = [
    process.env.CRE_RUNS_FILE!,
    process.env.IDEMPOTENCY_STORE_FILE!,
    process.env.UX_EVENTS_FILE!,
  ];
  for (const file of files) {
    try {
      await fs.promises.unlink(file);
    } catch {
      // ignore
    }
  }
});

describe("CreController", () => {
  it("updateRunPlan moves running run to paused_for_approval", async () => {
    const run = makeRun("running");
    await creRunStore.add(run as any);
    const controller = new CreController();

    const req = makeReq({
      params: { runId: run.runId },
      body: {
        plan: {
          version: 2,
          summary: "Updated",
          steps: [
            { id: "p1", title: "Step 1", enabled: true, status: "pending" },
            { id: "p2", title: "Step 2", enabled: false, status: "pending" },
          ],
        },
      },
    });
    const res = new MockRes();
    await controller.updateRunPlan(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.run?.status).toBe("paused_for_approval");
    expect(res.payload?.run?.plan?.version).toBe(2);
  });

  it("submitApproval approve marks plan steps approved/rejected and completes run", async () => {
    const run = makeRun("paused_for_approval");
    await creRunStore.add(run as any);
    const controller = new CreController();

    const req = makeReq({
      params: { runId: run.runId },
      body: { approve: true, reason: "ok" },
    });
    const res = new MockRes();
    await controller.submitApproval(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.run?.status).toBe("completed");
    const statuses = (res.payload?.run?.plan?.steps || []).map(
      (s: any) => s.status,
    );
    expect(statuses).toEqual(["approved", "approved"]);
  });

  it("submitApproval idempotency key returns cached response", async () => {
    const run = makeRun("paused_for_approval");
    await creRunStore.add(run as any);
    const controller = new CreController();
    const headers = { "Idempotency-Key": "same-key-1" };

    const req1 = makeReq({
      params: { runId: run.runId },
      headers,
      body: { approve: true, reason: "idempotent-check" },
    });
    const res1 = new MockRes();
    await controller.submitApproval(req1 as any, res1 as any);
    expect(res1.statusCode).toBe(200);
    const status1 = res1.payload?.run?.status;
    expect(status1).toBe("completed");

    const req2 = makeReq({
      params: { runId: run.runId },
      headers,
      body: { approve: false, reason: "should-not-apply" },
    });
    const res2 = new MockRes();
    await controller.submitApproval(req2 as any, res2 as any);
    expect(res2.statusCode).toBe(200);
    expect(res2.payload?.run?.status).toBe(status1);
  });

  it("submitApproval (spend workflow) broadcasts native transfer on approve", async () => {
    const { OwsWalletService } = await import(
      "../../src/backend/services/blockchain/OwsWalletService.js"
    );
    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );

    // Reset the vault file to a clean state for this test.
    fs.writeFileSync(
      process.env.OWS_VAULT_PATH!,
      JSON.stringify({ version: 1, wallets: [], apiKeys: [], agents: [] }),
    );
    const wallet = await owsLocalVaultService.importWallet({
      name: "Treasury",
      privateKey:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    });
    const access = await owsLocalVaultService.resolveAccess({
      apiKeyToken: (
        await owsLocalVaultService.createApiKey({
          name: "scoped",
          walletIds: [wallet.id],
          policyIds: [],
        })
      ).token,
    });

    const sendSpy = vi
      .spyOn(owsLocalVaultService, "sendNativeTransfer")
      .mockResolvedValue({ txHash: "0x" + "c".repeat(64), from: wallet.accounts[0].address });

    // Build a held spend run via the real handleHold path so artifacts match
    // the production shape (spend_intent + error with walletId/policyId).
    const service = new OwsWalletService();
    const verifySpy = vi.spyOn(OwsWalletService.prototype as any, "verifyTransferReceipt").mockResolvedValue({ outcome: "verified" });
    const intent = {
      id: "intent-ctrl-1",
      agentId: "agent-1",
      recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: "4242",
      asset: "OKB",
      reason: "controller test",
      timestamp: new Date().toISOString(),
    };
    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre", projectId: "default" });
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      recorder,
      "needs review",
      "policy-ctrl-1",
      access,
    );

    const controller = new CreController();
    sendSpy.mockClear();
    const req = makeReq({
      params: { runId: held.runId },
      body: { approve: true, reason: "operator approves" },
    });
    (req as any).userId = "operator-int-1";
    const res = new MockRes();
    await controller.submitApproval(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(res.payload?.run?.status).toBe("completed");
    expect(res.payload?.transfer?.transferStatus).toBe("sent");
    expect(res.payload?.transfer?.transferTxHash).toBe("0x" + "c".repeat(64));
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].operatorApproved).toBe(true);
    expect(sendSpy.mock.calls[0][0].valueWei).toBe(4242n);
    sendSpy.mockRestore();
    verifySpy.mockRestore();
  });

  it("submitApproval (spend workflow) leaves run paused + returns error when transfer fails", async () => {
    const { OwsWalletService } = await import(
      "../../src/backend/services/blockchain/OwsWalletService.js"
    );
    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );

    fs.writeFileSync(
      process.env.OWS_VAULT_PATH!,
      JSON.stringify({ version: 1, wallets: [], apiKeys: [], agents: [] }),
    );
    const wallet = await owsLocalVaultService.importWallet({
      name: "Treasury",
      privateKey:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    });
    const access = await owsLocalVaultService.resolveAccess({
      apiKeyToken: (
        await owsLocalVaultService.createApiKey({
          name: "scoped",
          walletIds: [wallet.id],
          policyIds: [],
        })
      ).token,
    });

    const sendSpy = vi
      .spyOn(owsLocalVaultService, "sendNativeTransfer")
      .mockResolvedValue({ error: "insufficient gas funds" });

    const service = new OwsWalletService();
    const verifySpy = vi.spyOn(OwsWalletService.prototype as any, "verifyTransferReceipt").mockResolvedValue({ outcome: "verified" });
    const intent = {
      id: "intent-ctrl-2",
      agentId: "agent-1",
      recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: "999",
      asset: "OKB",
      reason: "controller failure test",
      timestamp: new Date().toISOString(),
    };
    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre", projectId: "default" });
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      recorder,
      "needs review",
      "policy-ctrl-2",
      access,
    );

    const controller = new CreController();
    sendSpy.mockClear();
    const req = makeReq({
      params: { runId: held.runId },
      body: { approve: true, reason: "operator approves" },
    });
    (req as any).userId = "operator-int-2";
    const res = new MockRes();
    await controller.submitApproval(req as any, res as any);

    expect(res.payload?.success).toBe(false);
    expect(res.payload?.error).toMatch(/insufficient gas funds/);
    expect(res.payload?.transfer?.transferStatus).toBe("failed");
    expect(res.payload?.transfer?.transferTxHash).toBeUndefined();
    // Held run must remain retryable (status not flipped to "failed").
    const persisted = await creRunStore.get(held.runId);
    expect(persisted?.status).toBe("paused_for_approval");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    sendSpy.mockRestore();
    verifySpy.mockRestore();
  });

  it("submitApproval (spend workflow) refuses approve without operator userId", async () => {
    const { OwsWalletService } = await import(
      "../../src/backend/services/blockchain/OwsWalletService.js"
    );
    const { CreRunRecorder } = await import(
      "../../src/backend/cre/runRecorder.js"
    );

    fs.writeFileSync(
      process.env.OWS_VAULT_PATH!,
      JSON.stringify({ version: 1, wallets: [], apiKeys: [], agents: [] }),
    );
    const wallet = await owsLocalVaultService.importWallet({
      name: "Treasury",
      privateKey:
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    });
    const access = await owsLocalVaultService.resolveAccess({
      apiKeyToken: (
        await owsLocalVaultService.createApiKey({
          name: "scoped",
          walletIds: [wallet.id],
          policyIds: [],
        })
      ).token,
    });

    const sendSpy = vi.spyOn(owsLocalVaultService, "sendNativeTransfer");

    const service = new OwsWalletService();
    const intent = {
      id: "intent-ctrl-noauth",
      agentId: "agent-1",
      recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: "1000",
      asset: "OKB",
      reason: "no-auth attempt",
      timestamp: new Date().toISOString(),
    };
    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre", projectId: "default" });
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      recorder,
      "needs review",
      "policy-noauth",
      access,
    );

    const controller = new CreController();
    sendSpy.mockClear();
    // No userId on req — simulates a caller without a JWT (e.g. unauth or
    // workspace-key-only). Must be rejected with 403 and NEVER broadcast.
    const req = makeReq({
      params: { runId: held.runId },
      body: { approve: true, reason: "should-not-broadcast" },
    });
    const res = new MockRes();
    await controller.submitApproval(req as any, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.payload?.success).toBe(false);
    expect(res.payload?.error).toMatch(/operator/i);
    expect(sendSpy).not.toHaveBeenCalled();
    // Run must remain held so a properly-authed operator can still approve.
    const persisted = await creRunStore.get(held.runId);
    expect(persisted?.status).toBe("paused_for_approval");
    sendSpy.mockRestore();
  });

  it("reconcileRun requires operator authentication and workspace context", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-auth-check",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const controller = new CreController();
    const res = new MockRes();
    await controller.reconcileRun(
      makeReq({ params: { runId: run.runId } }) as any,
      res as any,
    );

    expect(res.statusCode).toBe(403);
    expect(res.payload?.success).toBe(false);
    expect(res.payload?.error).toMatch(/operator authentication/i);
  });

  it("getSpendAttribution requires operator authentication and workspace context", async () => {
    const controller = new CreController();
    const res = new MockRes();
    await controller.getSpendAttribution(
      makeReq() as any,
      res as any,
    );

    expect(res.statusCode).toBe(403);
    expect(res.payload).toMatchObject({
      success: false,
      error: expect.stringMatching(/operator authentication/i),
    });
  });

  it("getSpendAttribution excludes artifacts with a conflicting workspace", async () => {
    const run = {
      ...makeRun("completed" as any),
      runId: "workspace-conflict-run",
      projectId: "workspace-1",
      workflow: "spend" as const,
      mode: "cre" as const,
      artifacts: [
        {
          id: crypto.randomUUID(),
          type: "capital_attribution" as const,
          createdAt: new Date().toISOString(),
          data: {
            version: 1,
            allocationId: "allocation-conflict",
            workspaceId: "workspace-2",
            intentId: "intent-conflict",
            agentId: "agent-1",
            asset: "ETH",
            requestedAmount: "7",
            allocatedAmount: "7",
            consumedAmount: "7",
            status: "consumed",
          },
        },
      ],
    };
    await creRunStore.add(run as any);

    const controller = new CreController();
    const req = makeReq() as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.getSpendAttribution(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.data?.totalRecords).toBe(0);
  });

  it("getSpendAttribution aggregates only the current workspace", async () => {
    const makeAttributionRun = (runId: string, projectId: string, intentId: string, amount: string) => ({
      ...makeRun("completed" as any),
      runId,
      projectId,
      workflow: "spend" as const,
      mode: "cre" as const,
      artifacts: [
        {
          id: crypto.randomUUID(),
          type: "capital_attribution" as const,
          createdAt: new Date().toISOString(),
          data: {
            version: 1,
            allocationId: `allocation-${intentId}`,
            workspaceId: projectId,
            intentId,
            agentId: "agent-1",
            asset: "ETH",
            requestedAmount: amount,
            allocatedAmount: amount,
            consumedAmount: amount,
            status: "consumed",
          },
        },
      ],
    });
    await creRunStore.add(makeAttributionRun("workspace-run", "workspace-1", "intent-w1", "7") as any);
    await creRunStore.add(makeAttributionRun("other-run", "workspace-2", "intent-w2", "99") as any);

    const controller = new CreController();
    const req = makeReq() as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.getSpendAttribution(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(res.payload?.data?.totalRecords).toBe(1);
    expect(res.payload?.data?.counts?.allocated).toBe(1);
    expect(res.payload?.data?.totalsByAsset?.ETH).toMatchObject({
      allocatedAmount: "7",
      consumedAmount: "7",
      pendingAmount: "0",
    });
    expect(res.payload?.data?.records[0]?.intentId).toBe("intent-w1");
  });

  it("reconcileRun rejects a run from another workspace before querying KeeperHub", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-owner";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-cross-workspace",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const statusSpy = vi.spyOn(keeperHubExecutionProvider, "getExecutionStatus");
    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-other";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.payload?.error).toMatch(/does not belong/i);
    expect(statusSpy).not.toHaveBeenCalled();
    statusSpy.mockRestore();
  });

  it("reconcileRun reports a completed but mismatched receipt as recovery-required", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-mismatch",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const transactionHash = "0x" + "c".repeat(64);
    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-mismatch",
        status: "completed",
        transactionHash,
        chainId: 84532,
        receipts: [
          {
            hash: transactionHash,
            chainId: 84532,
            from: "0x1111111111111111111111111111111111111111",
            to: "0x3333333333333333333333333333333333333333",
            value: "2",
            verified: true,
            receiptStatus: "success",
          },
        ],
      });

    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: false,
      statusFetched: true,
      matched: false,
      recoveryRequired: true,
      readOnly: true,
    });
    statusSpy.mockRestore();
  });

  it("reconcileRun proves a matching receipt with equivalent ETH formatting", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-match",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000000000000000000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const transactionHash = "0x" + "d".repeat(64);
    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-match",
        status: "completed",
        transactionHash,
        chainId: 84532,
        receipts: [
          {
            hash: transactionHash,
            chainId: 84532,
            from: "0x1111111111111111111111111111111111111111",
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: "1",
            verified: true,
            receiptStatus: "success",
          },
        ],
      });

    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      statusFetched: true,
      matched: true,
      recoveryRequired: false,
      readOnly: true,
    });
    statusSpy.mockRestore();
  });

  it("uncertain spend runs cannot be cancelled or retried", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          recoveryRequired: true,
          transferExecutionId: "exec-locked",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const controller = new CreController();
    const cancelRes = new MockRes();
    await controller.cancelRun(
      makeReq({ params: { runId: run.runId }, workspaceId: "workspace-1" } as any) as any,
      cancelRes as any,
    );
    expect(cancelRes.statusCode).toBe(409);
    expect(cancelRes.payload?.error).toMatch(/reconciliation/i);

    const retryRes = new MockRes();
    await controller.retryRun(
      makeReq({ params: { runId: run.runId }, body: {}, workspaceId: "workspace-1" } as any) as any,
      retryRes as any,
    );
    expect(retryRes.statusCode).toBe(409);
    expect(retryRes.payload?.error).toMatch(/reconciliation/i);
    expect((await creRunStore.get(run.runId))?.status).toBe("running");
  });

  it("reconcileRun keeps a missing execution id in manual-support recovery", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          recoveryRequired: true,
          transferIdempotencyKey: "0x" + "e".repeat(64),
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);
    const statusSpy = vi.spyOn(keeperHubExecutionProvider, "getExecutionStatus");
    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: false,
      execution: null,
      idempotencyKey: "0x" + "e".repeat(64),
      recoveryRequired: true,
      readOnly: true,
    });
    expect(res.payload?.message).toMatch(/support|lookup/i);
    expect(statusSpy).not.toHaveBeenCalled();
    statusSpy.mockRestore();
  });

  it("uncertain runs cannot change plan or approval state", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-mutation-locked",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);
    const controller = new CreController();

    const planRes = new MockRes();
    await controller.updateRunPlan(
      makeReq({
        params: { runId: run.runId },
        body: {
          plan: {
            version: 2,
            steps: [{ id: "p1", title: "retry", enabled: true }],
          },
        },
        workspaceId: "workspace-1",
      } as any) as any,
      planRes as any,
    );
    expect(planRes.statusCode).toBe(409);
    expect(planRes.payload?.error).toMatch(/reconciliation/i);

    const approvalRes = new MockRes();
    const approvalReq = makeReq({
      params: { runId: run.runId },
      body: { approve: true },
      workspaceId: "workspace-1",
    } as any) as any;
    approvalReq.userId = "operator-1";
    await controller.submitApproval(approvalReq, approvalRes as any);
    expect(approvalRes.statusCode).toBe(409);
    expect(approvalRes.payload?.error).toMatch(/reconciliation/i);
  });

  it("reconcileRun keeps a pending provider status recovery-required", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-pending",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({ executionId: "exec-pending", status: "pending" });
    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.payload).toMatchObject({
      success: false,
      statusFetched: true,
      matched: false,
      recoveryRequired: true,
    });
    statusSpy.mockRestore();
  });

  it("POST reconcileRun resolves a fully matched execution and unlocks the run", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-resolve",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000000000000000000",
          chainId: 84532,
        },
      },
    ];
    run.artifacts.push({
      id: crypto.randomUUID(),
      type: "capital_attribution",
      createdAt: new Date().toISOString(),
      data: {
        version: 1,
        allocationId: "allocation-resolve",
        workspaceId: "workspace-1",
        intentId: "intent-resolve",
        agentId: "agent-1",
        asset: "ETH",
        requestedAmount: "1000000000000000000",
        allocatedAmount: "1000000000000000000",
        consumedAmount: "0",
        status: "uncertain",
      },
    });
    run.artifacts.push({
      id: crypto.randomUUID(),
      type: "spend_intent",
      createdAt: new Date().toISOString(),
      data: { id: "intent-resolve" },
    });
    await creRunStore.add(run);

    const transactionHash = "0x" + "f".repeat(64);
    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-resolve",
        status: "success",
        transactionHash,
        chainId: 84532,
        receipts: [
          {
            hash: transactionHash,
            chainId: 84532,
            from: "0x1111111111111111111111111111111111111111",
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: "1.0",
            verified: true,
            receiptStatus: "success",
          },
        ],
      });

    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.method = "POST";
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: true,
      resolved: true,
      readOnly: false,
      recoveryRequired: false,
      run: { status: "completed", ok: true },
    });
    expect((await creRunStore.get(run.runId))?.status).toBe("completed");
    const resolvedStored = await creRunStore.get(run.runId);
    const resolvedAttribution = resolvedStored?.artifacts.find(
      (artifact) => artifact.type === "capital_attribution",
    );
    const resolvedError = resolvedStored?.artifacts.find(
      (artifact) => artifact.type === "error",
    );
    expect((resolvedError?.data as { status?: string })?.status).toBe("execution_reconciled");
    expect(resolvedAttribution?.data).toMatchObject({
      status: "consumed",
      consumedAmount: "1000000000000000000",
      transactionHash,
      outcome: "value_transfer_reconciled",
    });
    statusSpy.mockRestore();
  });

  it("POST reconciliation resolves parent and child lifecycle records once", async () => {
    const parent = makeRun("running") as any;
    parent.workflow = "spend";
    parent.projectId = "workspace-1";
    parent.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-parent-child",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
      {
        id: crypto.randomUUID(),
        type: "spend_intent",
        createdAt: new Date().toISOString(),
        data: { id: "intent-parent-child" },
      },
      {
        id: crypto.randomUUID(),
        type: "capital_attribution",
        createdAt: new Date().toISOString(),
        data: {
          version: 1,
          allocationId: "allocation-parent-child",
          workspaceId: "workspace-1",
          intentId: "intent-parent-child",
          agentId: "agent-1",
          asset: "ETH",
          requestedAmount: "1000",
          allocatedAmount: "1000",
          consumedAmount: "0",
          status: "uncertain",
        },
      },
    ];
    const child = {
      ...parent,
      runId: crypto.randomUUID(),
      parentRunId: parent.runId,
      artifacts: parent.artifacts.filter((artifact: any) => artifact.type !== "error"),
    };
    await creRunStore.add(parent);
    await creRunStore.add(child);

    const transactionHash = "0x" + "9".repeat(64);
    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-parent-child",
        status: "completed",
        transactionHash,
        chainId: 84532,
        receipts: [
          {
            hash: transactionHash,
            chainId: 84532,
            from: "0x1111111111111111111111111111111111111111",
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: "0.000000000000001",
            verified: true,
            receiptStatus: "success",
          },
        ],
      });

    const controller = new CreController();
    const req = makeReq({ params: { runId: parent.runId } }) as any;
    req.method = "POST";
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.payload).toMatchObject({ success: true, resolved: true });
    const [parentStored, childStored] = await Promise.all([
      creRunStore.get(parent.runId),
      creRunStore.get(child.runId),
    ]);
    expect(parentStored?.status).toBe("completed");
    expect(childStored?.status).toBe("completed");
    expect((await creRunStore.list()).filter((candidate) => candidate.projectId === "workspace-1").length).toBe(2);
    statusSpy.mockRestore();
  });

  it("POST local reconciliation keeps a sender mismatch recovery-required", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    const txHash = "0x" + "7".repeat(64);
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferTxHash: txHash,
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
      {
        id: crypto.randomUUID(),
        type: "spend_intent",
        createdAt: new Date().toISOString(),
        data: { id: "intent-local-sender-mismatch" },
      },
    ];
    await creRunStore.add(run);

    const controller = new CreController();
    const verifySpy = vi.spyOn(controller as any, "verifyLocalTransfer").mockResolvedValue({
      matched: false,
      reason: "Local receipt did not match the expected sender",
      from: "0x2222222222222222222222222222222222222222",
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      valueWei: "1000",
      chainId: 84532,
      receiptStatus: "success",
    });
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.method = "POST";
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({ success: false, readOnly: true, recoveryRequired: true });
    expect(res.payload.message).toMatch(/expected sender/i);
    expect(verifySpy).toHaveBeenCalledWith(
      txHash,
      "0x1111111111111111111111111111111111111111",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "1000",
      84532,
    );
    verifySpy.mockRestore();
  });

  it("POST local reconciliation resolves a parent and child lifecycle", async () => {
    const parent = makeRun("running") as any;
    parent.workflow = "spend";
    parent.projectId = "workspace-1";
    const txHash = "0x" + "8".repeat(64);
    parent.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferTxHash: txHash,
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
      {
        id: crypto.randomUUID(),
        type: "spend_intent",
        createdAt: new Date().toISOString(),
        data: { id: "intent-local-parent-child" },
      },
      {
        id: crypto.randomUUID(),
        type: "capital_attribution",
        createdAt: new Date().toISOString(),
        data: {
          version: 1,
          allocationId: "allocation-local-parent-child",
          workspaceId: "workspace-1",
          intentId: "intent-local-parent-child",
          agentId: "agent-1",
          asset: "ETH",
          requestedAmount: "1000",
          allocatedAmount: "1000",
          consumedAmount: "0",
          status: "uncertain",
        },
      },
    ];
    const child = { ...parent, runId: crypto.randomUUID(), parentRunId: parent.runId, artifacts: parent.artifacts.filter((artifact: any) => artifact.type !== "error") };
    await creRunStore.add(parent);
    await creRunStore.add(child);

    const controller = new CreController();
    const verifySpy = vi.spyOn(controller as any, "verifyLocalTransfer").mockResolvedValue({ matched: true, chainId: 84532, receiptStatus: "success" });
    const req = makeReq({ params: { runId: parent.runId } }) as any;
    req.method = "POST";
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.payload).toMatchObject({ success: true, resolved: true });
    expect((await creRunStore.get(parent.runId))?.status).toBe("completed");
    expect((await creRunStore.get(child.runId))?.status).toBe("completed");
    expect(verifySpy).toHaveBeenCalledTimes(1);
    verifySpy.mockRestore();
  });

  it("rejects completed reconciliation reads from another workspace", async () => {
    const run = { ...makeRun("completed" as any), workflow: "spend" as const, projectId: "workspace-1" };
    await creRunStore.add(run as any);

    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-2";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(403);
    expect(res.payload).toMatchObject({ success: false, error: "Run does not belong to this workspace" });
  });

  it("POST reconciliation is idempotent when the resolve response is replayed", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-idempotent-resolve",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
      {
        id: crypto.randomUUID(),
        type: "spend_intent",
        createdAt: new Date().toISOString(),
        data: { id: "intent-idempotent-resolve" },
      },
      {
        id: crypto.randomUUID(),
        type: "capital_attribution",
        createdAt: new Date().toISOString(),
        data: {
          version: 1,
          allocationId: "allocation-idempotent-resolve",
          workspaceId: "workspace-1",
          intentId: "intent-idempotent-resolve",
          agentId: "agent-1",
          asset: "ETH",
          requestedAmount: "1000",
          allocatedAmount: "1000",
          consumedAmount: "0",
          status: "uncertain",
        },
      },
    ];
    await creRunStore.add(run);

    const transactionHash = "0x" + "b".repeat(64);
    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-idempotent-resolve",
        status: "completed",
        transactionHash,
        chainId: 84532,
        receipts: [
          {
            hash: transactionHash,
            chainId: 84532,
            from: "0x1111111111111111111111111111111111111111",
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: "0.000000000000001",
            verified: true,
            receiptStatus: "success",
          },
        ],
      });

    const controller = new CreController();
    const headers = { "Idempotency-Key": "resolve-once" };
    const firstReq = makeReq({ params: { runId: run.runId }, headers }) as any;
    firstReq.method = "POST";
    firstReq.userId = "operator-1";
    firstReq.workspaceId = "workspace-1";
    const firstRes = new MockRes();
    await controller.reconcileRun(firstReq, firstRes as any);

    const secondReq = makeReq({ params: { runId: run.runId }, headers }) as any;
    secondReq.method = "POST";
    secondReq.userId = "operator-1";
    secondReq.workspaceId = "workspace-1";
    const secondRes = new MockRes();
    await controller.reconcileRun(secondReq, secondRes as any);

    expect(firstRes.statusCode).toBe(200);
    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.payload).toEqual(firstRes.payload);
    expect(statusSpy).toHaveBeenCalledTimes(1);
    statusSpy.mockRestore();
  });

  it("reconcileRun accepts a verified sponsored receipt with a relayer sender", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-sponsored",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const transactionHash = "0x" + "a".repeat(64);
    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-sponsored",
        status: "completed",
        transactionHash,
        sponsored: true,
        chainId: 84532,
        receipts: [
          {
            hash: transactionHash,
            chainId: 84532,
            from: "0x9999999999999999999999999999999999999999",
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: "0.000000000000001",
            verified: true,
            receiptStatus: "success",
          },
        ],
      });

    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.payload).toMatchObject({
      success: true,
      matched: true,
      recoveryRequired: false,
    });
    statusSpy.mockRestore();
  });

  it("reconcileRun handles malformed provider hashes as recovery-required", async () => {
    const run = makeRun("running") as any;
    run.workflow = "spend";
    run.projectId = "workspace-1";
    run.artifacts = [
      {
        id: crypto.randomUUID(),
        type: "error",
        createdAt: new Date().toISOString(),
        data: {
          status: "execution_uncertain",
          transferExecutionId: "exec-malformed",
          expectedSender: "0x1111111111111111111111111111111111111111",
          expectedRecipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expectedValueWei: "1000",
          chainId: 84532,
        },
      },
    ];
    await creRunStore.add(run);

    const statusSpy = vi
      .spyOn(keeperHubExecutionProvider, "getExecutionStatus")
      .mockResolvedValue({
        executionId: "exec-malformed",
        status: "completed",
        transactionHash: "not-a-hash",
        chainId: 84532,
        receipts: [{ hash: "also-not-a-hash", verified: true, receiptStatus: "success" }],
      });
    const controller = new CreController();
    const req = makeReq({ params: { runId: run.runId } }) as any;
    req.userId = "operator-1";
    req.workspaceId = "workspace-1";
    const res = new MockRes();
    await controller.reconcileRun(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toMatchObject({
      success: false,
      statusFetched: true,
      matched: false,
      recoveryRequired: true,
    });
    statusSpy.mockRestore();
  });

  it("streamRunEvents resumes from Last-Event-ID", async () => {
    const run = makeRun("running");
    await creRunStore.add(run as any);
    const controller = new CreController();
    const firstTs = new Date(run.events[0].timestamp).getTime();
    const secondEventId = run.events[1].id;

    const req = makeReq({
      params: { runId: run.runId },
      headers: { "Last-Event-ID": String(firstTs) },
      __triggerClose: true as any,
    } as any);
    const res = new MockRes();
    await controller.streamRunEvents(req as any, res as any);

    const joined = res.chunks.join("");
    expect(joined.includes("event: run_event")).toBeTruthy();
    expect(joined.includes(secondEventId)).toBeTruthy();
    expect(!joined.includes(run.events[0].id)).toBeTruthy();
  });
});
