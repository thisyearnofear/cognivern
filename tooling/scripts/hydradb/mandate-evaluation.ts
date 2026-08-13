/**
 * Held-out Mandate Evidence Graph evaluation.
 *
 * The questions are generated from the authoritative mandate, statement,
 * recommendation, outcome, and run records at evaluation time. This keeps the
 * answer key outside the retrieval question wording while avoiding fabricated
 * fixtures. Each query is run twice against the same workspace/mandate scope:
 *   1. graph retrieval: thinking mode + graph relations
 *   2. no-graph baseline: fast mode with graph traversal disabled
 *
 * Run with one mandate:
 *   MANDATE_EVAL_WORKSPACE_ID=... MANDATE_EVAL_MANDATE_ID=... \
 *   HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:mandate-eval
 *
 * Run a comma-separated cohort; this writes docs/hydradb-mandate-evaluation-cohort.json:
 *   MANDATE_EVAL_WORKSPACE_ID=... MANDATE_EVAL_MANDATE_IDS=id-a,id-b \
 *   HYDRADB_ENABLED=true HYDRADB_API_KEY=... pnpm hydradb:mandate-eval
 *
 * Non-local workspaces require MANDATE_EVAL_CONFIRM_NONPROD=staging and should
 * write to an ignored artifact path with MANDATE_EVAL_OUTPUT_PATH. This keeps
 * accidental production evaluation and tracked-artifact overwrites explicit.
 */

import fs from "node:fs";
import path from "node:path";
import { AllocationRecommendationService } from "@backend/services/governance/AllocationRecommendationService.js";
import { creRunStore } from "@backend/cre/storage/CreRunStore.js";
import type { CreRun } from "@backend/cre/types.js";
import { FundedMandateService, type FundedMandate } from "@backend/services/governance/FundedMandateService.js";
import { OutcomeObservationService, type OutcomeObservation } from "@backend/services/governance/OutcomeObservationService.js";
import {
  buildSpendAttributionReport,
  getRunSpendAttribution,
  type SpendAttributionReport,
} from "@backend/services/governance/SpendAttributionService.js";
import { StatementService, type FundedMandateStatement } from "@backend/services/governance/StatementService.js";
import {
  collectionForWorkspace,
  hydraDbRetrieval,
  type HydraDbChunk,
  type RetrievalOutcome,
} from "@backend/services/hydradb/index.js";

interface MandateEvaluationQuestion {
  id: string;
  category: string;
  question: string;
  expectedAnswer: string[];
  expectedObjectTypes: string[];
  requiresGraphPath: boolean;
}

interface TrialResult {
  mode: "graph" | "no_graph";
  passed: boolean;
  answerCorrect: boolean;
  provenanceCorrect: boolean;
  graphPathUsed: boolean;
  latencyMs: number;
  hydraDbCalls: number;
  resultCount: number;
  matchedExpected: string[];
  objectTypesFound: string[];
  topChunkTitle?: string;
  error?: string;
}

interface EvaluationResult {
  question: MandateEvaluationQuestion;
  graph: TrialResult;
  noGraph: TrialResult;
}

export interface EvaluationSummary {
  workspaceId: string;
  mandateId: string;
  collection: string;
  questionCount: number;
  graphPassed: number;
  noGraphPassed: number;
  graphAccuracy: number;
  noGraphAccuracy: number;
  accuracyLift: number;
  graphProvenanceAccuracy: number;
  noGraphProvenanceAccuracy: number;
  graphPathUsage: number;
  graphAvgLatencyMs: number;
  noGraphAvgLatencyMs: number;
  results: EvaluationResult[];
  generatedAt: string;
}

export interface MandateEvaluationCohort {
  workspaceId: string;
  mandateIds: string[];
  questionCount: number;
  graphPassed: number;
  noGraphPassed: number;
  graphAccuracy: number;
  noGraphAccuracy: number;
  accuracyLift: number;
  graphProvenanceAccuracy: number;
  noGraphProvenanceAccuracy: number;
  graphPathUsage: number;
  graphAvgLatencyMs: number;
  noGraphAvgLatencyMs: number;
  mandates: EvaluationSummary[];
  generatedAt: string;
}

function fragment(value: string | number | undefined): string {
  return String(value ?? "").trim();
}

function spendVendor(run: CreRun): string {
  const artifact = run.artifacts?.find((candidate) => candidate.type === "spend_intent");
  const data = artifact?.data as Record<string, unknown> | undefined;
  const metadata = data?.metadata as Record<string, unknown> | undefined;
  return fragment(metadata?.vendor as string | undefined) || fragment(data?.recipient as string | undefined) || "unknown-vendor";
}

