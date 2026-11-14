/**
 * TelegraphCompliance
 *
 * Compliance-on-payment for governed Telegraph calls (Mission 02): before a
 * paid miner call settles, an optional screening call buys a verdict from a
 * compliance miner (SANCTIONS_SCREENING_MATCH, TRANSACTION_RISK, FRAUD_RISK,
 * …). The screening call is itself a governed, persisted CRE run; the parent
 * payment's telegraph.signal artifact carries a `compliance` block linking
 * back to it — the payment arrives with its own proof attached.
 *
 * Fail-safe contract mirrors confidence gating: only an explicit "clear"
 * verdict lets the parent payment proceed. "hit" blocks it; "unknown"
 * (miner returned nothing interpretable) also blocks — an unverifiable
 * screen is not a pass.
 */

import { Logger } from "@backend/shared/logging/Logger.js";
import { telegraphService } from "./TelegraphService.js";
import { telegraphGovernanceHelper } from "./TelegraphGovernanceHelper.js";
import { recordTelegraphGovernedCall } from "./TelegraphRunRecorder.js";
import type { CreRun } from "@backend/cre/types.js";
import type { TelegraphMinerResponse } from "./types.js";

const logger = new Logger("TelegraphCompliance");

export type ComplianceVerdict = "clear" | "hit" | "unknown";

export interface ComplianceScreenRequest {
  /** Explicit screening miner id. Takes precedence over intent lookup. */
  minerId?: string;
  /** Intent to screen with (e.g. SANCTIONS_SCREENING_MATCH). */
  intent?: string;
  /** Query params handed to the screening miner. */
  params: Record<string, unknown>;
}

export interface ComplianceScreenResult {
  verdict: ComplianceVerdict;
  detail?: string;
  run: CreRun | null;
  runId: string | null;
  minerId?: string;
  minerName?: string;
  intent?: string;
  confidence: number | null;
  costUsd?: string;
  blocked: boolean;
  blockReason?: string;
}

const DEFAULT_COMPLIANCE_INTENT = "SANCTIONS_SCREENING_MATCH";

// Keys already normalized via normKey. Boolean semantics are explicit:
// a key in HIT_WHEN_TRUE means true=hit/false=clear; CLEAR_WHEN_TRUE is the
// inverse (e.g. `no_match: true` is a clear, `no_match: false` is a hit).
const HIT_WHEN_TRUE = [
  "match",
  "matched",
  "listed",
  "sanctioned",
  "issanctioned",
  "hit",
  "flagged",
  "positive",
];
const CLEAR_WHEN_TRUE = [
  "nomatch",
  "notlisted",
  "notsanctioned",
  "clear",
  "clean",
  "negative",
];
const HIT_STRINGS = ["match", "matched", "listed", "sanctioned", "hit", "flagged", "positive"];
const CLEAR_STRINGS = [
  "clear",
  "no_match",
  "nomatch",
  "not_listed",
  "not_sanctioned",
  "clean",
  "negative",
];
const RISK_KEYS = ["riskscore", "score", "risk"];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Interpret a screening miner's response. Miners in this intent family return
 * heterogeneous shapes, so this scans recursively for the first recognizable
 * verdict signal rather than assuming a schema. Anything unrecognizable is
 * "unknown" — never silently "clear".
 */
export function evaluateComplianceVerdict(
  response: TelegraphMinerResponse<unknown> | undefined,
): { verdict: ComplianceVerdict; detail?: string } {
  const data = response?.data;
  if (data === undefined || data === null) {
    return { verdict: "unknown", detail: "screening miner returned no data" };
  }

  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  let riskScore: number | null = null;

  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const k = normKey(key);
      if (typeof value === "boolean") {
        if (HIT_WHEN_TRUE.includes(k)) {
          return { verdict: value ? "hit" : "clear", detail: `${key}=${value}` };
        }
        if (CLEAR_WHEN_TRUE.includes(k)) {
          return { verdict: value ? "clear" : "hit", detail: `${key}=${value}` };
        }
      }
      if (typeof value === "string") {
        const v = value.toLowerCase();
        if (HIT_STRINGS.includes(v)) {
          return { verdict: "hit", detail: `${key}=${value}` };
        }
        if (CLEAR_STRINGS.includes(v)) {
          return { verdict: "clear", detail: `${key}=${value}` };
        }
      }
      if (typeof value === "number" && RISK_KEYS.includes(k) && Number.isFinite(value)) {
        if (riskScore === null || value > riskScore) riskScore = value;
      }
      if (typeof value === "object" && value !== null) stack.push(value);
    }
  }

  if (riskScore !== null) {
    // Screening miners report 0–1 or 0–100 scales; treat >=0.5 (or >=50) as a hit.
    const normalized = riskScore > 1 ? riskScore / 100 : riskScore;
    return normalized >= 0.5
      ? { verdict: "hit", detail: `risk score ${riskScore}` }
      : { verdict: "clear", detail: `risk score ${riskScore}` };
  }

  return { verdict: "unknown", detail: "no recognizable verdict field in screening response" };
}

