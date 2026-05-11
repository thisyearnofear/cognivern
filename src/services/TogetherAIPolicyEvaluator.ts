/**
 * Together AI Policy Evaluator
 *
 * Replaces/extends the default LLM policy evaluator with Together AI inference.
 * Keeps the same interface as the existing governance evaluate handler so it
 * can be swapped in without changing callers.
 *
 * Agents Assemble Healthcare AI Endgame — Together AI integration requirement.
 */

import type { Policy, PolicyRule, SharpContext } from "../types/Policy.js";
import type { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";

const TOGETHER_API_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export interface PolicyEvaluationRequest {
  action: AgentAction;
  policy: Policy;
  /** Optional FHIR/SHARP clinical context propagated from the agent call chain */
  fhirContext?: SharpContext;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reasoning: string;
  policyChecks: PolicyCheck[];
  model: string;
  provider: "together-ai" | "fallback";
}

/** Fields on AgentAction beyond the base type that governance callers may supply */
export interface GovernanceActionMeta {
  agentId?: string;
  amount?: number;
  currency?: string;
}

function buildSystemPrompt(): string {
  return [
    "You are Cognivern, an autonomous governance policy evaluator for healthcare AI agents.",
    "You enforce HIPAA, FHIR R4 data-access policies, and organisational spend controls.",
    "Given an agent action and the active policy rules, decide whether the action is ALLOWED or DENIED.",
    "Return a JSON object with keys: allowed (boolean), reasoning (string ≤200 chars), checks (array of {ruleId, passed, reason}).",
    "Return ONLY valid JSON — no markdown fences, no extra text.",
  ].join(" ");
}

function buildUserPrompt(req: PolicyEvaluationRequest): string {
  const fhirBlock = req.fhirContext
    ? `\nFHIR/SHARP context: ${JSON.stringify(req.fhirContext)}`
    : "";

  const rulesBlock = req.policy.rules
    .map((r: PolicyRule) => `- [${r.id}] type=${r.type} condition="${r.condition}"`)
    .join("\n");

  return [
    `Agent action: ${JSON.stringify(req.action)}`,
    fhirBlock,
    `Policy "${req.policy.name}" rules:`,
    rulesBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackResult(
  req: PolicyEvaluationRequest,
  reason: string,
): PolicyEvaluationResult {
  return {
    allowed: false,
    reasoning: `Fallback deny — ${reason}`,
    policyChecks: req.policy.rules.map((r: PolicyRule) => ({
      policyId: r.id,
      result: false,
      reason: "LLM evaluator unavailable",
    })),
    model: "none",
    provider: "fallback",
  };
}

/**
 * Evaluate a governance policy decision using Together AI.
 * Falls back to a safe-deny result if the API is unreachable or returns
 * an unparseable response.
 */
export async function evaluatePolicyWithTogetherAI(
  req: PolicyEvaluationRequest,
): Promise<PolicyEvaluationResult> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    logger.warn("TOGETHER_API_KEY not set — using fallback policy evaluator");
    return buildFallbackResult(req, "TOGETHER_API_KEY not configured");
  }

  const model = process.env.TOGETHER_MODEL || DEFAULT_MODEL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    const response = await fetch(TOGETHER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(req) },
        ],
        temperature: 0.1,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Together AI HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from Together AI");

    const parsed = JSON.parse(content) as {
      allowed: boolean;
      reasoning: string;
      checks: { ruleId: string; passed: boolean; reason: string }[];
    };

    const policyChecks: PolicyCheck[] = (parsed.checks ?? []).map((c) => ({
      policyId: c.ruleId,
      result: c.passed,
      reason: c.reason,
    }));

    logger.info("Together AI policy evaluation complete", {
      allowed: parsed.allowed,
      model: data.model ?? model,
    });

    return {
      allowed: parsed.allowed,
      reasoning: parsed.reasoning ?? "",
      policyChecks,
      model: data.model ?? model,
      provider: "together-ai",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Together AI policy evaluator error", { error: msg });
    return buildFallbackResult(req, msg);
  }
}
