/**
 * PrivaraPayrollService
 *
 * Wraps the @reineira-os/sdk (Privara) to provide confidential payroll capabilities.
 * Composes with Fhenix: a policy decisionId is carried as compliance proof alongside
 * the Privara escrow-based confidential transfer.
 *
 * Flow:
 *   1. Agent gets a Fhenix decisionId from ConfidentialSpendPolicy (approve)
 *   2. Agent submits to /api/payroll/confidential with decisionId, contractor, amount
 *   3. PrivaraPayrollService creates an encrypted escrow via Privara SDK
 *   4. Returns the escrow ID and transaction as the confidential transfer
 */

import { ReineiraSDK } from "@reineira-os/sdk";
import { ethers } from "ethers";
import logger from "../utils/logger.js";

export interface ConfidentialPayrollRequest {
  /** Fhenix decisionId from ConfidentialSpendPolicy (compliance proof) */
  decisionId: string;
  /** Contractor wallet address to receive the payment */
  contractorWallet: string;
  /** Payment amount in USD (will be converted to USDC or native) */
  amountUsd: number;
  /** Currency to use for the transfer (e.g., "USDC", "FHE") */
  currency: string;
  /** Optional memo or invoice reference */
  memo?: string;
}

export interface ConfidentialPayrollResult {
  /** The Privara escrow ID created for this transfer */
  escrowId: string;
  /** The transaction hash of the escrow creation */
  privatransferTx: string;
  /** The Fhenix decisionId carried as compliance proof */
  decisionId: string;
  /** Contractor wallet address */
  contractorWallet: string;
  /** Amount in USD */
  amountUsd: number;
  /** Timestamp of the transfer */
  timestamp: string;
  /** Human-readable note */
  note: string;
}

export interface PrivaraPayrollServiceConfig {
  /** RPC URL for the Privara-supported chain (defaults to Arbitrum Sepolia) */
  rpcUrl?: string;
  /** Private key for signing Privara transactions */
  privateKey: string;
  /** Network identifier (defaults to "testnet") */
  network?: "testnet" | "mainnet";
}

/**
 * Default configuration for Privara payroll.
 * Uses environment variables with sensible defaults for testnet.
 */
export function createPrivaraConfig(): PrivaraPayrollServiceConfig {
  return {
    rpcUrl:
      process.env.PRIVARA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    privateKey:
      process.env.PRIVARA_PRIVATE_KEY || process.env.FHENIX_PRIVATE_KEY || "",
    network:
      (process.env.PRIVARA_NETWORK as "testnet" | "mainnet") || "testnet",
  };
}

export class PrivaraPayrollService {
  private sdk: ReineiraSDK | null = null;
  private config: PrivaraPayrollServiceConfig;

  constructor(config: PrivaraPayrollServiceConfig) {
    this.config = config;
  }

  /**
   * Initialize the Privara SDK.
   * Must be called before any payroll operations.
   */
  async initialize(): Promise<void> {
    if (this.sdk) return;

    if (!this.config.privateKey) {
      logger.warn(
        "PrivaraPayrollService: no private key configured — will use fallback mode",
      );
      return;
    }

    try {
      this.sdk = await ReineiraSDK.create({
        privateKey: this.config.privateKey,
        rpcUrl: this.config.rpcUrl || "https://sepolia-rollup.arbitrum.io/rpc",
        network: this.config.network || "testnet",
      });
      if (this.sdk.initialize) {
        await this.sdk.initialize();
      }

      logger.info("PrivaraPayrollService: SDK initialized successfully");
    } catch (error) {
      logger.error(
        "PrivaraPayrollService: SDK initialization failed",
        error instanceof Error ? error : undefined,
      );
      this.sdk = null; // Reset so fallback mode is used
      throw error;
    }
  }

