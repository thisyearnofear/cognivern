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
 * verdict lets the parent payment proceed. "hit", provider "review", and
 * "unknown" (miner returned nothing interpretable) all block — an
 * unverifiable screen is not a pass.
 */

import { Logger } from "@backend/shared/logging/Logger.js";
import { telegraphService } from "./TelegraphService.js";
import { telegraphGovernanceHelper } from "./TelegraphGovernanceHelper.js";
import { recordTelegraphGovernedCall } from "./TelegraphRunRecorder.js";
import { sha256CanonicalJson } from "./stableJson.js";
import {
  evaluateScreenSpendGuard,
  minerEstimatedCostUsd,
  subjectTerms,
  type TelegraphSpendGuardPolicy,
} from "./TelegraphSpendGuard.js";
import type { CreRun } from "@backend/cre/types.js";
import type { TelegraphMinerIntegration, TelegraphMinerResponse } from "./types.js";

const logger = new Logger("TelegraphCompliance");

export type ComplianceVerdict = "clear" | "hit" | "review" | "unknown";
export type ComplianceVerdictSource = "counterproof-adapter" | "generic-scan" | "none";

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
  providerVerdict?: string;
  verdictSource: ComplianceVerdictSource;
  detail?: string;
  run: CreRun | null;
  runId: string | null;
  minerId?: string;
  minerName?: string;
  intent?: string;
  confidence: number | null;
  costUsd?: string;
  estimatedCostUsd?: number | null;
  latencyMs?: number;
  paymentNetwork?: string;
  rawResponseHash?: string;
  source?: string;
  listVersion?: string;
  subjectHash?: string;
  subjectFields?: string[];
  status?: "approved" | "held" | "denied" | "failed";
  policyViolations?: string[];
  screeningSkipped?: boolean;
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
const CLEAR_WHEN_TRUE = ["nomatch", "notlisted", "notsanctioned", "clear", "clean", "negative"];
const REVIEW_WHEN_TRUE = ["review", "needsreview", "manualreview", "inconclusive", "ambiguous"];
const UNKNOWN_WHEN_TRUE = ["unknown", "unverifiable", "unavailable"];
const HIT_STRINGS = [
  "match",
  "matched",
  "listed",
  "sanctioned",
  "hit",
  "flagged",
  "positive",
  "block",
  "blocked",
  "deny",
  "denied",
];
const CLEAR_STRINGS = [
  "clear",
  "pass",
  "passed",
  "no_match",
  "nomatch",
  "not_listed",
  "not_sanctioned",
  "clean",
  "negative",
];
const REVIEW_STRINGS = [
  "review",
  "needs_review",
  "needs review",
  "manual_review",
  "manual review",
  "inconclusive",
  "ambiguous",
];
const UNKNOWN_STRINGS = ["unknown", "unverifiable", "unavailable"];
const RISK_KEYS = ["riskscore", "score", "risk"];

interface VerdictInterpretation {
  verdict: ComplianceVerdict;
  providerVerdict?: string;
  verdictSource: ComplianceVerdictSource;
  detail?: string;
  source?: string;
  listVersion?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function normKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeVerdictString(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstStringField(data: unknown, names: Set<string>): string | undefined {
  const stack: unknown[] = [data];
  const seen = new Set<unknown>();
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (names.has(normKey(key)) && typeof value === "string" && value.trim()) {
        return value;
      }
      if (typeof value === "object" && value !== null) stack.push(value);
    }
  }
  return undefined;
}

const PROVIDER_VERDICT_KEY_PRIORITY = [
  "label",
  "verdict",
  "decision",
  "recommendation",
  "result",
  "status",
  "outcome",
];
const PROVIDER_VERDICT_KEYS = new Set(PROVIDER_VERDICT_KEY_PRIORITY);