async function resolveScreeningMiner(
  screen: ComplianceScreenRequest,
): Promise<{ minerId: string; intent?: string } | null> {
  if (screen.minerId) {
    return { minerId: screen.minerId, intent: screen.intent };
  }
  const intent = screen.intent ?? DEFAULT_COMPLIANCE_INTENT;
  const miners = await telegraphService.getMiners(intent);
  const active = miners.filter(
    (m) => (m.activation_status ?? m.status ?? "active") === "active",
  );
  if (active.length === 0) return null;
  // Prefer scored miners, then cheapest — deterministic, not random.
  active.sort((a, b) => {
    const sa = a.scores?.[0]?.score ?? -1;
    const sb = b.scores?.[0]?.score ?? -1;
    if (sb !== sa) return sb - sa;
    return (a.min_price_usdc ?? Infinity) - (b.min_price_usdc ?? Infinity);
  });
  const pick = active[0];
  return { minerId: String(pick.id ?? pick.slug ?? pick.name), intent };
}

/**
 * Run the compliance screen and persist it as its own governed CRE run.
 * Returns the verdict plus the screening run id for linking.
 */
export async function runComplianceScreen(params: {
  agentId: string;
  workspaceId: string;
  mandateId?: string;
  policyId?: string;
  screen: ComplianceScreenRequest;
  description?: string;
}): Promise<ComplianceScreenResult> {
  const { agentId, workspaceId, screen } = params;

  const target = await resolveScreeningMiner(screen);
  if (!target) {
    return {
      verdict: "unknown",
      detail: `no active miner serves intent ${screen.intent ?? DEFAULT_COMPLIANCE_INTENT}`,
      run: null,
      runId: null,
      confidence: null,
      blocked: true,
      blockReason: "no compliance miner available for the requested intent",
    };
  }

  const result = await telegraphGovernanceHelper.governedMinerCall({
    agentId: `${agentId}:compliance`,
    workspaceId,
    mandateId: params.mandateId,
    policyId: params.policyId,
    minerRequest: {
      minerId: target.minerId,
      intent: target.intent ?? screen.intent,
      params: screen.params,
    },
    description: params.description ?? "Compliance screen before paid call",
  });

  const run = await recordTelegraphGovernedCall({
    result,
    projectId: workspaceId,
    agentId: `${agentId}:compliance`,
    description: params.description ?? "Compliance screen before paid call",
  });

  const meta = result.response?.metadata;
  const { verdict, detail } = evaluateComplianceVerdict(result.response);
  const blocked = verdict !== "clear" || result.status !== "approved";

  logger.info("Telegraph compliance screen completed", {
    agentId,
    minerId: target.minerId,
    intent: target.intent ?? screen.intent,
    verdict,
    status: result.status,
    runId: run?.runId,
  });

  return {
    verdict,
    detail,
    run,
    runId: run?.runId ?? null,
    minerId: target.minerId,
    minerName: meta?.minerName,
    intent: meta?.intent ?? target.intent ?? screen.intent,
    confidence: meta?.confidence ?? null,
    costUsd: meta?.costUsd,
    blocked,
    blockReason: blocked
      ? verdict === "hit"
        ? `compliance screen returned a positive match (${detail ?? "no detail"})`
        : verdict === "unknown"
          ? `compliance screen inconclusive (${detail ?? "no detail"})`
          : `compliance screen call ${result.status}: ${result.error ?? result.decision?.reason ?? "not approved"}`
      : undefined,
  };
}
