/**
 * Population-level governance signals for funded mandates ("programs").
 *
 * Pure functions over the spend-attribution read model — the productized
 * version of the swarm forensics detectors: each agent's spend can look
 * compliant in isolation while the *population* drifts from the mandate's
 * authorized boundary. Signals are evidence-linked (allocation/run ids) so
 * the UI can jump from a finding to the underlying records.
 */

import type { FundedMandate, SpendAttributionReport } from './api-client';

export type AttributionRecord = SpendAttributionReport['records'][number];

export type SignalSeverity = 'info' | 'warning' | 'critical';

export interface SignalEvidence {
  label: string;
  reference: string;
}

export interface ProgramSignal {
  id:
    | 'out_of_scope_spend'
    | 'split_procurement'
    | 'allocation_concentration'
    | 'treasury_race'
    | 'approval_pressure';
  severity: SignalSeverity;
  title: string;
  detail: string;
  evidence: SignalEvidence[];
}

export interface AgentSpendRollup {
  agentId: string;
  inScope: boolean;
  recordCount: number;
  allocated: bigint;
  consumed: bigint;
  held: bigint;
  denied: bigint;
  lastRecordedAt?: string;
}

function toBigInt(value: string | undefined): bigint {
  if (!value || !/^\d+$/.test(value)) return BigInt(0);
  try {
    return BigInt(value);
  } catch {
    return BigInt(0);
  }
}

function formatTokenAmount(value: bigint): string {
  return value.toLocaleString();
}

/** Per-agent rollup of attribution records, flagged against mandate membership. */
export function rollupAgentSpend(
  mandate: FundedMandate,
  records: AttributionRecord[],
): AgentSpendRollup[] {
  const memberIds = new Set(mandate.agentIds);
  const byAgent = new Map<string, AgentSpendRollup>();
  for (const rec of records) {
    let rollup = byAgent.get(rec.agentId);
    if (!rollup) {
      rollup = {
        agentId: rec.agentId,
        inScope: memberIds.has(rec.agentId),
        recordCount: 0,
        allocated: BigInt(0),
        consumed: BigInt(0),
        held: BigInt(0),
        denied: BigInt(0),
      };
      byAgent.set(rec.agentId, rollup);
    }
    rollup.recordCount += 1;
    rollup.allocated += toBigInt(rec.allocatedAmount);
    rollup.consumed += toBigInt(rec.consumedAmount);
    if (rec.status === 'held') rollup.held += toBigInt(rec.consumedAmount || rec.allocatedAmount);
    if (rec.status === 'denied') rollup.denied += toBigInt(rec.requestedAmount);
    if (!rollup.lastRecordedAt || rec.recordedAt > rollup.lastRecordedAt) {
      rollup.lastRecordedAt = rec.recordedAt;
    }
  }
  return [...byAgent.values()].sort((a, b) =>
    a.agentId.localeCompare(b.agentId),
  );
}

const CONSUMED_STATUSES = new Set(['consumed', 'held']);

