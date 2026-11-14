/**
 * InferenceVerdictStore — persistence and leaderboard projection for
 * Telegraph-verified correctness verdicts (Mission 10).
 *
 * A verdict row says: an evaluator miner was paid (via a governed Telegraph
 * call, linked by telegraph_run_id) to judge whether a sampled inference
 * record's response was correct. 'unknown' means the evaluator returned
 * nothing parseable — it is counted, never treated as correct.
 *
 * The leaderboard is computed per model over a program:
 *   - okCalls / totalCostUsd cover ALL successful calls for the model.
 *   - sampled* counts cover only records that were actually sent to an
 *     evaluator (open-tier records with usable excerpts).
 *   - costPerVerifiedCorrectUsd prices the verification spend itself:
 *     sampled cost ÷ verified-correct count. It answers "what did it cost
 *     to confirm one right answer", not "what did the whole cohort spend".
 */

import type Database from "better-sqlite3";
import { getDb } from "@backend/db/index.js";
import { nanoToUsd } from "./money.js";

export type VerdictValue = "correct" | "incorrect" | "unknown";

export interface NewVerdictInput {
  recordId: string;
  verdict: VerdictValue;
  evaluatorMinerId?: string | null;
  evaluatorMinerName?: string | null;
  evaluatorConfidence?: number | null;
  evaluatorDetail?: string | null;
  telegraphRunId?: string | null;
  costUsd?: string | null;
}

export interface LeaderboardRow {
  model: string;
  okCalls: number;
  totalCostUsd: number;
  sampledCalls: number;
  correctCount: number;
  incorrectCount: number;
  unknownCount: number;
  /** Cost of the sampled records themselves (what verification priced). */
  sampledCostUsd: number;
  /** sampledCostUsd / correctCount — null when nothing verified correct. */
  costPerVerifiedCorrectUsd: number | null;
  /** correct / (correct + incorrect); unknowns excluded from the rate. */
  verifiedAccuracy: number | null;
}

export class InferenceVerdictStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database = getDb()) {
    this.db = db;
  }

  insert(input: NewVerdictInput): void {
    this.db
      .prepare(
        `INSERT INTO inference_record_verdicts
           (record_id, verdict, evaluator_miner_id, evaluator_miner_name,
            evaluator_confidence, evaluator_detail, telegraph_run_id,
            cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(record_id) DO NOTHING`,
      )
      .run(
        input.recordId,
        input.verdict,
        input.evaluatorMinerId ?? null,
        input.evaluatorMinerName ?? null,
        input.evaluatorConfidence ?? null,
        input.evaluatorDetail ?? null,
        input.telegraphRunId ?? null,
        input.costUsd ?? null,
        new Date().toISOString(),
      );
  }

  hasVerdict(recordId: string): boolean {
    const row = this.db
      .prepare(`SELECT 1 AS x FROM inference_record_verdicts WHERE record_id = ?`)
      .get(recordId) as { x: number } | undefined;
    return row !== undefined;
  }

  /**
   * ok-status records with usable excerpts that have not been verdicted yet.
   * Excerpts only exist for 'open'-tier records — private/detailed rows are
   * never sampled because their content was never persisted.
   */
  sampleCandidates(
    programId: string,
    options: { limit?: number } = {},
  ): Array<{
    id: string;
    model: string;
    taskClass: string | null;
    promptExcerpt: string;
    responseExcerpt: string;
    costNano: number;
  }> {
    const limit = Math.min(25, Math.max(1, Math.floor(options.limit ?? 5)));
    const rows = this.db
      .prepare(
        `SELECT r.id, r.model, r.task_class, r.prompt_excerpt, r.response_excerpt,
                r.cost_nano
         FROM inference_records r
         LEFT JOIN inference_record_verdicts v ON v.record_id = r.id
         WHERE r.program_id = ?
           AND r.status = 'ok'
           AND r.prompt_excerpt IS NOT NULL
           AND r.response_excerpt IS NOT NULL
           AND r.prompt_excerpt != ''
           AND r.response_excerpt != ''
           AND v.record_id IS NULL
         ORDER BY r.created_at ASC
         LIMIT ?`,
      )
      .all(programId, limit) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      id: String(r.id),
      model: String(r.model),
      taskClass: (r.task_class as string | null) ?? null,
      promptExcerpt: String(r.prompt_excerpt),
      responseExcerpt: String(r.response_excerpt),
      costNano: Number(r.cost_nano ?? 0),
    }));
  }

  /**
   * Per-evaluator verdict outcomes across ALL programs — used to demote
   * evaluators that historically return unparseable ('unknown') verdicts.
   * Miner ids are protocol-global, so cross-program history is the signal.
   */
  evaluatorReliability(): Map<string, { total: number; unknown: number }> {
    const rows = this.db
      .prepare(
        `SELECT evaluator_miner_id AS miner_id,
                COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN verdict = 'unknown' THEN 1 ELSE 0 END), 0) AS unknown
         FROM inference_record_verdicts
         WHERE evaluator_miner_id IS NOT NULL
         GROUP BY evaluator_miner_id`,
      )
      .all() as Array<Record<string, unknown>>;

    return new Map(
      rows.map((r) => [
        String(r.miner_id),
        { total: Number(r.total ?? 0), unknown: Number(r.unknown ?? 0) },
      ]),
    );
  }

  leaderboard(programId: string): LeaderboardRow[] {
    const rows = this.db
      .prepare(
        `SELECT r.model,
                COUNT(*) AS ok_calls,
                COALESCE(SUM(r.cost_nano), 0) AS total_cost_nano,
                COALESCE(SUM(CASE WHEN v.record_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS sampled_calls,
                COALESCE(SUM(CASE WHEN v.verdict = 'correct' THEN 1 ELSE 0 END), 0) AS correct_count,
                COALESCE(SUM(CASE WHEN v.verdict = 'incorrect' THEN 1 ELSE 0 END), 0) AS incorrect_count,
                COALESCE(SUM(CASE WHEN v.verdict = 'unknown' THEN 1 ELSE 0 END), 0) AS unknown_count,
                COALESCE(SUM(CASE WHEN v.record_id IS NOT NULL THEN r.cost_nano ELSE 0 END), 0) AS sampled_cost_nano
         FROM inference_records r
         LEFT JOIN inference_record_verdicts v ON v.record_id = r.id
         WHERE r.program_id = ? AND r.status = 'ok'
         GROUP BY r.model
         ORDER BY sampled_cost_nano DESC`,
      )
      .all(programId) as Array<Record<string, unknown>>;

    return rows.map((r) => {
      const sampledCostUsd = nanoToUsd(Number(r.sampled_cost_nano ?? 0));
      const correctCount = Number(r.correct_count ?? 0);
      const incorrectCount = Number(r.incorrect_count ?? 0);
      const decided = correctCount + incorrectCount;
      return {
        model: String(r.model),
        okCalls: Number(r.ok_calls ?? 0),
        totalCostUsd: nanoToUsd(Number(r.total_cost_nano ?? 0)),
        sampledCalls: Number(r.sampled_calls ?? 0),
        correctCount,
        incorrectCount,
        unknownCount: Number(r.unknown_count ?? 0),
        sampledCostUsd,
        costPerVerifiedCorrectUsd:
          correctCount > 0 ? sampledCostUsd / correctCount : null,
        verifiedAccuracy: decided > 0 ? correctCount / decided : null,
      };
    });
  }
}

let shared: InferenceVerdictStore | null = null;
export function sharedInferenceVerdictStore(): InferenceVerdictStore {
  if (!shared) shared = new InferenceVerdictStore();
  return shared;
}
