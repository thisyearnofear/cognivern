import { Request, Response } from "express";
import { FhenixPolicyService } from "../../../services/FhenixPolicyService.js";
import { Logger } from "../../../shared/logging/Logger.js";

const logger = new Logger("FhenixController");

const fhenixPolicyService = new FhenixPolicyService({
  rpcUrl: process.env.FHENIX_RPC_URL || "https://api.testnet.fhenix.zone",
  contractAddress: process.env.FHENIX_POLICY_CONTRACT || "",
  privateKey: process.env.FHENIX_PRIVATE_KEY || process.env.FILECOIN_PRIVATE_KEY || "",
  evaluateTimeoutMs: Number(process.env.FHENIX_EVALUATE_TIMEOUT_MS || "30000"),
});

export class FhenixController {
  /**
   * Decrypt confidential data using an auditor's permit
   */
  async decrypt(req: Request, res: Response) {
    try {
      const { permit, encryptedValue, contractAddress } = req.body;

      if (!permit || !encryptedValue || !contractAddress) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: permit, encryptedValue, or contractAddress"
        });
        return;
      }

      logger.info(`Attempting decryption for contract ${contractAddress}`);

      // Call the service to perform decryption
      const value = await fhenixPolicyService.unsealValue(
        contractAddress,
        encryptedValue,
        permit
      );

      res.json({
        success: true,
        data: { value },
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error("Decryption failed", error);
      res.status(500).json({
        success: false,
        error: error.message || "Decryption failed",
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get Fhenix network status
   */
  async getStatus(req: Request, res: Response) {
    try {
      const provider = fhenixPolicyService.getProvider();
      const network = await provider.getNetwork();

      res.json({
        success: true,
        data: {
          chainId: network.chainId.toString(),
          name: network.name,
          fhenixEnabled: true
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Encrypt a plaintext amount into a ciphertext for agent use.
   * This is intended as a trusted sidecar utility for non-TS agents.
   */
  async encrypt(req: Request, res: Response) {
    try {
      const { amount } = req.body;

      if (amount === undefined || amount === null) {
        res.status(400).json({
          success: false,
          error: "Missing required field: amount"
        });
        return;
      }

      logger.info(`Encrypting amount via sidecar utility`);

      // We expect amount as a string representing ether/tokens or directly Wei
      // For simplicity, we assume it's already a scaled BigInt string (e.g. Wei)
      // or we just parse it. We'll try to parse it as BigInt.
      let amountWei: bigint;
      try {
        amountWei = BigInt(amount);
      } catch (e) {
        // If it's a decimal, standard parseInt/BigInt will fail, but we assume
        // the agent provides Wei-scaled integers.
        res.status(400).json({
          success: false,
          error: "amount must be a valid integer string (Wei)"
        });
        return;
      }

      const encryptedData = await fhenixPolicyService.encryptValue(amountWei);

      res.json({
        success: true,
        data: encryptedData,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.error("Sidecar encryption failed", error);
      res.status(500).json({
        success: false,
        error: error.message || "Encryption failed",
        timestamp: new Date().toISOString()
      });
    }
  }
}
