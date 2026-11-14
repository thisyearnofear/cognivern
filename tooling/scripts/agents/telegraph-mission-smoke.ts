#!/usr/bin/env tsx
/**
 * Telegraph Mission smoke test — exercises the Season II build paths against
 * the live network with real (tiny) x402 payments:
 *
 *   1. Compliance screen (SANCTIONS_SCREENING_MATCH) via runComplianceScreen
 *   2. Parent paid call + ledger projection (buildTelegraphLedgerReport)
 *   3. Optional: verify-sample over seeded inference records
 *      (VERIFICATION_SMOKE=1, seeds two open-tier records first)
 *
 * Run:
 *   set -a && . ./.env && set +a && pnpm exec tsx tooling/scripts/agents/telegraph-mission-smoke.ts
 *
 * Costs a few ~$0.01 paid calls. All runs persist as CRE runs under the
 * smoke workspace id so they show up in /api/telegraph/ledger honestly.
 */

import {
  runComplianceScreen,
  evaluateComplianceVerdict,
  telegraphGovernanceHelper,
  recordTelegraphGovernedCall,
  recordTelegraphGateDecision,
  buildTelegraphLedgerReport,
} from "../../../src/backend/services/telegraph/index.js";
import { creRunStore } from "../../../src/backend/cre/storage/CreRunStore.js";

const WORKSPACE = "local-smoke";
const AGENT = "mission-smoke";

async function main() {
  console.log("== 1. Compliance screen (SANCTIONS_SCREENING_MATCH) ==");
  const screen = await runComplianceScreen({
    agentId: AGENT,
    workspaceId: WORKSPACE,
    mandateId: "telegraph-s2-smoke",
    screen: {
      intent: "SANCTIONS_SCREENING_MATCH",
      params: { name: "Acme Corporation" },
    },
    description: "Smoke: screen payee before intelligence purchase",
  });
  console.log(
    JSON.stringify(
      {
        verdict: screen.verdict,
        detail: screen.detail,
        miner: `${screen.minerName ?? screen.minerId} (${screen.intent})`,
        confidence: screen.confidence,
        costUsd: screen.costUsd,
        screeningRunId: screen.runId,
        blocked: screen.blocked,
        blockReason: screen.blockReason,
      },
      null,
      2,
    ),
  );

  console.log("\n== 2. Parent paid call (gated on screen verdict) ==");
  if (screen.blocked) {
    const gateRun = await recordTelegraphGateDecision({
      projectId: WORKSPACE,
      agentId: AGENT,
      mandateId: "telegraph-s2-smoke",
      gate: "compliance",
      reason: screen.blockReason ?? `screening verdict ${screen.verdict}`,
      compliance: {
        verdict: screen.verdict,
        screeningRunId: screen.runId,
        screeningMinerId: screen.minerId,
      },
      intendedCall: { minerId: "txlens", intent: "GAS_PRICE" },
    });
    console.log(`Blocked as designed — gate run ${gateRun?.runId}`);
  } else {
    const result = await telegraphGovernanceHelper.governedMinerCall({
      agentId: AGENT,
      workspaceId: WORKSPACE,
      mandateId: "telegraph-s2-smoke",
      minerRequest: {
        minerId: "txlens",
        intent: "GAS_PRICE",
        params: { chain: "eth" },
      },
      description: "Smoke: governed gas-price call after clear screen",
    });
    const artifactData = result.artifact?.data;
    if (artifactData && typeof artifactData === "object") {
      (artifactData as Record<string, unknown>).compliance = {
        gate: "compliance",
        verdict: screen.verdict,
        screeningRunId: screen.runId,
        screeningMinerId: screen.minerId ?? null,
      };
    }
    const run = await recordTelegraphGovernedCall({
      result,
      projectId: WORKSPACE,
      agentId: AGENT,
      description: "Smoke: governed gas-price call after clear screen",
    });
    console.log(
      JSON.stringify(
        {
          status: result.status,
          confidence: result.decision?.actualConfidence,
          costUsd: result.response?.metadata.costUsd,
          runId: run?.runId,
          runStatus: run?.status,
        },
        null,
        2,
      ),
    );
  }

  console.log("\n== 3. Ledger projection ==");
  const runs = await creRunStore.list();
  const report = buildTelegraphLedgerReport(
    runs.filter((r) => r.projectId === WORKSPACE),
  );
  console.log(
    JSON.stringify(
      {
        totals: report.totals,
        byIntent: report.byIntent,
        records: report.records.map((r) => ({
          runId: r.runId,
          miner: r.minerName,
          intent: r.intent,
          disposition: r.disposition,
          costUsd: r.costUsd,
          complianceVerdict: r.complianceVerdict,
        })),
      },
      null,
      2,
    ),
  );

  if (process.env.VERIFICATION_SMOKE === "1") {
    console.log("\n== 4. Verification sample (Mission 10) ==");
    const { sharedInferenceVerificationService } = await import(
      "../../../src/backend/services/inference/InferenceVerificationService.js"
    );
    const { getDb } = await import("../../../src/backend/db/index.js");
    const db = getDb();
    const participant = db
      .prepare(
        `SELECT id, program_id, workspace_id FROM credit_participants LIMIT 1`,
      )
      .get() as { id: string; program_id: string; workspace_id: string } | undefined;
    if (!participant) {
      console.log("No credit_participants row — skipping verify smoke.");
      return;
    }
    // Seed two open-tier records if the table is empty (local dev DB only).
    const count = db
      .prepare(`SELECT COUNT(*) AS c FROM inference_records WHERE program_id = ?`)
      .get(participant.program_id) as { c: number };
    if (count.c === 0) {
      const { InferenceRecordStore } = await import(
        "../../../src/backend/services/credits/InferenceRecordStore.js"
      );
      const store = new InferenceRecordStore(db);
      for (const [prompt, response] of [
        ["What is 2+2? Reply with just the number.", "4"],
        ["What is the capital of France?", "Paris"],
      ]) {
        store.insert({
          programId: participant.program_id,
          participantId: participant.id,
          workspaceId: participant.workspace_id,
          disclosureTier: "open",
          backend: "smoke",
          model: "smoke-verified-model",
          status: "ok",
          inputTokens: 10,
          outputTokens: 5,
          cachedTokens: 0,
          costNano: 500_000,
          latencyMs: 50,
          streamed: false,
          redactionCount: 0,
          redactionCategories: [],
          taskClass: "question_answering",
          promptExcerpt: prompt,
          responseExcerpt: response,
        });
      }
      console.log("Seeded 2 open-tier inference records for smoke.");
    }
    const result = await sharedInferenceVerificationService().verifySample({
      programId: participant.program_id,
      workspaceId: participant.workspace_id,
      limit: 2,
    });
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((err) => {
  console.error("Smoke failed:", err);
  process.exit(1);
});
