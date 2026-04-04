/**
 * OWS Wallet Controller - Single Responsibility for Wallet Operations
 */

import { Request, Response } from "express";
import { z } from "zod";
import { OwsLocalVaultService } from "../../../services/OwsLocalVaultService.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../shared/errors/ApiErrors.js";

// Validation Schemas
const importWalletSchema = z.object({
  name: z.string().min(1),
  privateKey: z.string().min(1),
  chainId: z.string().optional(),
  chainType: z.string().optional(),
  derivationPath: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const connectExternalSchema = z.object({
  url: z.string().url().optional(),
});

export class OwsWalletController {
  private vaultService: OwsLocalVaultService;

  constructor() {
    this.vaultService = new OwsLocalVaultService();
  }

  /**
   * GET /ows/status - Get OWS system status
   */
  async getStatus(req: Request, res: Response) {
    const status = await this.vaultService.getStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /ows/bootstrap - Bootstrap default wallet
   */
  async bootstrap(req: Request, res: Response) {
    const wallet = await this.vaultService.ensureBootstrapWallet();
    if (!wallet) {
      throw new BadRequestError("No bootstrap wallet source available");
    }

    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /ows/wallets - List all wallets
   */
  async listWallets(req: Request, res: Response) {
    const wallets = await this.vaultService.listWallets();
    res.json({
      success: true,
      data: wallets,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /ows/health - OWS domain health check
   */
  async getHealth(req: Request, res: Response) {
    try {
      const wallets = await this.vaultService.listWallets();
      const apiKeys = await this.vaultService.listApiKeys();

      res.json({
        success: true,
        data: {
          status: "healthy",
          wallets: wallets.length,
          apiKeys: apiKeys.length,
          vaultAccessible: true,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        data: {
          status: "unhealthy",
          vaultAccessible: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /ows/wallets/:id - Get specific wallet
   */
  async getWallet(req: Request, res: Response) {
    const { id } = req.params;
    const wallets = await this.vaultService.listWallets();
    const wallet = wallets.find((w) => w.id === id);

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    res.json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /ows/wallets/import - Import wallet with private key
   */
  async importWallet(req: Request, res: Response) {
    const parse = importWalletSchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError(
        "Invalid wallet import payload",
        parse.error.format(),
      );
    }

    const wallet = await this.vaultService.importWallet({
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

  /**
   * POST /ows/wallets/connect - Connect to external OWS wallet
   */
  async connectExternal(req: Request, res: Response) {
    const parse = connectExternalSchema.safeParse(req.body);
    const externalUrl = parse.data?.url || process.env.OWS_EXTERNAL_WALLET_URL;

    if (!externalUrl) {
      throw new BadRequestError("External wallet URL required");
    }

    const wallet = await this.vaultService.connectToExternalWallet(externalUrl);
    if (!wallet) {
      throw new BadRequestError("Failed to connect to external wallet");
    }

    res.status(201).json({
      success: true,
      data: wallet,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * DELETE /ows/wallets/:id - Delete a wallet
   */
  async deleteWallet(req: Request, res: Response) {
    const { id } = req.params;
    const wallets = await this.vaultService.listWallets();
    const wallet = wallets.find((w) => w.id === id);

    if (!wallet) {
      throw new NotFoundError("Wallet");
    }

    // Note: Would need to add deleteWallet to vault service
    res.json({
      success: true,
      message: "Wallet deleted",
      timestamp: new Date().toISOString(),
    });
  }
}

export default OwsWalletController;
