#!/usr/bin/env tsx
/**
 * Telegraph Signal Digest — governed intelligence consumption.
 *
 * The legitimate consumption pattern for the Telegraph integration.
 * Instead of a timer hammering canned queries, the agent watches the
 * daemon for real high-interest signals, routes each to the miner the
 * daemon recommends, calls the miner directly (paid x402 micropayment),
 * and governance approves or holds based on the miner's OWN reported
 * confidence (signal_mapping.confidence_field) vs the threshold.
 *
 * - No fabricated confidence: miners without a confidence signal → held.
 * - No canned queries: consumes the daemon's actual signal feed.
 * - Real decisions: approve (confidence ≥ threshold) vs hold (below/unknown).
 * - Every call recorded as a telegraph.signal CRE artifact + audit trail.
 *
 * Run once:
 *   TELEGRAPH_ENABLED=true TELEGRAPH_EVM_PRIVATE_KEY=0x... \
 *     tsx tooling/scripts/agents/telegraph-signal-digest.ts
 *
 * Continuous (modest cadence, e.g. every 6h):
 *   TELEGRAPH_LOOP_INTERVAL=21600000 ... (same as above)
 *
 * Tuning:
 *   TELEGRAPH_SIGNAL_MIN_INTEREST — min daemon interest score (0-10), default 6
 *   TELEGRAPH_SIGNAL_LIMIT        — max signals per run, default 5
 *
 * Stats accumulate in data/telegraph-stats.json and are served by the
 * /api/telegraph/status endpoint and the dashboard.
 */

import { telegraphService, telegraphGovernanceHelper } from "../../../src/backend/services/telegraph/index.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const STATS_FILE = join(DATA_DIR, "telegraph-stats.json");

const MIN_INTEREST = parseFloat(process.env.TELEGRAPH_SIGNAL_MIN_INTEREST ?? "6");
const SIGNAL_LIMIT = parseInt(process.env.TELEGRAPH_SIGNAL_LIMIT ?? "5", 10);

interface TelegraphStats {
  totalCalls: number;
  approved: number;
  held: number;
  failed: number;
  totalSpendUsd: number;
  lastRun: string | null;
  calls: Array<{
    status: string;
    signal?: { text: string; category: string; interest: number };
    minerId: string;
    minerName: string;
    confidence: number | null;
    costUsd: string;
    decision?: unknown;
    timestamp: string;
  }>;
}

