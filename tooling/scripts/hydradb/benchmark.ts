/**
 * HydraDB challenge — benchmark runner.
 *
 * Runs the question set (tooling/scripts/hydradb/questions.ts) through the retrieval
 * service in both auto-routed and forced modes, recording:
 *   - accuracy (expected vs actual — substring + source checks)
 *   - latency (ms, from HydraDB meta.latency_ms + client overhead)
 *   - HydraDB call count
 *   - fast vs thinking usage
 *   - estimated retrieval cost (notional)
 *
 * Outputs a results table to stdout + a JSON file for the submission.
 *
 * Run: pnpm tsx tooling/scripts/hydradb/benchmark.ts
 *      (requires HYDRADB_ENABLED=true + HYDRADB_API_KEY in .env)
 */

import fs from "node:fs";
import path from "node:path";
import { hydraDbRetrieval, type RetrievalOutcome } from "@backend/services/hydradb/index.js";
import { QUESTIONS, gradeResult, type BenchmarkQuestion } from "./questions.js";

interface QuestionResult {
  id: string;
  category: string;
  question: string;
  expectedMode: string;
  actualMode: string;
  routingReason: string;
  hydraDbCalls: number;
  latencyMs: number;
  estimatedCostUsd: number;
  resultCount: number;
  topScore?: number;
  passed: boolean;
  matchedExpected: string[];
  expectedSources: string[];
  sourcesFound: string[];
  multiHop: boolean;
  topChunkTitle?: string;
  topChunkSnippet?: string;
}

interface BenchmarkSummary {
  totalQuestions: number;
  passed: number;
  accuracy: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  totalCalls: number;
  totalCostUsd: number;
  fastUsed: number;
  thinkingUsed: number;
  modeMatched: number; // router picked the expected mode
  byCategory: Record<string, { total: number; passed: number; avgLatencyMs: number }>;
  results: QuestionResult[];
  generatedAt: string;
}

async function runQuestion(q: BenchmarkQuestion): Promise<QuestionResult> {
  let outcomes: RetrievalOutcome[];
  let totalLatency = 0;
  let totalCalls = 0;
  let totalCost = 0;

  if (q.multiHop) {
    // Explicit multi-hop: run each hop as a thinking query.
    const multi = await hydraDbRetrieval.retrieveMultiHop(
      q.multiHop.map((query) => ({ query, forceMode: "thinking" as const })),
      { maxResults: 5 },
    );
    outcomes = multi.hops;
    totalLatency = multi.totalMetrics.latencyMs;
    totalCalls = multi.totalMetrics.hydraDbCalls;
    totalCost = multi.totalMetrics.estimatedCostUsd;
  } else {
    const outcome = await hydraDbRetrieval.retrieve({
      query: q.question,
      metadataFilters: q.metadataFilters,
      maxResults: 10,
      // Let the router decide (don't forceMode) so we can validate expectedMode.
    });
    outcomes = [outcome];
    totalLatency = outcome.metrics.latencyMs;
    totalCalls = outcome.metrics.hydraDbCalls;
    totalCost = outcome.metrics.estimatedCostUsd;
  }

  // Merge all chunks across hops for grading.
  const allChunks = outcomes.flatMap((o) => o.chunks);
  const grade = gradeResult(allChunks, q);

  // Use the first outcome's mode as the "actual mode" (or multi-hop).
  const firstMode = outcomes[0]?.metrics.mode ?? "thinking";
  const actualMode = q.multiHop ? "thinking (multi-hop)" : firstMode;
  const routingReason = outcomes[0]?.metrics.routingReason ?? "";

  const topChunk = allChunks[0];

  return {
    id: q.id,
    category: q.category,
    question: q.question,
    expectedMode: q.expectedMode,
    actualMode,
    routingReason,
    hydraDbCalls: totalCalls,
    latencyMs: totalLatency,
    estimatedCostUsd: totalCost,
    resultCount: allChunks.length,
    topScore: topChunk?.relevancy_score,
    passed: grade.passed,
    matchedExpected: grade.matchedExpected,
    expectedSources: q.expectedSources,
    sourcesFound: grade.sourcesFound,
    multiHop: Boolean(q.multiHop),
    topChunkTitle: topChunk?.source_title,
    topChunkSnippet: topChunk?.chunk_content?.slice(0, 120),
  };
}

function formatTable(results: QuestionResult[]): string {
  const header = [
    "ID".padEnd(14),
    "CAT".padEnd(22),
    "MODE".padEnd(10),
    "EXP".padEnd(6),
    "PASS".padEnd(5),
    "LAT(ms)".padStart(8),
    "CALLS".padStart(6),
    "COST".padStart(8),
    "RESULTS".padStart(8),
    "SOURCES".padEnd(28),
  ].join(" ");
  const sep = "─".repeat(header.length);
  const rows = results.map((r) =>
    [
      r.id.padEnd(14),
      r.category.padEnd(22),
      (r.multiHop ? "multi" : r.actualMode).padEnd(10),
      r.expectedMode.padEnd(6),
      (r.passed ? "✓" : "✗").padEnd(5),
      String(r.latencyMs).padStart(8),
      String(r.hydraDbCalls).padStart(6),
      `$${r.estimatedCostUsd.toFixed(4)}`.padStart(8),
      String(r.resultCount).padStart(8),
      r.sourcesFound.join(",").padEnd(28),
    ].join(" "),
  );
  return [header, sep, ...rows].join("\n");
}

