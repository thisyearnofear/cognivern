/**
 * Types and runtime validation for the published, redacted supplier-
 * diligence report (schema cognivern.telegraph.diligence-public-report.v1).
 * The runner writes this file; /verify?report=<id> renders it.
 */

export type DiligenceDecision = 'proceed' | 'hold' | 'reject';

const DECISIONS = new Set(['proceed', 'hold', 'reject']);
const REPORT_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SCHEMA = 'cognivern.telegraph.diligence-public-report.v1';

export function isValidReportId(id: string): boolean {
  return REPORT_ID_RE.test(id);
}

export interface PublicSpecialistSpec {
  minerId: string;
  intent: string;
}

export interface PublicSettlementTransfer {
  rail: string;
  status: string;
  cluster?: string | null;
  mint?: string | null;
  payee?: string | null;
  payer?: string | null;
  amountUsd?: number | null;
  signature?: string | null;
  reason?: string | null;
  intentId?: string | null;
  intentIdGenerated?: boolean;
  policySource?: string | null;
  idempotentReplay?: boolean;
}

/** Solscan link for a settlement signature; null when there's nothing to link. */
export function settlementExplorerUrl(settle: {
  signature?: string | null;
  cluster?: string | null;
}): string | null {
  if (!settle.signature) return null;
  const base = `https://solscan.io/tx/${settle.signature}`;
  const cluster = settle.cluster && settle.cluster !== 'mainnet-beta' ? settle.cluster : null;
  return cluster ? `${base}?cluster=${cluster}` : base;
}

export interface PublicStep {
  step: number;
  screenMinerId?: string;
  verdict?: string;
  providerVerdict?: string;
  status?: string;
  reviewRequired?: boolean;
  pendingAction?: string | null;
  parentPurchased: boolean;
  settlementStatus?: string;
  settlementTransfer?: PublicSettlementTransfer | null;
  costUsd?: number | null;
  latencyMs?: number;
  screeningRunId?: string | null;
  gateRunId?: string | null;
  parentRunId?: string | null;
  evidenceHash?: string;
  parentResponseHash?: string;
  parentRiskSignals?: string[];
  errored: boolean;
}

export interface PublicGateOutcome {
  decision: DiligenceDecision;
  decidedBy: string;
  reasons: string[];
}

export interface PublicModelArm {
  decision: DiligenceDecision | 'unparseable';
  correct: boolean | null;
  rationale: string | null;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number | null;
  latencyMs?: number;
  responseHash?: string;
  errored: boolean;
}

export interface PublicGovernedArm extends PublicModelArm {
  modelDecision: DiligenceDecision | 'unparseable' | null;
  finalDecision: DiligenceDecision;
  decidedBy: string;
}

export interface PublicPerModel {
  label: string;
  alone: PublicModelArm;
  governed: PublicGovernedArm;
  decisionChanged: boolean;
}

export interface PublicCase {
  id: string;
  description?: string;
  supplier: {
    name: string;
    type: 'entity' | 'individual';
    country: string;
    paymentUsd: number;
    paymentRail: string;
  };
  expectedDecision: DiligenceDecision;
  groundTruth: { source: string; assertion: string; checkedAt: string };
  evidence: {
    steps: PublicStep[];
    settlement?: (PublicSettlementTransfer & { attemptedStep?: number }) | null;
    specialistSpendUsd: number;
    escalations: string[];
  };
  gate: PublicGateOutcome | null;
  perModel: PublicPerModel[];
}

export interface PublicDiligenceReport {
  schema: typeof SCHEMA;
  id: string;
  generatedAt: string;
  network: string;
  mandateId: string;
  spendCapUsd: number;
  policy: string;
  specialists: Record<string, PublicSpecialistSpec>;
  models: {
    label: string;
    provider: string;
    model: string | null;
    route: string;
    skipped?: string;
  }[];
  cases: PublicCase[];
  summary: {
    perModel: {
      label: string;
      casesRun: number;
      aloneCorrect: number;
      governedCorrect: number;
      decisionsChanged: number;
      modelCostUsd: { alone: number; governed: number };
    }[];
    run: {
      specialistSpendUsd: number;
      escalations: number;
      casesHeld: number;
      casesRejected: number;
    };
  };
  honestyBounds: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Whitelist runtime check — returns null rather than throwing. */
export function parsePublicDiligenceReport(value: unknown): PublicDiligenceReport | null {
  if (!isRecord(value)) return null;
  if (value.schema !== SCHEMA) return null;
  if (typeof value.id !== 'string' || !isValidReportId(value.id)) return null;
  if (!Array.isArray(value.cases)) return null;
  for (const c of value.cases) {
    if (!isRecord(c)) return null;
    if (typeof c.id !== 'string' || !c.id) return null;
    if (!DECISIONS.has(c.expectedDecision as string)) return null;
    if (!isRecord(c.supplier) || typeof c.supplier.name !== 'string') return null;
    if (!isRecord(c.evidence) || !Array.isArray(c.evidence.steps)) return null;
    if (c.gate !== null && c.gate !== undefined) {
      if (!isRecord(c.gate) || !DECISIONS.has(c.gate.decision as string)) {
        return null;
      }
    }
    if (!Array.isArray(c.perModel)) return null;
    for (const m of c.perModel) {
      if (!isRecord(m) || !isRecord(m.alone) || !isRecord(m.governed)) {
        return null;
      }
      if (!DECISIONS.has(m.governed.finalDecision as string)) return null;
    }
  }
  if (!isRecord(value.summary)) return null;
  if (!Array.isArray(value.honestyBounds)) return null;
  return value as unknown as PublicDiligenceReport;
}

/**
 * One-line status for the replay strip: what the model said alone, what the
 * governed arm decided, and what the specialist evidence cost.
 */
export function caseHeadline(caseResult: PublicCase, modelLabel: string | null): string {
  const cost = `Specialist cost: $${caseResult.evidence.specialistSpendUsd.toFixed(2)}.`;
  const perModel = modelLabel
    ? caseResult.perModel.find((r) => r.label === modelLabel)
    : caseResult.perModel[0];
  if (!perModel) return cost;
  const governed = `Governed: ${perModel.governed.finalDecision}.`;
  if (perModel.alone.errored) return `${governed} ${cost}`;
  if (perModel.alone.decision === 'unparseable') {
    return `Alone: no usable answer. ${governed} ${cost}`;
  }
  return `Alone: ${perModel.alone.decision}. ${governed} ${cost}`;
}

const REASON_LABELS: Record<string, string> = {
  sanctions_hit: 'Sanctions screen returned a hit',
  compliance_review: 'Screener asked for human review',
  disputed_hit: 'Screeners disagreed',
  low_confidence_evidence: 'Purchased evidence was low-confidence',
  spend_guard: 'Spend guard blocked the call',
  settlement_guard: 'Settlement guard blocked the transfer',
  settlement_incomplete: 'Authorized settlement did not settle',
  request_error: 'A specialist call failed',
  incomplete_evidence: 'Evidence was incomplete',
  parent_review_required: 'The specialist itself asked for human review',
  parent_unverified: 'The subject could not be verified',
  source_unavailable: 'An upstream source could not be consulted',
  source_stale: 'An upstream source was past its freshness limit',
};

/** Plain-English label for the gate reasons, joined for display. */
export function whyLabel(gate: PublicGateOutcome | null): string {
  if (!gate) return 'The model decided with the purchased evidence';
  return gate.reasons.map((r) => REASON_LABELS[r] ?? r).join('; ');
}
