/**
 * TelegraphEvidence
 *
 * Shareable, hash-linked receipt for one compliant-call payment attempt. The
 * bundle deliberately hashes request params rather than storing the screened
 * subject, so the artifact can be shared without leaking the input that was
 * screened.
 */

import { sha256CanonicalJson } from './stableJson.js';

export interface TelegraphEvidenceBundleInput {
  attemptId: string;
  workspaceId: string;
  agentId: string;
  mandateId?: string;
  policyId?: string;
  description?: string;
  request: {
    bodyHash: string;
    intendedCall: {
      minerId: string;
      minerName?: string | null;
      intent?: string;
      paramsHash: string;
      paramFields: string[];
      estimatedCostUsd?: number | null;
    };
    compliance: {
      minerId?: string;
      intent?: string;
      paramsHash: string;
      subjectFields: string[];
    };
  };
  screening: {
    status: 'skipped' | 'completed' | 'failed';
    runId?: string | null;
    artifactId?: string | null;
    artifactHash?: string | null;
    artifactEvidenceHash?: string | null;
    minerId?: string | null;
    minerName?: string | null;
    intent?: string | null;
    verdict?: string | null;
    providerVerdict?: string | null;
    verdictSource?: string | null;
    detail?: string | null;
    confidence?: number | null;
    costUsd?: string | null;
    latencyMs?: number | null;
    paymentNetwork?: string | null;
    rawResponseHash?: string | null;
    source?: string | null;
    listVersion?: string | null;
  } | null;
  gate: {
    decision: 'allow' | 'deny';
    name: string;
    reason?: string | null;
    runId: string;
    artifactId?: string | null;
    artifactHash?: string | null;
  };
  settlement: {
    status: 'not_attempted' | 'settled' | 'held' | 'failed';
    runId?: string | null;
    artifactId?: string | null;
    artifactHash?: string | null;
    minerId?: string | null;
    minerName?: string | null;
    intent?: string | null;
    costUsd?: string | null;
    paid?: boolean | null;
    paymentNetwork?: string | null;
    latencyMs?: number | null;
  };
  spendGuard: unknown | null;
  policyViolations: string[];
  costs: {
    currency: 'USD';
    screeningUsd: string | null;
    parentEstimatedUsd: number | null;
    parentUsd: string | null;
    totalUsd: string | null;
  };
  replay: {
    endpoint: string;
    cliCommand: string;
  };
}

/** Build the bundle, then seal it with a SHA-256 hash of its canonical JSON. */
export function buildTelegraphEvidenceBundle(
  input: TelegraphEvidenceBundleInput,
): Record<string, unknown> {
  const bundle: Record<string, unknown> = {
    schema: 'cognivern.telegraph.compliant-call-evidence.v1',
    generatedAt: new Date().toISOString(),
    attemptId: input.attemptId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    mandateId: input.mandateId ?? null,
    policyId: input.policyId ?? null,
    description: input.description ?? null,
    request: input.request,
    screening: input.screening,
    gate: input.gate,
    settlement: input.settlement,
    spendGuard: input.spendGuard,
    costs: input.costs,
    policyEvaluation: {
      passed: input.policyViolations.length === 0,
      violations: input.policyViolations,
    },
    replay: input.replay,
  };
  bundle.evidenceHash = sha256CanonicalJson(bundle);
  return bundle;
}
