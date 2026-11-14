/**
 * InferenceVerificationService — Mission 10 (model economy).
 *
 * Samples recorded inference calls and pays a Telegraph evaluator miner
 * (LLM_OUTPUT_EVALUATION intent) to judge whether each response was correct.
 * Verdicts persist in inference_record_verdicts and feed the per-model
 * "cost per verified correct answer" leaderboard.
 *
 * Honesty contract:
 *   - Only 'open'-tier records carry excerpts, so only those can be sampled.
 *     Private/detailed calls are never sent to an evaluator.
 *   - The verdict is the evaluator miner's assertion — linked to a paid,
 *     governed CRE run — not independent ground truth. 'unknown' verdicts are
 *     stored and excluded from accuracy, never counted as correct.
 *   - Each verification is itself a governed Telegraph call, so the cost of
 *     verification is part of the ledger, not hidden.
 */

import { Logger } from "@backend/shared/logging/Logger.js";
import { telegraphService, baseIntent } from "@backend/services/telegraph/TelegraphService.js";
import type { TelegraphMinerIntegration } from "@backend/services/telegraph/types.js";
import { telegraphGovernanceHelper } from "@backend/services/telegraph/TelegraphGovernanceHelper.js";
import { recordTelegraphGovernedCall } from "@backend/services/telegraph/TelegraphRunRecorder.js";
import {
  sharedInferenceVerdictStore,
  type InferenceVerdictStore,
  type VerdictValue,
} from "@backend/services/credits/InferenceVerdictStore.js";
import type { CreRun } from "@backend/cre/types.js";

const logger = new Logger("InferenceVerificationService");

const EVALUATION_INTENT = "LLM_OUTPUT_EVALUATION";
const MAX_EXCERPT_CHARS = 1500;

export interface VerifySampleParams {
  programId: string;
  workspaceId: string;
  limit?: number;
  /** Optional operator-chosen evaluator miner id; skips auto-selection. */
  evaluatorMinerId?: string;
  /**
   * Cross-miner agreement: judge each record with TWO distinct evaluators.
   * The verdict only stands when both return the same decided verdict —
   * disagreement or any inconclusive evaluator persists 'unknown' with the
   * per-evaluator breakdown in the detail. Doubles verification spend per
   * sampled record; that cost is itself ledgered.
   */
  agreement?: boolean;
}

export interface EvaluationOutcome {
  verdict: VerdictValue;
  minerId: string;
  minerName?: string;
  confidence: number | null;
  runId: string | null;
  costUsd: string | null;
  detail?: string;
}