async function main() {
  console.log("=== HydraDB Benchmark ===");
  console.log(`Questions: ${QUESTIONS.length}`);
  console.log(`Database: ${process.env.HYDRADB_DATABASE ?? "cognivern"}\n`);

  if (!hydraDbRetrieval.isEnabled()) {
    console.error("HYDRADB_ENABLED is not true (or HYDRADB_API_KEY missing).");
    process.exit(1);
  }

  const results: QuestionResult[] = [];
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    process.stdout.write(`[${i + 1}/${QUESTIONS.length}] ${q.id} (${q.category})... `);
    try {
      const result = await runQuestion(q);
      results.push(result);
      console.log(
        `${result.passed ? "✓" : "✗"} ${result.actualMode} ${result.latencyMs}ms ${result.hydraDbCalls}call $${result.estimatedCostUsd.toFixed(4)} [${result.sourcesFound.join(",")}]`,
      );
    } catch (err) {
      console.log(`ERROR: ${err}`);
      results.push({
        id: q.id,
        category: q.category,
        question: q.question,
        expectedMode: q.expectedMode,
        actualMode: "error",
        routingReason: String(err),
        hydraDbCalls: 0,
        latencyMs: 0,
        estimatedCostUsd: 0,
        resultCount: 0,
        passed: false,
        matchedExpected: [],
        expectedSources: q.expectedSources,
        sourcesFound: [],
        multiHop: Boolean(q.multiHop),
      });
    }
  }

  // Summary.
  const passed = results.filter((r) => r.passed).length;
  const totalLatency = results.reduce((s, r) => s + r.latencyMs, 0);
  const totalCalls = results.reduce((s, r) => s + r.hydraDbCalls, 0);
  const totalCost = results.reduce((s, r) => s + r.estimatedCostUsd, 0);
  const fastUsed = results.filter((r) => r.actualMode === "fast").length;
  const thinkingUsed = results.filter((r) => r.actualMode.startsWith("thinking")).length;
  const modeMatched = results.filter(
    (r) => r.actualMode === r.expectedMode || (r.multiHop && r.expectedMode === "thinking"),
  ).length;

  const byCategory: Record<string, { total: number; passed: number; latencies: number[] }> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, passed: 0, latencies: [] };
    byCategory[r.category].total++;
    if (r.passed) byCategory[r.category].passed++;
    byCategory[r.category].latencies.push(r.latencyMs);
  }

  const summary: BenchmarkSummary = {
    totalQuestions: QUESTIONS.length,
    passed,
    accuracy: passed / QUESTIONS.length,
    totalLatencyMs: totalLatency,
    avgLatencyMs: Math.round(totalLatency / QUESTIONS.length),
    totalCalls,
    totalCostUsd: totalCost,
    fastUsed,
    thinkingUsed,
    modeMatched,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [
        k,
        {
          total: v.total,
          passed: v.passed,
          avgLatencyMs: Math.round(v.latencies.reduce((s, x) => s + x, 0) / v.latencies.length),
        },
      ]),
    ),
    results,
    generatedAt: new Date().toISOString(),
  };

  console.log("\n=== Results ===");
  console.log(formatTable(results));

  console.log("\n=== Summary ===");
  console.log(`Accuracy:        ${passed}/${QUESTIONS.length} (${(summary.accuracy * 100).toFixed(0)}%)`);
  console.log(`Avg latency:     ${summary.avgLatencyMs}ms`);
  console.log(`Total calls:     ${totalCalls}`);
  console.log(`Total cost:      $${totalCost.toFixed(4)} (notional)`);
  console.log(`Fast used:       ${fastUsed} | Thinking used: ${thinkingUsed}`);
  console.log(`Mode matched:    ${modeMatched}/${QUESTIONS.length} (router picked expected mode)`);
  console.log(`\nBy category:`);
  for (const [cat, s] of Object.entries(summary.byCategory)) {
    console.log(`  ${cat.padEnd(24)} ${s.passed}/${s.total} passed, avg ${s.avgLatencyMs}ms`);
  }

  // Write JSON for the submission.
  const outPath = path.resolve(process.cwd(), "docs/hydradb-benchmark-results.json");
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nResults written to: ${outPath}`);

  // Print failures for debugging.
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`\n=== Failures (${failures.length}) ===`);
    for (const f of failures) {
      console.log(`  ${f.id}: expected [${f.expectedSources.join(",")}] got [${f.sourcesFound.join(",")}]`);
      console.log(`    matched ${f.matchedExpected.length}/${f.expectedSources.length + f.matchedExpected.length} expected fragments`);
      if (f.topChunkTitle) console.log(`    top: ${f.topChunkTitle}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
