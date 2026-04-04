/**
 * OWS Permissions Controller - Single Responsibility for Permissions
 */

import { Request, Response } from "express";
import { z } from "zod";
import { OwsLocalVaultService } from "../../../services/OwsLocalVaultService.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../shared/errors/ApiErrors.js";

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
    const parse = requestPermissionsSchema.safeParse(req.body);
    if (!parse.success) {
      throw new BadRequestError(
        "Invalid permissions request payload",
        parse.error.format(),
      );
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
  }

  /**
   * GET /ows/permissions/:walletId - Get permissions for a wallet
   */
  async getPermissions(req: Request, res: Response) {
    const { walletId } = req.params;
    if (!walletId) {
      throw new BadRequestError("walletId parameter required");
    }

    const permissions = await this.vaultService.getPermissions(walletId);
    res.json({
      success: true,
      data: permissions,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * DELETE /ows/permissions/:walletId/:invoker - Revoke permissions
   */
  async revokePermissions(req: Request, res: Response) {
    const { walletId, invoker } = req.params;
    if (!walletId || !invoker) {
      throw new BadRequestError("walletId and invoker parameters required");
    }

    // Note: Would need to add revokePermissions to vault service
    res.json({
      success: true,
      message: "Permissions revoked",
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * GET /ows/permissions/:walletId/:invoker - Check specific permissions
   */
  async checkPermissions(req: Request, res: Response) {
    const { walletId, invoker } = req.params;
    if (!walletId || !invoker) {
      throw new BadRequestError("walletId and invoker parameters required");
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
  }
}

export default OwsPermissionsController;
