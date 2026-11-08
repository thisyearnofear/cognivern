/**
 * Population-level governance signals for funded mandates ("programs").
 *
 * Pure functions over the spend-attribution read model — the productized
 * version of the swarm forensics detectors: each agent's spend can look
 * compliant in isolation while the *population* drifts from the mandate's
 * authorized boundary. Signals are evidence-linked (allocation/run ids) so
 * the UI can jump from a finding to the underlying records.
 */

import type { Agent, FundedMandate, SpendAttributionReport } from './api-client';
import { parseBudget } from './budget-format';
import { baseUnitsToHuman, resolveAssetUnit, type AssetUnitOverride } from '@cognivern/shared';

export type AttributionRecord = SpendAttributionReport['records'][number];

export type SignalSeverity = 'info' | 'warning' | 'critical';
export type SignalConfidence = 'high' | 'medium' | 'low';

export interface DelegatedSpendEdge {
  buyerAgentId: string;
  beneficiaryAgentId: string;
  beneficiaryInScope: boolean;
  recordCount: number;
  totalConsumed: bigint;
  evidence: SignalEvidence[];
}

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
    | 'approval_pressure'
    | 'delegated_without_coverage';
  severity: SignalSeverity;
  /** Detector certainty — 'low' signals aggregate rather than alarm. */
  confidence: SignalConfidence;
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

/**
 * Delegated-spend edges: buyer → beneficiary pairs from `onBehalfOfAgentId`
 * attribution records. The swarm `for_agent` analog — one agent's budget
 * funds another's scope. Edges to beneficiaries outside the mandate
 * population are the population-level violation per-trajectory monitors
 * cannot see.
 */
