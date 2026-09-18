import {
  type ExecutionBackend,
  type ExecutionCapability,
  type ExecutionTransferRequest,
  type ExecutionTransferResult,
  normalizeTxStatus,
} from "./ExecutionBackend.js";
import {
  getDynamicWalletClient,
  type DynamicWalletMetadata,
} from "../dynamic/DynamicServerWalletClient.js";
import { explorerTxUrl } from "@cognivern/shared";

type WalletClientLike = {
  sendTransaction: (args: {
    to: `0x${string}`;
    value: bigint;
  }) => Promise<`0x${string}`>;
};

/** Classify Dynamic failures so operators know whether to fix config or reconcile. */
export function classifyDynamicTransferError(message: string): {
  status: "failed" | "uncertain";
  uncertain: boolean;
  code:
    | "missing_metadata"
    | "wrong_chain"
    | "not_configured"
    | "network"
    | "broadcast";
} {
  if (
    /not configured|DYNAMIC_ENABLED|DYNAMIC_ENVIRONMENT_ID|DYNAMIC_API_TOKEN/i.test(
      message,
    )
  ) {
    return { status: "failed", uncertain: false, code: "not_configured" };
  }
  if (
    /walletMetadata is missing|account address is missing|DYNAMIC_WALLET_METADATA/i.test(
      message,
    )
  ) {
    return { status: "failed", uncertain: false, code: "missing_metadata" };
  }
  if (
    /No configured execution rail|requires a positive wallet chainId|has no RPC URL/i.test(
      message,
    )
  ) {
    return { status: "failed", uncertain: false, code: "wrong_chain" };
  }
  if (
    /timeout|timed out|network|ECONNRESET|ETIMEDOUT|ECONNREFUSED|fetch failed|socket/i.test(
      message,
    )
  ) {
    return { status: "uncertain", uncertain: true, code: "network" };
  }
  return { status: "failed", uncertain: false, code: "broadcast" };
}

/**
 * Dynamic server-wallet execution adapter.
 *
 * Broadcasts native transfers via a Dynamic MPC wallet (viem WalletClient).
 * Inject {@link getClient} in tests to avoid the real SDK.
 */
export class DynamicExecutionBackend implements ExecutionBackend {
  readonly name = "dynamic";
  readonly capabilities: ReadonlySet<ExecutionCapability> = new Set([
    "native_transfer",
  ]);

  constructor(
    private readonly getClient: typeof getDynamicWalletClient = getDynamicWalletClient,
    private readonly defaultChainId = 1952,
  ) {}

  get chainId(): number {
    return this.defaultChainId;
  }

  async transfer(
    req: ExecutionTransferRequest,
  ): Promise<ExecutionTransferResult> {
    const requestedChainId =
      typeof req.chainId === "number" && Number.isFinite(req.chainId)
        ? req.chainId
        : this.defaultChainId;
    const chainId = requestedChainId;
    try {
      if (!Number.isFinite(chainId) || chainId <= 0) {
        throw new Error(
          "Dynamic spend requires a positive wallet chainId. Set metadata.chainId to a configured execution rail.",
        );
      }

      const meta = (req.metadata ?? {}) as Record<string, unknown>;
      const walletMetadata =
        (meta.dynamicWalletMetadata as DynamicWalletMetadata | undefined) ||
        null;
      const accountAddress =
        (typeof meta.dynamicAccountAddress === "string"
          ? meta.dynamicAccountAddress
          : undefined) || req.fromAddress;

      const {
        walletClient,
        accountAddress: signer,
        railId,
        chainId: resolvedChainId,
      } = await this.getClient({
        walletMetadata,
        accountAddress,
        chainId,
      });

      const hash = await (walletClient as WalletClientLike).sendTransaction({
        to: req.to as `0x${string}`,
        value: req.amountWei,
      });

      return {
        status: normalizeTxStatus(hash),
        backend: this.name,
        chainId: resolvedChainId,
        railId,
        txHash: hash,
        from: signer,
        explorerUrl: explorerTxUrl(resolvedChainId, hash),
        idempotencyKey: req.idempotencyKey,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const classified = classifyDynamicTransferError(message);
      return {
        status: classified.status,
        backend: this.name,
        chainId,
        railId: undefined,
        error: `[dynamic:${classified.code}] ${message}`,
        uncertain: classified.uncertain,
        idempotencyKey: req.idempotencyKey,
      };
    }
  }
}

export const dynamicExecutionBackend = new DynamicExecutionBackend();