function mapProviderVerdict(value: string): ComplianceVerdict | null {
  const normalized = normalizeVerdictString(value);
  const compact = normKey(value);
  if (["clear", "pass", "passed", "no match", "nomatch", "clean"].includes(normalized))
    return "clear";
  if (
    ["review", "needs review", "manual review", "inconclusive", "ambiguous"].includes(normalized)
  ) {
    return "review";
  }
  if (
    [
      "block",
      "blocked",
      "deny",
      "denied",
      "hit",
      "match",
      "matched",
      "listed",
      "sanctioned",
      "positive",
    ].includes(normalized) ||
    compact === "block"
  ) {
    return "hit";
  }
  if (["unknown", "unverifiable", "unavailable"].includes(normalized)) return "unknown";
  return null;
}

function isCounterproofMiner(context?: { minerId?: string; minerName?: string }): boolean {
  const id = context?.minerId?.toLowerCase() ?? "";
  const name = context?.minerName?.toLowerCase() ?? "";
  return id === "731002" || name.includes("counterproof");
}

function providerVerdictCandidates(data: unknown): Array<{ key: string; value: string }> {
  const candidates: Array<{ key: string; value: string }> = [];
  const queue: unknown[] = [data];
  const seen = new Set<unknown>();

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === null || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (PROVIDER_VERDICT_KEYS.has(normKey(key)) && typeof value === "string") {
        candidates.push({ key, value });
      }
      if (typeof value === "object" && value !== null) queue.push(value);
    }
  }

  return candidates;
}

/**
 * Prefer explicit provider verdict labels over field guessing so a provider
 * "review" is never collapsed into a generic hit or malformed-response unknown.
 */
function interpretProviderVerdict(
  data: unknown,
  verdictSource: ComplianceVerdictSource,
): VerdictInterpretation | null {
  const candidates = providerVerdictCandidates(data);
  for (const key of PROVIDER_VERDICT_KEY_PRIORITY) {
    const candidate = candidates.find((item) => normKey(item.key) === key);
    if (!candidate) continue;
    const verdict = mapProviderVerdict(candidate.value);
    if (verdict) {
      return {
        verdict,
        providerVerdict: candidate.value,
        verdictSource,
        detail: `${candidate.key}=${candidate.value}`,
      };
    }
  }
  return null;
}

/** Counterproof exposes provider-native CLEAR / REVIEW / BLOCK labels. */
function interpretCounterproofVerdict(data: unknown): VerdictInterpretation | null {
  const explicit = interpretProviderVerdict(data, "counterproof-adapter");
  if (explicit) return explicit;

  const genericRecord = asRecord(data);
  const matched = genericRecord?.matched;
  if (typeof matched === "boolean") {
    return {
      verdict: matched ? "hit" : "clear",
      providerVerdict: String(matched),
      verdictSource: "counterproof-adapter",
      detail: `matched=${matched}`,
    };
  }
  return null;
}

/**
 * Interpret a screening miner's response. A provider adapter gets first pass
 * when the miner is known; otherwise this scans recursively for recognizable
 * verdict signals. Anything unrecognizable is "unknown" — never silently
 * "clear".
 */
