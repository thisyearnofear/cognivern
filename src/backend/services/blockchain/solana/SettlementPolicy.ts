/**
 * SettlementPolicy — resolves the bounds a Solana settlement is measured
 * against.
 *
 * The mandate is the app's durable unit of spend authority. When a settlement
 * names one, the funded mandate is the source of truth: it must be active,
 * carry a stablecoin budget line, and be compatible with a non-EVM rail.
 * Environment caps act as an additional ceiling, never a replacement for a
 * mandate that was explicitly named.
 *
 * When no mandate is named the env caps still apply, but the resolution is
 * labelled `policySource: "env"` and carries a warning so the evidence is
 * honest about what actually bounded the transfer.
 */

import {
  FundedMandateService,
  findUsdcAsset,
  remainingForAsset,
  type FundedMandate,
} from '@backend/services/governance/FundedMandateService.js';
import type { SettlementLimits } from './SolanaSettlementService.js';

export interface SettlementPolicyResolution {
  limits: SettlementLimits;
  policySource: 'env' | 'funded_mandate';
  mandateId?: string;
  mandateRemainingUsd?: number;
  violations: string[];
  warnings: string[];
}

function assetAllowed(mandate: FundedMandate): boolean {
  const allowed = mandate.settlement?.allowedAssets;
  if (!allowed || allowed.length === 0) return true;
  return allowed.some((asset) => asset.trim().toLowerCase() === 'usdc');
}

/**
 * Resolve limits for one intent. Pure read — consumption is recorded by
 * `recordSettlementConsumption` only after the transfer confirms.
 */
export function resolveSettlementPolicy(input: {
  workspaceId: string;
  mandateId?: string;
  amountUsd: number;
  envLimits: SettlementLimits;
}): SettlementPolicyResolution {
  const { workspaceId, mandateId, amountUsd, envLimits } = input;

  if (!mandateId) {
    return {
      limits: { ...envLimits, policySource: 'env' },
      policySource: 'env',
      violations: [],
      warnings: ['settlement has no mandateId — only env caps bound this transfer'],
    };
  }

  const violations: string[] = [];
  const mandate = FundedMandateService.get(workspaceId, mandateId);
  if (!mandate) {
    violations.push(`mandate ${mandateId} not found in this workspace`);
  } else {
    if (mandate.status !== 'active') {
      violations.push(`mandate ${mandateId} is ${mandate.status}, not active`);
    }
    if (!findUsdcAsset(mandate)) {
      violations.push(`mandate ${mandateId} has no USDC budget line`);
    }
    if (!assetAllowed(mandate)) {
      const allowed = mandate.settlement?.allowedAssets?.join(', ') ?? '—';
      violations.push(`mandate ${mandateId} only permits assets [${allowed}]; Solana settles USDC`);
    }
    if (mandate.settlement?.requireCleanverseIdentity) {
      violations.push(
        `mandate ${mandateId} requires a Cleanverse identity; the Solana rail is not covered`,
      );
    }
    if (mandate.settlement?.requireVerifiedSettlement) {
      violations.push(
        `mandate ${mandateId} requires Cleanverse verified settlement; the Solana rail is not covered`,
      );
    }
    if (mandate.settlement?.chainIds && mandate.settlement.chainIds.length > 0) {
      violations.push(
        `mandate ${mandateId} restricts settlement to chainIds [${mandate.settlement.chainIds.join(', ')}]; Solana is not covered`,
      );
    }
  }

  const remaining = mandate ? remainingForAsset(mandate) : 0;
  if (mandate && Number.isFinite(remaining) && amountUsd > remaining) {
    violations.push(
      `amount ${amountUsd} exceeds mandate ${mandateId} remaining budget ${remaining}`,
    );
  }

  // The mandate bounds the transfer; env caps remain a hard outer ceiling.
  const budgetCeiling = mandate ? remaining : 0;
  const limits: SettlementLimits = {
    maxTransferUsd: Math.min(envLimits.maxTransferUsd, budgetCeiling),
    runwayUsd: Math.min(envLimits.runwayUsd, budgetCeiling),
    payeeAllowlist: envLimits.payeeAllowlist,
    policySource: 'funded_mandate',
    mandateId,
  };

  return {
    limits,
    policySource: 'funded_mandate',
    mandateId,
    mandateRemainingUsd: remaining,
    violations,
    warnings: [],
  };
}

/**
 * Debit a confirmed settlement against the mandate budget. Callers must only
 * invoke this after a `settled` result.
 */
export function recordSettlementConsumption(input: {
  workspaceId: string;
  mandateId?: string;
  amountUsd: number;
}): { ok: boolean; reason?: string } {
  if (!input.mandateId) return { ok: true };
  try {
    const result = FundedMandateService.consumeBudget(
      input.workspaceId,
      input.mandateId,
      input.amountUsd,
    );
    return result.ok ? { ok: true } : { ok: false, reason: result.reason };
  } catch (error) {
    // The USDC already moved; a ledger problem must be reported, never thrown
    // back as if the settlement failed.
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