export function delegatedSpendEdges(
  mandate: FundedMandate,
  records: AttributionRecord[],
): DelegatedSpendEdge[] {
  const memberIds = new Set(mandate.agentIds);
  const edges = new Map<string, DelegatedSpendEdge>();
  for (const rec of records) {
    if (!rec.onBehalfOfAgentId || rec.onBehalfOfAgentId === rec.agentId) continue;
    const key = `${rec.agentId}→${rec.onBehalfOfAgentId}`;
    let edge = edges.get(key);
    if (!edge) {
      edge = {
        buyerAgentId: rec.agentId,
        beneficiaryAgentId: rec.onBehalfOfAgentId,
        beneficiaryInScope: memberIds.has(rec.onBehalfOfAgentId),
        recordCount: 0,
        totalConsumed: BigInt(0),
        evidence: [],
      };
      edges.set(key, edge);
    }
    edge.recordCount += 1;
    edge.totalConsumed += toBigInt(rec.consumedAmount || rec.allocatedAmount);
    if (edge.evidence.length < 8) {
      edge.evidence.push({
        label: `${rec.agentId} → ${rec.onBehalfOfAgentId} · ${rec.provider ?? rec.asset}`,
        reference: rec.allocationId,
      });
    }
  }
  return [...edges.values()].sort(
    (a, b) => (b.totalConsumed > a.totalConsumed ? 1 : b.totalConsumed < a.totalConsumed ? -1 : 0),
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
      confidence: 'high',
      title: 'Spend attributed outside the mandate population',
      detail: `${outOfScope.length} record(s) across ${agents.length} agent(s) not in this mandate's authorized agent list.`,
      evidence: outOfScope.slice(0, 8).map((r) => ({
        label: `${r.agentId} · ${r.provider ?? r.asset}`,
        reference: r.allocationId,
      })),
    });
  }

  // 1b. Delegated spend to out-of-scope beneficiaries: an in-scope buyer
  //     funding an agent outside the mandate population — the productized
  //     `for_agent`/unauthorized-transfer analog.
  const badDelegations = scoped.filter(
    (r) =>
      r.onBehalfOfAgentId &&
      r.onBehalfOfAgentId !== r.agentId &&
      !memberIds.has(r.onBehalfOfAgentId),
  );
  if (badDelegations.length > 0) {
    const beneficiaries = [...new Set(badDelegations.map((r) => r.onBehalfOfAgentId))];
    signals.push({
      id: 'out_of_scope_spend',
      severity: 'critical',
      confidence: 'high',
      title: 'Delegated spend to agents outside the mandate',
      detail: `${badDelegations.length} record(s) fund ${beneficiaries.join(', ')} — agent(s) not in this mandate's authorized population.`,
      evidence: badDelegations.slice(0, 8).map((r) => ({
        label: `${r.agentId} → ${r.onBehalfOfAgentId} · ${r.provider ?? r.asset}`,
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
      // Confidence scales with how "division of labor"-like the pattern is:
      // three or more distinct agents, or agents buying distinct assets,
      // is stronger evidence than two agents touching the same provider.
      const distinctAssets = new Set(
        scoped
          .filter((r) => r.provider === provider && CONSUMED_STATUSES.has(r.status))
          .map((r) => r.asset),
      ).size;
      const confidence: SignalConfidence =
        agents.size >= 3 || distinctAssets >= 2 ? 'high' : 'medium';
      signals.push({
        id: 'split_procurement',
        severity: confidence === 'high' ? 'warning' : 'info',
        confidence,
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
        confidence: 'medium',
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
        confidence: 'high',
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
      confidence: 'high',
      title: `${held.length} spend(s) awaiting approval`,
      detail: `${held.length} held and ${denied.length} denied record(s) under this mandate. Review the escalation queue before approving in bulk.`,
      evidence: held.slice(0, 8).map((r) => ({
        label: `${r.agentId} · ${r.provider ?? r.asset}`,
        reference: r.allocationId,
      })),
    });
  }

  // 6. Delegated spend to uncovered beneficiaries: an in-scope beneficiary
  //    credited by delegated purchases but holding no spend records of their
  //    own — work arriving without budget coverage is how division of labor
  //    hides inside the mandate boundary.
  const beneficiaryIds = new Set<string>();
  for (const rec of scoped) {
    if (rec.onBehalfOfAgentId && rec.onBehalfOfAgentId !== rec.agentId) {
      beneficiaryIds.add(rec.onBehalfOfAgentId);
    }
  }
  const agentsWithOwnSpend = new Set(scoped.map((r) => r.agentId));
  const uncovered = [...beneficiaryIds].filter(
    (id) => memberIds.has(id) && !agentsWithOwnSpend.has(id),
  );
  if (uncovered.length > 0) {
    const count = scoped.filter(
      (r) => r.onBehalfOfAgentId && uncovered.includes(r.onBehalfOfAgentId),
    ).length;
    signals.push({
      id: 'delegated_without_coverage',
      severity: 'warning',
      confidence: 'medium',
      title: `Delegated spend credits agents with no spend of their own`,
      detail: `${count} record(s) credit ${uncovered.join(', ')} — in-scope beneficiaries with zero attributed spend. Buying on another agent's budget to fund their scope is the collusion primitive; verify the delegation is authorized.`,
      evidence: scoped
        .filter((r) => r.onBehalfOfAgentId && uncovered.includes(r.onBehalfOfAgentId))
        .slice(0, 8)
        .map((r) => ({
          label: `${r.agentId} → ${r.onBehalfOfAgentId} · ${r.provider ?? r.asset}`,
          reference: r.allocationId,
        })),
    });
  }

  const order: Record<SignalSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return signals.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Coverage lint (P1) ──────────────────────────────────────────────────────
// The swarm finding: over-provisioned mandates guarantee a population
// violation at authoring time. Cognivern's analog: member agents each hold
// a spending budget while the mandate holds a shared treasury — if the
// population's authority exceeds the invariant, honest compliance breaches
// it. Units caveat: agent budgets are display rates ("$400/day"); mandate
// amounts are base units per asset. We only hard-flag over-provisioning for
// fiat-denominated assets where units are comparable, and always surface
// the raw authority estimate so operators can verify asset decimals.
// Unit resolution uses the shared asset registry (`@cognivern/shared`
// asset-units): fiat/USD-pegged assets convert base units → dollars for a
// hard over-provisioning check; unknown/native assets stay advisory-only.

export interface CoverageAdvisory {
  id:
    | 'over_provisioned'
    | 'uncovered_member'
    | 'unallocated_headroom'
    | 'authority_estimate';
  severity: SignalSeverity;
  title: string;
  detail: string;
}

function windowDays(mandate: FundedMandate): number | null {
  const window = mandate.measurementWindow;
  if (!window?.startsAt || !window.endsAt) return null;
  const ms = Date.parse(window.endsAt) - Date.parse(window.startsAt);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / 86_400_000;
}

export function computeProgramCoverage(
  mandate: FundedMandate,
  agents: Agent[],
  assetOverrides?: Record<string, AssetUnitOverride>,
): CoverageAdvisory[] {
  const advisories: CoverageAdvisory[] = [];
  const memberIds = new Set(mandate.agentIds);
  const members = agents.filter((a) => memberIds.has(a.id));

  // Members authorized by the mandate but unable to spend (no/zero budget).
  const unbudgeted = members.filter((a) => {
    const parsed = parseBudget(a.budget ?? '');
    return parsed.amount === null || parsed.amount === 0;
  });
  if (mandate.agentIds.length > 0 && unbudgeted.length > 0) {
    advisories.push({
      id: 'uncovered_member',
      severity: 'warning',
      title: `${unbudgeted.length} member agent(s) hold no budget`,
      detail: `${unbudgeted.map((a) => a.name || a.id).join(', ')} ${unbudgeted.length === 1 ? 'is' : 'are'} authorized by this mandate but ${unbudgeted.length === 1 ? 'has' : 'have'} no spend budget — coverage gap, not a violation.`,
    });
  }

  // Population authority estimate: Σ member daily budgets × window days.
  const dailyAuth = members.reduce((sum, a) => {
    const parsed = parseBudget(a.budget ?? '');
    // Only daily (or period-less lump sums treated as per-window totals are
    // excluded) budgets count toward a daily authority rate.
    return parsed.period === 'day' || parsed.period === null
      ? sum + (parsed.amount ?? 0)
      : sum;
  }, 0);
  const days = windowDays(mandate);
  if (dailyAuth > 0) {
    const authority = days ? dailyAuth * days : dailyAuth;
    const windowNote = days ? `over the ${Math.round(days)}-day window` : 'per day (no window end set)';
    advisories.push({
      id: 'authority_estimate',
      severity: 'info',
      title: `Population authority ≈ $${authority.toLocaleString()} ${windowNote}`,
      detail: `${members.length} member agent(s) hold ≈$${dailyAuth.toLocaleString()}/day of spend authority.`,
    });

    // Hard over-provisioning check — only where the asset registry can
    // convert authorized base units into USD-comparable whole units.
    for (const [asset, budget] of Object.entries(mandate.budget.byAsset)) {
      const unit = resolveAssetUnit(asset, assetOverrides?.[asset]);
      if (unit.kind === 'unknown') {
        advisories.push({
          id: 'authority_estimate',
          severity: 'info',
          title: `${asset} treasury cannot be unit-checked`,
          detail: `No decimals/kind metadata for asset "${asset}" — population authority (≈$${authority.toLocaleString()}) cannot be compared to its authorized amount. Add it to the asset registry or pass a decimals override.`,
        });
        continue;
      }
      const authorizedHuman = baseUnitsToHuman(budget.authorizedAmount, unit.decimals);
      if (authorizedHuman === null || authorizedHuman <= 0) continue;
      if (!unit.usdPegged) {
        advisories.push({
          id: 'authority_estimate',
          severity: 'info',
          title: `${asset} treasury is not USD-comparable`,
          detail: `Authorized ${formatTokenAmount(toBigInt(budget.authorizedAmount))} ${asset} (${unit.decimals} decimals) is a native/non-USD asset — verify against population authority ≈$${authority.toLocaleString()} manually.`,
        });
        continue;
      }
      if (authority > authorizedHuman) {
        advisories.push({
          id: 'over_provisioned',
          severity: 'warning',
          title: `Mandate over-provisioned (${asset})`,
          detail: `Member agents hold ≈$${authority.toLocaleString()} of authority ${windowNote}, exceeding the $${authorizedHuman.toLocaleString()} ${asset} authorized treasury (${budget.authorizedAmount} base units @ ${unit.decimals} decimals). Honest compliance can breach the program invariant — the swarm finding: coverage must not exceed the cap.`,
        });
      }
    }
  }

  // Unallocated headroom: authorized treasury not yet committed to agents.
  for (const [asset, budget] of Object.entries(mandate.budget.byAsset)) {
    const authorized = toBigInt(budget.authorizedAmount);
    const allocated = toBigInt(budget.allocatedAmount);
    if (authorized > BigInt(0) && allocated * BigInt(4) < authorized * BigInt(3)) {
      advisories.push({
        id: 'unallocated_headroom',
        severity: 'info',
        title: `Most of the ${asset} treasury is unallocated`,
        detail: `${formatTokenAmount(allocated)} of ${formatTokenAmount(authorized)} ${asset} authorized has been allocated to agent spend.`,
      });
    }
  }

  const order: Record<SignalSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return advisories.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Detection gap (P3) ──────────────────────────────────────────────────────
// The product's core claim: population violations invisible to
// per-trajectory oversight. A gap exists when population signals fire while
// no individual agent exceeds its own allocated spend — every agent looks
// compliant in isolation and only the aggregate betrays the invariant.

export interface DetectionGap {
  detected: boolean;
  signalCount: number;
  individuallyVisibleViolations: number;
  explanation: string;
}

export function computeDetectionGap(
  mandate: FundedMandate,
  records: AttributionRecord[],
): DetectionGap {
  const signals = detectProgramSignals(mandate, records);
  const memberIds = new Set(mandate.agentIds);
  const scoped = records.filter((r) => r.mandateId === mandate.id || !r.mandateId);

  // Individual overspend: an agent whose consumed total exceeds its own
  // allocated total across records — visible in that agent's trajectory.
  const perAgent = new Map<string, { allocated: bigint; consumed: bigint }>();
  for (const rec of scoped) {
    if (!memberIds.has(rec.agentId)) continue;
    const entry = perAgent.get(rec.agentId) ?? { allocated: BigInt(0), consumed: BigInt(0) };
    entry.allocated += toBigInt(rec.allocatedAmount);
    entry.consumed += toBigInt(rec.consumedAmount);
    perAgent.set(rec.agentId, entry);
  }
  const individualViolations = [...perAgent.values()].filter(
    (v) => v.consumed > v.allocated && v.allocated > BigInt(0),
  ).length;

  const detected = signals.length > 0 && individualViolations === 0;
  return {
    detected,
    signalCount: signals.length,
    individuallyVisibleViolations: individualViolations,
    explanation: detected
      ? `${signals.length} population signal(s) fired while every member agent stayed within its own allocation — invisible to per-agent monitoring.`
      : signals.length === 0
        ? 'No population signals; nothing to compare across oversight arms.'
        : `${individualViolations} agent(s) individually overspent — the violation is already visible per-trajectory.`,
  };
}

// ── Treasury trajectory (P2) ────────────────────────────────────────────────
// Cap-race is a trajectory problem: cumulative committed spend over time vs.
// the authorized invariant, with a linear projection to cap exhaustion.
// Computed for the asset carrying the most committed spend.

export interface TrajectoryPoint {
  at: string;
  committed: bigint;
}

export interface TreasuryTrajectory {
  asset: string;
  points: TrajectoryPoint[];
  /** Linear rate of committed spend per day, or null if the span is <1 day. */
  ratePerDay: number | null;
  /** Days until authorized headroom is exhausted at the current rate. */
  daysToCap: number | null;
}

export function treasuryTrajectory(
  mandate: FundedMandate,
  records: AttributionRecord[],
): TreasuryTrajectory | null {
  const scoped = records.filter(
    (r) => (r.mandateId === mandate.id || !r.mandateId) && r.recordedAt,
  );
  if (scoped.length === 0) return null;

  // Pick the asset with the largest committed total.
  const byAsset = new Map<string, bigint>();
  for (const rec of scoped) {
    const amt = toBigInt(rec.consumedAmount || rec.allocatedAmount);
    if (amt === BigInt(0)) continue;
    byAsset.set(rec.asset, (byAsset.get(rec.asset) ?? BigInt(0)) + amt);
  }
  const [asset] = [...byAsset.entries()].sort((a, b) =>
    b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0,
  )[0] ?? ['', BigInt(0)];
  if (!asset) return null;

  const assetRecords = scoped
    .filter((r) => r.asset === asset)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  const points: TrajectoryPoint[] = [];
  let running = BigInt(0);
  for (const rec of assetRecords) {
    running += toBigInt(rec.consumedAmount || rec.allocatedAmount);
    points.push({ at: rec.recordedAt, committed: running });
  }
  if (points.length === 0) return null;

  const first = Date.parse(points[0].at);
  const last = Date.parse(points[points.length - 1].at);
  const spanDays = (last - first) / 86_400_000;
  const total = Number(points[points.length - 1].committed);
  const ratePerDay = spanDays >= 1 ? total / spanDays : null;

  const budget = mandate.budget.byAsset[asset];
  const authorized = budget ? toBigInt(budget.authorizedAmount) : BigInt(0);
  const alreadyCommitted = budget
    ? toBigInt(budget.consumedAmount) + toBigInt(budget.pendingAmount)
    : BigInt(0);
  const headroom = Number(authorized) - Number(alreadyCommitted);
  const daysToCap =
    ratePerDay != null && ratePerDay > 0
      ? headroom > 0
        ? headroom / ratePerDay
        : 0
      : null;

  return { asset, points, ratePerDay, daysToCap };
}
