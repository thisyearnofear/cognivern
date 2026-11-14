/**
 * Mission 10 smoke: seed one open-tier inference record locally, then run a
 * real paid evaluator sample through the governed Telegraph path and print
 * the resulting verdict + leaderboard row.
 *
 * Local-only: the record is inserted into the dev SQLite DB so the sampling
 * and persistence rails can be exercised without a live gateway call. The
 * Telegraph evaluation itself is a real paid miner call (~$0.01).
 *
 * Usage: set -a && . ./.env && set +a && pnpm exec tsx tooling/scripts/agents/telegraph-verify-sample-smoke.ts
 */

import { sharedInferenceRecordStore } from "../../../src/backend/services/credits/InferenceRecordStore.js";
import { sharedInferenceVerdictStore } from "../../../src/backend/services/credits/InferenceVerdictStore.js";
import { InferenceVerificationService } from "../../../src/backend/services/inference/InferenceVerificationService.js";

const PROGRAM_ID = process.env.SMOKE_PROGRAM_ID ?? "prog_b9a2165e-ecd5-48e6-94c9-4abd9f0ccd4d";
const PARTICIPANT_ID = process.env.SMOKE_PARTICIPANT_ID ?? "part_73f1634f-7b5d-4f11-be9e-babe9e98fd09";
const WORKSPACE_ID = process.env.SMOKE_WORKSPACE_ID ?? "6045bd98-f997-4628-b21e-78d035100f4d";

const records = sharedInferenceRecordStore();
const verdicts = sharedInferenceVerdictStore();

const recordId = records.insert({
  programId: PROGRAM_ID,
  participantId: PARTICIPANT_ID,
  workspaceId: WORKSPACE_ID,
  disclosureTier: "open",
  backend: "smoke",
  model: "smoke-verified-model",
  status: "ok",
  inputTokens: 12,
  outputTokens: 4,
  cachedTokens: 0,
  costNano: 1_000_000, // $0.001
  latencyMs: 120,
  streamed: false,
  redactionCount: 0,
  redactionCategories: [],
  taskClass: "question_answering",
  promptExcerpt: "What is 17 + 25?",
  responseExcerpt: "42",
});
console.log("seeded record", recordId);

const service = new InferenceVerificationService(verdicts);
const result = await service.verifySample({
  programId: PROGRAM_ID,
  workspaceId: WORKSPACE_ID,
  limit: 1,
  evaluatorMinerId: process.env.SMOKE_EVALUATOR_MINER_ID || undefined,
});
console.log(JSON.stringify(result, null, 2));

console.log("\n== leaderboard ==");
console.log(JSON.stringify(verdicts.leaderboard(PROGRAM_ID), null, 2));
