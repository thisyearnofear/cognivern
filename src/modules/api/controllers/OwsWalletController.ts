/**
 * OWS Wallet Controller - Single Responsibility for Wallet Operations
 */

import { Request, Response } from "express";
import { z } from "zod";
import {
  OwsLocalVaultService,
  OwsAgentRecord,
} from "../../../services/OwsLocalVaultService.js";
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
   * GET /ows/dashboard - Unified OWS dashboard data
   */
  async getDashboard(req: Request, res: Response) {
    try {
      const [wallets, apiKeys, permissions, agents] = await Promise.all([
        this.vaultService.listWallets(),
        this.vaultService.listApiKeys(),
        this.vaultService
          .listWallets()
          .then((w) =>
            w[0]?.id
              ? this.vaultService.getPermissions(w[0].id)
              : Promise.resolve([]),
          ),
        this.vaultService.listAgents(),
      ]);

      const wallet = wallets[0];

      res.json({
        success: true,
        data: {
          wallet: wallet
            ? {
                id: wallet.id,
                name: wallet.name,
                chainType: wallet.chainType,
                accounts: wallet.accounts.map((a) => ({
                  address: a.address,
                  chainId: a.chainId,
                })),
              }
            : null,
          apiKeys: apiKeys.map((k) => ({
            id: k.id,
            name: k.name,
            createdAt: k.createdAt,
            walletCount: k.walletIds.length,
            policyCount: k.policyIds.length,
          })),
          agents: agents.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            status: a.status,
            policyCount: a.policyIds.length,
          })),
          permissions: permissions.slice(0, 5),
          hasWallet: !!wallet,
          hasApiKeys: apiKeys.length > 0,
          hasAgents: agents.length > 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /ows/agents - List all OWS agents
   */
  async listAgents(req: Request, res: Response) {
    const agents = await this.vaultService.listAgents();
    res.json({
      success: true,
      data: agents,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /ows/agents - Register a new agent
   */
  async createAgent(req: Request, res: Response) {
    const { name, description, type, walletId, apiKeyId, policyIds, metadata } =
      req.body;

    if (!name || !type) {
      throw new BadRequestError("Agent name and type are required");
    }

    const agent: OwsAgentRecord = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name,
      description: description || "",
      type,
      status: "active",
      walletId,
      apiKeyId,
      policyIds: policyIds || [],
      createdAt: new Date().toISOString(),
      metadata,
    };

    const created = await this.vaultService.registerAgent(agent);
    res.status(201).json({
      success: true,
      data: created,
      timestamp: new Date().toISOString(),
    });
  }
}

export default OwsWalletController;
