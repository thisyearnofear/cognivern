/**
 * Recall Controller
 *
 * API endpoints for Recall Network memory services
 */

import { Request, Response } from "express";
import { RecallService } from "../../../services/RecallService.js";
import { Logger } from "../../../shared/logging/Logger.js";

const logger = new Logger("RecallController");

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
      if (!this.recallService.isReady()) {
        res.json({
          status: "simulated",
          stats: { totalMemories: 0, storageUsed: "0 KB" },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const stats = await this.recallService.getStats();
      res.json({
        status: "connected",
        stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn("Recall API unavailable, returning simulated status");
      res.json({
        status: "simulated",
        stats: { totalMemories: 0, storageUsed: "0 KB" },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * POST /api/recall/store
   */
  async storeMemory(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, type, content, confidence, metadata } = req.body;

      if (!agentId || !content) {
        res
          .status(400)
          .json({ error: "Missing required fields: agentId, content" });
        return;
      }

      const id = await this.recallService.store({
        agentId,
        type: type || "reasoning",
        content,
        confidence: confidence || 1.0,
        metadata,
      });

      res.json({ success: true, id });
    } catch (error) {
      logger.error("Failed to store memory:", error);
      res.status(500).json({ error: "Failed to store memory" });
    }
  }

  /**
   * GET /api/recall/query
   */
  async queryMemories(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, q, limit } = req.query;

      if (!agentId) {
        res.status(400).json({ error: "Missing agentId" });
        return;
      }

      const results = await this.recallService.query(
        agentId as string,
        (q as string) || "",
        limit ? parseInt(limit as string) : 5,
      );

      res.json({ results });
    } catch (error) {
      logger.error("Failed to query memories:", error);
      res.status(500).json({ error: "Failed to query memories" });
    }
  }
  /**
   * GET /api/recall/decisions
   */
  async getDecisions(req: Request, res: Response): Promise<void> {
    try {
      if (!this.recallService.isReady()) {
        res.json({ success: true, decisions: this.getSimulatedDecisions() });
        return;
      }
      const { agentId, limit } = req.query;
      const results = await this.recallService.query(
        (agentId as string) || "recall-agent-1",
        "",
        limit ? parseInt(limit as string) : 10,
      );

      // Transform to TradingDecision format
      const decisions = results.map((r: any) => ({
        id: r.id,
        action: r.type === "trade" ? (r.content.includes("buy") ? "buy" : "sell") : "hold",
        symbol: "ETH/USD",
        quantity: 1,
        price: 2500,
        confidence: r.confidence || 0.9,
        reasoning: r.content,
        riskScore: 0.1,
        timestamp: r.timestamp || new Date().toISOString(),
      }));

      res.json({ success: true, decisions });
    } catch (error) {
      logger.warn("Recall API unavailable, returning simulated decisions");
      res.json({ success: true, decisions: this.getSimulatedDecisions() });
    }
  }

  private getSimulatedDecisions(): any[] {
    return [
      {
        id: "sim-1",
        action: "buy",
        symbol: "ETH/USD",
        quantity: 0.5,
        price: 2450.25,
        confidence: 0.85,
        reasoning: "Strong support at 2400 level with increasing volume.",
        riskScore: 0.2,
        timestamp: new Date().toISOString(),
      },
      {
        id: "sim-2",
        action: "hold",
        symbol: "BTC/USD",
        quantity: 0,
        price: 65000,
        confidence: 0.92,
        reasoning: "Wait for breakout above 66k resistance before entering.",
        riskScore: 0.1,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
      }
    ];
  }
}
