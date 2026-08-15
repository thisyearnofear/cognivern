import type { GovernanceEvaluation } from '@cognivern/shared';

export type DecisionOutcome = NonNullable<GovernanceEvaluation['decision']>;

export const DECISION_LABELS: Record<DecisionOutcome, string> = {
  approved: 'Approved',
  held: 'Held for review',
  denied: 'Stopped',
};

export function decisionLabel(decision: string): string {
  if (decision === 'approved') return DECISION_LABELS.approved;
  if (decision === 'held') return DECISION_LABELS.held;
  if (decision === 'denied') return DECISION_LABELS.denied;
  return decision.replaceAll('_', ' ');
}

export function resolveDecision(
  decision?: string | null,
  allowed?: boolean,
): DecisionOutcome {
  if (decision === 'approved' || decision === 'held' || decision === 'denied') {
    return decision;
  }
  return allowed ? 'approved' : 'denied';
}
