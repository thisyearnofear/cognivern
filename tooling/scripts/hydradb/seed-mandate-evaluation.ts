/**
 * Seed one deterministic local workspace for the held-out mandate evaluation.
 *
 * This is additive and idempotent: it creates only the named evaluation
 * workspace/mandate and one governed run/outcome if they do not exist.
 *
 * Run: pnpm hydradb:seed-mandate-eval
 */

import { getDb } from "@backend/db/index.js";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";
import { FundedMandateService } from "@backend/services/governance/FundedMandateService.js";
import { OutcomeObservationService } from "@backend/services/governance/OutcomeObservationService.js";
import { hydraDbMandateContext } from "@backend/services/hydradb/HydraDbMandateContextService.js";

const USER_ID = "hydra-eval-user";
const WORKSPACE_ID = "hydra-eval-workspace";
const MANDATE_ID = "hydra-eval-mandate";
const AGENT_ID = "hydra-eval-agent";
const POLICY_ID = "hydra-eval-policy";
const RUN_ID = "hydra-eval-run-001";
const OUTCOME_KEY = "hydra-eval-outcome-001";

function now(): string {
  return new Date().toISOString();
}

function seedSqlite(): void {
  const db = getDb();
  const timestamp = now();
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
  db.prepare(
    `INSERT OR IGNORE INTO funded_mandates
      (id, workspace_id, name, objective, agent_ids, status, budget_by_asset, policy_ids, measurement_window, success_metrics, settlement, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    MANDATE_ID,
    WORKSPACE_ID,
    "HydraDB mandate evaluation",
    "Acquire qualified customers with accountable agent spend",
    JSON.stringify([AGENT_ID]),
    "active",
    JSON.stringify({ USDC: { authorizedAmount: "1000", allocatedAmount: "250", consumedAmount: "250", pendingAmount: "0" } }),
    JSON.stringify([POLICY_ID]),
    JSON.stringify({ startsAt: "2026-08-01T00:00:00.000Z" }),
    JSON.stringify([{ id: "qualified-leads", name: "Qualified leads", unit: "leads", target: "10" }]),
    null,
    "2026-08-01T00:00:00.000Z",
    "2026-08-13T00:00:00.000Z",
  );
}

async function seedRun(): Promise<void> {
  if (await creRunStore.get(RUN_ID)) return;
  const timestamp = "2026-08-12T12:00:00.000Z";
  const txHash = `0x${"a".repeat(64)}`;
  const run: CreRun = {
    runId: RUN_ID,
    projectId: WORKSPACE_ID,
    workflow: "spend",
    mode: "cre",
    startedAt: timestamp,
    finishedAt: timestamp,
    ok: true,
    status: "completed",
    approvalState: "approved",
    controls: { canCancel: false, canRetry: true, canApprove: false },
    provenance: { source: "cognivern", workflowVersion: "hydra-eval-v1" },
    events: [],
    steps: [],
    artifacts: [
      {
        id: `${RUN_ID}-intent`,
        createdAt: timestamp,
        type: "spend_intent",
        data: {
          id: `${RUN_ID}-intent`,
          agentId: AGENT_ID,
          recipient: "growth-analytics-vendor",
          amount: "250",
          asset: "USDC",
          mandateId: MANDATE_ID,
          reason: "Qualified-customer acquisition experiment",
          metadata: {
            vendor: "growth-analytics-vendor",
            policyId: POLICY_ID,
            mandateId: MANDATE_ID,
            chain: "arbitrum-sepolia",
          },
        },
      },
      {
        id: `${RUN_ID}-attribution`,
        createdAt: timestamp,
        type: "capital_attribution",
        data: {
          version: 1,
          allocationId: `${RUN_ID}-allocation`,
          workspaceId: WORKSPACE_ID,
          mandateId: MANDATE_ID,
          intentId: `${RUN_ID}-intent`,
          agentId: AGENT_ID,
          policyId: POLICY_ID,
          asset: "USDC",
          requestedAmount: "250",
          allocatedAmount: "250",
          consumedAmount: "250",
          status: "consumed",
          provider: "local",
          transactionHash: txHash,
          transactionLink: `https://sepolia.arbiscan.io/tx/${txHash}`,
          recordedAt: timestamp,
        },
      },
    ],
    metrics: { latencyMs: 420, stepCount: 2, artifactCount: 2 },
    evidence: { hash: `0x${"b".repeat(64)}` },
  };
  await creRunStore.add(run);
}

function seedOutcome(): void {
  const existing = OutcomeObservationService.list(WORKSPACE_ID, MANDATE_ID);
  if (existing.some((observation) => observation.id === "hydra-eval-outcome-001")) return;
  OutcomeObservationService.create(
    WORKSPACE_ID,
    MANDATE_ID,
    {
      metricId: "qualified-leads",
      kind: "verified_external_state",
      value: "12",
      unit: "leads",
      observedAt: "2026-08-13T12:00:00.000Z",
      source: "CRM verification",
      confidence: "independently_verified",
      evidence: [{ type: "artifact", reference: "crm://hydra-eval/qualified-leads", hash: `0x${"c".repeat(64)}` }],
      notes: "Internal CRM note retained only in Cognivern's authoritative ledger.",
    },
    OUTCOME_KEY,
  );
}

async function main() {
  seedSqlite();
  const mandate = FundedMandateService.get(WORKSPACE_ID, MANDATE_ID);
  if (!mandate) throw new Error("Seeded mandate was not persisted");
  await seedRun();
  seedOutcome();

  const sync = await hydraDbMandateContext.syncMandate(WORKSPACE_ID, MANDATE_ID, "manual");
  console.log(JSON.stringify({
    workspaceId: WORKSPACE_ID,
    mandateId: MANDATE_ID,
    name: mandate.name,
    syncStatus: sync.syncStatus,
    collection: sync.collection,
    ingested: sync.ingested,
    warning: sync.warning,
  }, null, 2));
  if (sync.syncStatus === "failed" || sync.syncStatus === "disabled") process.exitCode = 1;
}

main().catch((error) => {
  console.error("Mandate evaluation seed failed:", error);
  process.exitCode = 1;
});