function mandateRuns(workspaceId: string, mandateId: string, runs: CreRun[]): CreRun[] {
  return runs.filter((run) => {
    const attribution = getRunSpendAttribution(run);
    return run.projectId === workspaceId && attribution?.workspaceId === workspaceId && attribution.mandateId === mandateId;
  });
}

function makeQuestions(
  mandate: FundedMandate,
  statement: FundedMandateStatement,
  recommendation: Awaited<ReturnType<typeof AllocationRecommendationService.generate>>,
  observations: OutcomeObservation[],
  report: SpendAttributionReport,
  runs: CreRun[],
): MandateEvaluationQuestion[] {
  const firstAsset = Object.entries(statement.capital.byAsset)[0];
  const asset = firstAsset?.[0] ?? "no asset";
  const authorized = firstAsset?.[1].authorizedAmount ?? "0";
  const runIds = statement.evidence.runIds;
  const vendors = [...new Set(runs.map(spendVendor))];
  const transactionHashes = statement.evidence.transactionHashes;
  const outcomeFragments = observations.flatMap((observation) => [observation.value, observation.unit]);
  const sourceFragments = [...new Set(observations.map((observation) => observation.source))];
  const unknownFragment = statement.performance.knownUnknowns[0];

  return [
    { id: "mandate_objective", category: "mandate_facts", question: `What is the authorized objective of funded mandate ${mandate.name}?`, expectedAnswer: [mandate.objective], expectedObjectTypes: ["mandate"], requiresGraphPath: false },
    { id: "mandate_budget", category: "mandate_facts", question: `What is the current ${asset} authorization and mandate status for ${mandate.name}?`, expectedAnswer: [asset, authorized, mandate.status], expectedObjectTypes: ["mandate"], requiresGraphPath: false },
    { id: "authorized_agents", category: "ontology", question: "Which agents are authorized by this mandate, and which policies govern them?", expectedAnswer: [...mandate.agentIds, ...mandate.policyIds].filter(Boolean), expectedObjectTypes: ["mandate"], requiresGraphPath: true },
    { id: "spend_run_count", category: "temporal_state", question: "How many governed spend records contributed to this mandate's current statement?", expectedAnswer: [`spend records: ${report.totalRecords}`], expectedObjectTypes: ["mandate_statement"], requiresGraphPath: false },
    { id: "contributing_runs", category: "multi_hop", question: "Which agent runs contributed governed spend to this mandate?", expectedAnswer: runIds.length > 0 ? runIds : ["spend records: 0"], expectedObjectTypes: runIds.length > 0 ? ["run"] : ["mandate_statement"], requiresGraphPath: true },
    { id: "spend_vendors", category: "multi_hop", question: "Which vendors or recipients received governed spend under this mandate?", expectedAnswer: vendors.length > 0 ? vendors : ["spend records: 0"], expectedObjectTypes: vendors.length > 0 ? ["run"] : ["mandate_statement"], requiresGraphPath: true },
    { id: "receipt_evidence", category: "provenance", question: "Which consumed spends have receipt-backed transaction evidence?", expectedAnswer: transactionHashes.length > 0 ? transactionHashes : ["spendRecordsWithTransactionEvidence"], expectedObjectTypes: transactionHashes.length > 0 ? ["run"] : ["mandate_statement"], requiresGraphPath: true },
    { id: "outcome_values", category: "outcomes", question: "What outcome values have been observed for this mandate?", expectedAnswer: outcomeFragments.length > 0 ? outcomeFragments : ["Outcomes: 0"], expectedObjectTypes: observations.length > 0 ? ["outcome"] : ["mandate_statement"], requiresGraphPath: true },
    { id: "outcome_provenance", category: "outcomes", question: "Which sources and confidence levels support the observed outcomes?", expectedAnswer: observations.length > 0 ? [...sourceFragments, ...observations.map((observation) => observation.confidence)] : ["Outcomes: 0"], expectedObjectTypes: observations.length > 0 ? ["outcome"] : ["mandate_statement"], requiresGraphPath: true },
    { id: "latest_mandate_change", category: "temporal_reasoning", question: "What changed most recently in the mandate context?", expectedAnswer: [mandate.updatedAt.slice(0, 10)], expectedObjectTypes: ["mandate"], requiresGraphPath: true },
    { id: "recommendation_stance", category: "decision_boundary", question: "What is Cognivern's current bounded allocation recommendation for this mandate?", expectedAnswer: [recommendation.recommendation.stance, recommendation.status], expectedObjectTypes: ["mandate_recommendation"], requiresGraphPath: true },
    { id: "recommendation_reason", category: "decision_boundary", question: "Why is the current allocation recommendation bounded this way?", expectedAnswer: [recommendation.recommendation.reasoning[0] || recommendation.governanceNote], expectedObjectTypes: ["mandate_recommendation"], requiresGraphPath: true },
    { id: "known_unknown", category: "decision_boundary", question: "What known unknown must an operator review before allocating more capital?", expectedAnswer: [unknownFragment || "Known unknowns: none"], expectedObjectTypes: ["mandate_statement"], requiresGraphPath: true },
    { id: "evidence_integrity", category: "provenance", question: "Which evidence objects and integrity hashes support the mandate statement?", expectedAnswer: [statement.contentHash, ...transactionHashes].filter(Boolean), expectedObjectTypes: ["mandate_statement"], requiresGraphPath: true },
    { id: "outcome_timeline", category: "temporal_reasoning", question: "When were the mandate outcomes observed, and what changed over time?", expectedAnswer: observations.length > 0 ? observations.map((observation) => observation.observedAt.slice(0, 10)) : ["Outcomes: 0"], expectedObjectTypes: observations.length > 0 ? ["outcome"] : ["mandate_statement"], requiresGraphPath: true },
    { id: "governance_boundary", category: "decision_boundary", question: "Can the retrieved context authorize a new spend, and what remains required?", expectedAnswer: ["explicit operator approval", "governance boundary"], expectedObjectTypes: ["mandate_recommendation"], requiresGraphPath: true },
  ];
}

