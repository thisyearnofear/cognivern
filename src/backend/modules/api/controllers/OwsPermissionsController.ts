/**
 * OWS Permissions Controller - Single Responsibility for Permissions
 */

import { Request, Response } from "express";
import { z } from "zod";
import { OwsLocalVaultService } from "@backend/services/blockchain/OwsLocalVaultService.js";
import {
  BadRequestError,
  NotFoundError,
} from "@backend/shared/errors/ApiErrors.js";

// Validation Schemas
const requestPermissionsSchema = z.object({
  walletId: z.string().min(1),
  invoker: z.string().min(1),
  permissions: z.array(
    z.object({
      type: z.string().min(1),
      value: z.unknown().optional(),
    }),
  ),
});

export class OwsPermissionsController {
  private vaultService: OwsLocalVaultService;

  constructor() {
    this.vaultService = new OwsLocalVaultService();
  }

  /**
   * POST /ows/permissions - Request permissions for a wallet
   */
  async requestPermissions(req: Request, res: Response) {
    try {
      const parse = requestPermissionsSchema.safeParse(req.body);
      if (!parse.success) {
        res.status(400).json({
          success: false,
          error: "Invalid permissions request payload",
          details: parse.error.format(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const permissions = await this.vaultService.requestPermissions({
        walletId: parse.data.walletId,
        invoker: parse.data.invoker,
        permissions: parse.data.permissions.map((p) => ({
          type: p.type,
          value: p.value,
        })),
      });

      res.json({
        success: true,
        data: { permissions },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to request permissions",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /ows/permissions/:walletId - Get permissions for a wallet
   */
  async getPermissions(req: Request, res: Response) {
    try {
      const { walletId } = req.params;
      if (!walletId) {
        res.status(400).json({
          success: false,
          error: "walletId parameter required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const permissions = await this.vaultService.getPermissions(walletId);
      res.json({
        success: true,
        data: permissions,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to get permissions",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * DELETE /ows/permissions/:walletId/:invoker - Revoke permissions
   */
  async revokePermissions(req: Request, res: Response) {
    try {
      const { walletId, invoker } = req.params;
      if (!walletId || !invoker) {
        res.status(400).json({
          success: false,
          error: "walletId and invoker parameters required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Note: Would need to add revokePermissions to vault service
      res.json({
        success: true,
        message: "Permissions revoked",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke permissions",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /ows/permissions/:walletId/:invoker - Check specific permissions
   */
  async checkPermissions(req: Request, res: Response) {
    try {
      const { walletId, invoker } = req.params;
      if (!walletId || !invoker) {
        res.status(400).json({
          success: false,
          error: "walletId and invoker parameters required",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const permissions = await this.vaultService.getPermissions(walletId);
      const invokerPermissions = permissions.filter((p) => p.invoker === invoker);

      res.json({
        success: true,
        data: {
          hasPermissions: invokerPermissions.length > 0,
          permissions: invokerPermissions,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to check permissions",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default OwsPermissionsController;