export interface VerifySampleResult {
  attempted: number;
  skippedNoCandidates: boolean;
  verdicts: Array<{
    recordId: string;
    model: string;
    verdict: VerdictValue;
    evaluatorMinerId?: string | null;
    evaluatorMinerName?: string | null;
    confidence: number | null;
    telegraphRunId: string | null;
    detail?: string | null;
    /** Present in agreement mode — every evaluator's individual outcome. */
    evaluations?: EvaluationOutcome[];
  }>;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildEvaluationQuery(prompt: string, response: string): string {
  return [
    "Judge whether the assistant response correctly answers the user prompt.",
    "Reply with exactly one word: CORRECT or INCORRECT.",
    "",
    `Prompt: ${truncate(prompt, MAX_EXCERPT_CHARS)}`,
    "",
    `Response: ${truncate(response, MAX_EXCERPT_CHARS)}`,
  ].join("\n");
}

const VERDICT_KEYS = new Set([
  "verdict",
  "correct",
  "is_correct",
  "iscorrect",
  "accuracy",
  "judgement",
  "judgment",
  "result",
  "answer",
]);

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseToken(value: unknown): VerdictValue | null {
  if (typeof value === "boolean") return value ? "correct" : "incorrect";
  if (typeof value !== "string") return null;
  const v = value.toLowerCase().trim();
  if (["correct", "right", "yes", "true", "accurate"].includes(v)) return "correct";
  if (["incorrect", "wrong", "no", "false", "inaccurate"].includes(v)) return "incorrect";
  return null;
}

// Loose match for free-text evaluator output. "incorrect" is checked first —
// it contains "correct" as a substring.
function parseLooseToken(value: string): VerdictValue | null {
  const v = value.toLowerCase();
  if (/\b(incorrect|wrong|inaccurate|false)\b/.test(v)) return "incorrect";
  if (/\b(correct|right|accurate|true)\b/.test(v)) return "correct";
  return null;
}

/**
 * Extract a correct/incorrect verdict from an evaluator response. Scans
 * recursively for verdict-shaped keys first, then falls back to the first
 * recognizable token anywhere in the payload. Unparseable → "unknown".
 */
export function parseEvaluationVerdict(data: unknown): {
  verdict: VerdictValue;
  detail?: string;
} {
  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  let fallback: VerdictValue | null = null;

  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined || seen.has(node)) continue;
    if (typeof node === "string") {
      const parsed = parseLooseToken(node);
      if (parsed && !fallback) fallback = parsed;
      continue;
    }
    if (typeof node !== "object") continue;
    seen.add(node);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (VERDICT_KEYS.has(normKey(key))) {
        const parsed = parseToken(value);
        if (parsed) return { verdict: parsed, detail: `${key}=${String(value).slice(0, 80)}` };
      }
      if (typeof value === "object" && value !== null) stack.push(value);
      else if (typeof value === "string") {
        const parsed = parseLooseToken(value);
        if (parsed && !fallback) fallback = parsed;
      }
    }
  }

  return fallback
    ? { verdict: fallback }
    : { verdict: "unknown", detail: "no parseable verdict in evaluator response" };
}

/**
 * Ranked list of evaluator miner ids, best first. Flaky evaluators
 * (>=50% unparseable verdicts over >=2 samples) sort last regardless of
 * protocol score.
 */
async function pickEvaluatorPool(
  reliability?: Map<string, { total: number; unknown: number }>,
): Promise<string[]> {
  const miners = await telegraphService.getMiners(EVALUATION_INTENT);
  const active = miners.filter(
    (m) => (m.activation_status ?? m.status ?? "active") === "active",
  );
  if (active.length === 0) return [];
  // `*_GENERAL` intents are claimed by miners that never evaluate anything
  // (price feeds, dataset proxies). When miners with a real evaluation
  // endpoint exist, restrict to them — a verdict requires an evaluator.
  const evalRank = (m: TelegraphMinerIntegration): number => {
    const hasEvalEndpoint = (m.endpoints ?? []).some((e) => /eval/i.test(e.path ?? ""));
    const label = `${m.slug ?? ""} ${m.name ?? ""}`.toLowerCase();
    const hasEvalLabel = /eval|llm/.test(label);
    if (hasEvalEndpoint && hasEvalLabel) return 3;
    if (hasEvalEndpoint) return 2;
    if (hasEvalLabel) return 1;
    return 0;
  };
  const evalCapable = active.filter((m) => evalRank(m) >= 2);
  const pool = evalCapable.length > 0 ? evalCapable : active;
  // `scores` is a per-intent leaderboard — scores[0] is whatever intent the
  // miner ranked highest on, not necessarily this one. Match the intent.
  const intentScore = (m: TelegraphMinerIntegration): number =>
    m.scores?.find((s) => baseIntent(s.intent_id) === EVALUATION_INTENT)?.score ?? -1;
  // A miner with a track record of unparseable verdicts is a bad evaluator —
  // demote it below peers regardless of protocol score. Needs >=2 samples so
  // one unlucky response doesn't blacklist a miner.
  const isFlaky = (m: TelegraphMinerIntegration): boolean => {
    if (!reliability) return false;
    const id = String(m.id ?? m.slug ?? m.name ?? "");
    const stats = reliability.get(id);
    return !!stats && stats.total >= 2 && stats.unknown / stats.total >= 0.5;
  };
  pool.sort((a, b) => {
    const fa = isFlaky(a) ? 1 : 0;
    const fb = isFlaky(b) ? 1 : 0;
    if (fb !== fa) return fa - fb;
    const sa = intentScore(a);
    const sb = intentScore(b);
    if (sb !== sa) return sb - sa;
    const ra = evalRank(a);
    const rb = evalRank(b);
    if (rb !== ra) return rb - ra;
    return (a.min_price_usdc ?? Infinity) - (b.min_price_usdc ?? Infinity);
  });
  return pool.map((m) => String(m.id ?? m.slug ?? m.name));
}

