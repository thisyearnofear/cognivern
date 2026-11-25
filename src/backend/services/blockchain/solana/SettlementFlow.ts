/**
 * SettlementFlow — the settlement leg of the compliant-call pipeline.
 *
 * Extracted from TelegraphController so the guard/execute/debit sequence
 * lives in one place and a future rail copies *this*, not 200 lines of
 * controller. The controller stays a thin caller: it supplies the request's
 * settlement intent and the evidence plumbing; this module owns the phases.
 *
 * Phase contract (the ordering is load-bearing):
 *   1. preScreenGuard  — runs BEFORE the paid screen. A settlement that
 *      cannot execute (policy, caps, allowlist, rail readiness) is denied
 *      without buying intelligence it could never settle.
 *   2. executeIfApproved — runs only after the parent call is approved.
 *      Executes the transfer, debits the mandate single-flight, and maps
 *      every outcome to an honest evidence status.
 *   3. Error mapping is centralized here so a second caller cannot diverge:
 *      policy/intent_conflict/invalid_input → blocked, uncertain → uncertain
 *      (with the recorded signature for reconciliation), disabled/not_ready →
 *      unavailable, everything else → failed.
 */

import { Logger } from '@backend/shared/logging/Logger.js';
import {
  isValidSolanaAddress,
  SolanaSettlementError,
  solanaSettlementService,
  type SettlementLimits,
} from '@backend/services/blockchain/solana/SolanaSettlementService.js';
import {
  recordSettlementConsumption,
  resolveSettlementPolicy,
} from '@backend/services/blockchain/solana/SettlementPolicy.js';
import type { TelegraphEvidenceBundleInput } from '@backend/services/telegraph/TelegraphEvidence.js';
import { sha256CanonicalJson } from '@backend/services/telegraph/index.js';

const logger = new Logger('SettlementFlow');

/** The settlement portion of the compliant-call request body. */
export interface SettlementRequestIntent {
  rail: 'solana';
  payee: string;
  amountUsd: number;
  intentId: string;
  intentIdGenerated: boolean;
}

/** Narrow view of the evidence bundle's settlementTransfer record. */
export type SettlementTransferEvidence =
  TelegraphEvidenceBundleInput['settlementTransfer'];

export interface SettlementFlowDeps {
  workspaceId: string;
  /** The funded mandate named by the request, if any. */
  mandateId?: string;
}

export interface PreScreenGuardResult {
  /** Null when the settlement may proceed to screening. */
  denial: {
    gate: 'settlement_guard';
    reason: string;
    violations: string[];
    settlementTransfer: SettlementTransferEvidence;
  } | null;
  /** Resolved limits to pass to executeIfApproved. */
  limits: SettlementLimits | null;
  policySource: 'env' | 'funded_mandate' | null;
}

/**
 * Phase 1 — guard before the paid screen. Covers mandate policy (budget,
 * allowed assets, chain constraints), env caps, payee allowlist, and rail
 * readiness (enabled flag, key, payer SOL/USDC balance).
 */
export async function settlementPreScreenGuard(
  intent: SettlementRequestIntent,
  deps: SettlementFlowDeps,
): Promise<PreScreenGuardResult> {
  const policy = resolveSettlementPolicy({
    workspaceId: deps.workspaceId,
    mandateId: deps.mandateId,
    amountUsd: intent.amountUsd,
    envLimits: solanaSettlementService.defaultLimits(),
  });
  const violations = [...policy.violations];
  if (violations.length === 0) {
    const preflight = await solanaSettlementService.preflight(
      { payee: intent.payee, amountUsd: intent.amountUsd },
      policy.limits,
      deps.workspaceId,
    );
    violations.push(...preflight.violations);
  }
  const uniqueViolations = [...new Set(violations)];
  if (uniqueViolations.length > 0) {
    return {
      denial: {
        gate: 'settlement_guard',
        reason: `settlement blocked before screening: ${uniqueViolations.join('; ')}`,
        violations: uniqueViolations,
        settlementTransfer: {
          rail: 'solana',
          status: 'blocked',
          payee: intent.payee,
          amountUsd: intent.amountUsd,
          intentId: intent.intentId,
          intentIdGenerated: intent.intentIdGenerated,
          policySource: policy.policySource,
          mandateId: deps.mandateId ?? null,
          reason: 'settlement intent cannot be executed as requested',
          violations: uniqueViolations,
        },
      },
      limits: null,
      policySource: policy.policySource,
    };
  }
  return { denial: null, limits: policy.limits, policySource: policy.policySource };
}

