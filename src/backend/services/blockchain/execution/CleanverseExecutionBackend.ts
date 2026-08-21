import {
  type ExecutionBackend,
  type ExecutionCapability,
  type ExecutionTransferRequest,
  type ExecutionTransferResult,
  normalizeTxStatus,
} from "./ExecutionBackend.js";
import { cleanverseExecutionProvider } from "../cleanverse/index.js";
import { cleanverseConfig } from "@backend/shared/config/index.js";

export class CleanverseExecutionBackend implements ExecutionBackend {
  readonly name = "cleanverse";
  readonly capabilities: ReadonlySet<ExecutionCapability> = new Set([
    "erc20_transfer",
  ]);

  constructor(
    private readonly provider: {
      executeTransfer: typeof cleanverseExecutionProvider.executeTransfer;
    } = cleanverseExecutionProvider,
  ) {}

  get chainId(): number {
    return cleanverseConfig.monadChainId;
  }

  async transfer(
    req: ExecutionTransferRequest,
  ): Promise<ExecutionTransferResult> {
    const chainId = req.chainId || this.chainId;
    const result = await this.provider.executeTransfer({
      intentId: req.intentId,
      walletId: req.walletId,
      apiKeyToken: req.apiKeyToken,
      operatorApproved: req.operatorApproved,
      from: req.fromAddress,
      to: req.to,
      amount: req.amountWei,
      chainId,
    });

    if ("error" in result) {
      return {
        status: result.uncertain ? "uncertain" : "failed",
        backend: this.name,
        chainId,
        error: result.error,
        uncertain: result.uncertain,
        idempotencyKey: req.idempotencyKey,
      };
    }

    return {
      status: normalizeTxStatus(result.txHash),
      backend: this.name,
      chainId: result.chainId,
      txHash: result.txHash,
      from: result.from,
      transactionLink: result.transactionLink,
      explorerUrl: result.transactionLink,
      tokenAddress: result.tokenAddress,
      tokenSymbol: result.tokenSymbol,
      verifyApass: result.verifyApass,
      recipientMatches: result.recipientMatches,
      valueMatches: result.valueMatches,
      verified: result.verified,
      receiptStatus: result.receiptStatus,
      idempotencyKey: req.idempotencyKey,
    };
  }
}

export const cleanverseExecutionBackend = new CleanverseExecutionBackend();