function loadStats(): TelegraphStats {
  if (existsSync(STATS_FILE)) {
    try {
      return JSON.parse(readFileSync(STATS_FILE, "utf-8"));
    } catch {
      // Corrupted file — start fresh.
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
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
}

/** Extract the model the daemon recommends from its routing reasoning, if any. */
function extractModel(reasoning?: string): string | undefined {
  if (!reasoning) return undefined;
  const m = reasoning.match(/model\s+['"]?([A-Za-z0-9_.:-]+)['"]?/);
  return m ? m[1] : undefined;
}

/** Build miner params from the question, the daemon's routing, and the miner schema. */
function buildParams(
  endpoint: { path?: string } | undefined,
  miner: { input_schema?: { properties?: Record<string, unknown>; required?: string[] } } | null,
  routing: { intent?: string; reasoning?: string } | undefined,
  questionText: string,
): Record<string, unknown> {
  const path = endpoint?.path ?? "";
  const intent = routing?.intent ?? "";
  const reasoning = routing?.reasoning ?? "";
  const schemaProps = (miner?.input_schema?.properties ?? {}) as Record<string, unknown>;
  const required = miner?.input_schema?.required ?? [];

  // Chat endpoints expect messages array (+ model if the schema requires it).
  if (path.includes("/chat") || path.includes("/completion")) {
    const params: Record<string, unknown> = {
      messages: [{ role: "user", content: questionText }],
    };
    if (schemaProps.temperature) params.temperature = 0.3;
    if (schemaProps.max_tokens) params.max_tokens = 500;
    // The daemon's routing reason declares the model it wants us to use.
    const model = extractModel(reasoning);
    if (required.includes("model") || schemaProps.model) {
      params.model = model || (intent === "WEB_SEARCH" ? "nova-2-lite" : "nova-pro");
    }
    // WEB_SEARCH via chat miner wants web_search_options enabled.
    if (intent === "WEB_SEARCH" && schemaProps.web_search_options) {
      params.web_search_options = { enable: true };
    }
    return params;
  }
  // Everything else: pass the query — most miners accept this.
  return { query: questionText };
}

async function runDigest() {
  console.log("=".repeat(80));
  console.log("Telegraph Signal Digest");
  console.log("=".repeat(80));

  if (!telegraphService.getEnabled()) {
    console.error("❌ Telegraph not enabled. Set TELEGRAPH_ENABLED=true");
    return;
  }
  if (!(await telegraphService.isReady())) {
    console.error("❌ x402 payment not ready.");
    console.error(`  ${telegraphService.getPaymentInitError?.() ?? ""}`);
    return;
  }
  console.log("✅ Telegraph ready (x402 payments enabled)");

  const stats = loadStats();
  console.log(`Previous: ${stats.totalCalls} calls, $${stats.totalSpendUsd.toFixed(4)} spent`);

  // 1. Fetch real daemon signals sorted by interest, skip our own noise.
  console.log(`\nFetching daemon signals (min interest: ${MIN_INTEREST}, limit: ${SIGNAL_LIMIT})...`);
  const daemonQ = await telegraphService.getDaemonQuestions({
    sort: "interest",
    min_interest: MIN_INTEREST,
    limit: SIGNAL_LIMIT * 3, // fetch extra to filter noise
  });
  const signals = (daemonQ.results ?? [])
    .filter((s) => {
      const src = String(s.source ?? "").toLowerCase();
      return src !== "user" && (s.question?.interest_score ?? 0) >= MIN_INTEREST;
    })
    .slice(0, SIGNAL_LIMIT);

  console.log(`Found ${signals.length} real signals to consume`);

  if (signals.length === 0) {
    console.log("No high-interest signals to consume. Try again later or lower MIN_INTEREST.");
    stats.lastRun = new Date().toISOString();
    saveStats(stats);
    return;
  }

  let runCalls = 0;
  let runApproved = 0;
  let runHeld = 0;
  let runFailed = 0;
  let runSpend = 0;

  for (const sig of signals) {
    const question = sig.question ?? {};
    const routing = sig.routing ?? {};
    const text = String(question.text ?? "").trim();
    const category = String(question.category ?? "unknown");
    const interest = question.interest_score ?? 0;
    const minerSlug = String(routing.miner_slug ?? "");

    if (!text || !minerSlug) {
      console.log(`  SKIP (no text or routing): ${text.slice(0, 50)}`);
      continue;
    }

    console.log(`\n  [${runCalls + runFailed + 1}/${signals.length}] ${text.slice(0, 70)}...`);
    console.log(`    category: ${category} | interest: ${interest}/10 | miner: ${minerSlug}`);

    try {
      const miner = await telegraphService.getMiner(minerSlug);
      if (!miner) {
        console.log(`    → SKIP: miner ${minerSlug} not found in registry`);
        continue;
      }
      const endpoint = (miner.endpoints ?? [])[0];
      const params = buildParams(endpoint, miner, routing, text);

      const result = await telegraphGovernanceHelper.governedMinerCall({
        agentId: `telegraph-digest-${Date.now()}`,
        mandateId: "hackathon-track-3-demo",
        minerRequest: { minerId: minerSlug, params, confidenceThreshold: 0.7 },
        description: `Signal digest: ${category} — ${text.slice(0, 80)}`,
      });

      if (result.success) {
        const cost = parseFloat(result.response?.metadata?.costUsd ?? "0");
        const conf = result.response?.metadata?.confidence ?? null;
        console.log(
          `    → ${result.status.toUpperCase()} | confidence: ${conf !== null ? conf.toFixed(2) : "?"} | cost: $${cost.toFixed(4)}`,
        );

        runCalls++;
        runSpend += cost;
        if (result.status === "approved") runApproved++;
        else if (result.status === "held") runHeld++;

        stats.calls.push({
          status: result.status,
          signal: { text: text.slice(0, 120), category, interest },
          minerId: miner.id ?? minerSlug,
          minerName: miner.name ?? minerSlug,
          confidence: conf,
          costUsd: cost.toFixed(4),
          decision: result.decision,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`    → FAILED: ${result.error}`);
        runFailed++;
      }
    } catch (error) {
      console.log(`    → ERROR: ${error instanceof Error ? error.message : String(error)}`);
      runFailed++;
    }
  }

  stats.totalCalls += runCalls;
  stats.approved += runApproved;
  stats.held += runHeld;
  stats.failed += runFailed;
  stats.totalSpendUsd += runSpend;
  stats.lastRun = new Date().toISOString();
  if (stats.calls.length > 1000) stats.calls = stats.calls.slice(-1000);
  saveStats(stats);

  console.log("\n" + "-".repeat(80));
  console.log(
    `This run: ${runCalls} calls, $${runSpend.toFixed(4)} | ${runApproved} approved, ${runHeld} held, ${runFailed} failed`,
  );
  console.log(`All time: ${stats.totalCalls} calls, $${stats.totalSpendUsd.toFixed(4)}`);
  console.log("=".repeat(80));
}

const intervalMs = parseInt(process.env.TELEGRAPH_LOOP_INTERVAL ?? "0", 10);
if (intervalMs > 0) {
  console.log(`Continuous mode: every ${intervalMs / 1000}s`);
  await runDigest();
  console.log(`\nNext run in ${intervalMs / 1000}s...\n`);
  setInterval(() => {
    runDigest().catch((e) => console.error("Digest run failed:", e));
  }, intervalMs);
} else {
  await runDigest();
  process.exit(0);
}