function chunkText(chunks: HydraDbChunk[]): string {
  return chunks.map((chunk) => [
    chunk.chunk_content ?? "",
    chunk.source_title ?? "",
    JSON.stringify(chunk.metadata ?? {}),
    JSON.stringify(chunk.additional_metadata ?? {}),
  ].join(" ")).join(" ").toLowerCase();
}

function mandateScopedChunks(outcome: RetrievalOutcome, mandateId: string): RetrievalOutcome {
  return {
    ...outcome,
    chunks: outcome.chunks.filter((chunk) => {
      const metadata = { ...(chunk.metadata ?? {}), ...(chunk.additional_metadata ?? {}) };
      return metadata.mandate_id === mandateId;
    }),
  };
}

function evaluateOutcome(outcome: RetrievalOutcome, question: MandateEvaluationQuestion, mode: TrialResult["mode"]): TrialResult {
  const text = chunkText(outcome.chunks);
  const matchedExpected = question.expectedAnswer.filter((expected) => text.includes(expected.toLowerCase()));
  const objectTypesFound = [...new Set(outcome.chunks.flatMap((chunk) => {
    const metadata = { ...(chunk.metadata ?? {}), ...(chunk.additional_metadata ?? {}) };
    return [metadata.object_type, chunk.source_type].filter((value): value is string => typeof value === "string");
  }))];
  const answerCorrect = matchedExpected.length === question.expectedAnswer.length;
  const provenanceCorrect = question.expectedObjectTypes.every((type) => objectTypesFound.includes(type));
  const graphPathUsed = Boolean(outcome.raw.graph_context?.query_paths?.length || outcome.raw.graph_context?.chunk_relations?.length);
  return {
    mode,
    passed: answerCorrect && provenanceCorrect && (!question.requiresGraphPath || (mode === "graph" ? graphPathUsed : true)),
    answerCorrect,
    provenanceCorrect,
    graphPathUsed,
    latencyMs: outcome.metrics.latencyMs,
    hydraDbCalls: outcome.metrics.hydraDbCalls,
    resultCount: outcome.metrics.resultCount,
    matchedExpected,
    objectTypesFound,
    topChunkTitle: outcome.chunks[0]?.source_title,
  };
}

