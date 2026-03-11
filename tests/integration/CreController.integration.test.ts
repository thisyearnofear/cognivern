import test from "node:test";
import assert from "node:assert/strict";
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

const { CreController } = await import(
  "../../src/modules/api/controllers/CreController.js"
);
const { creRunStore } = await import("../../src/cre/storage/CreRunStore.js");

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

test.beforeEach(async () => {
  await creRunStore.reset();
});

test.after(async () => {
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

test("updateRunPlan moves running run to paused_for_approval", async () => {
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

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.run?.status, "paused_for_approval");
  assert.equal(res.payload?.run?.plan?.version, 2);
});

test("submitApproval approve marks plan steps approved/rejected and completes run", async () => {
  const run = makeRun("paused_for_approval");
  await creRunStore.add(run as any);
  const controller = new CreController();

  const req = makeReq({
    params: { runId: run.runId },
    body: { approve: true, reason: "ok" },
  });
  const res = new MockRes();
  await controller.submitApproval(req as any, res as any);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.run?.status, "completed");
  const statuses = (res.payload?.run?.plan?.steps || []).map(
    (s: any) => s.status,
  );
  assert.deepEqual(statuses, ["approved", "approved"]);
});

test("submitApproval idempotency key returns cached response", async () => {
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
  assert.equal(res1.statusCode, 200);
  const status1 = res1.payload?.run?.status;
  assert.equal(status1, "completed");

  const req2 = makeReq({
    params: { runId: run.runId },
    headers,
    body: { approve: false, reason: "should-not-apply" },
  });
  const res2 = new MockRes();
  await controller.submitApproval(req2 as any, res2 as any);
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.payload?.run?.status, status1);
});

test("streamRunEvents resumes from Last-Event-ID", async () => {
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
  assert.ok(joined.includes("event: run_event"));
  assert.ok(joined.includes(secondEventId));
  assert.ok(!joined.includes(run.events[0].id));
});
