/**
 * TelegraphController
 *
 * API endpoints for Telegraph Protocol integration status and miner discovery.
 */

import { Request, Response } from "express";
import { Logger } from "@backend/shared/logging/Logger.js";
import { telegraphService } from "@backend/services/telegraph/index.js";

const logger = new Logger("TelegraphController");

export class TelegraphController {
  /**
   * GET /api/telegraph/status
   *
   * Returns Telegraph integration status, node/engine/daemon health,
   * payment readiness, and available miners count.
   */
  async getStatus(_req: Request, res: Response) {
    try {
      const enabled = telegraphService.getEnabled();

      if (!enabled) {
        res.json({
          success: true,
          data: {
            enabled: false,
            reason: "Telegraph integration disabled or not configured",
            hint: "Set TELEGRAPH_ENABLED=true and TELEGRAPH_EVM_PRIVATE_KEY in environment",
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [status, paymentReady, daemonHealth] = await Promise.all([
        telegraphService.getNodeStatus(),
        telegraphService.isReady(),
        telegraphService.getDaemonHealth(),
      ]);

      const config = telegraphService.getConfig();

      res.json({
        success: true,
        data: {
          enabled: true,
          healthy: status.healthy,
          nodeUrl: status.nodeUrl,
          engineUrl: config.engineUrl,
          daemonUrl: config.daemonUrl,
          minersAvailable: status.minersAvailable,
          lastRefresh: status.lastRefresh,
          confidenceThreshold: config.confidenceThreshold,
          network: config.evmNetwork,
          paymentReady,
          paymentError: paymentReady ? null : telegraphService.getPaymentInitError(),
          daemon: daemonHealth,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph status", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get Telegraph status",
      });
    }
  }

  /**
   * GET /api/telegraph/miners
   *
   * Returns list of available Telegraph miners with their details.
   * Optional query param: ?intent=WEATHER_FORECAST to filter by intent
   */
  async getMiners(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const intent = req.query.intent as string | undefined;
      const miners = await telegraphService.getMiners(intent);

      res.json({
        success: true,
        data: {
          miners: miners.map((m) => ({
            id: m.id ?? m.slug ?? m.name,
            slug: m.slug,
            name: m.name,
            description: m.description,
            endpoints: m.endpoints,
            intents: m.supported_intents ?? [],
            protocol: m.protocol,
            minPriceUsdc: m.min_price_usdc,
            minPriceUsd: m.min_price_usdc !== undefined ? (m.min_price_usdc / 1_000_000).toFixed(4) : undefined,
            totalRequestsServed: m.total_requests_served,
            scored: m.scored,
            topScore: m.scores?.[0]?.score,
            status: m.activation_status ?? m.status ?? "active",
          })),
          count: miners.length,
          filteredBy: intent ? { intent } : null,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph miners", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get miners",
      });
    }
  }

  /**
   * GET /api/telegraph/intents
   *
   * Returns list of available intents and their miner counts.
   */
  async getIntents(_req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const intents = await telegraphService.getIntents();

      res.json({
        success: true,
        data: {
          intents: intents.map((i) => ({
            name: i.name,
            category: i.category,
            description: i.description,
            minerCount: i.minerCount,
            requestCount: i.requestCount,
          })),
          count: intents.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph intents", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get intents",
      });
    }
  }

  /**
   * GET /api/telegraph/miners/:minerId
   *
   * Returns details about a specific miner.
   */
  async getMiner(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const minerId = req.params.minerId;
      const miner = await telegraphService.getMiner(minerId);

      if (!miner) {
        res.status(404).json({
          success: false,
          error: `Miner ${minerId} not found`,
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: miner.id ?? miner.slug ?? miner.name,
          slug: miner.slug,
          name: miner.name,
          description: miner.description,
          endpoints: miner.endpoints,
          intents: miner.supported_intents ?? [],
          protocol: miner.protocol,
          signalMapping: miner.signal_mapping,
          minPriceUsdc: miner.min_price_usdc,
          minPriceUsd: miner.min_price_usdc !== undefined ? (miner.min_price_usdc / 1_000_000).toFixed(4) : undefined,
          totalRequestsServed: miner.total_requests_served,
          scored: miner.scored,
          scores: miner.scores,
          baseUrl: miner.base_url,
          walletAddress: miner.wallet_address,
          status: miner.activation_status ?? miner.status ?? "active",
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get Telegraph miner", { minerId: req.params.minerId, error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get miner",
      });
    }
  }

  /**
   * GET /api/telegraph/daemon/categories
   *
   * Returns daemon signal categories (free — no payment).
   */
  async getDaemonCategories(_req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const categories = await telegraphService.getDaemonCategories();
      res.json({
        success: true,
        data: {
          categories: categories.categories,
          stats: categories.stats.map((s) => ({
            name: s.name,
            count: s.count,
            avgInterest: s.avg_interest,
            maxInterest: s.max_interest,
          })),
          count: categories.categories.length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get daemon categories", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get daemon categories",
      });
    }
  }

  /**
   * GET /api/telegraph/daemon/questions
   *
   * Returns daemon-collected signals, filterable by category/source.
   */
  async getDaemonQuestions(req: Request, res: Response) {
    try {
      if (!telegraphService.getEnabled()) {
        res.status(503).json({
          success: false,
          error: "Telegraph integration is not enabled",
        });
        return;
      }

      const result = await telegraphService.getDaemonQuestions({
        category: req.query.category as string | undefined,
        source: req.query.source as string | undefined,
        sort: req.query.sort as string | undefined,
        since_hours: req.query.since_hours ? Number(req.query.since_hours) : undefined,
        min_interest: req.query.min_interest ? Number(req.query.min_interest) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      res.json({
        success: true,
        data: { questions: result.results, count: result.results.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error("Failed to get daemon questions", { error });
      res.status(500).json({
        success: false,
        error: error.message || "Failed to get daemon questions",
      });
    }
  }
}
