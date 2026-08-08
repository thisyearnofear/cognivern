import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-published-${process.pid}-${Date.now()}.db`);
const runsPath = path.join(os.tmpdir(), `cognivern-published-runs-${process.pid}-${Date.now()}.jsonl`);
process.env.DB_PATH = dbPath;
process.env.CRE_RUNS_FILE = runsPath;
process.env.MONGODB_URI = "";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationService } = await import("@backend/services/governance/OutcomeObservationService.js");
const { PublishedStatementService } = await import("@backend/services/governance/PublishedStatementService.js");
const { hashStatementPayload } = await import("@backend/services/governance/StatementService.js");
const { creRunStore } = await import("@backend/cre/storage/CreRunStore.js");

const WORKSPACE = "publication-workspace";
let verifiedMandateId = "";
let overAuthorizedMandateId = "";

function attributionRun(runId: string, mandate: string, asset: string, amount: string, transactionHash?: string) {
  return {
    runId,
    projectId: WORKSPACE,
    workflow: "spend" as const,
    mode: "cre" as const,
    startedAt: "2026-08-01T00:00:00.000Z",
    finishedAt: "2026-08-02T00:00:00.000Z",
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
          allocationId: `allocation-${runId}`,
          workspaceId: WORKSPACE,
          mandateId: mandate,
          intentId: `intent-${runId}`,
          agentId: "agent-1",
          asset,
          requestedAmount: amount,
          allocatedAmount: amount,
          consumedAmount: amount,
          status: "consumed",
          ...(transactionHash ? { transactionHash } : {}),
        },
      },
    ],
  };
}

beforeAll(async () => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("publication-user", now, now);
  db.prepare("INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run(WORKSPACE, "Publication", "publication-user", now, now);

  verifiedMandateId = FundedMandateService.create(WORKSPACE, {
    name: "Verified mandate",
    objective: "Complete evidence package for publication",
    status: "active",
    budget: { byAsset: { USDC: { authorizedAmount: "1000", allocatedAmount: "500", consumedAmount: "500" } } },
  }).id;
  OutcomeObservationService.create(WORKSPACE, verifiedMandateId, {
    kind: "verified_external_state",
    value: "10",
    unit: "leads",
    observedAt: "2026-08-08T12:00:00.000Z",
    source: "CRM verified",
    confidence: "independently_verified",
    evidence: [{ type: "external_record", reference: "crm://verified/2026-08-08", hash: "0xevidence1" }],
    notes: "Operator note with internal details",
  }, "publication-observation-1");
  await creRunStore.add(attributionRun("published-run-1", verifiedMandateId, "USDC", "500", "0x" + "a".repeat(64)) as any);

  // A mandate whose derived governed allocation (500) exceeds its declared
  // authorization (100) — candidate generation fails closed, so publish must
  // refuse to freeze an invalid snapshot.
  overAuthorizedMandateId = FundedMandateService.create(WORKSPACE, {
    name: "Over-authorized mandate",
    objective: "Derived spend exceeds authorization",
    status: "active",
    budget: { byAsset: { USDC: { authorizedAmount: "100" } } },
  }).id;
  await creRunStore.add(attributionRun("over-run-1", overAuthorizedMandateId, "USDC", "500", "0x" + "b".repeat(64)) as any);
});

afterAll(() => {
  closeDb();
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, runsPath]) {
    try { fs.unlinkSync(file); } catch { /* best effort */ }
  }
});

describe("PublishedStatementService", () => {
  it("publishes an immutable v1 snapshot with a stable content hash", async () => {
    const published = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    expect(published.id).toBe(`statement-${verifiedMandateId}-v1`);
    expect(published.version).toBe(1);
    expect(published.publishedBy).toBe("publication-user");
    expect(published.payload.statementId).toBe(published.id);
    expect(published.payload.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(published.payload.performance.outcomes).toHaveLength(1);
    // The published hash is reproducible from the stored payload alone.
    expect(hashStatementPayload(published.payload)).toBe(published.payload.contentHash);
  });

  it("versions subsequent publications without mutating earlier snapshots", async () => {
    const first = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    const second = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    expect(second.version).toBe(first.version + 1);
    expect(second.id).not.toBe(first.id);

    // The earlier snapshot is still retrievable unchanged.
    const fetched = PublishedStatementService.get(WORKSPACE, verifiedMandateId, first.id);
    expect(fetched?.id).toBe(first.id);
    expect(fetched?.payload.contentHash).toBe(first.payload.contentHash);
  });

  it("lists versions newest-first with summaries only", async () => {
    const first = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    const second = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    const summaries = PublishedStatementService.list(WORKSPACE, verifiedMandateId);
    expect(summaries[0].version).toBe(second.version);
    expect(summaries[1].version).toBe(first.version);
    for (const item of summaries) {
      expect(item.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect("payload" in item).toBe(false);
    }
    const versions = summaries.map((item) => item.version);
    expect(versions).toEqual([...versions].sort((a, b) => b - a));
  });

  it("exports a permissioned redacted copy that preserves capital and hashes", async () => {
    const published = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    const exported = PublishedStatementService.export(WORKSPACE, verifiedMandateId, published.id);
    expect(exported).toBeDefined();
    expect(exported!.redacted).toBe(true);
    expect(exported!.originalContentHash).toBe(published.payload.contentHash);
    expect(exported!.contentHash).toMatch(/^[0-9a-f]{64}$/);
    // Redaction changes the payload, so the export hash must differ from the original.
    expect(exported!.contentHash).not.toBe(exported!.originalContentHash);
    // A verifier recomputing the canonical hash (excluding contentHash and the
    // display timestamp) reproduces the export hash from the payload alone.
    expect(hashStatementPayload(exported!.payload)).toBe(exported!.contentHash);

    // Internal details are stripped while capital framing is preserved.
    expect(exported!.payload.performance.outcomes[0].source).toBe("[redacted]");
    expect(exported!.payload.performance.outcomes[0].notes).toBe("[redacted]");
    expect(exported!.payload.performance.outcomes[0].evidence[0].reference).toBe("[redacted]");
    expect(exported!.payload.performance.outcomes[0].evidence[0].hash).toBe("0xevidence1");
    expect(exported!.payload.evidence.externalReferences).toEqual(["[redacted]"]);
    expect(exported!.payload.capital.byAsset.USDC.authorizedAmount).toBe("1000");
    expect(exported!.payload.capital.byAsset.USDC.allocatedAmount).toBe("500");

    // The stored snapshot is never mutated by the export.
    const untouched = PublishedStatementService.get(WORKSPACE, verifiedMandateId, published.id);
    expect(untouched?.payload.performance.outcomes[0].source).toBe("CRM verified");
  });

  it("enforces workspace isolation for list, get, and export", async () => {
    const published = await PublishedStatementService.publish(WORKSPACE, verifiedMandateId, "publication-user");
    expect(PublishedStatementService.list("other-workspace", verifiedMandateId)).toEqual([]);
    expect(PublishedStatementService.get("other-workspace", verifiedMandateId, published.id)).toBeUndefined();
    expect(PublishedStatementService.export("other-workspace", verifiedMandateId, published.id)).toBeUndefined();
  });

  it("fails closed when the candidate would exceed authorization", async () => {
    await expect(PublishedStatementService.publish(WORKSPACE, overAuthorizedMandateId, "publication-user")).rejects.toThrow(/exceeds authorization/i);
    // Nothing was persisted.
    expect(PublishedStatementService.list(WORKSPACE, overAuthorizedMandateId)).toEqual([]);
  });
});
