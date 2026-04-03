import { Request, Response } from "express";
import { z } from "zod";
import { owsLocalVaultService } from "../../../services/OwsLocalVaultService.js";

const importWalletSchema = z.object({
  name: z.string().min(1),
  privateKey: z.string().min(1),
  chainId: z.string().optional(),
  chainType: z.string().optional(),
  derivationPath: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1),
  walletIds: z.array(z.string().min(1)).min(1),
  policyIds: z.array(z.string()).default([]),
  expiresAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export class OwsController {
  async getStatus(req: Request, res: Response) {
    const status = await owsLocalVaultService.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  }

  async bootstrap(req: Request, res: Response) {
    const wallet = await owsLocalVaultService.ensureBootstrapWallet();
    if (!wallet) {
      res.status(400).json({
        success: false,
        error: "No bootstrap wallet source available",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  }

  async listWallets(req: Request, res: Response) {
    const wallets = await owsLocalVaultService.listWallets();
    res.json({
      success: true,
      data: wallets,
      timestamp: new Date().toISOString(),
    });
  }

  async importWallet(req: Request, res: Response) {
    const parse = importWalletSchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: "Invalid wallet import payload",
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const wallet = await owsLocalVaultService.importWallet({
      name: parse.data.name,
      privateKey: parse.data.privateKey,
      chainId: parse.data.chainId,
      chainType: parse.data.chainType,
      derivationPath: parse.data.derivationPath,
      metadata: parse.data.metadata,
    });
    res.status(201).json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  }

  async listApiKeys(req: Request, res: Response) {
    const apiKeys = await owsLocalVaultService.listApiKeys();
    res.json({
      success: true,
      data: apiKeys,
      timestamp: new Date().toISOString(),
    });
  }

  async createApiKey(req: Request, res: Response) {
    const parse = createApiKeySchema.safeParse(req.body || {});
    if (!parse.success) {
      res.status(400).json({
        success: false,
        error: "Invalid API key payload",
        details: parse.error.format(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const apiKey = await owsLocalVaultService.createApiKey({
      name: parse.data.name,
      walletIds: parse.data.walletIds,
      policyIds: parse.data.policyIds,
      expiresAt: parse.data.expiresAt,
      metadata: parse.data.metadata,
    });
    res.status(201).json({
      success: true,
      data: apiKey,
      timestamp: new Date().toISOString(),
    });
  }
}
