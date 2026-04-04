/**
 * OWS API Key Controller - Single Responsibility for API Key Management
 */

import { Request, Response } from "express";
import { z } from "zod";
import { OwsLocalVaultService } from "../../../services/OwsLocalVaultService.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../shared/errors/ApiErrors.js";

// Validation Schemas
const createApiKeySchema = z.object({
  name: z.string().min(1),
  walletIds: z.array(z.string().min(1)).min(1),
  policyIds: z.array(z.string()).default([]),
  expiresAt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export class OwsApiKeyController {
  private vaultService: OwsLocalVaultService;

  constructor() {
    this.vaultService = new OwsLocalVaultService();
  }

  /**
   * GET /ows/api-keys - List all API keys
   */
  async listApiKeys(req: Request, res: Response) {
    const apiKeys = await this.vaultService.listApiKeys();
    res.json({
      success: true,
      data: apiKeys,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * POST /ows/api-keys - Create new API key
   */
  async createApiKey(req: Request, res: Response) {
    const parse = createApiKeySchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError(
        "Invalid API key payload",
        parse.error.format(),
      );
    }

    const result = await this.vaultService.createApiKey({
      name: parse.data.name,
      walletIds: parse.data.walletIds,
      policyIds: parse.data.policyIds,
      expiresAt: parse.data.expiresAt,
      metadata: parse.data.metadata,
    });

    res.status(201).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /ows/api-keys/:id - Get specific API key (without token)
   */
  async getApiKey(req: Request, res: Response) {
    const { id } = req.params;
    const apiKeys = await this.vaultService.listApiKeys();
    const apiKey = apiKeys.find((k) => k.id === id);

    if (!apiKey) {
      throw new NotFoundError("API Key");
    }

    res.json({
      success: true,
      data: apiKey,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * DELETE /ows/api-keys/:id - Revoke/delete API key
   */
  async deleteApiKey(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) {
      throw new BadRequestError("API key ID required");
    }

    try {
      await this.vaultService.deleteApiKey(id);
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      throw new NotFoundError("API Key");
    }
  }

  /**
   * POST /ows/api-keys/:id/validate - Validate an API key token
   */
  async validateApiKey(req: Request, res: Response) {
    const { id } = req.params;
    const { token } = req.body;

    if (!token) {
      throw new BadRequestError("Token required for validation");
    }

    const apiKey = await this.vaultService.validateApiKey(token);
    if (!apiKey || apiKey.id !== id) {
      throw new NotFoundError("API Key");
    }

    res.json({
      success: true,
      data: {
        valid: true,
        apiKeyId: apiKey.id,
        walletIds: apiKey.walletIds,
        policyIds: apiKey.policyIds,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export default OwsApiKeyController;
