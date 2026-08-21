import {
  type ExecutionBackend,
  type ExecutionCapability,
  type ExecutionTransferRequest,
  type ExecutionTransferResult,
  normalizeTxStatus,
} from "./ExecutionBackend.js";
import { keeperHubExecutionProvider } from "../KeeperHubExecutionProvider.js";
import { executionRailIdForChainId, explorerTxUrl } from "@cognivern/shared";

export class KeeperHubExecutionBackend implements ExecutionBackend {
  readonly name = "keeperhub";
  readonly capabilities: ReadonlySet<ExecutionCapability> = new Set([
    "native_transfer",
    "sponsored",
  ]);

  constructor(
    private readonly provider: {
      executeTransfer: typeof keeperHubExecutionProvider.executeTransfer;
    } = keeperHubExecutionProvider,
    private readonly defaultChainId = 1952,
  ) {}

  get chainId(): number {
    return this.defaultChainId;
  }

  async transfer(
    req: ExecutionTransferRequest,
  ): Promise<ExecutionTransferResult> {
    const chainId = req.chainId || this.defaultChainId;
    const railId = executionRailIdForChainId(chainId);
    try {
      const result = await this.provider.executeTransfer({
        intentId: req.intentId,
        from: req.fromAddress,
        to: req.to,
        valueWei: req.amountWei,
        chainId,
      });

      if ("error" in result) {
        return {
          status: result.uncertain ? "uncertain" : "failed",
          backend: this.name,
          chainId,
          railId,
          error: result.error,
          uncertain: result.uncertain,
          idempotencyKey:
            "idempotencyKey" in result
              ? (result.idempotencyKey as string | undefined)
              : req.idempotencyKey,
        };
      }

      return {
        status: normalizeTxStatus(result.txHash, {
          executionId: result.executionId,
        }),
        backend: this.name,
        chainId: result.chainId ?? chainId,
        railId,
        txHash: result.txHash,
        from: result.from,
        executionId: result.executionId,
        transactionLink: result.transactionLink,
        sponsored: result.sponsored,
        verified: result.verified,
        receiptStatus: result.receiptStatus,
        receipts: result.receipts as ExecutionTransferResult["receipts"],
        recipientMatches: result.recipientMatches,
        valueMatches: result.valueMatches,
        explorerUrl:
          result.transactionLink ||
          (result.txHash ? explorerTxUrl(chainId, result.txHash) : undefined),
        idempotencyKey: req.idempotencyKey,
      };
    } catch (error) {
      return {
        status: "failed",
        backend: this.name,
        chainId,
        railId,
        error: error instanceof Error ? error.message : String(error),
        idempotencyKey: req.idempotencyKey,
      };
    }
  }
}

export const keeperHubExecutionBackend = new KeeperHubExecutionBackend();