export interface ExecuteOutcome {
  settlementTransfer: SettlementTransferEvidence;
}

/**
 * Phase 2 — execute after approval. Only an *approved* intelligence call
 * releases the transfer; a held parent means the evidence is not yet
 * trustworthy, and a released hold never resumes settlement (the contract is
 * synchronous-approve-only, recorded as a blocked intent).
 */
export async function settlementExecuteIfApproved(params: {
  intent: SettlementRequestIntent;
  parentStatus: string;
  limits: SettlementLimits | null;
  policySource: 'env' | 'funded_mandate' | null;
  deps: SettlementFlowDeps;
}): Promise<ExecuteOutcome> {
  const { intent, parentStatus, limits, policySource, deps } = params;
  const base = {
    rail: 'solana' as const,
    payee: intent.payee,
    amountUsd: intent.amountUsd,
    intentId: intent.intentId,
    intentIdGenerated: intent.intentIdGenerated,
    mandateId: deps.mandateId ?? null,
  };

  if (parentStatus !== 'approved') {
    return {
      settlementTransfer: {
        ...base,
        status: 'blocked',
        reason: `parent call ${parentStatus} — settlement not authorized`,
      },
    };
  }
  if (!solanaSettlementService.getEnabled()) {
    return {
      settlementTransfer: {
        ...base,
        status: 'unavailable',
        reason: 'SOLANA_SETTLEMENT_ENABLED is false — rail not armed',
      },
    };
  }

  try {
    const settled = await solanaSettlementService.executeTransfer(
      {
        intentId: intent.intentId,
        workspaceId: deps.workspaceId,
        payee: intent.payee,
        amountUsd: intent.amountUsd,
        mandateId: deps.mandateId,
      },
      { limits: limits ?? undefined },
    );
    const mandateDebit = await debitMandateForConfirmedTransfer(intent, deps);
    return {
      settlementTransfer: {
        ...settled,
        intentId: intent.intentId,
        intentIdGenerated: intent.intentIdGenerated,
        policySource: params.policySource ?? null,
        mandateId: deps.mandateId ?? null,
        mandateDebit,
      },
    };
  } catch (error) {
    return { settlementTransfer: mapSettlementError(error, intent, deps) };
  }
}

/** Debit the mandate budget after a confirmed transfer, single-flight. */
async function debitMandateForConfirmedTransfer(
  intent: SettlementRequestIntent,
  deps: SettlementFlowDeps,
): Promise<{ ok: boolean; reason?: string | null } | null> {
  if (!deps.mandateId) return null;
  try {
    // Single-flight per intent: two concurrent replays must not both pass
    // the debited-flag check and debit twice.
    let debit: { ok: boolean; reason?: string | null } = { ok: true };
    await solanaSettlementService.runMandateDebitExclusive(
      deps.workspaceId,
      intent.intentId,
      async () => {
        const recorded = await solanaSettlementService.getIntentStatus(
          deps.workspaceId,
          intent.intentId,
        );
        if (recorded?.mandateDebited) {
          debit = { ok: true, reason: 'already debited' };
          return;
        }
        debit = recordSettlementConsumption({
          workspaceId: deps.workspaceId,
          mandateId: deps.mandateId!,
          amountUsd: intent.amountUsd,
        });
        if (debit.ok) {
          await solanaSettlementService.markMandateDebited(
            deps.workspaceId,
            intent.intentId,
          );
        } else {
          logger.error('Settlement confirmed but mandate debit failed', {
            workspaceId: deps.workspaceId,
            mandateId: deps.mandateId,
            intentId: intent.intentId,
            reason: debit.reason,
          });
        }
      },
    );
    return debit;
  } catch (debitError) {
    // Never let ledger bookkeeping mask a confirmed transfer.
    logger.error('Settlement debit bookkeeping failed', {
      workspaceId: deps.workspaceId,
      mandateId: deps.mandateId,
      intentId: intent.intentId,
      error: debitError,
    });
    return {
      ok: false,
      reason: debitError instanceof Error ? debitError.message : String(debitError),
    };
  }
}