export class InferenceVerificationService {
  constructor(
    private readonly verdicts: InferenceVerdictStore = sharedInferenceVerdictStore(),
  ) {}

  /**
   * Verify up to `limit` unverdicted ok-records for a program. Each record
   * costs one paid evaluator call; the caller bounds spend via `limit`.
   */
  async verifySample(params: VerifySampleParams): Promise<VerifySampleResult> {
    const limit = Math.min(10, Math.max(1, Math.floor(params.limit ?? 3)));
    const candidates = this.verdicts.sampleCandidates(params.programId, { limit });

    if (candidates.length === 0) {
      return { attempted: 0, skippedNoCandidates: true, verdicts: [] };
    }

    // Agreement mode needs two DISTINCT evaluators; a single-evaluator run
    // uses just the top of the pool. An explicit override always wins and
    // runs single-evaluator (the operator chose the judge).
    const evaluatorIds = params.evaluatorMinerId
      ? [params.evaluatorMinerId]
      : (await pickEvaluatorPool(this.verdicts.evaluatorReliability())).slice(
          0,
          params.agreement ? 2 : 1,
        );
    const results: VerifySampleResult["verdicts"] = [];

    if (evaluatorIds.length === 0) {
      logger.warn("No active LLM_OUTPUT_EVALUATION miner; verdicts skipped");
      return { attempted: 0, skippedNoCandidates: false, verdicts: [] };
    }
    if (params.agreement && evaluatorIds.length < 2) {
      logger.warn("Agreement mode requested but only one evaluator miner available");
    }

    for (const candidate of candidates) {
      try {
        const evaluations: EvaluationOutcome[] = [];
        for (const evaluatorId of evaluatorIds) {
          evaluations.push(
            await this.evaluateRecord(candidate, evaluatorId, params),
          );
        }

        const combined = combineEvaluations(evaluations);
        this.verdicts.insert({
          recordId: candidate.id,
          verdict: combined.verdict,
          evaluatorMinerId: combined.evaluatorMinerId,
          evaluatorMinerName: combined.evaluatorMinerName,
          evaluatorConfidence: combined.confidence,
          evaluatorDetail: combined.detail,
          telegraphRunId: combined.telegraphRunId,
          costUsd: combined.costUsd,
        });

        results.push({
          recordId: candidate.id,
          model: candidate.model,
          verdict: combined.verdict,
          evaluatorMinerId: combined.evaluatorMinerId,
          evaluatorMinerName: combined.evaluatorMinerName,
          confidence: combined.confidence,
          telegraphRunId: combined.telegraphRunId,
          detail: combined.detail,
          evaluations: params.agreement ? evaluations : undefined,
        });
      } catch (error) {
        logger.error("Verification call failed for record", {
          recordId: candidate.id,
          error,
        });
      }
    }

    return { attempted: results.length, skippedNoCandidates: false, verdicts: results };
  }

