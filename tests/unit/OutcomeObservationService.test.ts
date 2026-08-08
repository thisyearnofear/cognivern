import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-outcomes-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationService } = await import("@backend/services/governance/OutcomeObservationService.js");

let mandateId = "";

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("outcome-user", now, now);
  db.prepare("INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("outcome-workspace-a", "Outcome A", "outcome-user", now, now);
  db.prepare("INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("outcome-workspace-b", "Outcome B", "outcome-user", now, now);
  const mandate = FundedMandateService.create("outcome-workspace-a", {
    name: "Customer acquisition",
    objective: "Observe qualified pipeline",
    successMetrics: [{ id: "qualified_leads", name: "Qualified leads", unit: "leads" }],
  });
  mandateId = mandate.id;
});

afterAll(() => {
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* cleanup best effort */ }
  }
});

describe("OutcomeObservationService", () => {
  const input = {
    metricId: "qualified_leads",
    kind: "observed" as const,
    value: "12",
    unit: "leads",
    observedAt: "2026-08-08T12:00:00.000Z",
    source: "CRM export",
    confidence: "self_reported" as const,
    evidence: [{ type: "external_record" as const, reference: "crm://export/2026-08-08" }],
  };

  it("creates and replays an observation without duplicating it", () => {
    const first = OutcomeObservationService.create("outcome-workspace-a", mandateId, input, "observation-1");
    const second = OutcomeObservationService.create("outcome-workspace-a", mandateId, input, "observation-1");
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.observation.id).toBe(first.observation.id);
    expect(OutcomeObservationService.list("outcome-workspace-a", mandateId)).toHaveLength(1);
  });

  it("rejects reuse of a key for a changed payload", () => {
    expect(() => OutcomeObservationService.create("outcome-workspace-a", mandateId, { ...input, value: "13" }, "observation-1")).toThrow(/idempotency/i);
  });

  it("rejects cross-workspace mandate access and invalid metric references", () => {
    expect(() => OutcomeObservationService.create("outcome-workspace-b", mandateId, input, "other-workspace-key")).toThrow(/mandate not found/i);
    expect(() => OutcomeObservationService.list("outcome-workspace-b", mandateId)).toThrow(/mandate not found/i);
    expect(() => OutcomeObservationService.create("outcome-workspace-a", mandateId, { ...input, metricId: "not-a-metric" }, "observation-2")).toThrow(/metric/i);
    expect(() => OutcomeObservationService.create("outcome-workspace-a", mandateId, { ...input, unit: "customers" }, "observation-5")).toThrow(/unit/i);
  });

  it("requires independently verified evidence for verified external state", () => {
    expect(() => OutcomeObservationService.create("outcome-workspace-a", mandateId, { ...input, kind: "verified_external_state", confidence: "system_observed" }, "observation-3")).toThrow(/independently verified/i);
    const verified = OutcomeObservationService.create("outcome-workspace-a", mandateId, {
      ...input,
      kind: "verified_external_state",
      confidence: "independently_verified",
      evidence: [{ type: "url", reference: "https://example.test/record", hash: "ABC123" }],
    }, "observation-4");
    expect(verified.observation.kind).toBe("verified_external_state");
    expect(verified.observation.confidence).toBe("independently_verified");
    expect(verified.observation.evidence[0]?.hash).toBe("abc123");
  });
});
