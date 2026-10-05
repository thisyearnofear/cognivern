/**
 * Runware System-One decisions adapter (Laya / Jev).
 *
 * Laya (`runware:laya@1`) is an open-weight, non-autoregressive decision
 * model: one forward pass over a state + typed questions, returning
 * probabilities and confidence instead of prose. Same request contract as
 * TypeSafe Jev (`POST /v1/decisions`, `{model, state, questions}`) — see
 * https://runware.ai/docs/tools/compatible-apis.
 *
 * Design constraints (mirror TYPESAFE.md):
 * - Reporting signal only. Nothing in this codebase may gate, deny, or
 *   penalise a request based on a decision-model output. Callers fall back
 *   to the deterministic heuristic when this returns null.
 * - Input must already be redacted. This module never sees raw prompts;
 *   callers pass `redactSecrets(...).text`.
 * - Never throws and never blocks the money path: disabled/missing key,
 *   timeout, non-2xx, and malformed answers all resolve to null.
 * - 421M parameters, ~512-token English context: keep the state short
 *   (excerpt, not the full prompt) — callers truncate before calling.
 */

import { TASK_CLASSES, type TaskClass } from "@backend/services/credits/taskClassifier.js";

const DECISIONS_URL = "https://api.runware.ai/v1/decisions";

export interface TaskDecision {
  /** Label chosen by the decision model (always one of TASK_CLASSES). */
  label: TaskClass;
  /** Model-reported confidence, 0–1. */
  confidence: number;
  /** Runware model id that produced it (e.g. `runware:laya@1`). */
  model: string;
}

function isEnabled(): boolean {
  return process.env.RUNWARE_DECISIONS_ENABLED === "true";
}

function apiKey(): string {
  return process.env.RUNWARE_API_KEY ?? "";
}

function modelId(): string {
  return process.env.RUNWARE_DECISION_MODEL || "runware:laya@1";
}

function timeoutMs(): number {
  const raw = Number(process.env.RUNWARE_DECISIONS_TIMEOUT_MS ?? "5000");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 5000;
}

function isTaskClass(value: unknown): value is TaskClass {
  return (
    typeof value === "string" && (TASK_CLASSES as readonly string[]).includes(value)
  );
}

function clampConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(0, value));
}

/**
 * Classify already-redacted text with a Runware decision model.
 * Resolves to null when disabled, unconfigured, slow, or surprising —
 * callers use the keyword heuristic instead.
 */
export async function classifyWithDecisions(
  redactedText: string,
): Promise<TaskDecision | null> {
  if (!isEnabled() || !apiKey() || !redactedText.trim()) return null;
  const model = modelId();

  const criteria: Record<string, null> = {};
  for (const taskClass of TASK_CLASSES) criteria[taskClass] = null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const response = await fetch(DECISIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        state: { text: redactedText.slice(0, 2000) },
        questions: {
          taskClass: {
            type: "choice",
            instructions:
              "What shape of work does this developer request look like? " +
              "Answer with exactly one of the listed options.",
            criteria,
          },
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      answers?: { taskClass?: { choice?: unknown; confidence?: unknown } };
    };
    const answer = payload.answers?.taskClass;
    if (!answer || !isTaskClass(answer.choice)) return null;
    const confidence = clampConfidence(answer.confidence) ?? 0.5;
    return { label: answer.choice, confidence, model };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Start classification concurrently with an upstream inference call so the
 * decision is usually resolved before recording — zero added latency on the
 * client response. Returns null when the tier forbids classification or the
 * adapter is disabled, so callers can skip awaiting entirely.
 */
export function startTaskDecision(
  taskClassAllowed: boolean,
  redactedText: string,
): Promise<TaskDecision | null> | null {
  if (!taskClassAllowed || !isEnabled() || !apiKey()) return null;
  return classifyWithDecisions(redactedText);
}
