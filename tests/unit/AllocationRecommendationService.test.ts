import { beforeAll, afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-recommendations-${process.pid}-${Date.now()}.db`);
const runsPath = path.join(os.tmpdir(), `cognivern-recommendation-runs-${process.pid}-${Date.now()}.jsonl`);
process.env.DB_PATH = dbPath;
process.env.CRE_RUNS_FILE = runsPath;
process.env.MONGODB_URI = "";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationService } = await import("@backend/services/governance/OutcomeObservationService.js");
const { AllocationRecommendationService } = await import("@backend/services/governance/AllocationRecommendationService.js");
const { creRunStore } = await import("@backend/cre/storage/CreRunStore.js");

let mandateId = "";
let verifiedMandateId = "";
let closedMandateId = "";
let cleanverseMandateId = "";

function attributionRun(
  runId: string,
  mandate: string,
  asset: string,
  amount: string,
  status: string,
  transactionHash?: string,
  extras?: { provider?: string; compliance?: Record<string, unknown> },
) {
  return {
    runId,
    projectId: "recommendation-workspace",
    workflow: "spend" as const,
    mode: "cre" as const,
    startedAt: "2026-08-01T00:00:00.000Z",
    finishedAt: "2026-08-02T00:00:00.000Z",
    ok: status === "consumed",
    status: status === "consumed" ? "completed" as const : "paused_for_approval" as const,
    steps: [],
    artifacts: [
      {
        id: `${runId}-artifact`,
        type: "capital_attribution" as const,
        createdAt: "2026-08-01T00:00:00.000Z",
        data: {
          version: 1,
          allocationId: `allocation-${runId}`,
          workspaceId: "recommendation-workspace",
          mandateId: mandate,
          intentId: `intent-${runId}`,
          agentId: "agent-1",
          asset,
          requestedAmount: amount,
          allocatedAmount: amount,
          consumedAmount: status === "consumed" ? amount : "0",
          status,
          ...(transactionHash ? { transactionHash } : {}),
          ...(extras?.provider ? { provider: extras.provider } : {}),
          ...(extras?.compliance ? { compliance: extras.compliance } : {}),
        },
      },
    ],
  };
}

beforeAll(async () => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("recommendation-user", now, now);
  db.prepare("INSERT INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("recommendation-workspace", "Recommendations", "recommendation-user", now, now);

  mandateId = FundedMandateService.create("recommendation-workspace", {
    name: "Held mandate",
    objective: "No verified evidence yet",
    budget: { byAsset: { USDC: { authorizedAmount: "1000" } } },
  }).id;

  closedMandateId = FundedMandateService.create("recommendation-workspace", {
    name: "Closed mandate",
    objective: "Complete evidence but no longer active",
    status: "closed",
    budget: { byAsset: { USDC: { authorizedAmount: "1000" } } },
  }).id;
  OutcomeObservationService.create("recommendation-workspace", closedMandateId, {
    kind: "verified_external_state",
    value: "3",
    unit: "leads",
    observedAt: "2026-08-08T12:00:00.000Z",
    source: "CRM verified",
    confidence: "independently_verified",
    evidence: [{ type: "external_record", reference: "crm://verified-closed/2026-08-08" }],
  }, "recommendation-observation-closed");
  await creRunStore.add(attributionRun("closed-run-1", closedMandateId, "USDC", "100", "consumed", "0x" + "c".repeat(64)) as any);

  // The verified mandate declares budget totals that match the governed
  // attribution recorded below (allocated/consumed 500 of the 1000 authorized)
  // so the generated statement is a complete evidence package.
  verifiedMandateId = FundedMandateService.create("recommendation-workspace", {
    name: "Verified mandate",
    objective: "Has verified outcomes",
    status: "active",
    budget: { byAsset: { USDC: { authorizedAmount: "1000", allocatedAmount: "500", consumedAmount: "500" } } },
  }).id;

  OutcomeObservationService.create("recommendation-workspace", verifiedMandateId, {
    kind: "verified_external_state",
    value: "10",
    unit: "leads",
    observedAt: "2026-08-08T12:00:00.000Z",
    source: "CRM verified",
    confidence: "independently_verified",
    evidence: [{ type: "external_record", reference: "crm://verified/2026-08-08" }],
  }, "recommendation-observation-1");

  await creRunStore.add(attributionRun("verified-run-1", verifiedMandateId, "USDC", "500", "consumed", "0x" + "a".repeat(64)) as any);
  await creRunStore.add(attributionRun("held-run-1", mandateId, "USDC", "100", "held") as any);

  cleanverseMandateId = FundedMandateService.create("recommendation-workspace", {
    name: "Cleanverse settlement mandate",
    objective: "Requires verified settlement but has only unverified spend",
    status: "active",
    budget: {
      byAsset: { "aUSD-D": { authorizedAmount: "1000000", allocatedAmount: "500000", consumedAmount: "500000" } },
    },
    settlement: {
      requireVerifiedSettlement: true,
      requireCleanverseIdentity: true,
      allowedAssets: ["aUSD-D"],
      chainIds: [10143],
    },
  }).id;
  OutcomeObservationService.create("recommendation-workspace", cleanverseMandateId, {
    kind: "verified_external_state",
    value: "2",
    unit: "leads",
    observedAt: "2026-08-08T12:00:00.000Z",
    source: "CRM verified",
    confidence: "independently_verified",
    evidence: [{ type: "external_record", reference: "crm://verified-cleanverse/2026-08-08" }],
  }, "recommendation-observation-cleanverse");
  await creRunStore.add(
    attributionRun(
      "cleanverse-unverified-run",
      cleanverseMandateId,
      "aUSD-D",
      "500000",
      "consumed",
      "0x" + "b".repeat(64),
    ) as any,
  );
});

afterAll(() => {
  closeDb();
  for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, runsPath]) {
    try { fs.unlinkSync(file); } catch { /* best effort */ }
  }
});

describe("AllocationRecommendationService", () => {
  it("fails closed with hold when evidence is insufficient", async () => {
    const recommendation = await AllocationRecommendationService.generate("recommendation-workspace", mandateId);
    expect(recommendation.status).toBe("insufficient_evidence");
    expect(recommendation.recommendation.stance).toBe("hold");
    expect(recommendation.evidenceCompleteness.blockers.length).toBeGreaterThan(0);
    // Zero verified outcomes means the cost metric is not meaningful.
    expect(recommendation.operationalMetrics.costPerObservedOutcomeByAsset).toEqual({});
  });

  it("recommends a next allocation only with verified outcomes and receipt-backed spend", async () => {
    const recommendation = await AllocationRecommendationService.generate("recommendation-workspace", verifiedMandateId);
    expect(recommendation.status).toBe("ready");
    expect(recommendation.recommendation.stance).toBe("consider_next_allocation");
    expect(recommendation.evidenceCompleteness.verifiedOutcomeCount).toBe(1);
    expect(recommendation.evidenceCompleteness.verifiedSpendRecordCount).toBe(1);
    expect(recommendation.operationalMetrics.costPerObservedOutcomeByAsset.USDC).toBe("500");
    expect(recommendation.governanceNote).toMatch(/never executed automatically|explicit operator approval/i);
  });

  it("holds the stance for closed mandates even with complete evidence", async () => {
    const recommendation = await AllocationRecommendationService.generate("recommendation-workspace", closedMandateId);
    expect(recommendation.recommendation.stance).toBe("hold");
    expect(recommendation.recommendation.reasoning.join(" ")).toMatch(/closed|active/i);
  });

  it("holds when a verified-settlement mandate lacks Cleanverse-attributed spend", async () => {
    const recommendation = await AllocationRecommendationService.generate(
      "recommendation-workspace",
      cleanverseMandateId,
    );
    expect(recommendation.recommendation.stance).toBe("hold");
    expect(recommendation.evidenceCompleteness.blockers.join(" ")).toMatch(/Cleanverse|verified settlement/i);
  });

  it("rejects cross-workspace recommendation access", async () => {
    await expect(AllocationRecommendationService.generate("other-workspace", verifiedMandateId)).rejects.toThrow(/mandate not found/i);
  });
});