async function runTrial(
  workspaceId: string,
  mandateId: string,
  question: MandateEvaluationQuestion,
  mode: TrialResult["mode"],
): Promise<TrialResult> {
  try {
    const outcome = await hydraDbRetrieval.retrieve({
      query: `${question.question} Scope the answer to mandate ${mandateId}.`,
      collection: collectionForWorkspace(workspaceId),
      type: "knowledge",
      maxResults: 12,
      forceMode: mode === "graph" ? "thinking" : "fast",
      graphContext: mode === "graph",
      queryForcefulRelations: mode === "graph",
      queryApps: true,
    });
    return evaluateOutcome(mandateScopedChunks(outcome, mandateId), question, mode);
  } catch (error) {
    return {
      mode,
      passed: false,
      answerCorrect: false,
      provenanceCorrect: false,
      graphPathUsed: false,
      latencyMs: 0,
      hydraDbCalls: 0,
      resultCount: 0,
      matchedExpected: [],
      objectTypesFound: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function evaluateMandate(
  workspaceId: string,
  mandateId: string,
  logProgress = true,
): Promise<EvaluationSummary> {
  if (!hydraDbRetrieval.isEnabled()) throw new Error("HYDRADB_ENABLED=true and HYDRADB_API_KEY are required");

  const mandate = FundedMandateService.get(workspaceId, mandateId);
  if (!mandate) throw new Error(`Mandate ${mandateId} was not found in workspace ${workspaceId}`);
  const observations = OutcomeObservationService.list(workspaceId, mandateId);
  const statement = await StatementService.generateCandidate(workspaceId, mandateId);
  const recommendation = await AllocationRecommendationService.generate(workspaceId, mandateId);
  const runs = mandateRuns(workspaceId, mandateId, await creRunStore.list());
  const report = buildSpendAttributionReport(runs, mandateId);
  const questions = makeQuestions(mandate, statement, recommendation, observations, report, runs);

  const results: EvaluationResult[] = [];
  for (const question of questions) {
    if (logProgress) process.stdout.write(`${mandateId}/${question.id} … `);
    const graph = await runTrial(workspaceId, mandateId, question, "graph");
    const noGraph = await runTrial(workspaceId, mandateId, question, "no_graph");
    results.push({ question, graph, noGraph });
    if (logProgress) console.log(`${graph.passed ? "✓" : "✗"} graph / ${noGraph.passed ? "✓" : "✗"} baseline (${graph.latencyMs}ms / ${noGraph.latencyMs}ms)`);
  }

  const graphPassed = results.filter((result) => result.graph.passed).length;
  const noGraphPassed = results.filter((result) => result.noGraph.passed).length;
  const graphProvenance = results.filter((result) => result.graph.provenanceCorrect).length;
  const noGraphProvenance = results.filter((result) => result.noGraph.provenanceCorrect).length;
  const graphPathQuestions = questions.filter((question) => question.requiresGraphPath).length;
  const graphPathUsed = results.filter((result) => result.question.requiresGraphPath && result.graph.graphPathUsed).length;
  const graphLatency = results.reduce((sum, result) => sum + result.graph.latencyMs, 0);
  const noGraphLatency = results.reduce((sum, result) => sum + result.noGraph.latencyMs, 0);
  return {
    workspaceId,
    mandateId,
    collection: collectionForWorkspace(workspaceId),
    questionCount: questions.length,
    graphPassed,
    noGraphPassed,
    graphAccuracy: graphPassed / questions.length,
    noGraphAccuracy: noGraphPassed / questions.length,
    accuracyLift: (graphPassed - noGraphPassed) / questions.length,
    graphProvenanceAccuracy: graphProvenance / questions.length,
    noGraphProvenanceAccuracy: noGraphProvenance / questions.length,
    graphPathUsage: graphPathQuestions === 0 ? 0 : graphPathUsed / graphPathQuestions,
    graphAvgLatencyMs: Math.round(graphLatency / questions.length),
    noGraphAvgLatencyMs: Math.round(noGraphLatency / questions.length),
    results,
    generatedAt: new Date().toISOString(),
  };
}

function aggregateSummaries(summaries: EvaluationSummary[]): MandateEvaluationCohort {
  const questionCount = summaries.reduce((sum, summary) => sum + summary.questionCount, 0);
  const graphPassed = summaries.reduce((sum, summary) => sum + summary.graphPassed, 0);
  const noGraphPassed = summaries.reduce((sum, summary) => sum + summary.noGraphPassed, 0);
  const graphProvenance = summaries.reduce((sum, summary) => sum + summary.results.filter((result) => result.graph.provenanceCorrect).length, 0);
  const noGraphProvenance = summaries.reduce((sum, summary) => sum + summary.results.filter((result) => result.noGraph.provenanceCorrect).length, 0);
  const graphPathQuestions = summaries.reduce((sum, summary) => sum + summary.results.filter((result) => result.question.requiresGraphPath).length, 0);
  const graphPathUsed = summaries.reduce((sum, summary) => sum + summary.results.filter((result) => result.question.requiresGraphPath && result.graph.graphPathUsed).length, 0);
  const graphLatency = summaries.reduce((sum, summary) => sum + summary.results.reduce((total, result) => total + result.graph.latencyMs, 0), 0);
  const noGraphLatency = summaries.reduce((sum, summary) => sum + summary.results.reduce((total, result) => total + result.noGraph.latencyMs, 0), 0);
  return {
    workspaceId: summaries[0]?.workspaceId ?? "",
    mandateIds: summaries.map((summary) => summary.mandateId),
    questionCount,
    graphPassed,
    noGraphPassed,
    graphAccuracy: questionCount === 0 ? 0 : graphPassed / questionCount,
    noGraphAccuracy: questionCount === 0 ? 0 : noGraphPassed / questionCount,
    accuracyLift: questionCount === 0 ? 0 : (graphPassed - noGraphPassed) / questionCount,
    graphProvenanceAccuracy: questionCount === 0 ? 0 : graphProvenance / questionCount,
    noGraphProvenanceAccuracy: questionCount === 0 ? 0 : noGraphProvenance / questionCount,
    graphPathUsage: graphPathQuestions === 0 ? 0 : graphPathUsed / graphPathQuestions,
    graphAvgLatencyMs: questionCount === 0 ? 0 : Math.round(graphLatency / questionCount),
    noGraphAvgLatencyMs: questionCount === 0 ? 0 : Math.round(noGraphLatency / questionCount),
    mandates: summaries,
    generatedAt: new Date().toISOString(),
  };
}

async function main() {
  const workspaceId = process.env.MANDATE_EVAL_WORKSPACE_ID;
  const rawMandateIds = process.env.MANDATE_EVAL_MANDATE_IDS ?? process.env.MANDATE_EVAL_MANDATE_ID;
  const mandateIds = [...new Set((rawMandateIds ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
  if (!workspaceId || mandateIds.length === 0) throw new Error("MANDATE_EVAL_WORKSPACE_ID and MANDATE_EVAL_MANDATE_ID(S) are required");

  const localEvaluation = workspaceId.startsWith("hydra-eval-");
  if (!localEvaluation && process.env.MANDATE_EVAL_CONFIRM_NONPROD !== "staging") {
    throw new Error("Refusing a non-local mandate evaluation. Set MANDATE_EVAL_CONFIRM_NONPROD=staging only for a confirmed disposable staging workspace; never use production data.");
  }

  const summaries: EvaluationSummary[] = [];
  for (const mandateId of mandateIds) {
    summaries.push(await evaluateMandate(workspaceId, mandateId));
  }

  const defaultOutput = summaries.length === 1
    ? "docs/hydradb-mandate-evaluation.json"
    : "docs/hydradb-mandate-evaluation-cohort.json";
  const output = path.resolve(process.cwd(), process.env.MANDATE_EVAL_OUTPUT_PATH?.trim() || defaultOutput);
  const report = summaries.length === 1 ? summaries[0] : aggregateSummaries(summaries);
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  const aggregate = summaries.length === 1 ? summaries[0]! : aggregateSummaries(summaries);
  console.log("\n=== Mandate Evidence Graph evaluation ===");
  console.log(`Mandates:               ${summaries.length}`);
  console.log(`Questions:              ${aggregate.questionCount}`);
  console.log(`Graph accuracy:         ${aggregate.graphPassed}/${aggregate.questionCount} (${(aggregate.graphAccuracy * 100).toFixed(0)}%)`);
  console.log(`No-graph baseline:      ${aggregate.noGraphPassed}/${aggregate.questionCount} (${(aggregate.noGraphAccuracy * 100).toFixed(0)}%)`);
  console.log(`Accuracy lift:          ${(aggregate.accuracyLift * 100).toFixed(0)} percentage points`);
  console.log(`Graph provenance:       ${(aggregate.graphProvenanceAccuracy * 100).toFixed(0)}%`);
  console.log(`Graph path usage:       ${(aggregate.graphPathUsage * 100).toFixed(0)}% of graph questions`);
  console.log(`Average latency:        ${aggregate.graphAvgLatencyMs}ms graph / ${aggregate.noGraphAvgLatencyMs}ms no-graph`);
  console.log(`Results written to:     ${output}`);
}

main().catch((error) => {
  console.error("Mandate evaluation failed:", error);
  process.exitCode = 1;
});
