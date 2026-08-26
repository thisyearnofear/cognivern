import {
  isConfidentialEvidence,
  railViewFromEvidence,
} from '@/lib/confidential-rail';

/**
 * Pure detection helpers for raw audit log payloads. These read the loosely
 * typed backend shapes (evidence, confidential, policyChecks, artifacts) and
 * reduce them to the booleans/structures the audit timeline renders. Kept
 * dependency-free (no React) so they are trivially unit-testable.
 */

export function hasConfidentialFhe(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== 'object') return false;
  const r = rawLog as Record<string, unknown>;
  const conf = r.confidential as Record<string, unknown> | undefined;
  if (isConfidentialEvidence(conf)) return true;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks)) {
    return checks.some(
      (c) =>
        (c.metadata as Record<string, unknown> | undefined)?.confidential === true ||
        (c.metadata as Record<string, unknown> | undefined)?.fheEvaluated === true ||
        (c.metadata as Record<string, unknown> | undefined)?.teeEvaluated === true ||
        (c.metadata as Record<string, unknown> | undefined)?.confidentialEvaluated === true,
    );
  }
  return false;
}

export function hasChainGptAudit(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== 'object') return false;
  const r = rawLog as Record<string, unknown>;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks)) {
    return checks.some(
      (c) => (c.metadata as Record<string, unknown> | undefined)?.chaingptAudit === true,
    );
  }
  return false;
}

export function hasLedgerSigning(rawLog: unknown): boolean {
  if (!rawLog || typeof rawLog !== 'object') return false;
  return (rawLog as Record<string, unknown>).signingProvider === 'ledger';
}

export function getOnChainTxHash(rawLog: unknown): string | null {
  if (!rawLog || typeof rawLog !== 'object') return null;
  const r = rawLog as Record<string, unknown>;

  // Check top-level txHash
  if (typeof r.txHash === 'string' && r.txHash.length > 10) return r.txHash;

  // Check artifacts (from run ledger)
  const artifacts = r.artifacts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(artifacts)) {
    for (const art of artifacts) {
      const data = art.data as Record<string, unknown> | undefined;
      if (data && typeof data.txHash === 'string' && data.txHash.length > 10) {
        return data.txHash;
      }
    }
  }

  return null;
}

export function getOnChainChainId(rawLog: unknown): number | undefined {
  if (!rawLog || typeof rawLog !== 'object') return undefined;
  const r = rawLog as Record<string, unknown>;
  if (typeof r.chainId === 'number') return r.chainId;
  const meta = r.metadata as Record<string, unknown> | undefined;
  if (typeof meta?.chainId === 'number') return meta.chainId;
  const artifacts = r.artifacts as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(artifacts)) {
    for (const art of artifacts) {
      const data = art.data as Record<string, unknown> | undefined;
      if (typeof data?.chainId === 'number') return data.chainId;
    }
  }
  return undefined;
}

export function getPolicyId(rawLog: unknown): string | null {
  if (!rawLog || typeof rawLog !== 'object') return null;
  const r = rawLog as Record<string, unknown>;
  if (typeof r.policyId === 'string' && r.policyId.length > 0) return r.policyId;
  const checks = r.policyChecks as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(checks) && checks.length > 0 && typeof checks[0].policyId === 'string') {
    return checks[0].policyId as string;
  }
  return null;
}

export interface AnchoringData {
  confidentialStatus: 'resolved' | 'pending' | null;
  confidentialLabel: string;
  filecoinCid: string | null;
  filecoinTxHash: string | null;
  zeroGRootHash: string | null;
  evidenceHash: string | null;
}

export function getAnchoringData(rawLog: unknown): AnchoringData | null {
  if (!rawLog || typeof rawLog !== 'object') return null;
  const r = rawLog as Record<string, unknown>;
  const evidence = r.evidence as Record<string, unknown> | undefined;
  const conf = r.confidential as Record<string, unknown> | undefined;

  const filecoinCid = (evidence?.filecoinCid as string) || null;
  const filecoinTxHash = (evidence?.filecoinTxHash as string) || null;
  const zeroGRootHash = (evidence?.zeroGRootHash as string) || null;
  const evidenceHash = (evidence?.hash as string) || null;

  let confidentialStatus: 'resolved' | 'pending' | null = null;
  let confidentialLabel = 'Confidential eval';
  if (conf && isConfidentialEvidence(conf)) {
    const decisionIds = conf.decisionIds as string[] | undefined;
    if (decisionIds && decisionIds.length > 0) {
      confidentialStatus = conf.resolved === true ? 'resolved' : 'pending';
    }
    const view = railViewFromEvidence(conf);
    confidentialLabel = view.rail === 'flare' ? 'Flare TEE' : 'Fhenix CoFHE';
  }

  if (!filecoinCid && !zeroGRootHash && !confidentialStatus && !evidenceHash) return null;
  return {
    confidentialStatus,
    confidentialLabel,
    filecoinCid,
    filecoinTxHash,
    zeroGRootHash,
    evidenceHash,
  };
}

export interface SuspicionData {
  composite: number;
  label: string;
  dimensions: Record<string, number>;
  escalated: boolean;
  reasoning: string[];
}

/**
 * The CRE run id behind a real run-mapped audit log. In CRE-unified mode the
 * audit log's id IS the run id (`mapCreRunToAuditLog` sets `id: run.runId`),
 * so linking to `/runs/<id>` opens the canonical execution record for this
 * decision. Demo/synthetic logs lack the run-shaped fields (details.stepCount,
 * artifacts, evidence.hash) — return null so the UI never links to a run that
 * does not exist.
 */
export function getRunIdForAuditLog(rawLog: unknown): string | null {
  if (!rawLog || typeof rawLog !== 'object') return null;
  const r = rawLog as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  const details = r.details as Record<string, unknown> | undefined;
  const evidence = r.evidence as Record<string, unknown> | undefined;
  const isRunShaped =
    (details && typeof details.stepCount === 'number') ||
    (details && typeof details.artifactCount === 'number') ||
    typeof evidence?.hash === 'string';
  return isRunShaped ? r.id : null;
}

export function getSuspicionData(rawLog: unknown): SuspicionData | null {
  if (!rawLog || typeof rawLog !== 'object') return null;
  const r = rawLog as Record<string, unknown>;
  const evidence = r.evidence as Record<string, unknown> | undefined;
  const suspicion = evidence?.suspicion as Record<string, unknown> | undefined;
  if (!suspicion || typeof suspicion.composite !== 'number') return null;
  return {
    composite: suspicion.composite,
    label: String(suspicion.label || 'unknown'),
    dimensions: (suspicion.dimensions as Record<string, number>) || {},
    escalated: suspicion.escalated === true,
    reasoning: Array.isArray(suspicion.reasoning) ? suspicion.reasoning.map(String) : [],
  };
}
