/**
 * TelegraphLedger
 *
 * Read-only projection over CRE runs carrying `telegraph.signal` artifacts.
 * This is the Mission-02 "agent expense ledger" substrate: every paid miner
 * call is already a persisted run; this aggregates them into burn-by-intent,
 * per-miner, and per-mandate views plus a settlement count a judge can
 * re-derive from the same store.
 *
 * Dispositions come from the run lifecycle, not the artifact alone:
 *   approved    — confidence met, run completed
 *   held_pending— signal held, still waiting on an operator
 *   released    — held signal approved by an operator
 *   quarantined — held signal rejected by an operator
 *   failed      — call or run failed
 */

import type { CreRun } from "@backend/cre/types.js";

export type TelegraphLedgerDisposition =
  | "approved"
  | "held_pending"
  | "released"
  | "quarantined"
  | "blocked"
  | "failed";

export interface TelegraphLedgerRecord {
  runId: string;
  timestamp: string;
  agentId?: string;
  mandateId?: string;
  minerId?: string;
  minerName?: string;
  intent?: string;
  confidence: number | null;
  confidenceMet: boolean | null;
  costUsd: number;
  paid: boolean;
  paymentNetwork?: string;
  latencyMs?: number;
  disposition: TelegraphLedgerDisposition;
  approvalState?: string;
  /** Present when the payment carried a compliance screen (or was gate-blocked). */
  complianceVerdict?: string;
  complianceRunId?: string;
  complianceVerdictSource?: string;
  evidenceHash?: string;
  evidencePath?: string;
  policyViolations?: string[];
  gateBlocked?: boolean;
}

export interface TelegraphLedgerReport {
  generatedAt: string;
  totals: {
    calls: number;
    paidCalls: number;
    spendUsd: number;
    approved: number;
    heldPending: number;
    released: number;
    quarantined: number;
    blocked: number;
    failed: number;
  };
  byIntent: Array<{
    intent: string;
    calls: number;
    spendUsd: number;
    approved: number;
    held: number;
    failed: number;
  }>;
  byMiner: Array<{
    minerId: string;
    minerName: string;
    calls: number;
    spendUsd: number;
    avgConfidence: number | null;
  }>;
  byMandate: Array<{ mandateId: string; calls: number; spendUsd: number }>;
  records: TelegraphLedgerRecord[];
}

const MAX_RECORDS = 100;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function dispositionFor(
  run: CreRun,
  confidenceMet: boolean | null,
  gateBlocked: boolean,
): TelegraphLedgerDisposition {
  if (gateBlocked) return "blocked";
  const wasHeld =
    confidenceMet === false ||
    run.status === "paused_for_approval" ||
    run.requiresApproval === true;
  if (wasHeld) {
    if (run.approvalState === "approved") return "released";
    if (run.approvalState === "rejected") return "quarantined";
    return "held_pending";
  }
  return run.ok !== false && run.status !== "failed" ? "approved" : "failed";
}

