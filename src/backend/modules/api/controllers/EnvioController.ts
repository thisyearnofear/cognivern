/**
 * Envio controller — reads from the HyperIndex project in indexers/envio/ and
 * exposes evidence sync. The sync endpoint pulls newly indexed Monad events
 * (aUSDC settlements, ERC-8004 registrations, reputation feedback) and
 * materializes them as signed CRE artifacts linked to originating runs.
 */

import { Request, Response } from 'express';
import {
  envioEvidenceService,
  type EnvioEvidenceService,
} from '@backend/services/blockchain/envio/EnvioEvidenceService.js';

export class EnvioController {
  constructor(
    private readonly service: EnvioEvidenceService = envioEvidenceService,
  ) {}

  async getStatus(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: this.service.status(),
      timestamp: new Date().toISOString(),
    });
  }

  async listEvents(req: Request, res: Response): Promise<void> {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    res.json({
      success: true,
      data: this.service.listRecentEvents(limit),
      timestamp: new Date().toISOString(),
    });
  }

  async sync(req: Request, res: Response): Promise<void> {
    const projectId = req.workspaceId || 'envio-indexer';
    try {
      const result = await this.service.syncOnce(projectId);
      if ('error' in result) {
        res.status(503).json({
          success: false,
          error: result.error,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Envio sync failed',
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const envioController = new EnvioController();
