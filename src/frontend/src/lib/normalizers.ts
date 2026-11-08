// Normalization utilities for audit/governance data
// Single source of truth for data transformation (DRY)

import type { AuditLog } from "@cognivern/shared";

export type NormalizedDecision = "approved" | "denied" | "held";

/**
 * Normalize a raw decision/outcome/complianceStatus string into a canonical decision.
 */
export function normalizeDecisionStatus(
  raw: string | undefined | null,
): NormalizedDecision {
  if (!raw) return "held";
  const lower = raw.toLowerCase();
  if (["approved", "allowed", "compliant"].includes(lower)) return "approved";
  if (["denied", "non-compliant"].includes(lower)) return "denied";
  return "held";
}

/**
 * Normalize a raw audit log from any source (backend, demo data, etc.)
 * into a consistent shape for UI consumption.
 */
export interface NormalizedAuditLog {
  id: string;
  agent: string;
  action: string;
  description: string;
  decision: NormalizedDecision;
  chain: string;
  timestamp: string;
  time: string;
  latency: string;
  policyChecks: { policyId: string; result: boolean; reason: string }[];
}

export function normalizeAuditLog(raw: AuditLog | Record<string, unknown>): NormalizedAuditLog {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    agent: String(r.agent ?? r.agentId ?? "Unknown"),
    action: String(r.actionType ?? r.action ?? "unknown"),
    description: String(r.desc ?? r.description ?? ""),
    decision: normalizeDecisionStatus(
      String(r.outcome ?? r.complianceStatus ?? r.decision ?? ""),
    ),
    chain: String(r.chain ?? "—"),
    timestamp: String(r.timestamp ?? new Date().toISOString()),
    time: String(r.time ?? new Date(r.timestamp as string).toLocaleString()),
    latency: String(r.latency ?? r.responseTime ?? "—"),
    policyChecks: Array.isArray(r.policyChecks) ? r.policyChecks : [],
  };
}

/**
 * Normalize a list of audit logs.
 */
export function normalizeAuditLogs(
  rawLogs: AuditLog[] | Record<string, unknown>[] | unknown,
): NormalizedAuditLog[] {
  if (!Array.isArray(rawLogs)) return [];
  return rawLogs.map(normalizeAuditLog);
}

/**
 * Which governance layer produced the recorded decision — the
 * defense-in-depth provenance view. Derived from fields already on the
 * audit record; it does not claim a layer that isn't evidenced.
 *
 * - `policy`: a concrete policy check failed → deterministic rule blocked.
 * - `evaluation`: denied without a failed check → the aggregate governance
 *   evaluation (rules + model scoring) rejected it.
 * - `escalation`: held → flagged for operator review before execution.
 * - `cleared`: approved → passed every layer.
 */
export type DecisionLayer = 'policy' | 'evaluation' | 'escalation' | 'cleared';

export function decisionLayer(log: NormalizedAuditLog): DecisionLayer {
  if (log.decision === 'held') return 'escalation';
  if (log.decision === 'denied') {
    return log.policyChecks.some((check) => !check.result) ? 'policy' : 'evaluation';
  }
  return 'cleared';
}

export function summarizeDecisionLayers(
  logs: NormalizedAuditLog[],
): Record<DecisionLayer, number> {
  const counts: Record<DecisionLayer, number> = {
    policy: 0,
    evaluation: 0,
    escalation: 0,
    cleared: 0,
  };
  for (const log of logs) counts[decisionLayer(log)] += 1;
  return counts;
}

/**
 * Check if a normalized decision is a rejection.
 */
export function isRejected(decision: NormalizedDecision): boolean {
  return decision === "denied";
}

/**
 * Compute compliance rate from normalized logs.
 */
export function computeComplianceRate(
  logs: NormalizedAuditLog[],
): number {
  if (logs.length === 0) return 0;
  return Math.round(
    (logs.filter((l) => l.decision === "approved").length / logs.length) * 100,
  );
}

/**
 * Compute average latency from normalized logs.
 */
export function computeAverageLatency(
  logs: NormalizedAuditLog[],
): number {
  if (logs.length === 0) return 0;
  return Math.round(
    logs.reduce((sum, l) => sum + (parseFloat(l.latency) || 0), 0) / logs.length,
  );
}