/** Centralized error → evidence mapping. A second caller cannot diverge. */
function mapSettlementError(
  error: unknown,
  intent: SettlementRequestIntent,
  deps: SettlementFlowDeps,
): SettlementTransferEvidence {
  const reason = error instanceof Error ? error.message : String(error);
  const base = {
    rail: 'solana' as const,
    payee: intent.payee,
    amountUsd: intent.amountUsd,
    intentId: intent.intentId,
    intentIdGenerated: intent.intentIdGenerated,
    mandateId: deps.mandateId ?? null,
  };
  if (error instanceof SolanaSettlementError) {
    if (
      error.code === 'policy' ||
      error.code === 'intent_conflict' ||
      error.code === 'invalid_input'
    ) {
      return {
        ...base,
        status: 'blocked',
        reason,
        violations: error.violations,
      };
    }
    if (error.code === 'uncertain') {
      // Surface the recorded signature so the operator can reconcile on the
      // explorer instead of blind-retrying a send we lost track of.
      return {
        ...base,
        status: 'uncertain',
        reason,
      };
    }
    if (error.code === 'disabled' || error.code === 'not_ready') {
      return { ...base, status: 'unavailable', reason };
    }
  }
  return { ...base, status: 'failed', reason };
}

/**
 * Enrich an `uncertain` evidence record with the journalled state (signature,
 * explorer URL, confirmation status) so the operator has everything needed to
 * reconcile without a second call.
 */
export async function enrichUncertainEvidence(
  intent: SettlementRequestIntent,
  evidence: NonNullable<SettlementTransferEvidence>,
  deps: SettlementFlowDeps,
): Promise<SettlementTransferEvidence> {
  if (evidence.status !== 'uncertain') return evidence;
  const recorded = await solanaSettlementService
    .getIntentStatus(deps.workspaceId, intent.intentId)
    .catch(() => null);
  if (!recorded) return evidence;
  return {
    ...evidence,
    cluster: recorded.cluster ?? null,
    mint: recorded.mint ?? null,
    payer: recorded.payer ?? null,
    signature: recorded.signature ?? null,
    explorerUrl: recorded.explorerUrl ?? null,
    confirmationStatus: recorded.confirmationStatus ?? null,
  };
}

/**
 * Parse and validate the `settlement` field of a compliant-call body.
 * Returns null when absent; throws a plain Error with a 400-worthy message
 * when malformed.
 */
export function parseSettlementIntent(
  body: Record<string, unknown>,
  workspaceId: string,
  bodyHash: string,
): SettlementRequestIntent | null {
  const s = body.settlement;
  if (!s || typeof s !== 'object') return null;
  const rec = s as Record<string, unknown>;
  if (rec.rail !== 'solana') {
    throw new Error('settlement.rail must be "solana"');
  }
  const payee = typeof rec.payee === 'string' ? rec.payee.trim() : '';
  if (!payee) throw new Error('settlement.payee is required');
  const amountUsd = typeof rec.amountUsd === 'number' ? rec.amountUsd : Number.NaN;
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error('settlement.amountUsd must be a positive number');
  }
  if (!isValidSolanaAddress(payee)) {
    throw new Error('settlement.payee is not a valid base58 Solana address');
  }
  const requestedIntentId =
    typeof rec.intentId === 'string' && rec.intentId.trim()
      ? rec.intentId.trim().slice(0, 128)
      : null;
  // A missing intentId must not become a fresh random id per retry — that is
  // a double-pay. Derive it from the request instead, so an identical retry
  // replays the recorded outcome.
  const intentId =
    requestedIntentId ??
    `auto-${sha256CanonicalJson({
      workspaceId,
      payee,
      amountUsd,
      bodyHash,
    }).slice(0, 32)}`;
  return {
    rail: 'solana',
    payee,
    amountUsd,
    intentId,
    intentIdGenerated: requestedIntentId === null,
  };
}
