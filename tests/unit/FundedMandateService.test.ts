import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-mandates-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import(
  "@backend/services/governance/FundedMandateService.js"
);
const { buildSpendAttributionReport } = await import(
  "@backend/services/governance/SpendAttributionService.js"
);

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "user-mandate-test",
    now,
    now,
  );
  for (const workspaceId of ["workspace-mandate-a", "workspace-mandate-b"]) {
    db.prepare(
      "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
    ).run(workspaceId, workspaceId, "user-mandate-test", now, now);
    db.prepare(
      "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)",
    ).run(workspaceId, "user-mandate-test", now);
  }
  db.prepare(
    "INSERT OR IGNORE INTO workspace_agents (id, workspace_id, name, role, chain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("agent-mandate-a", "workspace-mandate-a", "A", "operator", "evm", now, now);
  db.prepare(
    "INSERT OR IGNORE INTO workspace_policies (id, workspace_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run("policy-mandate-a", "workspace-mandate-a", "Policy A", "budget", now, now);
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

describe("FundedMandateService", () => {
  it("creates and updates a workspace-scoped mandate", () => {
    const created = FundedMandateService.create("workspace-mandate-a", {
      name: "Growth pilot",
      objective: "Acquire qualified customers",
      agentIds: ["agent-mandate-a"],
      policyIds: ["policy-mandate-a"],
      status: "active",
      budget: { byAsset: { USDC: { authorizedAmount: "1000000", pendingAmount: "0" } } },
    });

    expect(created).toMatchObject({
      workspaceId: "workspace-mandate-a",
      name: "Growth pilot",
      status: "active",
      agentIds: ["agent-mandate-a"],
      policyIds: ["policy-mandate-a"],
      budget: { byAsset: { USDC: { authorizedAmount: "1000000", allocatedAmount: "0" } } },
    });
    expect(FundedMandateService.list("workspace-mandate-b")).toEqual([]);

    const updated = FundedMandateService.update("workspace-mandate-a", created.id, {
      status: "paused",
      objective: "Acquire retained customers",
    });
    expect(updated?.status).toBe("paused");
    expect(FundedMandateService.get("workspace-mandate-b", created.id)).toBeUndefined();
  });

  it("rejects cross-workspace references and invalid budget bounds", () => {
    expect(() =>
      FundedMandateService.create("workspace-mandate-a", {
        name: "Invalid",
        objective: "Should not cross a workspace boundary",
        agentIds: ["agent-from-another-workspace"],
      }),
    ).toThrow(/agent.*workspace/i);

    expect(() =>
      FundedMandateService.create("workspace-mandate-a", {
        name: "Invalid",
        objective: "Should not cross a workspace boundary",
        policyIds: ["policy-from-another-workspace"],
      }),
    ).toThrow(/policy.*workspace/i);

    expect(() =>
      FundedMandateService.create("workspace-mandate-a", {
        name: "Invalid budget",
        objective: "Should enforce the authorization bound",
        budget: { byAsset: { USDC: { authorizedAmount: "10", allocatedAmount: "11" } } },
      }),
    ).toThrow(/authorized amount/i);
  });

  it("persists and returns settlement constraints for verified capital mandates", () => {
    const created = FundedMandateService.create("workspace-mandate-a", {
      name: "Verified aUSDC mandate",
      objective: "Settle only Cleanverse-verified capital",
      agentIds: ["agent-mandate-a"],
      policyIds: ["policy-mandate-a"],
      status: "active",
      budget: {
        byAsset: {
          "aUSDC": { authorizedAmount: "1000000", pendingAmount: "0" },
        },
      },
      settlement: {
        requireCleanverseIdentity: true,
        requireVerifiedSettlement: true,
        allowedAssets: ["aUSDC"],
        chainIds: [10143],
      },
    });

    expect(created.settlement).toEqual({
      requireCleanverseIdentity: true,
      requireVerifiedSettlement: true,
      allowedAssets: ["aUSDC"],
      chainIds: [10143],
    });

    const updated = FundedMandateService.update("workspace-mandate-a", created.id, {
      settlement: {
        requireVerifiedSettlement: true,
        allowedAssets: ["aUSDC"],
      },
    });
    expect(updated?.settlement).toEqual({
      requireCleanverseIdentity: false,
      requireVerifiedSettlement: true,
      allowedAssets: ["aUSDC"],
    });
  });

  it("filters attribution by mandate without affecting legacy records", () => {
    const makeRun = (runId: string, mandateId?: string) => ({
      runId,
      workflow: "spend" as const,
      mode: "cre" as const,
      projectId: "workspace-mandate-a",
      startedAt: "2026-08-01T00:00:00.000Z",
      finishedAt: "2026-08-01T00:00:00.000Z",
      ok: true,
      status: "completed" as const,
      steps: [],
      artifacts: [
        {
          id: `${runId}-artifact`,
          type: "capital_attribution" as const,
          createdAt: "2026-08-01T00:00:00.000Z",
          data: {
            version: 1,
            allocationId: runId,
            workspaceId: "workspace-mandate-a",
            ...(mandateId ? { mandateId } : {}),
            intentId: `${runId}-intent`,
            agentId: "agent-mandate-a",
            asset: "USDC",
            requestedAmount: "10",
            allocatedAmount: "10",
            consumedAmount: "10",
            status: "consumed",
          },
        },
      ],
    });

    const report = buildSpendAttributionReport([
      makeRun("mandate-run", "mandate-growth"),
      makeRun("legacy-run"),
    ]);
    expect(report.totalRecords).toBe(2);
    expect(buildSpendAttributionReport([makeRun("mandate-run", "mandate-growth")], "mandate-growth").totalRecords).toBe(1);
    expect(buildSpendAttributionReport([makeRun("legacy-run")], "mandate-growth").totalRecords).toBe(0);
  });
});
