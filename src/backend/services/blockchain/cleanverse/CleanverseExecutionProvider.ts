/**
 * CVA — Cleanverse Verified Assets settlement rail.
 * Verifies A-Pass transfer eligibility, then broadcasts an Access USDC/aUSDC ERC-20 transfer
 * on Monad testnet via the local OWS vault signer.
 */

import { ethers } from "ethers";
import { cleanverseConfig } from "@backend/shared/config/index.js";
import { logger } from "@backend/shared/logging/Logger.js";
import { owsLocalVaultService } from "../OwsLocalVaultService.js";
import {
  cleanverseIdentityService,
  type CleanverseIdentityService,
} from "./CleanverseIdentityService.js";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

export interface CleanverseTransferRequest {
  intentId: string;
  walletId: string;
  apiKeyToken?: string | null;
  operatorApproved?: boolean;
  from: string;
  to: string;
  /** Token base units (Access USDC/aUSDC uses 6 decimals by default). */
  amount: bigint;
  chainId?: number;
}

export interface CleanverseTransferResult {
  txHash: string;
  from: string;
  to: string;
  amount: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  transactionLink: string;
  verifyApass?: {
    sender: { success: boolean; code: number; message: string };
    recipient: { success: boolean; code: number; message: string };
  };
  recipientMatches: boolean;
  valueMatches: boolean;
  verified: boolean;
  receiptStatus: "success" | "failed" | "unknown";
}

export type CleanverseTransferError = {
  error: string;
  uncertain?: boolean;
};

export class CleanverseExecutionProvider {
  constructor(
    private readonly identity: CleanverseIdentityService = cleanverseIdentityService,
  ) {}

  async executeTransfer(
    request: CleanverseTransferRequest,
  ): Promise<CleanverseTransferResult | CleanverseTransferError> {
    if (!cleanverseConfig.enabled) {
      return {
        error:
          "Cleanverse is not configured. Set CLEANVERSE_API_ID and CLEANVERSE_API_KEY.",
      };
    }
    if (!ethers.isAddress(request.to)) {
      return { error: `Invalid recipient address: ${request.to}` };
    }
    if (request.amount <= 0n) {
      return { error: `Transfer amount must be positive (got ${request.amount})` };
    }

    const chain = cleanverseConfig.chain;
    const tokenAddress = cleanverseConfig.aTokenAddress;
    const chainId = request.chainId || cleanverseConfig.monadChainId;

    let senderVerify;
    let recipientVerify;
    try {
      [senderVerify, recipientVerify] = await Promise.all([
        this.identity.verifyAPass(chain, request.from, tokenAddress),
        this.identity.verifyAPass(chain, request.to, tokenAddress),
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "verify_apass failed";
      return { error: `CVA verify_apass failed: ${message}` };
    }

    if (!senderVerify.success) {
      return {
        error: `Sender failed CVA verify_apass: ${senderVerify.message}`,
      };
    }
    if (!recipientVerify.success) {
      return {
        error: `Recipient failed CVA verify_apass: ${recipientVerify.message}`,
      };
    }

    const broadcast = await owsLocalVaultService.sendErc20Transfer({
      walletId: request.walletId,
      apiKeyToken: request.operatorApproved ? undefined : request.apiKeyToken,
      operatorApproved: request.operatorApproved,
      tokenAddress,
      to: request.to,
      amount: request.amount,
      rpcUrl: cleanverseConfig.monadRpcUrl,
      chainId,
      // aUSDC on Monad is a minimal proxy (delegatecall), so a real transfer
      // costs ~300k gas — 120k was burning the full limit and reverting.
      gasLimit: 400_000,
    });

    if ("error" in broadcast) {
      return { error: broadcast.error };
    }

    const verification = await this.verifyErc20TransferReceipt({
      txHash: broadcast.txHash,
      tokenAddress,
      expectedFrom: broadcast.from,
      expectedTo: request.to,
      expectedAmount: request.amount,
      chainId,
    });

    logger.info(
      `Cleanverse aUSDC transfer ${broadcast.txHash} verified=${verification.verified}`,
    );

    return {
      txHash: broadcast.txHash,
      from: broadcast.from,
      to: request.to,
      amount: request.amount.toString(),
      chainId,
      tokenAddress,
      tokenSymbol: cleanverseConfig.aTokenSymbol,
      transactionLink: cleanverseConfig.explorerTxUrl(broadcast.txHash),
      verifyApass: {
        sender: {
          success: senderVerify.success,
          code: senderVerify.code,
          message: senderVerify.message,
        },
        recipient: {
          success: recipientVerify.success,
          code: recipientVerify.code,
          message: recipientVerify.message,
        },
      },
      recipientMatches: verification.recipientMatches,
      valueMatches: verification.valueMatches,
      verified: verification.verified,
      receiptStatus: verification.receiptStatus,
    };
  }

  private async verifyErc20TransferReceipt(params: {
    txHash: string;
    tokenAddress: string;
    expectedFrom: string;
    expectedTo: string;
    expectedAmount: bigint;
    chainId: number;
  }): Promise<{
    verified: boolean;
    recipientMatches: boolean;
    valueMatches: boolean;
    receiptStatus: "success" | "failed" | "unknown";
  }> {
    try {
      const provider = new ethers.JsonRpcProvider(
        cleanverseConfig.monadRpcUrl,
        params.chainId,
      );
      const receipt = await provider.waitForTransaction(params.txHash, 1, 60_000);
      if (!receipt) {
        return {
          verified: false,
          recipientMatches: false,
          valueMatches: false,
          receiptStatus: "unknown",
        };
      }
      if (receipt.status !== 1) {
        return {
          verified: false,
          recipientMatches: false,
          valueMatches: false,
          receiptStatus: "failed",
        };
      }

      const iface = new ethers.Interface(ERC20_ABI);
      let recipientMatches = false;
      let valueMatches = false;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== params.tokenAddress.toLowerCase()) {
          continue;
        }
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (!parsed || parsed.name !== "Transfer") continue;
          const to = String(parsed.args.to);
          const value = BigInt(parsed.args.value.toString());
          recipientMatches =
            to.toLowerCase() === params.expectedTo.toLowerCase();
          valueMatches = value === params.expectedAmount;
          if (recipientMatches && valueMatches) break;
        } catch {
          // ignore non-matching logs
        }
      }

      return {
        verified: recipientMatches && valueMatches,
        recipientMatches,
        valueMatches,
        receiptStatus: "success",
      };
    } catch (error) {
      logger.warn(
        `Cleanverse receipt verification failed: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      return {
        verified: false,
        recipientMatches: false,
        valueMatches: false,
        receiptStatus: "unknown",
      };
    }
  }
}

export const cleanverseExecutionProvider = new CleanverseExecutionProvider();
