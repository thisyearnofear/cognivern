import {
  type ExecutionBackend,
  type ExecutionCapability,
  type ExecutionTransferRequest,
  type ExecutionTransferResult,
  normalizeTxStatus,
} from "./ExecutionBackend.js";
import { owsLocalVaultService } from "../OwsLocalVaultService.js";
import {
  executionRails,
  type EvmExecutionRailConfig,
} from "@backend/shared/config/index.js";
import { explorerTxUrl } from "@cognivern/shared";

/**
 * Local vault-signed native transfer. RPC / gas come from the configured
 * EVM rail matching `req.chainId` (default + Mantle Sepolia today).
 */
export class EvmExecutionBackend implements ExecutionBackend {
  readonly name = "local";
  readonly capabilities: ReadonlySet<ExecutionCapability> = new Set([
    "native_transfer",
  ]);

  constructor(
    private readonly defaultRail: EvmExecutionRailConfig = executionRails.default,
    private readonly vault: {
      sendNativeTransfer: typeof owsLocalVaultService.sendNativeTransfer;
    } = owsLocalVaultService,
    private readonly resolveRail: (
      chainIdOrRailId?: number | string | null,
    ) => EvmExecutionRailConfig = (id) => executionRails.resolve(id),
  ) {}

  get chainId(): number {
    return this.defaultRail.chainId;
  }

  async transfer(
    req: ExecutionTransferRequest,
  ): Promise<ExecutionTransferResult> {
    const rail = this.resolveRail(req.chainId || this.defaultRail.chainId);
    const chainId = req.chainId || rail.chainId;
    const railId = rail.railId;
    const result = await this.vault.sendNativeTransfer({
      walletId: req.walletId,
      apiKeyToken: req.operatorApproved ? undefined : req.apiKeyToken,
      operatorApproved: req.operatorApproved,
      to: req.to,
      valueWei: req.amountWei,
      rpcUrl: rail.rpcUrl,
      chainId,
      gasLimit: rail.gasLimits.nativeTransfer,
    });

    if ("error" in result) {
      return {
        status: "failed",
        backend: this.name,
        chainId,
        railId,
        error: result.error,
        idempotencyKey: req.idempotencyKey,
      };
    }

    return {
      status: normalizeTxStatus(result.txHash),
      backend: this.name,
      chainId,
      railId,
      txHash: result.txHash,
      from: result.from,
      explorerUrl: explorerTxUrl(chainId, result.txHash),
      idempotencyKey: req.idempotencyKey,
    };
  }
}

export const evmExecutionBackend = new EvmExecutionBackend();
