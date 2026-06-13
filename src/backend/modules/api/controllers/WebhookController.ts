import { Request, Response } from "express";
import {
  sharedNewsPolicyAdjuster,
  NewsEvent,
} from "../../../services/NewsPolicyAdjuster.js";
import { Logger } from "../../../shared/logging/Logger.js";

const logger = new Logger("WebhookController");

export class WebhookController {
  /**
   * Receive a ChainGPT AI Crypto News webhook event.
   * ChainGPT sends breaking crypto news here; the NewsPolicyAdjuster
   * matches it against active policies and auto-holds affected ones.
   */
  async handleChainGptNews(req: Request, res: Response): Promise<void> {
    try {
      const { event, title, summary, affectedProtocols, affectedTokens, severity } = req.body;

      if (!event || !title) {
        res.status(400).json({
          success: false,
          error: "Missing required fields: event, title",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const newsEvent: NewsEvent = {
        id: `news-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: event,
        title,
        summary: summary || "",
        affectedProtocols: affectedProtocols || [],
        affectedTokens: affectedTokens || [],
        severity: severity || "medium",
        timestamp: new Date().toISOString(),
      };

      logger.info(`ChainGPT news webhook received: ${newsEvent.type} — ${newsEvent.title}`);

      const holds = await sharedNewsPolicyAdjuster.handleNewsEvent(newsEvent);

      res.json({
        success: true,
        data: {
          eventId: newsEvent.id,
          policiesHeld: holds.length,
          holds: holds.map((h) => ({
            policyId: h.policyId,
            policyName: h.policyName,
            reason: h.reason,
          })),
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to process ChainGPT news webhook", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to process news event",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Release a held policy manually.
   */
  async releaseHold(req: Request, res: Response): Promise<void> {
    try {
      const { policyId } = req.params;
      const releasedBy = ((req as unknown as Record<string, unknown>).userId as string) || "operator";

      const released = await sharedNewsPolicyAdjuster.releasePolicyHold(
        policyId,
        releasedBy,
      );

      if (!released) {
        res.status(404).json({
          success: false,
          error: `No active hold found for policy ${policyId}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.json({
        success: true,
        data: { policyId, releasedBy },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to release policy hold", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to release policy hold",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * List all active policy holds.
   */
  async listHolds(req: Request, res: Response): Promise<void> {
    try {
      const holds = sharedNewsPolicyAdjuster.getActiveHolds();

      res.json({
        success: true,
        data: { holds, count: holds.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to list policy holds", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to list policy holds",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
