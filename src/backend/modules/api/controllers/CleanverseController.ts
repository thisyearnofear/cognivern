/**
 * Cleanverse CVI/CVA controller — status + A-Pass screening for the demo UI.
 */

import { Request, Response } from "express";
import { z } from "zod";
import { ethers } from "ethers";
import { cleanverseConfig } from "@backend/shared/config/index.js";
import { cleanverseIdentityService } from "@backend/services/blockchain/cleanverse/index.js";

const screenSchema = z.object({
  sender: z.string().min(1),
  recipient: z.string().min(1),
  chain: z.string().optional(),
});

export class CleanverseController {
  async getStatus(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: {
        enabled: cleanverseConfig.enabled,
        chain: cleanverseConfig.chain,
        monadChainId: cleanverseConfig.monadChainId,
        monadRpcUrl: cleanverseConfig.monadRpcUrl,
        aTokenAddress: cleanverseConfig.aTokenAddress,
        aTokenSymbol: cleanverseConfig.aTokenSymbol,
        aTokenDecimals: cleanverseConfig.aTokenDecimals,
        gateAllSpends: cleanverseConfig.gateAllSpends,
        apiConfigured: Boolean(cleanverseConfig.apiId && cleanverseConfig.apiKey),
        countryRule: cleanverseConfig.countryRule,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async screen(req: Request, res: Response): Promise<void> {
    const parse = screenSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: "Invalid screen payload",
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!ethers.isAddress(parse.data.sender) || !ethers.isAddress(parse.data.recipient)) {
      res.status(400).json({
        success: false,
        error: "sender and recipient must be valid EVM addresses",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!cleanverseConfig.enabled) {
      res.status(503).json({
        success: false,
        error:
          "Cleanverse is not configured. Set CLEANVERSE_API_ID and CLEANVERSE_API_KEY.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const screening = await cleanverseIdentityService.screenAddresses(
        parse.data.sender,
        parse.data.recipient,
        parse.data.chain || cleanverseConfig.chain,
      );
      res.json({
        success: true,
        data: screening,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error: error instanceof Error ? error.message : "Cleanverse screening failed",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const cleanverseController = new CleanverseController();
