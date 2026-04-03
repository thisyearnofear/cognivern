import { Request, Response } from "express";
import { z } from "zod";
import {
  owsWalletService,
  SpendIntent,
} from "../../../services/OwsWalletService.js";
import crypto from "node:crypto";

const spendIntentSchema = z.object({
  agentId: z.string().min(1),
  recipient: z.string().min(1),
  amount: z.string().min(1),
  asset: z.string().min(1),
  reason: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export class SpendController {
  /**
   * Request a spend execution from an agent
   */
  async requestSpend(req: Request, res: Response) {
    try {
      const parse = spendIntentSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid spend intent payload",
          details: parse.error.format(),
        });
        return;
      }

      const intent: SpendIntent = {
        id: `spend_${crypto.randomUUID()}`,
        timestamp: new Date().toISOString(),
        agentId: parse.data.agentId,
        recipient: parse.data.recipient,
        amount: parse.data.amount,
        asset: parse.data.asset,
        reason: parse.data.reason,
        metadata: parse.data.metadata,
      };

      const owsScopedAccess = req.headers["x-ows-scoped-access"] as
        | string
        | undefined;
      console.log(
        "[SpendController] owsScopedAccess:",
        owsScopedAccess?.substring(0, 10) + "...",
      );
      const walletId =
        typeof parse.data.metadata?.walletId === "string"
          ? parse.data.metadata.walletId
          : undefined;

      const result = await owsWalletService.executeSpend(intent, {
        apiKeyToken: owsScopedAccess,
        walletId,
      });
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown spend execution error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get current execution layer status
   */
  async getStatus(req: Request, res: Response) {
    const status = await owsWalletService.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  }
}
