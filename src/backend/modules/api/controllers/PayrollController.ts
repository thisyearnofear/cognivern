/**
 * PayrollController
 *
 * Handles confidential payroll endpoints powered by the Privara SDK.
 * Composes with the Fhenix spend layer: a decisionId from ConfidentialSpendPolicy
 * is carried as compliance proof for each payroll transfer.
 */

import { Request, Response } from "express";
import { z } from "zod";
import {
  sharedPrivaraPayrollService,
  PrivaraPayrollService,
} from "@backend/services/blockchain/PrivaraPayrollService.js";
import { Logger } from "@backend/shared/logging/Logger.js";

const logger = new Logger("PayrollController");

const confidentialPayrollSchema = z.object({
  /** Fhenix decisionId from ConfidentialSpendPolicy */
  decisionId: z.string().min(1),
  /** Contractor wallet address */
  contractorWallet: z.string().min(1),
  /** Payment amount in USD */
  amountUsd: z.number().positive(),
  /** Currency (e.g., "USDC", "FHE") */
  currency: z.string().min(1).default("USDC"),
  /** Optional memo */
  memo: z.string().optional(),
});

export class PayrollController {
  private payrollService: PrivaraPayrollService;

  constructor(payrollService?: PrivaraPayrollService) {
    this.payrollService = payrollService || sharedPrivaraPayrollService;
  }

  /**
   * Initialize the PayrollController (initializes the Privara SDK)
   */
  async initialize(): Promise<void> {
    try {
      await this.payrollService.initialize();
      logger.info("PayrollController: Privara SDK initialized");
    } catch (error) {
      logger.warn(
        "PayrollController: Privara SDK initialization failed — payroll will use simulated mode",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * POST /api/payroll/confidential
   *
   * Executes a confidential payroll transfer via Privara SDK.
   * The contractor receives an FHE-encrypted escrow that only they can decrypt.
   * The Fhenix decisionId is carried as compliance proof.
   */
  async executeConfidentialPayroll(req: Request, res: Response) {
    try {
      const parse = confidentialPayrollSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid payroll payload",
          details: parse.error.format(),
        });
        return;
      }

      const { decisionId, contractorWallet, amountUsd, currency, memo } =
        parse.data;

      logger.info(
        `PayrollController: confidential payroll for ${contractorWallet}, amount=${amountUsd} ${currency}, decisionId=${decisionId}`,
      );

      const result = await this.payrollService.executeConfidentialPayroll({
        decisionId,
        contractorWallet,
        amountUsd,
        currency,
        memo,
      });

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(
        "PayrollController: confidential payroll failed",
        error instanceof Error ? error : undefined,
      );
      res.status(500).json({
        success: false,
        error: error.message || "Confidential payroll execution failed",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default PayrollController;
