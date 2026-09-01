#!/usr/bin/env tsx
/**
 * Telegraph Governed Call Loop
 *
 * A scheduled loop that makes governed Telegraph miner calls to accumulate
 * real usage metrics (calls, spend, approves, holds) for the Track 3
 * submission narrative.
 *
 * Run once:
 *   TELEGRAPH_ENABLED=true TELEGRAPH_EVM_PRIVATE_KEY=0x... \
 *     tsx tooling/scripts/agents/telegraph-governed-loop.ts
 *
 * Run continuously (every 5 min):
 *   TELEGRAPH_ENABLED=true TELEGRAPH_EVM_PRIVATE_KEY=0x... \
 *     TELEGRAPH_LOOP_INTERVAL=300000 \
 *     tsx tooling/scripts/agents/telegraph-governed-loop.ts
 *
 * Stats accumulate in data/telegraph-stats.json and can be read by the
 * /api/telegraph/status endpoint or the dashboard.
 */

import { telegraphService } from "../../../src/backend/services/telegraph/index.js";
import { telegraphGovernanceHelper } from "../../../src/backend/services/telegraph/TelegraphGovernanceHelper.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const STATS_FILE = join(DATA_DIR, "telegraph-stats.json");

interface TelegraphStats {
  totalCalls: number;
  approved: number;
  held: number;
  failed: number;
  totalSpendUsd: number;
  lastRun: string | null;
  calls: Array<{
    status: string;
    minerId: string;
    minerName: string;
    confidence: number | null;
    costUsd: string;
    intent: string;
    timestamp: string;
  }>;
}

function loadStats(): TelegraphStats {
  if (existsSync(STATS_FILE)) {
    try {
      return JSON.parse(readFileSync(STATS_FILE, "utf-8"));
    } catch {
      // Corrupted file — start fresh
    }
  }
  return {
    totalCalls: 0,
    approved: 0,
    held: 0,
    failed: 0,
    totalSpendUsd: 0,
    lastRun: null,
    calls: [],
  };
}

function saveStats(stats: TelegraphStats): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

async function runLoop() {
  console.log("=".repeat(80));
  console.log("Telegraph Governed Call Loop");
  console.log("=".repeat(80));
  console.log();

  // Check readiness
  if (!telegraphService.getEnabled()) {
    console.error("❌ Telegraph not enabled. Set TELEGRAPH_ENABLED=true");
    process.exit(1);
  }

  const paymentReady = await telegraphService.isReady();
  if (!paymentReady) {
    console.error("❌ x402 payment not ready. Set TELEGRAPH_EVM_PRIVATE_KEY");
    console.error(`  ${telegraphService.getPaymentInitError() ?? ""}`);
    process.exit(1);
  }

  console.log("✅ Telegraph ready (x402 payments enabled)");
  console.log();

  // Load previous stats
  const stats = loadStats();
  console.log(`Previous runs: ${stats.totalCalls} calls, $${stats.totalSpendUsd.toFixed(4)} spent`);
  console.log();

  // Discover available miners
  const miners = await telegraphService.getMiners();
  console.log(`Found ${miners.length} miners on the live node`);
  console.log();

  // Define queries to run
  const queries = [
    { query: "What is the weather forecast for San Francisco?", intent: "WEATHER_FORECAST" },
    { query: "What is the weather forecast for London?", intent: "WEATHER_FORECAST" },
    { query: "What is the current price of Bitcoin?", intent: "CRYPTO_PRICE" },
    { query: "Is this image likely AI-generated? Analyze the image at https://example.com", intent: "AI_TEXT_DETECTION" },
    { query: "What is the Tech industry outlook for 2026?", intent: "RESEARCH_QUERY" },
  ];

  const agentId = `telegraph-loop-${Date.now()}`;
  const mandateId = "hackathon-track-3-demo";

  console.log(`Agent: ${agentId}`);
  console.log(`Mandate: ${mandateId}`);
  console.log(`Queries: ${queries.length}`);
  console.log();

  let runCalls = 0;
  let runApproved = 0;
  let runHeld = 0;
  let runFailed = 0;
  let runSpend = 0;

  for (const q of queries) {
    console.log(`  [${runCalls + 1}/${queries.length}] ${q.query.substring(0, 60)}...`);
    console.log(`    Intent: ${q.intent}`);

    try {
      const result = await telegraphGovernanceHelper.governedEngineAsk({
        agentId,
        mandateId,
        engineRequest: {
          query: q.query,
          confidenceThreshold: 0.7,
        },
        description: `Governed intelligence: ${q.intent}`,
      });

      if (result.success) {
        const cost = result.response?.data?.costUsd ?? "0";
        const costNum = parseFloat(cost);
        console.log(`    → ${result.status.toUpperCase()} | confidence: ${result.decision?.actualConfidence?.toFixed(2) ?? "?"} | cost: $${cost}`);

        runCalls++;
        runSpend += costNum;

        if (result.status === "approved") runApproved++;
        else if (result.status === "held") runHeld++;

        // Record the call in stats
        stats.calls.push({
          status: result.status,
          minerId: result.response?.data?.minerId ?? "unknown",
          minerName: result.response?.data?.minerName ?? "unknown",
          confidence: result.decision?.actualConfidence ?? null,
          costUsd: cost,
          intent: q.intent,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`    → FAILED: ${result.error}`);
        runFailed++;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`    → ERROR: ${message}`);
      runFailed++;
    }

    console.log();
  }

  // Update totals
  stats.totalCalls += runCalls;
  stats.approved += runApproved;
  stats.held += runHeld;
  stats.failed += runFailed;
  stats.totalSpendUsd += runSpend;
  stats.lastRun = new Date().toISOString();

  // Keep only the last 1000 call records (to keep the file small)
  if (stats.calls.length > 1000) {
    stats.calls = stats.calls.slice(-1000);
  }

  saveStats(stats);

  console.log("=".repeat(80));
  console.log("Run Complete");
  console.log("-".repeat(80));
  console.log(`  This run:   ${runCalls} calls, $${runSpend.toFixed(4)}, ${runApproved} approved, ${runHeld} held, ${runFailed} failed`);
  console.log(`  All time:   ${stats.totalCalls} calls, $${stats.totalSpendUsd.toFixed(4)}`);
  console.log(`  Stats file: ${STATS_FILE}`);
  console.log("=".repeat(80));
}

// Check if we should run as a continuous loop
const intervalMs = parseInt(process.env.TELEGRAPH_LOOP_INTERVAL ?? "0", 10);

if (intervalMs > 0) {
  console.log(`Continuous mode: running every ${intervalMs / 1000}s`);
  console.log(`Set TELEGRAPH_LOOP_INTERVAL=0 for one-shot mode`);
  console.log();

  runLoop()
    .then(() => {
      console.log(`\nNext run in ${intervalMs / 1000}s...\n`);
    })
    .catch((err) => {
      console.error("Initial run failed:", err);
    });

  setInterval(() => {
    runLoop().catch((err) => {
      console.error("Loop run failed:", err);
    });
  }, intervalMs);
} else {
  runLoop()
    .then(() => {
      console.log("One-shot complete. Set TELEGRAPH_LOOP_INTERVAL=300000 for continuous mode.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Loop failed:", err);
      process.exit(1);
    });
}