export function buildTelegraphLedgerReport(runs: CreRun[]): TelegraphLedgerReport {
  const records: TelegraphLedgerRecord[] = [];

  for (const run of runs) {
    const artifact = [...run.artifacts]
      .reverse()
      .find((a) => a.type === "telegraph.signal");
    if (!artifact) continue;
    const data = asRecord(artifact.data);
    if (!data) continue;

    const miner = asRecord(data.miner);
    const signal = asRecord(data.signal);
    const cost = asRecord(data.cost);
    const compliance = asRecord(data.compliance);
    const evidenceBundle = asRecord(data.evidenceBundle);
    const policyEvaluation = asRecord(evidenceBundle?.policyEvaluation);
    const gate = asRecord(data.gate);
    const gateBlocked = gate?.decision === "blocked";

    const confidence = num(signal?.confidence);
    const confidenceMet =
      typeof signal?.confidenceMet === "boolean" ? signal.confidenceMet : null;
    const costUsd = num(cost?.usd) ?? 0;

    records.push({
      runId: run.runId,
      timestamp: str(data.timestamp) ?? run.startedAt,
      agentId: str(data.agentId),
      mandateId: str(data.mandateId),
      minerId: str(miner?.id),
      minerName: str(miner?.name) ?? (gateBlocked ? "compliance gate" : undefined),
      intent: str(miner?.intent),
      confidence,
      confidenceMet,
      costUsd,
      paid: cost?.paid === true,
      paymentNetwork: str(cost?.paymentNetwork),
      latencyMs: num(data.latencyMs) ?? undefined,
      disposition: dispositionFor(run, confidenceMet, gateBlocked),
      approvalState: run.approvalState,
      complianceVerdict: str(compliance?.verdict),
      complianceRunId: str(compliance?.screeningRunId),
      complianceVerdictSource: str(compliance?.verdictSource),
      evidenceHash: str(evidenceBundle?.evidenceHash),
      evidencePath: evidenceBundle?.evidenceHash
        ? `/api/telegraph/evidence/${run.runId}`
        : undefined,
      policyViolations: Array.isArray(policyEvaluation?.violations)
        ? policyEvaluation.violations.filter((item): item is string => typeof item === "string")
        : undefined,
      gateBlocked: gateBlocked || undefined,
    });
  }

  records.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const totals: TelegraphLedgerReport["totals"] = {
    calls: records.length,
    paidCalls: 0,
    spendUsd: 0,
    approved: 0,
    heldPending: 0,
    released: 0,
    quarantined: 0,
    blocked: 0,
    failed: 0,
  };
  const intentMap = new Map<
    string,
    { intent: string; calls: number; spendUsd: number; approved: number; held: number; failed: number }
  >();
  const minerMap = new Map<
    string,
    { minerId: string; minerName: string; calls: number; spendUsd: number; confidenceSum: number; confidenceCount: number }
  >();
  const mandateMap = new Map<string, { mandateId: string; calls: number; spendUsd: number }>();

  for (const r of records) {
    if (r.paid) totals.paidCalls += 1;
    totals.spendUsd += r.costUsd;
    if (r.disposition === "approved") totals.approved += 1;
    else if (r.disposition === "held_pending") totals.heldPending += 1;
    else if (r.disposition === "released") totals.released += 1;
    else if (r.disposition === "quarantined") totals.quarantined += 1;
    else if (r.disposition === "blocked") totals.blocked += 1;
    else totals.failed += 1;

    const intentKey = r.intent ?? "unclassified";
    const intent = intentMap.get(intentKey) ?? {
      intent: intentKey,
      calls: 0,
      spendUsd: 0,
      approved: 0,
      held: 0,
      failed: 0,
    };
    intent.calls += 1;
    intent.spendUsd += r.costUsd;
    if (r.disposition === "approved" || r.disposition === "released") intent.approved += 1;
    else if (
      r.disposition === "held_pending" ||
      r.disposition === "quarantined" ||
      r.disposition === "blocked"
    )
      intent.held += 1;
    else intent.failed += 1;
    intentMap.set(intentKey, intent);

    const minerKey = r.minerId ?? r.minerName ?? "unknown";
    const miner = minerMap.get(minerKey) ?? {
      minerId: minerKey,
      minerName: r.minerName ?? minerKey,
      calls: 0,
      spendUsd: 0,
      confidenceSum: 0,
      confidenceCount: 0,
    };
    miner.calls += 1;
    miner.spendUsd += r.costUsd;
    if (r.confidence !== null) {
      miner.confidenceSum += r.confidence;
      miner.confidenceCount += 1;
    }
    minerMap.set(minerKey, miner);

    const mandateKey = r.mandateId ?? "unscoped";
    const mandate = mandateMap.get(mandateKey) ?? {
      mandateId: mandateKey,
      calls: 0,
      spendUsd: 0,
    };
    mandate.calls += 1;
    mandate.spendUsd += r.costUsd;
    mandateMap.set(mandateKey, mandate);
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  totals.spendUsd = round2(totals.spendUsd);

  return {
    generatedAt: new Date().toISOString(),
    totals,
    byIntent: [...intentMap.values()]
      .map((i) => ({ ...i, spendUsd: round2(i.spendUsd) }))
      .sort((a, b) => b.spendUsd - a.spendUsd),
    byMiner: [...minerMap.values()]
      .map((m) => ({
        minerId: m.minerId,
        minerName: m.minerName,
        calls: m.calls,
        spendUsd: round2(m.spendUsd),
        avgConfidence:
          m.confidenceCount > 0 ? m.confidenceSum / m.confidenceCount : null,
      }))
      .sort((a, b) => b.spendUsd - a.spendUsd),
    byMandate: [...mandateMap.values()]
      .map((m) => ({ ...m, spendUsd: round2(m.spendUsd) }))
      .sort((a, b) => b.spendUsd - a.spendUsd),
    records: records.slice(0, MAX_RECORDS),
  };
}
