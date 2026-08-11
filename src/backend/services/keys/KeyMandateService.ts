/**
 * KeyMandateService
 *
 * Binds workspace API keys to TEE-sealed spend mandates (the "key = sealed
 * mandate" paradigm): creating or importing a key can attach budget limits
 * that are registered into the Flare Confidential Compute TEE. From then on
 * the enclave enforces the budget — a key cannot overspend its own mandate
 * even if leaked, because evaluation happens where nobody (the operator
 * included) can tamper with it.
 *
 * The mandate's policyId is derived from the key id with a namespaced
 * keccak — stable per key, collision-free with demo/user policy ids (the
 * public demo policy is 0x01), and re-derivable so a TEE restart can be
 * re-seeded with the same id.
 */
import { randomUUID } from 'node:crypto';
import { keccak256, stringToBytes } from 'viem';
import { getDb } from '@backend/db/index.js';
import logger from '@backend/utils/logger.js';
import {
  isFlareEvaluatorEnabled,
  sharedFlareConfidentialPolicyService,
  type PolicyLimits,
} from '../blockchain/FlareConfidentialPolicyService.js';

export type KeyMandateStatus = 'pending' | 'sealed' | 'failed' | 'unsupported';

export interface KeyMandateLimits {
  /** Total daily budget — maps to the TEE dailyLimit. */
  budgetUsd: number;
  /** Per-transaction ceiling — amounts above this deny. */
  perTxUsd: number;
  /** Human-review floor — amounts between this and perTx hold. */
  approvalThresholdUsd: number;
}

export interface KeyMandate {
  id: string;
  apiKeyId: string;
  workspaceId: string;
  policyId: string;
  dailyLimitUsd: string;
  perTxUsd: string;
  approvalThresholdUsd: string;
  status: KeyMandateStatus;
  sealedTxHash: string | null;
  error: string | null;
}

/** Stable bytes32 policy id for a key's mandate (namespaced keccak). */
export function deriveKeyPolicyId(apiKeyId: string): string {
  return keccak256(stringToBytes(`cognivern:key-mandate:${apiKeyId}`));
}

/**
 * Validate user-supplied mandate limits. TEE semantics:
 * amount < threshold → approve · threshold ≤ amount ≤ perTx → hold ·
 * amount > perTx → deny, so threshold < perTx ≤ budget must hold.
 */
export function validateMandateLimits(input: unknown): KeyMandateLimits {
  const m = (input ?? {}) as Record<string, unknown>;
  const budget = Number(m.budgetUsd);
  const perTx = Number(m.perTxUsd);
  const threshold = Number(m.approvalThresholdUsd);
  const allFinite = [budget, perTx, threshold].every((n) => Number.isFinite(n));
  if (!allFinite || budget <= 0 || perTx <= 0 || threshold <= 0) {
    throw new Error('mandate fields budgetUsd, perTxUsd, approvalThresholdUsd must be positive numbers');
  }
  if (threshold >= perTx) {
    throw new Error('approvalThresholdUsd must be lower than perTxUsd');
  }
  if (perTx > budget) {
    throw new Error('perTxUsd must not exceed budgetUsd');
  }
  if (budget > 1_000_000) {
    throw new Error('budgetUsd must not exceed 1,000,000');
  }
  return { budgetUsd: budget, perTxUsd: perTx, approvalThresholdUsd: threshold };
}

interface MandateRow {
  id: string;
  api_key_id: string;
  workspace_id: string;
  policy_id: string;
  daily_limit_usd: string;
  per_tx_usd: string;
  approval_threshold_usd: string;
  status: KeyMandateStatus;
  sealed_tx_hash: string | null;
  error: string | null;
}

function rowToMandate(r: MandateRow): KeyMandate {
  return {
    id: r.id,
    apiKeyId: r.api_key_id,
    workspaceId: r.workspace_id,
    policyId: r.policy_id,
    dailyLimitUsd: r.daily_limit_usd,
    perTxUsd: r.per_tx_usd,
    approvalThresholdUsd: r.approval_threshold_usd,
    status: r.status,
    sealedTxHash: r.sealed_tx_hash,
    error: r.error,
  };
}

export function getKeyMandate(apiKeyId: string): KeyMandate | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM key_mandates WHERE api_key_id = ?')
    .get(apiKeyId) as MandateRow | undefined;
  return row ? rowToMandate(row) : null;
}

/** Mandates for all keys in a workspace, keyed by api_key_id. */
export function getKeyMandatesForWorkspace(workspaceId: string): Map<string, KeyMandate> {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM key_mandates WHERE workspace_id = ?')
    .all(workspaceId) as MandateRow[];
  return new Map(rows.map((r) => [r.api_key_id, rowToMandate(r)]));
}

/**
 * Persist a mandate row as pending and kick off TEE sealing in the
 * background. Key creation never blocks on the enclave — the mandate row
 * carries the outcome (sealed / failed / unsupported) for the UI.
 */
export function createKeyMandate(params: {
  apiKeyId: string;
  workspaceId: string;
  limits: KeyMandateLimits;
}): KeyMandate {
  const db = getDb();
  const id = randomUUID();
  const policyId = deriveKeyPolicyId(params.apiKeyId);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO key_mandates
      (id, api_key_id, workspace_id, policy_id, daily_limit_usd, per_tx_usd,
       approval_threshold_usd, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  ).run(
    id,
    params.apiKeyId,
    params.workspaceId,
    policyId,
    String(params.limits.budgetUsd),
    String(params.limits.perTxUsd),
    String(params.limits.approvalThresholdUsd),
    now,
    now,
  );
  void sealKeyMandate(id).catch((err) =>
    logger.warn('Key mandate sealing failed asynchronously', {
      mandateId: id,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  return getKeyMandate(params.apiKeyId)!;
}

/** Seal the mandate's limits into the TEE; transitions the row's status. */
export async function sealKeyMandate(mandateId: string): Promise<void> {
  const db = getDb();
  const row = db.prepare('SELECT * FROM key_mandates WHERE id = ?').get(mandateId) as
    | MandateRow
    | undefined;
  if (!row) return;

  const finish = (status: KeyMandateStatus, txHash: string | null, error: string | null) => {
    db.prepare('UPDATE key_mandates SET status = ?, sealed_tx_hash = ?, error = ?, updated_at = ? WHERE id = ?').run(
      status,
      txHash,
      error,
      new Date().toISOString(),
      mandateId,
    );
  };

  if (!isFlareEvaluatorEnabled()) {
    logger.warn('Key mandate created while FLARE_EVALUATOR is off — mandate unsupported', {
      mandateId,
    });
    finish('unsupported', null, 'FLARE_EVALUATOR is not "flare"');
    return;
  }

  const limits: PolicyLimits = {
    dailyLimit: row.daily_limit_usd,
    perTxLimit: row.per_tx_usd,
    approvalThreshold: row.approval_threshold_usd,
  };

  try {
    const txHash = await sharedFlareConfidentialPolicyService.registerPolicyWithLimits(
      row.policy_id,
      limits,
    );
    logger.info('Key mandate sealed in TEE', { mandateId, policyId: row.policy_id, txHash });
    finish('sealed', txHash, null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Key mandate TEE registration failed', { mandateId, error: msg });
    finish('failed', null, msg);
  }
}

/** TEE limits for a sealed mandate (used by spend evaluation). */
export function mandateToPolicyLimits(m: KeyMandate): PolicyLimits {
  return {
    dailyLimit: m.dailyLimitUsd,
    perTxLimit: m.perTxUsd,
    approvalThreshold: m.approvalThresholdUsd,
  };
}
