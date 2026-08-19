import { AbiCoder, getAddress, id, keccak256, toUtf8Bytes } from 'ethers';

export const ZERO_G_PROOF_V2_SCHEMA_VERSION = 2;
export const ZERO_G_PROOF_CANONICAL_VERSION = 1;

export type ZeroGDecision = 'approved' | 'held' | 'denied' | 'stopped';

export type CanonicalJsonValue =
  | null
  | boolean
  | string
  | number
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export interface ZeroGV2EvidenceBundle {
  schemaVersion: number;
  runId: string;
  decision: ZeroGDecision;
  decisionTimestamp: string;
  action: CanonicalJsonValue;
  policyChecks: CanonicalJsonValue[];
  evidence: CanonicalJsonValue;
}

export interface ZeroGV2PolicyEntry {
  id: string;
  version: string;
  contentHash: string;
}

export interface ZeroGV2PolicySet {
  schemaVersion: number;
  policies: ZeroGV2PolicyEntry[];
}

export interface ZeroGV2ProofInput {
  contractAddress: string;
  chainId: bigint;
  runId: string;
  evidence: Omit<
    ZeroGV2EvidenceBundle,
    'schemaVersion' | 'runId' | 'decision' | 'decisionTimestamp'
  >;
  policySet: ZeroGV2PolicySet;
  decision: ZeroGDecision;
  decisionTimestamp: number;
}

export interface ZeroGV2Commitments {
  evidenceBundle: ZeroGV2EvidenceBundle;
  policySet: ZeroGV2PolicySet;
  runIdHash: string;
  evidenceHash: string;
  policySetHash: string;
  decisionCode: number;
  decisionTimestamp: bigint;
  proofId: string;
}

/**
 * Canonical JSON for GovernanceProofV2. Object keys are sorted; array order is
 * significant; no whitespace is emitted. Undefined values are rejected rather
 * than silently omitted.
 */
export function canonicalJson(value: unknown): string {
  if (value === undefined) {
    throw new Error('Canonical JSON does not permit undefined values');
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON does not permit NaN or Infinity');
    }
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    throw new Error(`Canonical JSON does not support ${typeof value}`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`;
}

export function hashCanonicalJson(value: unknown): string {
  return keccak256(toUtf8Bytes(canonicalJson(value)));
}

/**
 * Hash the policy-version shape shared by both governance evaluators. Keeping
 * this in one place prevents workspace and CRE paths from committing the same
 * policy differently.
 */
export function hashPolicyContent(input: {
  id: string;
  version: string;
  name: string;
  description: string;
  status: string;
  rules: unknown;
  metadata?: unknown;
}): string {
  return hashCanonicalJson({
    id: input.id,
    version: input.version,
    name: input.name,
    description: input.description,
    status: input.status,
    rules: input.rules,
    metadata: input.metadata ?? {},
  });
}

export function hashRunId(runId: string): string {
  if (!isUuidLike(runId)) {
    throw new Error('GovernanceProofV2 runId must be a high-entropy UUID-like identifier');
  }
  return id(runId);
}

export function decisionCode(decision: ZeroGDecision): number {
  if (decision === 'approved') return 1;
  if (decision === 'held') return 2;
  if (decision === 'denied' || decision === 'stopped') return 3;
  throw new Error(`Unsupported GovernanceProofV2 decision: ${decision}`);
}

export function policySetFromChecks(
  policyChecks: Array<{
    policyId: string;
    metadata?: Record<string, unknown>;
  }>,
): ZeroGV2PolicySet {
  const policies: ZeroGV2PolicyEntry[] = [];
  const seen = new Set<string>();

  for (const check of policyChecks) {
    const metadata = check.metadata || {};
    const version = metadata.policyVersion;
    const contentHash = metadata.policyContentHash;
    if (typeof version !== 'string' || typeof contentHash !== 'string') {
      throw new Error(`Missing canonical policy metadata for ${check.policyId}`);
    }

    if (seen.has(check.policyId)) {
      const existing = policies.find((policy) => policy.id === check.policyId);
      if (existing && (existing.version !== version || existing.contentHash !== contentHash)) {
        throw new Error(`Conflicting canonical policy metadata for ${check.policyId}`);
      }
      continue;
    }
    seen.add(check.policyId);

    policies.push({
      id: check.policyId,
      version,
      contentHash,
    });
  }

  return {
    schemaVersion: ZERO_G_PROOF_CANONICAL_VERSION,
    policies,
  };
}

export function computeProofId(params: {
  contractAddress: string;
  chainId: bigint;
  runIdHash: string;
  evidenceHash: string;
  policySetHash: string;
  decisionCode: number;
  decisionTimestamp: bigint;
}): string {
  const encoded = AbiCoder.defaultAbiCoder().encode(
    ['uint8', 'uint256', 'address', 'bytes32', 'bytes32', 'bytes32', 'uint8', 'uint64'],
    [
      ZERO_G_PROOF_V2_SCHEMA_VERSION,
      params.chainId,
      getAddress(params.contractAddress),
      params.runIdHash,
      params.evidenceHash,
      params.policySetHash,
      params.decisionCode,
      params.decisionTimestamp,
    ],
  );
  return keccak256(encoded);
}

export function buildCommitments(input: ZeroGV2ProofInput): ZeroGV2Commitments {
  const decisionTimestamp = BigInt(input.decisionTimestamp);
  if (decisionTimestamp <= 0n) {
    throw new Error('GovernanceProofV2 decisionTimestamp must be positive');
  }
  if (!Number.isSafeInteger(input.decisionTimestamp)) {
    throw new Error('GovernanceProofV2 decisionTimestamp must be a safe integer');
  }
  if (input.policySet.schemaVersion !== ZERO_G_PROOF_CANONICAL_VERSION) {
    throw new Error('Unsupported GovernanceProofV2 policy-set canonical version');
  }

  const evidenceBundle: ZeroGV2EvidenceBundle = {
    schemaVersion: ZERO_G_PROOF_CANONICAL_VERSION,
    runId: input.runId,
    decision: input.decision,
    decisionTimestamp: decisionTimestamp.toString(),
    action: stripUndefined(input.evidence.action),
    policyChecks: stripUndefined(input.evidence.policyChecks) as CanonicalJsonValue[],
    evidence: stripUndefined(input.evidence.evidence),
  };
  const runIdHash = hashRunId(input.runId);
  const evidenceHash = hashCanonicalJson(evidenceBundle);
  const policySetHash = hashCanonicalJson(input.policySet);
  const code = decisionCode(input.decision);

  return {
    evidenceBundle,
    policySet: input.policySet,
    runIdHash,
    evidenceHash,
    policySetHash,
    decisionCode: code,
    decisionTimestamp,
    proofId: computeProofId({
      contractAddress: input.contractAddress,
      chainId: input.chainId,
      runIdHash,
      evidenceHash,
      policySetHash,
      decisionCode: code,
      decisionTimestamp,
    }),
  };
}

function stripUndefined(value: unknown): CanonicalJsonValue {
  if (value === undefined) {
    throw new Error('Canonical JSON does not permit undefined values');
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value as null | boolean | string;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON does not permit NaN or Infinity');
    }
    return value as number;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item));
  }
  if (typeof value !== 'object') {
    throw new Error(`Canonical JSON does not support ${typeof value}`);
  }

  const normalized: Record<string, CanonicalJsonValue> = {};
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) {
      throw new Error(`Canonical JSON does not permit undefined at key ${key}`);
    }
    normalized[key] = stripUndefined(item);
  }
  return normalized;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
