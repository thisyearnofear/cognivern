/**
 * Recall Controller
 * 
 * API endpoints for Recall Network memory services
 */

import { Request, Response } from 'express';
import { RecallService } from '../../../services/RecallService.js';
import { Logger } from '../../../shared/logging/Logger.js';

const logger = new Logger('RecallController');

export class RecallController {
  private recallService: RecallService;

  constructor() {
    this.recallService = new RecallService();
  }

  /**
   * GET /api/recall/status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.recallService.getStats();
      res.json({
        status: this.recallService.isReady() ? 'connected' : 'simulated',
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get Recall status:', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  }

  /**
   * POST /api/recall/store
   */
  async storeMemory(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, type, content, confidence, metadata } = req.body;
      
      if (!agentId || !content) {
        res.status(400).json({ error: 'Missing required fields: agentId, content' });
        return;
      }

      const id = await this.recallService.store({
        agentId,
        type: type || 'reasoning',
        content,
        confidence: confidence || 1.0,
        metadata
      });

      res.json({ success: true, id });
    } catch (error) {
      logger.error('Failed to store memory:', error);
      res.status(500).json({ error: 'Failed to store memory' });
    }
  }

  /**
   * GET /api/recall/query
   */
  async queryMemories(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, q, limit } = req.query;
      
      if (!agentId) {
        res.status(400).json({ error: 'Missing agentId' });
        return;
      }

      const results = await this.recallService.query(
        agentId as string, 
        (q as string) || '', 
        limit ? parseInt(limit as string) : 5
      );

      res.json({ results });
    } catch (error) {
      logger.error('Failed to query memories:', error);
      res.status(500).json({ error: 'Failed to query memories' });
    }
  }
}