/** Detect population-level signals for one mandate from its attribution records. */
export function detectProgramSignals(
  mandate: FundedMandate,
  records: AttributionRecord[],
): ProgramSignal[] {
  const signals: ProgramSignal[] = [];
  if (records.length === 0) return signals;

  const memberIds = new Set(mandate.agentIds);
  const scoped = records.filter((r) => r.mandateId === mandate.id || !r.mandateId);

  // 1. Out-of-scope spend: records attributed to agents outside the mandate's
  //    authorized population — the population-level analog of an
  //    unauthorized transfer (work funded outside the mandate boundary).
  const outOfScope = scoped.filter((r) => !memberIds.has(r.agentId));
  if (outOfScope.length > 0) {
    const agents = [...new Set(outOfScope.map((r) => r.agentId))];
    signals.push({
      id: 'out_of_scope_spend',
      severity: 'critical',
      title: 'Spend attributed outside the mandate population',
      detail: `${outOfScope.length} record(s) across ${agents.length} agent(s) not in this mandate's authorized agent list.`,
      evidence: outOfScope.slice(0, 8).map((r) => ({
        label: `${r.agentId} · ${r.provider ?? r.asset}`,
        reference: r.allocationId,
      })),
    });
  }

  // 2. Split procurement: multiple in-scope agents buying from the same
  //    provider — division of labor that is invisible per-trajectory.
  const byProvider = new Map<string, Set<string>>();
  for (const rec of scoped) {
    if (!memberIds.has(rec.agentId) || !rec.provider) continue;
    if (!CONSUMED_STATUSES.has(rec.status)) continue;
    const set = byProvider.get(rec.provider) ?? new Set<string>();
    set.add(rec.agentId);
    byProvider.set(rec.provider, set);
  }
  for (const [provider, agents] of byProvider) {
    if (agents.size >= 2) {
      signals.push({
        id: 'split_procurement',
        severity: 'warning',
        title: `Coordinated procurement at ${provider}`,
        detail: `${agents.size} mandate agents each bought from ${provider}. Individually plausible; collectively a division-of-labor pattern.`,
        evidence: scoped
          .filter((r) => r.provider === provider && CONSUMED_STATUSES.has(r.status))
          .slice(0, 8)
          .map((r) => ({ label: `${r.agentId} · ${r.asset}`, reference: r.allocationId })),
      });
    }
  }

  // 3. Allocation concentration: one member agent absorbing most consumed
  //    budget while peers starve — a funding asymmetry worth review.
  const inScopeConsumed = scoped.filter(
    (r) => memberIds.has(r.agentId) && CONSUMED_STATUSES.has(r.status),
  );
  if (inScopeConsumed.length >= 3) {
    const perAgent = new Map<string, bigint>();
    let total = BigInt(0);
    for (const rec of inScopeConsumed) {
      const amt = toBigInt(rec.consumedAmount || rec.allocatedAmount);
      perAgent.set(rec.agentId, (perAgent.get(rec.agentId) ?? BigInt(0)) + amt);
      total += amt;
    }
    const [topAgent, topAmount] = [...perAgent.entries()].sort(
      (a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0),
    )[0] ?? ['', BigInt(0)];
    if (total > BigInt(0) && topAmount * BigInt(5) > total * BigInt(3)) {
      signals.push({
        id: 'allocation_concentration',
        severity: 'warning',
        title: `Spend concentrated in ${topAgent}`,
        detail: `${topAgent} accounts for ${Math.round((Number(topAmount) / Number(total)) * 100)}% of consumed mandate funds across ${perAgent.size} active agents.`,
        evidence: inScopeConsumed
          .filter((r) => r.agentId === topAgent)
          .slice(0, 8)
          .map((r) => ({ label: `${r.agentId} · ${r.provider ?? r.asset}`, reference: r.allocationId })),
      });
    }
  }

  // 4. Treasury race: per-asset consumed+pending approaching or exceeding
  //    authorized — the program-cap analog. The mandate budget is the
  //    population invariant; per-agent views cannot see it breach.
  for (const [asset, budget] of Object.entries(mandate.budget.byAsset)) {
    const authorized = toBigInt(budget.authorizedAmount);
    if (authorized === BigInt(0)) continue;
    const committed =
      toBigInt(budget.consumedAmount) + toBigInt(budget.pendingAmount);
    const ratio = Number(committed) / Number(authorized);
    if (ratio >= 0.8) {
      signals.push({
        id: 'treasury_race',
        severity: ratio >= 1 ? 'critical' : 'warning',
        title: `Treasury ${Math.round(ratio * 100)}% committed (${asset})`,
        detail: `${formatTokenAmount(committed)} of ${formatTokenAmount(authorized)} ${asset} consumed or pending. Remaining headroom: ${formatTokenAmount(authorized - committed)}.`,
        evidence: scoped
          .filter((r) => r.asset === asset && CONSUMED_STATUSES.has(r.status))
          .slice(-5)
          .map((r) => ({ label: `${r.agentId} · ${r.provider ?? r.asset}`, reference: r.allocationId })),
      });
    }
  }

  // 5. Approval pressure: held spend accumulating — population-level queue
  //    depth that per-agent dashboards never aggregate.
  const held = scoped.filter((r) => r.status === 'held');
  const denied = scoped.filter((r) => r.status === 'denied');
  if (held.length >= 2 || (held.length > 0 && denied.length >= held.length)) {
    signals.push({
      id: 'approval_pressure',
      severity: held.length >= 3 ? 'warning' : 'info',
      title: `${held.length} spend(s) awaiting approval`,
      detail: `${held.length} held and ${denied.length} denied record(s) under this mandate. Review the escalation queue before approving in bulk.`,
      evidence: held.slice(0, 8).map((r) => ({
        label: `${r.agentId} · ${r.provider ?? r.asset}`,
        reference: r.allocationId,
      })),
    });
  }

  const order: Record<SignalSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return signals.sort((a, b) => order[a.severity] - order[b.severity]);
}
