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
  "../../src/backend/services/OwsLocalVaultService.js"
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
  return {
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
      "../../src/backend/services/OwsWalletService.js"
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
      .mockResolvedValue({ txHash: "0xctrl-success", from: wallet.accounts[0].address });

    // Build a held spend run via the real handleHold path so artifacts match
    // the production shape (spend_intent + error with walletId/policyId).
    const service = new OwsWalletService();
    const intent = {
      id: "intent-ctrl-1",
      agentId: "agent-1",
      recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: "4242",
      asset: "OKB",
      reason: "controller test",
      timestamp: new Date().toISOString(),
    };
    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      recorder,
      "needs review",
      "policy-ctrl-1",
      access,
    );

    const controller = new CreController();
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
    expect(res.payload?.transfer?.transferTxHash).toBe("0xctrl-success");
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0][0].operatorApproved).toBe(true);
    expect(sendSpy.mock.calls[0][0].valueWei).toBe(4242n);
    sendSpy.mockRestore();
  });

  it("submitApproval (spend workflow) leaves run paused + returns error when transfer fails", async () => {
    const { OwsWalletService } = await import(
      "../../src/backend/services/OwsWalletService.js"
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
    const intent = {
      id: "intent-ctrl-2",
      agentId: "agent-1",
      recipient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      amount: "999",
      asset: "OKB",
      reason: "controller failure test",
      timestamp: new Date().toISOString(),
    };
    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      recorder,
      "needs review",
      "policy-ctrl-2",
      access,
    );

    const controller = new CreController();
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
  });

  it("submitApproval (spend workflow) refuses approve without operator userId", async () => {
    const { OwsWalletService } = await import(
      "../../src/backend/services/OwsWalletService.js"
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
    const recorder = new CreRunRecorder({ workflow: "spend", mode: "cre" });
    await recorder.addArtifact({ type: "spend_intent", data: intent });
    const held = await (service as any).handleHold(
      intent,
      recorder,
      "needs review",
      "policy-noauth",
      access,
    );

    const controller = new CreController();
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
