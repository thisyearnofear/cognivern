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
    const chainId = req.chainId || this.defaultChainId;
    try {
      const meta = (req.metadata ?? {}) as Record<string, unknown>;
      const walletMetadata =
        (meta.dynamicWalletMetadata as DynamicWalletMetadata | undefined) ||
        null;
      const accountAddress =
        (typeof meta.dynamicAccountAddress === "string"
          ? meta.dynamicAccountAddress
          : undefined) || req.fromAddress;

      const { walletClient, accountAddress: signer, railId, chainId: resolvedChainId } =
        await this.getClient({
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
      const uncertain =
        /timeout|timed out|network|ECONNRESET|ETIMEDOUT/i.test(message);
      return {
        status: uncertain ? "uncertain" : "failed",
        backend: this.name,
        chainId,
        railId: undefined,
        error: message,
        uncertain,
        idempotencyKey: req.idempotencyKey,
      };
    }
  }
}

export const dynamicExecutionBackend = new DynamicExecutionBackend();
