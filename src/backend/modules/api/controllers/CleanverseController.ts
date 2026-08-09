/**
 * Cleanverse CVI/CVA controller — status + A-Pass screening for the demo UI.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { cleanverseConfig } from '@backend/shared/config/index.js';
import { cleanverseIdentityService } from '@backend/services/blockchain/cleanverse/index.js';

const screenSchema = z.object({
  sender: z.string().min(1),
  recipient: z.string().min(1),
  chain: z.string().optional(),
});

const depositAddressSchema = z.object({
  address: z.string().min(1),
  chain: z.string().optional(),
});

export class CleanverseController {
  async getStatus(_req: Request, res: Response): Promise<void> {
    const depositAddressConfigured = Boolean(
      cleanverseConfig.depositAddress && cleanverseConfig.depositForAddress,
    );
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
        depositAddress: depositAddressConfigured ? cleanverseConfig.depositAddress : null,
        depositForAddress: depositAddressConfigured ? cleanverseConfig.depositForAddress : null,
        depositAddressConfigured,
        gateAllSpends: cleanverseConfig.gateAllSpends,
        apiConfigured: Boolean(cleanverseConfig.apiId && cleanverseConfig.apiKey),
        countryRule: cleanverseConfig.countryRule,
      },
      timestamp: new Date().toISOString(),
    });
  }

  async getDepositAddress(req: Request, res: Response): Promise<void> {
    const parse = depositAddressSchema.safeParse({
      address: req.query.address,
      chain: req.query.chain,
    });
    if (!parse.success || !ethers.isAddress(parse.data.address)) {
      res.status(400).json({
        success: false,
        error: 'address must be a valid EVM address',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (!cleanverseConfig.enabled) {
      res.status(503).json({
        success: false,
        error: 'Cleanverse is not configured. Set CLEANVERSE_API_ID and CLEANVERSE_API_KEY.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      const chain = parse.data.chain || cleanverseConfig.chain;
      const result = await cleanverseIdentityService.queryDepositAddress(
        chain,
        parse.data.address,
      );
      if (!result.success || !result.data) {
        res.status(502).json({
          success: false,
          error: result.error || 'Cleanverse deposit address lookup failed',
          code: result.code,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Circle USDC must use the explicit USDC wallet; never fall back to USDT.
      const depositAddress = result.data.depositUSDCWallet;
      if (!depositAddress || !ethers.isAddress(depositAddress)) {
        res.status(502).json({
          success: false,
          error: 'Cleanverse returned no valid USDC deposit address',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const requestedAddress = ethers.getAddress(parse.data.address);
      if (!result.data.address || !ethers.isAddress(result.data.address)) {
        res.status(502).json({
          success: false,
          error: 'Cleanverse returned an invalid wallet address',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (ethers.getAddress(result.data.address) !== requestedAddress) {
        res.status(502).json({
          success: false,
          error: 'Cleanverse returned a deposit address for a different wallet',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      if (result.data.chain && result.data.chain.toLowerCase() !== chain.toLowerCase()) {
        res.status(502).json({
          success: false,
          error: 'Cleanverse returned a deposit address for a different chain',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: {
          address: result.data.address,
          chain: result.data.chain || chain,
          depositAddress,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Cleanverse deposit address lookup failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  async screen(req: Request, res: Response): Promise<void> {
    const parse = screenSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid screen payload',
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!ethers.isAddress(parse.data.sender) || !ethers.isAddress(parse.data.recipient)) {
      res.status(400).json({
        success: false,
        error: 'sender and recipient must be valid EVM addresses',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!cleanverseConfig.enabled) {
      res.status(503).json({
        success: false,
        error: 'Cleanverse is not configured. Set CLEANVERSE_API_ID and CLEANVERSE_API_KEY.',
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
        error: error instanceof Error ? error.message : 'Cleanverse screening failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const cleanverseController = new CleanverseController();
