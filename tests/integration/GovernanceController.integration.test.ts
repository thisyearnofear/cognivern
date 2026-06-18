import { describe, it, expect, beforeEach, vi } from "vitest";
import os from "node:os";
import path from "node:path";

// Force isolation: no MongoDB, no real file-backed stores.
delete process.env.MONGODB_URI;
process.env.CRE_RUNS_FILE = path.join(
  os.tmpdir(),
  `cognivern-cre-runs-gov-${Date.now()}.jsonl`,
);
process.env.IDEMPOTENCY_STORE_FILE = path.join(
  os.tmpdir(),
  `cognivern-idem-gov-${Date.now()}.json`,
);
process.env.UX_EVENTS_FILE = path.join(
  os.tmpdir(),
  `cognivern-ux-events-gov-${Date.now()}.jsonl`,
);
process.env.RATE_LIMIT_STORE_FILE = path.join(
  os.tmpdir(),
  `cognivern-rate-limit-gov-${Date.now()}.jsonl`,
);
process.env.TOKEN_BLACKLIST_FILE = path.join(
  os.tmpdir(),
  `cognivern-token-blacklist-gov-${Date.now()}.jsonl`,
);

// Mock FilecoinStorageService (transitive dep of AuditLogService) to avoid
// config import side-effects in the vitest environment.
vi.mock("../../src/backend/services/blockchain/FilecoinStorageService.js", () => ({
  FilecoinStorageService: class {
    enabled = false;
  },
}));

// Stub AuditLogService so logAction is a no-op — the controller calls it
// as a side-effect on every evaluation, and we don't want it touching files
// or MongoDB during integration tests.
vi.mock("../../src/backend/services/governance/AuditLogService.js", () => ({
  AuditLogService: class {
    async logAction() {
      return { decisionId: "test-decision-id" };
    }
  },
}));

// Mock getDb() so GovernanceController.resolveWorkspacePolicy returns a
// canned workspace_policies row without hitting real SQLite.
const mockGet = vi.fn();
const mockAll = vi.fn();
vi.mock("../../src/backend/db/index.js", () => ({
  getDb: () => ({
    prepare: () => ({
      get: (...args: unknown[]) => mockGet(...args),
      all: (...args: unknown[]) => mockAll(...args),
    }),
  }),
}));

const { GovernanceController } = await import(
  "../../src/backend/modules/api/controllers/GovernanceController.js"
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

function makeReq(overrides: Record<string, any> = {}) {
  return overrides as any;
}

const ACTIVE_POLICY_ROW = {
  id: "policy-1",
  name: "Default Test Policy",
  type: "spend",
  description: "test policy",
  rules: JSON.stringify([
    { id: "r1", type: "allow", condition: "true", metadata: {} },
  ]),
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("GovernanceController.evaluateAction (sync path)", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockAll.mockReset();
    // Default: no explicit policyId lookup (the .get call) — fall through
    // to .all() which returns the active policy row.
    mockGet.mockReturnValue(undefined);
    mockAll.mockReturnValue([ACTIVE_POLICY_ROW]);
  });

  it("returns 401 when workspaceId is missing", async () => {
    const controller = new GovernanceController();
    const res = new MockRes();
    await controller.evaluateAction(
      makeReq({ body: { agentId: "a1", action: { type: "spend" } } }),
      res as any,
    );
    expect(res.statusCode).toBe(401);
    expect(res.payload.success).toBe(false);
  });

  it("returns 400 when agentId or action is missing", async () => {
    const controller = new GovernanceController();
    const res = new MockRes();
    await controller.evaluateAction(
      makeReq({ workspaceId: "ws-1", body: { agentId: "a1" } }),
      res as any,
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload.error.code).toBe("BAD_REQUEST");
  });

  it("returns 503 when no active policy exists", async () => {
    mockAll.mockReturnValue([]);
    const controller = new GovernanceController();
    const res = new MockRes();
    await controller.evaluateAction(
      makeReq({
        workspaceId: "ws-1",
        body: { agentId: "a1", action: { type: "spend" } },
      }),
      res as any,
    );
    expect(res.statusCode).toBe(503);
    expect(res.payload.error.code).toBe("NO_ACTIVE_POLICY");
  });

  it("approves an action against an active workspace policy", async () => {
    const controller = new GovernanceController();
    const res = new MockRes();
    await controller.evaluateAction(
      makeReq({
        workspaceId: "ws-1",
        body: {
          agentId: "agent-1",
          action: {
            type: "spend",
            description: "Small vendor payment",
            metadata: { amountValue: 500 },
          },
        },
      }),
      res as any,
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.data.approved).toBe(true);
    expect(res.payload.data.policyChecks.length).toBeGreaterThanOrEqual(1);
    expect(res.payload.data.suspicion).toBeUndefined();
  });

  it("attaches a suspicion score when CONTROL_EVAL_MODE=true", async () => {
    const original = process.env.CONTROL_EVAL_MODE;
    process.env.CONTROL_EVAL_MODE = "true";
    try {
      // Re-import a fresh controller so the constructor picks up the env flag.
      const mod = await import(
        "../../src/backend/modules/api/controllers/GovernanceController.js"
      );
      const controller = new mod.GovernanceController();
      const res = new MockRes();
      await controller.evaluateAction(
        makeReq({
          workspaceId: "ws-1",
          body: {
            agentId: "agent-1",
            action: {
              type: "spend",
              description: "Small vendor payment",
              metadata: { amountValue: 500 },
            },
          },
        }),
        res as any,
      );
      expect(res.statusCode).toBe(200);
      expect(res.payload.data.suspicion).toBeDefined();
      expect(typeof res.payload.data.suspicion.composite).toBe("number");
      expect(res.payload.data.suspicion.composite).toBeGreaterThanOrEqual(0);
      expect(res.payload.data.suspicion.composite).toBeLessThanOrEqual(1);
      expect(["normal", "elevated", "high", "critical"]).toContain(
        res.payload.data.suspicion.label,
      );
    } finally {
      if (original === undefined) delete process.env.CONTROL_EVAL_MODE;
      else process.env.CONTROL_EVAL_MODE = original;
    }
  });
});
