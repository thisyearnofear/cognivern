import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-statements-${process.pid}-${Date.now()}.db`);
const runsPath = path.join(os.tmpdir(), `cognivern-statement-runs-${process.pid}-${Date.now()}.jsonl`);
process.env.DB_PATH = dbPath;
process.env.CRE_RUNS_FILE = runsPath;
process.env.MONGODB_URI = "";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationService } = await import("@backend/services/governance/OutcomeObservationService.js");
const { StatementService, canonicalStringify } = await import("@backend/services/governance/StatementService.js");

let mandateId = "";

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("statement-user", now, now);
  db.prepare("INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("statement-workspace", "Statements", "statement-user", now, now);
  mandateId = FundedMandateService.create("statement-workspace", {
    name: "Statement pilot",
    objective: "Observe qualified leads",
    budget: { byAsset: { USDC: { authorizedAmount: "1000" } } },
    measurementWindow: { startsAt: "2026-08-01T00:00:00.000Z", endsAt: "2026-08-31T23:59:59.000Z" },
    successMetrics: [{ id: "leads", name: "Qualified leads", unit: "leads" }],
  }).id;
});

afterAll(() => {
  closeDb();
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, runsPath]) {
    try { fs.unlinkSync(file); } catch { /* best effort */ }
  }
});

describe("StatementService", () => {
  it("canonicalizes object keys while preserving array order", () => {
    expect(canonicalStringify({ z: 1, a: ["first", "second"] })).toBe('{"a":["first","second"],"z":1}');
  });

  it("generates a read-only candidate with observations, evidence, and known unknowns", async () => {
    OutcomeObservationService.create("statement-workspace", mandateId, {
      metricId: "leads",
      kind: "observed",
      value: "7",
      unit: "leads",
      observedAt: "2026-08-08T12:00:00.000Z",
      source: "CRM export",
      confidence: "self_reported",
      evidence: [{ type: "external_record", reference: "crm://export/2026-08-08" }],
    }, "statement-observation-1");

    const statement = await StatementService.generateCandidate("statement-workspace", mandateId);
    expect(statement.statementId).toBe("candidate");
    expect(statement.capital.byAsset.USDC).toMatchObject({ authorizedAmount: "1000", allocatedAmount: "0", consumedAmount: "0" });
    expect(statement.performance.outcomes).toHaveLength(1);
    expect(statement.evidence.externalReferences).toEqual(["crm://export/2026-08-08"]);
    expect(statement.performance.knownUnknowns).toContain("No governed spend attribution records were found in the mandate measurement window.");
    expect(statement.performance.attributionNote).not.toMatch(/ROI|return on token/i);
    expect(statement.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(statement.capital.cleanverseVerifiedSpendByAsset).toEqual({});
    expect(statement.capital.cleanverseVerifiedShareOfConsumed).toBeNull();
    expect(statement.performance.evidenceCompleteness.cleanverseVerifiedSpendRecordCount).toBe(0);
  });

  it("rejects cross-workspace statement access", async () => {
    await expect(StatementService.generateCandidate("other-workspace", mandateId)).rejects.toThrow(/mandate not found/i);
  });
});
