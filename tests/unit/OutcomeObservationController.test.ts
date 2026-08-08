import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-outcome-controller-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationController } = await import("@backend/modules/api/controllers/OutcomeObservationController.js");
const { createOutcomeObservationRoutes } = await import("@backend/modules/api/routes/outcomeObservationRoutes.js");

let mandateId = "";

class MockRes {
  statusCode = 200;
  payload: unknown;
  status(code: number) { this.statusCode = code; return this; }
  json(body: unknown) { this.payload = body; return this; }
}

function request(overrides: Record<string, unknown> = {}) {
  const headers = (overrides.headers || {}) as Record<string, string>;
  return {
    userId: overrides.userId,
    workspaceId: overrides.workspaceId,
    params: { mandateId },
    body: overrides.body || {},
    header: (name: string) => headers[name] || headers[name.toLowerCase()],
  };
}

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("controller-outcome-user", now, now);
  db.prepare("INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("controller-outcome-workspace", "Controller outcomes", "controller-outcome-user", now, now);
  mandateId = FundedMandateService.create("controller-outcome-workspace", {
    name: "Controller mandate",
    objective: "Observe a metric",
    successMetrics: [{ id: "metric-1", name: "Conversions", unit: "count" }],
  }).id;
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* best effort */ }
  }
});

describe("OutcomeObservationController", () => {
  const body = {
    metricId: "metric-1",
    kind: "observed",
    value: "4",
    unit: "count",
    observedAt: "2026-08-08T12:00:00.000Z",
    source: "operator log",
    confidence: "self_reported",
    evidence: [{ type: "artifact", reference: "artifact://outcome-1" }],
  };

  it("registers the nested list and create routes", () => {
    const router = createOutcomeObservationRoutes(new OutcomeObservationController()) as any;
    const routes = router.stack.map((layer: any) => ({ path: layer.route.path, methods: layer.route.methods }));
    expect(routes).toEqual([
      { path: "/mandates/:mandateId/outcomes", methods: { get: true } },
      { path: "/mandates/:mandateId/outcomes", methods: { post: true } },
    ]);
  });

  it("requires an authenticated operator", async () => {
    const res = new MockRes();
    await new OutcomeObservationController().create(request({ body }) as any, res as any);
    expect(res.statusCode).toBe(403);
  });

  it("rejects cross-workspace list access and missing idempotency keys", async () => {
    const controller = new OutcomeObservationController();
    const listRes = new MockRes();
    await controller.list(request({ userId: "operator", workspaceId: "other-workspace" }) as any, listRes as any);
    expect(listRes.statusCode).toBe(404);

    const createRes = new MockRes();
    await controller.create(request({ userId: "operator", workspaceId: "controller-outcome-workspace", body }) as any, createRes as any);
    expect(createRes.statusCode).toBe(400);
    expect(createRes.payload).toMatchObject({ success: false, error: expect.stringMatching(/idempotency/i) });
  });

  it("returns 201 then 200 for an idempotent replay", async () => {
    const controller = new OutcomeObservationController();
    const first = new MockRes();
    const overrides = { userId: "operator", workspaceId: "controller-outcome-workspace", body, headers: { "Idempotency-Key": "controller-key" } };
    await controller.create(request(overrides) as any, first as any);
    const second = new MockRes();
    await controller.create(request(overrides) as any, second as any);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.payload).toMatchObject({ success: true, replayed: true });
  });
});
