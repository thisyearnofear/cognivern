/**
 * SolanaExecutionBackend — the `ExecutionBackend` adapter for the governed SPL
 * USDC settlement rail.
 *
 * The generic spend intent is EVM-shaped (`amountWei`), so this adapter
 * refuses to guess: callers must pass the rail-specific fields in
 * `metadata.solanaSettlement`. That keeps an accidental `executionProvider:
 * "solana"` wallet spend from interpreting wei as USDC.
 *
 * Telegraph's `compliant-call` is the primary caller and keeps a thin
 * service-level path (`SolanaSettlementService.executeTransfer`) so it can
 * attach the settled signature to the evidence bundle.
 */

import {
  type ExecutionBackend,
  type ExecutionCapability,
  type ExecutionTransferRequest,
  type ExecutionTransferResult,
} from './ExecutionBackend.js';
import {
  SolanaSettlementError,
  solanaSettlementService,
  type SettlementLimits,
  type SolanaSettlementService,
} from '../solana/SolanaSettlementService.js';

/** Solana mainnet reference used by multi-chain clients (CAIP-style). */
export const SOLANA_CHAIN_ID = 101;

export interface SolanaExecutionMetadata {
  workspaceId: string;
  payee?: string;
  amountUsd: number;
  mandateId?: string;
  limits?: SettlementLimits;
}

export class SolanaExecutionBackend implements ExecutionBackend {
  readonly name = 'solana';
  readonly chainId = SOLANA_CHAIN_ID;
  readonly capabilities: ReadonlySet<ExecutionCapability> = new Set(['spl_transfer']);

  constructor(private readonly service: SolanaSettlementService = solanaSettlementService) {}

  async transfer(req: ExecutionTransferRequest): Promise<ExecutionTransferResult> {
    const meta = (req.metadata?.solanaSettlement ?? null) as SolanaExecutionMetadata | null;
    const base: ExecutionTransferResult = {
      status: 'failed',
      backend: this.name,
      chainId: this.chainId,
      idempotencyKey: req.idempotencyKey,
    };

    if (!meta || typeof meta.amountUsd !== 'number') {
      return {
        ...base,
        error: 'solana execution requires metadata.solanaSettlement { workspaceId, amountUsd }',
      };
    }
    const payee = meta.payee ?? req.to;
    if (!payee) {
      return { ...base, error: 'solana execution requires a payee' };
    }

    try {
      const result = await this.service.executeTransfer(
        {
          // `intentId` is the journal key; fall back to the caller's
          // idempotency key rather than sending a non-idempotent transfer.
          intentId: req.intentId || req.idempotencyKey,
          workspaceId: meta.workspaceId,
          payee,
          amountUsd: meta.amountUsd,
          mandateId: meta.mandateId,
        },
        { limits: meta.limits },
      );
      return {
        status: 'sent',
        backend: this.name,
        chainId: this.chainId,
        txHash: result.signature,
        from: result.payer,
        explorerUrl: result.explorerUrl,
        idempotencyKey: req.idempotencyKey,
        verified: true,
        receiptStatus: result.confirmationStatus,
      };
    } catch (error) {
      if (error instanceof SolanaSettlementError) {
        const uncertain = error.code === 'uncertain';
        return {
          ...base,
          status: uncertain ? 'uncertain' : 'failed',
          uncertain: uncertain || undefined,
          error: error.message,
        };
      }
      return {
        ...base,
        status: 'uncertain',
        uncertain: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const solanaExecutionBackend = new SolanaExecutionBackend();
