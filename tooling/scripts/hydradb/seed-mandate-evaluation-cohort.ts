/**
 * Seed an additive local cohort for mandate retrieval evaluation.
 *
 * This never targets production: it writes only the named local evaluation
 * workspace and deterministic mandate/run records. The cohort represents:
 *   - hydra-eval-mandate: evidence-backed spend + verified outcome
 *   - hydra-eval-mandate-hold: spend exists but receipt/outcome evidence is missing
 *   - hydra-eval-mandate-early: authorized mandate with no spend or outcomes yet
 *
 * Run: pnpm hydradb:seed-mandate-eval-cohort
 */

import { getDb } from "@backend/db/index.js";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";
import { FundedMandateService } from "@backend/services/governance/FundedMandateService.js";
import { hydraDbMandateContext } from "@backend/services/hydradb/HydraDbMandateContextService.js";

const USER_ID = "hydra-eval-user";
const WORKSPACE_ID = "hydra-eval-workspace";
const AGENT_ID = "hydra-eval-agent";
const POLICY_ID = "hydra-eval-policy";

const MANDATES = [
  {
    id: "hydra-eval-mandate",
    name: "HydraDB mandate evaluation",
    objective: "Acquire qualified customers with accountable agent spend",
    status: "active",
    authorized: "1000",
    allocated: "250",
    consumed: "250",
    pending: "0",
    updatedAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "hydra-eval-mandate-hold",
    name: "HydraDB evidence gap review",
    objective: "Test spend reconciliation before the next allocation",
    status: "active",
    authorized: "500",
    allocated: "100",
    consumed: "100",
    pending: "0",
    updatedAt: "2026-08-12T00:00:00.000Z",
  },
  {
    id: "hydra-eval-mandate-early",
    name: "HydraDB early mandate",
    objective: "Validate a new agent workflow before funding expansion",
    status: "draft",
    authorized: "750",
    allocated: "0",
    consumed: "0",
    pending: "0",
    updatedAt: "2026-08-11T00:00:00.000Z",
  },
] as const;

function seedWorkspace(): void {
  const db = getDb();
  const timestamp = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(USER_ID, timestamp, timestamp);
  db.prepare("INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run(
    WORKSPACE_ID,
    "HydraDB Mandate Evaluation",
    USER_ID,
    timestamp,
    timestamp,
  );
  db.prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").run(WORKSPACE_ID, USER_ID, timestamp);
  db.prepare("INSERT OR IGNORE INTO workspace_agents (id, workspace_id, name, role, chain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    AGENT_ID,
    WORKSPACE_ID,
    "Mandate Evidence Agent",
    "capital_operator",
    "evm",
    timestamp,
    timestamp,
  );
  db.prepare("INSERT OR IGNORE INTO workspace_policies (id, workspace_id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    POLICY_ID,
    WORKSPACE_ID,
    "Evidence-backed allocation policy",
    "budget",
    timestamp,
    timestamp,
  );

  for (const mandate of MANDATES) {
    db.prepare(
      `INSERT OR IGNORE INTO funded_mandates
        (id, workspace_id, name, objective, agent_ids, status, budget_by_asset, policy_ids, measurement_window, success_metrics, settlement, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      mandate.id,
      WORKSPACE_ID,
      mandate.name,
      mandate.objective,
      JSON.stringify([AGENT_ID]),
      mandate.status,
      JSON.stringify({ USDC: {
        authorizedAmount: mandate.authorized,
        allocatedAmount: mandate.allocated,
        consumedAmount: mandate.consumed,
        pendingAmount: mandate.pending,
      } }),
      JSON.stringify([POLICY_ID]),
      JSON.stringify({ startsAt: "2026-08-01T00:00:00.000Z" }),
      JSON.stringify([{ id: "qualified-leads", name: "Qualified leads", unit: "leads", target: "10" }]),
      null,
      "2026-08-01T00:00:00.000Z",
      mandate.updatedAt,
    );
  }
}

function buildRun(params: {
  runId: string;
  mandateId: string;
  amount: string;
  timestamp: string;
  transactionHash?: string;
}): CreRun {
  const intentId = `${params.runId}-intent`;
  return {
    runId: params.runId,
    projectId: WORKSPACE_ID,
    workflow: "spend",
    mode: "cre",
    startedAt: params.timestamp,
    finishedAt: params.timestamp,
    ok: true,
    status: "completed",
    approvalState: "approved",
    controls: { canCancel: false, canRetry: true, canApprove: false },
    provenance: { source: "cognivern", workflowVersion: "hydra-eval-cohort-v1" },
    events: [],
    steps: [],
    artifacts: [
      {
        id: intentId,
        createdAt: params.timestamp,
        type: "spend_intent",
        data: {
          id: intentId,
          agentId: AGENT_ID,
          recipient: "growth-analytics-vendor",
          amount: params.amount,
          asset: "USDC",
          mandateId: params.mandateId,
          reason: "Evaluation cohort spend",
          metadata: { vendor: "growth-analytics-vendor", policyId: POLICY_ID, mandateId: params.mandateId, chain: "arbitrum-sepolia" },
        },
      },
      {
        id: `${params.runId}-attribution`,
        createdAt: params.timestamp,
        type: "capital_attribution",
        data: {
          version: 1,
          allocationId: `${params.runId}-allocation`,
          workspaceId: WORKSPACE_ID,
          mandateId: params.mandateId,
          intentId,
          agentId: AGENT_ID,
          policyId: POLICY_ID,
          asset: "USDC",
          requestedAmount: params.amount,
          allocatedAmount: params.amount,
          consumedAmount: params.amount,
          status: "consumed",
          provider: "local",
          ...(params.transactionHash ? { transactionHash: params.transactionHash } : {}),
          recordedAt: params.timestamp,
        },
      },
    ],
    metrics: { latencyMs: 420, stepCount: 2, artifactCount: 2 },
    evidence: { hash: `0x${"d".repeat(64)}` },
  };
}

async function seedRuns(): Promise<void> {
  const runs = [
    buildRun({
      runId: "hydra-eval-run-001",
      mandateId: "hydra-eval-mandate",
      amount: "250",
      timestamp: "2026-08-12T12:00:00.000Z",
      transactionHash: `0x${"a".repeat(64)}`,
    }),
    buildRun({
      runId: "hydra-eval-run-hold-001",
      mandateId: "hydra-eval-mandate-hold",
      amount: "100",
      timestamp: "2026-08-11T12:00:00.000Z",
    }),
  ];
  for (const run of runs) {
    if (!(await creRunStore.get(run.runId))) await creRunStore.add(run);
  }
}

async function main(): Promise<void> {
  seedWorkspace();
  await seedRuns();
  const syncs = [];
  for (const mandate of MANDATES) {
    syncs.push(await hydraDbMandateContext.syncMandate(WORKSPACE_ID, mandate.id, "manual"));
  }
  console.log(JSON.stringify({
    workspaceId: WORKSPACE_ID,
    mandates: syncs.map((sync) => ({
      mandateId: sync.mandateId,
      syncStatus: sync.syncStatus,
      collection: sync.collection,
      ingested: sync.ingested,
      warning: sync.warning,
    })),
  }, null, 2));
  if (syncs.some((sync) => sync.syncStatus === "failed" || sync.syncStatus === "disabled")) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Mandate evaluation cohort seed failed:", error);
  process.exitCode = 1;
});
