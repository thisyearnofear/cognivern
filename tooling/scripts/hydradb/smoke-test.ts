/**
 * HydraDB integration smoke test.
 *
 * Run: HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm tsx tooling/scripts/hydradb/smoke-test.ts
 *
 * Verifies the full lifecycle against the live HydraDB free tier:
 *   1. ensureDatabase (create + readiness)
 *   2. ingest a sample CRE run as app-knowledge
 *   3. waitForIndexing
 *   4. retrieve (fast mode) — should find the ingested run
 *   5. retrieve (thinking mode) — graph traversal
 *   6. print metrics (latency, call count, mode)
 *
 * Exits 0 on success, 1 on failure. Safe to re-run (upsert=true).
 */

import { config } from "@/config.js";
import {
  hydraDbIngestion,
  hydraDbRetrieval,
  type AppKnowledgeRecord,
} from "@backend/services/hydradb/index.js";
import type { CreRun } from "@backend/cre/types.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(`✗ ${msg}`);
    process.exit(1);
  } else {
    console.log(`✓ ${msg}`);
  }
}

async function main() {
  console.log("=== HydraDB smoke test ===\n");

  if (!config.HYDRADB_ENABLED) {
    console.error("HYDRADB_ENABLED is not true. Set it to run this smoke test.");
    process.exit(1);
  }
  if (!config.HYDRADB_API_KEY) {
    console.error("HYDRADB_API_KEY is not set.");
    process.exit(1);
  }

  console.log(`database: ${config.HYDRADB_DATABASE}`);
  console.log(`collection: ${config.HYDRADB_COLLECTION}\n`);

  // 1. Ensure database exists + ready.
  console.log("[1/6] ensureDatabase...");
  const ready = await hydraDbIngestion.ensureDatabase();
  assert(ready, "database ready for ingestion");

  // 2. Ingest a synthetic CRE run (mirrors the real cre-runs.jsonl shape).
  console.log("\n[2/6] ingest sample CRE run...");
  const sampleRun: CreRun = {
    runId: `smoke-${Date.now()}`,
    projectId: "smoke-test",
    workflow: "spend",
    mode: "cre",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    ok: true,
    status: "completed",
    approvalState: "not_required",
    controls: { canCancel: false, canRetry: true, canApprove: false },
    provenance: { source: "cognivern" },
    events: [],
    steps: [
      {
        kind: "compute",
        name: "policy_evaluation",
        startedAt: new Date().toISOString(),
        ok: true,
        summary: "Policy smoke-policy approved spend",
        details: {
          policyId: "smoke-policy",
          intent: {
            id: `spend_smoke_${Date.now()}`,
            agentId: "smoke-test-agent",
            recipient: "0xsmokeVendor",
            amount: "5",
            asset: "USDC",
            reason: "HydraDB smoke test spend",
            metadata: {
              walletId: "smoke-wallet",
              policyId: "smoke-policy",
              amountUsd: 5,
              vendor: "smoke-vendor",
              chain: "xlayer",
              purpose: "smoke_test",
            },
          },
        },
      },
    ],
    artifacts: [
      {
        id: `art-intent-${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: "spend_intent",
        data: {
          id: `spend_smoke_${Date.now()}`,
          agentId: "smoke-test-agent",
          recipient: "0xsmokeVendor",
          amount: "5",
          asset: "USDC",
          reason: "HydraDB smoke test spend",
          metadata: {
            walletId: "smoke-wallet",
            policyId: "smoke-policy",
            amountUsd: 5,
            vendor: "smoke-vendor",
            chain: "xlayer",
            purpose: "smoke_test",
          },
        },
        evidence: { hash: "0x".padEnd(66, "0") },
      },
      {
        id: `art-attest-${Date.now()}`,
        createdAt: new Date().toISOString(),
        type: "attestation_result",
        data: {
          signingProvider: "local",
          txHash: "0x".padEnd(66, "1"),
          policyId: "smoke-policy",
          status: "approved",
          onChainStatus: "recorded",
        },
        evidence: { hash: "0x".padEnd(66, "2") },
      },
    ],
    metrics: { latencyMs: 1234, stepCount: 2, artifactCount: 2 },
    evidence: { hash: "0x".padEnd(66, "3") },
  };

  const ingestId = await hydraDbIngestion.ingestCreRun(sampleRun);
  assert(Boolean(ingestId), `ingested run (ingest id=${ingestId})`);

  // Also ingest a synthetic Slack record referencing the same agent —
  // this is the cross-source entity dedup the challenge tests.
  console.log("\n[2b/6] ingest sample Slack record (same agent)...");
  const slackRecord: AppKnowledgeRecord = {
    id: `slack_smoke_${sampleRun.runId}`,
    database: config.HYDRADB_DATABASE,
    collection: config.HYDRADB_COLLECTION,
    title: `#governance — smoke-test-agent spend discussion`,
    type: "slack",
    url: "https://cognivern.slack.com/archives/smoke/p0001",
    timestamp: new Date().toISOString(),
    content: {
      text: "smoke-test-agent: the 5 USDC spend to smoke-vendor looks fine, policy smoke-policy covers it.",
    },
    tenant_metadata: {},
    additional_metadata: {
      author: "smoke-test-agent",
      channel: "governance",
      workspace: "cognivern",
      workflow: "spend",
      chain: "xlayer",
      decision: "approved",
      ts: new Date().toISOString().slice(0, 10),
      agent_id: "smoke-test-agent",
      vendor: "smoke-vendor",
      origin: "slack",
    },
    relations: {
      ids: [`cognivern_run_${sampleRun.runId}`, "cognivern_agent_smoke-test-agent"],
      properties: { relation: "same_agent" },
    },
  };
  const slackId = await hydraDbIngestion.ingestAppRecord(slackRecord);
  assert(Boolean(slackId), `ingested slack record (ingest id=${slackId})`);

  // 3. Wait for indexing.
  console.log("\n[3/6] waitForIndexing...");
  const indexed = await hydraDbIngestion.waitForIndexing(
    [ingestId!, slackId!].filter(Boolean) as string[],
    90_000,
  );
  assert(indexed, "indexing completed (searchable)");

  // 4. Fast-mode retrieval — metadata-filtered single-entity lookup.
  console.log("\n[4/6] retrieve (fast mode, metadata filter)...");
  const fast = await hydraDbRetrieval.retrieve({
    query: "smoke-test-agent spend",
    metadataFilters: { additional_metadata: { agent_id: "smoke-test-agent" } },
    forceMode: "fast",
    maxResults: 5,
  });
  console.log("  metrics:", JSON.stringify(fast.metrics, null, 2));
  assert(fast.metrics.resultCount > 0, "fast mode returned results");
  assert(fast.metrics.mode === "fast", "fast mode used");

  // 5. Thinking-mode retrieval — multi-hop, cross-source.
  console.log("\n[5/6] retrieve (thinking mode, multi-hop)...");
  const thinking = await hydraDbRetrieval.retrieve({
    query:
      "What did smoke-test-agent spend on smoke-vendor, and what was said about it in Slack?",
    forceMode: "thinking",
    maxResults: 10,
    queryApps: true,
  });
  console.log("  metrics:", JSON.stringify(thinking.metrics, null, 2));
  assert(thinking.metrics.resultCount > 0, "thinking mode returned results");
  assert(thinking.metrics.mode === "thinking", "thinking mode used");

  // 6. Multi-hop retrieval (explicit hops).
  console.log("\n[6/6] retrieveMultiHop (3 hops)...");
  const multi = await hydraDbRetrieval.retrieveMultiHop(
    [
      { query: "smoke-test-agent spend", forceMode: "thinking" },
      {
        query: "smoke-vendor",
        metadataFilters: { additional_metadata: { vendor: "smoke-vendor" } },
        forceMode: "fast",
      },
      { query: "what was said about smoke-test-agent in slack", forceMode: "thinking" },
    ],
    { maxResults: 5 },
  );
  console.log("  total metrics:", JSON.stringify(multi.totalMetrics, null, 2));
  assert(multi.totalMetrics.hydraDbCalls === 3, "multi-hop made 3 calls");
  assert(multi.chunks.length > 0, "multi-hop returned deduped chunks");

  console.log("\n=== Smoke test passed ===");
  console.log("Context string preview (first 500 chars):");
  console.log(hydraDbRetrieval.buildContextString(thinking.chunks).slice(0, 500));

  process.exit(0);
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