export function evaluateComplianceVerdict(
  response: TelegraphMinerResponse<unknown> | undefined,
  context?: { minerId?: string; minerName?: string },
): VerdictInterpretation {
  const data = response?.data;
  if (data === undefined || data === null) {
    return {
      verdict: "unknown",
      verdictSource: "none",
      detail: "screening miner returned no data",
    };
  }

  const source = firstStringField(data, new Set(["source", "provider", "datasource", "datafeed"]));
  const listVersion = firstStringField(
    data,
    new Set(["listversion", "sanctionslistversion", "datasetversion", "version", "asof"]),
  );

  const providerContext = {
    minerId: context?.minerId ?? response?.metadata?.minerId,
    minerName: context?.minerName ?? response?.metadata?.minerName,
  };
  if (isCounterproofMiner(providerContext)) {
    const provider = interpretCounterproofVerdict(data);
    if (provider) return { ...provider, source, listVersion };
  }

  const explicit = interpretProviderVerdict(data, "generic-scan");
  if (explicit) return { ...explicit, source, listVersion };

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
          return {
            verdict: value ? "hit" : "clear",
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
        if (CLEAR_WHEN_TRUE.includes(k)) {
          return {
            verdict: value ? "clear" : "hit",
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
        if (REVIEW_WHEN_TRUE.includes(k) && value) {
          return {
            verdict: "review",
            providerVerdict: key,
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
        if (UNKNOWN_WHEN_TRUE.includes(k) && value) {
          return {
            verdict: "unknown",
            providerVerdict: key,
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
      }
      if (typeof value === "string") {
        const v = normalizeVerdictString(value);
        if (HIT_STRINGS.map(normalizeVerdictString).includes(v)) {
          return {
            verdict: "hit",
            providerVerdict: value,
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
        if (CLEAR_STRINGS.map(normalizeVerdictString).includes(v)) {
          return {
            verdict: "clear",
            providerVerdict: value,
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
        if (REVIEW_STRINGS.map(normalizeVerdictString).includes(v)) {
          return {
            verdict: "review",
            providerVerdict: value,
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
        }
        if (UNKNOWN_STRINGS.map(normalizeVerdictString).includes(v)) {
          return {
            verdict: "unknown",
            providerVerdict: value,
            verdictSource: "generic-scan",
            detail: `${key}=${value}`,
            source,
            listVersion,
          };
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
      ? {
          verdict: "hit",
          verdictSource: "generic-scan",
          detail: `risk score ${riskScore}`,
          source,
          listVersion,
        }
      : {
          verdict: "clear",
          verdictSource: "generic-scan",
          detail: `risk score ${riskScore}`,
          source,
          listVersion,
        };
  }

  return {
    verdict: "unknown",
    verdictSource: "generic-scan",
    detail: "no recognizable verdict field in screening response",
    source,
    listVersion,
  };
}

async function resolveScreeningMiner(screen: ComplianceScreenRequest): Promise<{
  minerId: string;
  intent?: string;
  miner?: TelegraphMinerIntegration | null;
  estimatedCostUsd?: number | null;
} | null> {
  if (screen.minerId) {
    let miner: TelegraphMinerIntegration | null = null;
    try {
      miner = await telegraphService.getMiner(screen.minerId);
    } catch {
      miner = null;
    }
    return {
      minerId: screen.minerId,
      intent: screen.intent,
      miner,
      estimatedCostUsd: minerEstimatedCostUsd(miner),
    };
  }
  const intent = screen.intent ?? DEFAULT_COMPLIANCE_INTENT;
  const miners = await telegraphService.getMiners(intent);
  const active = miners.filter((m) => (m.activation_status ?? m.status ?? "active") === "active");
  if (active.length === 0) return null;
  // Prefer scored miners, then cheapest — deterministic, not random.
  active.sort((a, b) => {
    const sa = a.scores?.[0]?.score ?? -1;
    const sb = b.scores?.[0]?.score ?? -1;
    if (sb !== sa) return sb - sa;
    return (a.min_price_usdc ?? Infinity) - (b.min_price_usdc ?? Infinity);
  });
  const pick = active[0];
  return {
    minerId: String(pick.id ?? pick.slug ?? pick.name),
    intent,
    miner: pick,
    estimatedCostUsd: minerEstimatedCostUsd(pick),
  };
}

/**
 * Run the compliance screen and persist it as its own governed CRE run.
 * Returns the verdict plus the screening run id for linking. `spendGuard` is
 * fail-closed: if the screen cannot be proven inside the declared policy, no
 * screening payment is made.
 */
export async function runComplianceScreen(params: {
  agentId: string;
  workspaceId: string;
  mandateId?: string;
  policyId?: string;
  screen: ComplianceScreenRequest;
  description?: string;
  spendGuard?: TelegraphSpendGuardPolicy | null;
  parentEstimatedCostUsd?: number | null;
}): Promise<ComplianceScreenResult> {
  const { agentId, workspaceId, screen } = params;
  const subject = subjectTerms(screen.params);
  const baseResult = {
    run: null,
    runId: null,
    confidence: null,
    subjectHash: sha256CanonicalJson(screen.params),
    subjectFields: subject.fields,
    blocked: true,
  };

  let target: Awaited<ReturnType<typeof resolveScreeningMiner>>;
  try {
    target = await resolveScreeningMiner(screen);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ...baseResult,
      verdict: "unknown",
      verdictSource: "none",
      detail: `compliance miner lookup failed: ${detail}`,
      screeningSkipped: true,
      blockReason: `compliance miner lookup failed: ${detail}`,
    };
  }
  if (!target) {
    return {
      ...baseResult,
      verdict: "unknown",
      verdictSource: "none",
      detail: `no active miner serves intent ${screen.intent ?? DEFAULT_COMPLIANCE_INTENT}`,
      screeningSkipped: true,
      blockReason: "no compliance miner available for the requested intent",
    };
  }

  const screenPolicyViolations = evaluateScreenSpendGuard({
    policy: params.spendGuard ?? null,
    miner: target.miner,
    minerId: target.minerId,
    minerName: target.miner?.name,
    intent: target.intent ?? screen.intent,
    parentEstimatedCostUsd: params.parentEstimatedCostUsd ?? null,
  });
  if (screenPolicyViolations.length > 0) {
    return {
      ...baseResult,
      verdict: "unknown",
      verdictSource: "none",
      detail: "spend guard denied the screening call before payment",
      minerId: target.minerId,
      minerName: target.miner?.name,
      intent: target.intent ?? screen.intent,
      estimatedCostUsd: target.estimatedCostUsd ?? null,
      policyViolations: screenPolicyViolations,
      screeningSkipped: true,
      blockReason: screenPolicyViolations.join("; "),
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
  const interpretation = evaluateComplianceVerdict(result.response, {
    minerId: target.minerId,
    minerName: meta?.minerName ?? target.miner?.name,
  });
  const blocked = interpretation.verdict !== "clear" || result.status !== "approved";

  logger.info("Telegraph compliance screen completed", {
    agentId,
    minerId: target.minerId,
    intent: target.intent ?? screen.intent,
    verdict: interpretation.verdict,
    verdictSource: interpretation.verdictSource,
    status: result.status,
    runId: run?.runId,
  });

  return {
    verdict: interpretation.verdict,
    providerVerdict: interpretation.providerVerdict,
    verdictSource: interpretation.verdictSource,
    detail: interpretation.detail,
    source: interpretation.source,
    listVersion: interpretation.listVersion,
    rawResponseHash:
      result.response?.data === undefined ? undefined : sha256CanonicalJson(result.response.data),
    run,
    runId: run?.runId ?? null,
    minerId: target.minerId,
    minerName: meta?.minerName ?? target.miner?.name,
    intent: meta?.intent ?? target.intent ?? screen.intent,
    confidence: meta?.confidence ?? null,
    costUsd: meta?.costUsd,
    estimatedCostUsd: target.estimatedCostUsd ?? null,
    latencyMs: meta?.latencyMs,
    paymentNetwork: meta?.paymentNetwork,
    status: result.status,
    subjectHash: sha256CanonicalJson(screen.params),
    subjectFields: subject.fields,
    policyViolations: [],
    blocked,
    blockReason: blocked
      ? interpretation.verdict === "hit"
        ? `compliance screen returned a positive match (${interpretation.detail ?? "no detail"})`
        : interpretation.verdict === "review"
          ? `compliance screen requires review (${interpretation.detail ?? "no detail"})`
          : interpretation.verdict === "unknown"
            ? `compliance screen inconclusive (${interpretation.detail ?? "no detail"})`
            : `compliance screen call ${result.status}: ${result.error ?? result.decision?.reason ?? "not approved"}`
      : undefined,
  };
}