  /** One governed evaluator call for a single record. Never throws for
   *  upstream problems — inconclusive outcomes come back as 'unknown'. */
  private async evaluateRecord(
    candidate: {
      id: string;
      model: string;
      promptExcerpt: string;
      responseExcerpt: string;
    },
    evaluatorId: string,
    params: VerifySampleParams,
  ): Promise<EvaluationOutcome> {
    const governed = await telegraphGovernanceHelper.governedMinerCall({
      agentId: `verifier:${params.programId}`,
      workspaceId: params.workspaceId,
      minerRequest: {
        minerId: evaluatorId,
        intent: EVALUATION_INTENT,
        params: {
          query: buildEvaluationQuery(
            candidate.promptExcerpt,
            candidate.responseExcerpt,
          ),
        },
      },
      description: `Verify inference record ${candidate.id} (${candidate.model})`,
    });

    let run: CreRun | null = null;
    try {
      run = await recordTelegraphGovernedCall({
        result: governed,
        projectId: params.workspaceId,
        agentId: `verifier:${params.programId}`,
        description: `Verify inference record ${candidate.id}`,
      });
    } catch (err) {
      logger.warn("Failed to persist verification CRE run", {
        recordId: candidate.id,
        error: err,
      });
    }

    // A held or failed evaluation never released its signal — the verdict
    // is inconclusive regardless of what the raw response contained.
    const { verdict, detail } =
      governed.status === "approved"
        ? parseEvaluationVerdict(governed.response?.data)
        : {
            verdict: "unknown" as VerdictValue,
            detail: `evaluator call ${governed.status}`,
          };
    const meta = governed.response?.metadata;

    return {
      verdict,
      minerId: meta?.minerId ?? evaluatorId,
      minerName: meta?.minerName,
      confidence: meta?.confidence ?? null,
      runId: run?.runId ?? null,
      costUsd: meta?.costUsd ?? null,
      detail,
    };
  }
}

/**
 * Collapse per-evaluator outcomes into the single stored verdict.
 * Agreement mode: a decided verdict only stands when at least two
 * evaluators decided AND all decided verdicts agree; anything less is
 * 'unknown' with the breakdown preserved in the detail.
 */
export function combineEvaluations(evaluations: EvaluationOutcome[]): {
  verdict: VerdictValue;
  evaluatorMinerId: string | null;
  evaluatorMinerName: string | null;
  confidence: number | null;
  telegraphRunId: string | null;
  costUsd: string | null;
  detail: string | null;
} {
  const ids = evaluations.map((e) => e.minerId).join(",");
  const names = evaluations.map((e) => e.minerName ?? e.minerId).join(" + ");
  const runIds = evaluations.map((e) => e.runId).filter(Boolean).join(",");
  const totalCost = evaluations.reduce<number>(
    (sum, e) => sum + (e.costUsd != null ? Number(e.costUsd) || 0 : 0),
    0,
  );
  const breakdown = evaluations
    .map((e) => `${e.minerName ?? e.minerId}=${e.verdict}${e.detail ? `(${e.detail})` : ""}`)
    .join("; ");

  if (evaluations.length === 1) {
    const e = evaluations[0];
    return {
      verdict: e.verdict,
      evaluatorMinerId: e.minerId,
      evaluatorMinerName: e.minerName ?? null,
      confidence: e.confidence,
      telegraphRunId: e.runId,
      costUsd: e.costUsd != null ? String(e.costUsd) : null,
      detail: e.detail ?? null,
    };
  }

  const decided = evaluations.filter((e) => e.verdict !== "unknown");
  const unanimous =
    decided.length >= 2 && decided.every((e) => e.verdict === decided[0].verdict);

  return {
    verdict: unanimous ? decided[0].verdict : "unknown",
    evaluatorMinerId: ids,
    evaluatorMinerName: names,
    confidence: decided.length > 0 ? decided[0].confidence : null,
    telegraphRunId: runIds || null,
    costUsd: totalCost > 0 ? totalCost.toFixed(6) : null,
    detail: unanimous
      ? `agreement: ${breakdown}`
      : `no consensus: ${breakdown}`,
  };
}

let shared: InferenceVerificationService | null = null;
export function sharedInferenceVerificationService(): InferenceVerificationService {
  if (!shared) shared = new InferenceVerificationService();
  return shared;
}
