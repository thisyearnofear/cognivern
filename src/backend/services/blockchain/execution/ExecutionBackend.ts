/**
 * ExecutionBackend — pluggable spend broadcast adapters.
 *
 * Control plane stays rail-agnostic; wallet metadata `executionProvider`
 * selects which backend moves value after policy approval.
 *
 * @see docs/ARCHITECTURE_RAILS.md
 */

export type ExecutionCapability =
  | "native_transfer"
  | "erc20_transfer"
  | "sponsored";

export interface ExecutionTransferRequest {
  intentId: string;
  /** Local vault wallet id when the backend signs from OWS. */
  walletId: string;
  /** Address hint / org wallet provenance for hosted providers. */
  fromAddress: string;
  to: string;
  amountWei: bigint;
  chainId: number;
  idempotencyKey: string;
  apiKeyToken?: string | null;
  operatorApproved?: boolean;
  abortSignal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface ExecutionTransferResult {
  status: "sent" | "failed" | "uncertain";
  backend: string;
  chainId: number;
  railId?: string;
  txHash?: string;
  explorerUrl?: string;
  from?: string;
  executionId?: string;
  transactionLink?: string;
  sponsored?: boolean;
  verified?: boolean;
  receiptStatus?: string;
  receipts?: Array<{
    hash: string;
    chainId?: number;
    from?: string;
    to?: string;
    value?: string;
    verified?: boolean;
    receiptStatus?: string;
    blockNumber?: number;
    gasUsed?: string;
    verifiedAt?: string;
  }>;
  recipientMatches?: boolean;
  valueMatches?: boolean;
  tokenAddress?: string;
  tokenSymbol?: string;
  verifyApass?: unknown;
  idempotencyKey?: string;
  uncertain?: boolean;
  error?: string;
}

export interface ExecutionBackend {
  readonly name: string;
  readonly chainId: number;
  readonly capabilities: ReadonlySet<ExecutionCapability>;
  transfer(req: ExecutionTransferRequest): Promise<ExecutionTransferResult>;
}

export function normalizeTxStatus(
  txHash: string | undefined,
  opts?: { uncertain?: boolean; executionId?: string; error?: string },
): "sent" | "failed" | "uncertain" {
  const valid = typeof txHash === "string" && /^0x[0-9a-fA-F]{64}$/.test(txHash);
  if (valid) return "sent";
  if (opts?.uncertain || opts?.executionId) return "uncertain";
  if (opts?.error || txHash !== undefined) return "uncertain";
  return "failed";
}