  /**
   * Execute a confidential payroll transfer via Privara escrow.
   *
   * Creates an FHE-encrypted escrow for the contractor, then funds it.
   * The Fhenix decisionId is embedded as compliance proof.
   */
  async executeConfidentialPayroll(
    request: ConfidentialPayrollRequest,
  ): Promise<ConfidentialPayrollResult> {
    logger.info(
      `PrivaraPayroll: processing confidential payroll for ${request.contractorWallet}, amount=${request.amountUsd} ${request.currency}`,
    );

    // If SDK is not initialized, return a simulated result for demo/dev
    if (!this.sdk) {
      logger.warn(
        "PrivaraPayrollService: SDK not initialized, returning simulated result",
      );

      const simulatedTx =
        "0x" +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join("");

      return {
        escrowId: `sim-${Date.now()}`,
        privatransferTx: simulatedTx,
        decisionId: request.decisionId,
        contractorWallet: request.contractorWallet,
        amountUsd: request.amountUsd,
        timestamp: new Date().toISOString(),
        note: `Privara simulated confidential transfer — decisionId ${request.decisionId} carried as compliance proof. Set PRIVARA_PRIVATE_KEY env var for real execution.`,
      };
    }

    try {
      // Convert USD amount to USDC units (6 decimals on Arbitrum)
      const amountUnits = ethers.parseUnits(request.amountUsd.toString(), 6);

      // Build and create the encrypted escrow via Privara SDK builder
      const escrow = await this.sdk.escrow
        .build()
        .amount(amountUnits)
        .owner(request.contractorWallet)
        .create();

      // The escrow instance has the id property directly
      const escrowId = escrow.id;

      let txHash: string;
      let funded = false;

      try {
        // Fund the escrow with autoApprove (handles USDC token approval in one call)
        const fundResult = await escrow.fund(amountUnits, {
          autoApprove: true,
        });
        txHash = fundResult?.tx?.hash?.toString() || "";
        funded = true;
      } catch (fundErr) {
        // Escrow created but funding failed (e.g. cUSDC operator approval not
        // available on this network). Return escrow creation as partial success.
        logger.warn(
          `PrivaraPayroll: escrow ${escrowId} created but funding failed: ${fundErr instanceof Error ? fundErr.message : String(fundErr)}`,
        );
        txHash = escrow.createTx?.hash?.toString() || "";
      }

      logger.info(
        `PrivaraPayroll: escrow ${escrowId} created${funded ? " and funded" : ""} for ${request.contractorWallet}`,
      );

      return {
        escrowId: escrowId.toString(),
        privatransferTx: txHash,
        decisionId: request.decisionId,
        contractorWallet: request.contractorWallet,
        amountUsd: request.amountUsd,
        timestamp: new Date().toISOString(),
        note: funded
          ? `Privara executed confidential transfer — escrow ${escrowId} created and funded, decisionId ${request.decisionId} carried as compliance proof`
          : `Privara escrow ${escrowId} created — funding requires cUSDC operator approval on this network. decisionId ${request.decisionId} carried as compliance proof`,
      };
    } catch (error) {
      logger.error(
        "PrivaraPayroll: escrow creation failed",
        error instanceof Error ? error : undefined,
      );
      throw error;
    }
  }

  /**
   * Redeem/completes a confidential payroll escrow.
   * Called by the contractor to claim their payment.
   */
  async redeemPayroll(escrowId: string): Promise<boolean> {
    if (!this.sdk) {
      logger.warn("PrivaraPayrollService: SDK not initialized, cannot redeem");
      return false;
    }

    try {
      const escrow = this.sdk.escrow.get(BigInt(escrowId));
      await escrow.redeem();
      logger.info(`PrivaraPayroll: escrow ${escrowId} redeemed`);
      return true;
    } catch (error) {
      logger.error(
        `PrivaraPayroll: escrow ${escrowId} redemption failed`,
        error instanceof Error ? error : undefined,
      );
      return false;
    }
  }

  /**
   * Get the status of a payroll escrow
   */
  async getPayrollStatus(escrowId: string): Promise<{
    exists: boolean;
    funded: boolean;
    redeemed: boolean;
  }> {
    if (!this.sdk) {
      return { exists: false, funded: false, redeemed: false };
    }

    try {
      const escrow = this.sdk.escrow.get(BigInt(escrowId));
      const exists = await escrow.exists();
      const funded = exists ? await escrow.isFunded() : false;
      const redeemed = exists ? await escrow.isRedeemable() : false;

      return { exists, funded, redeemed };
    } catch {
      return { exists: false, funded: false, redeemed: false };
    }
  }
}

/** Shared singleton instance */
export const sharedPrivaraPayrollService = new PrivaraPayrollService(
  createPrivaraConfig(),
);
