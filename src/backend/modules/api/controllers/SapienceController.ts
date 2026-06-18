/**
 * Sapience Controller
 *
 * API endpoints for Sapience forecasting and market data
 */

import { Request, Response } from "express";
import { Logger } from "@backend/shared/logging/Logger.js";

const logger = new Logger("SapienceController");

type SapienceServiceType = InstanceType<
  typeof import("@backend/services/SapienceService.js").SapienceService
>;
type AutomatedForecastingServiceType = InstanceType<
  typeof import("@backend/services/ai/AutomatedForecastingService.js").AutomatedForecastingService
>;

export class SapienceController {
  private sapienceService?: SapienceServiceType;
  private forecastingService?: AutomatedForecastingServiceType;

  private async ensureServices(): Promise<void> {
    if (this.sapienceService && this.forecastingService) {
      return;
    }

    const [{ SapienceService }, { AutomatedForecastingService }] =
      await Promise.all([
        import("@backend/services/SapienceService.js"),
        import("@backend/services/ai/AutomatedForecastingService.js"),
      ]);

    this.sapienceService = new SapienceService();
    this.forecastingService = new AutomatedForecastingService({
      sapienceService: this.sapienceService,
    });
  }

  /**
   * GET /api/sapience/status
   * Get Sapience service status
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      await this.ensureServices();
      const stats = this.forecastingService!.getStats();
      const walletAddress = this.sapienceService!.getAddress();

      res.json({
        status: "operational",
        wallet: walletAddress,
        forecasting: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get Sapience status:", err);
      res.status(500).json({
        error: "Failed to get status",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * POST /api/sapience/forecast
   * Submit a manual forecast
   */
  async submitForecast(req: Request, res: Response): Promise<void> {
    try {
      await this.ensureServices();
      const { conditionId, probability, reasoning, confidence } = req.body;

      if (!conditionId || probability === undefined) {
        res.status(400).json({
          error: "Missing required fields",
          required: ["conditionId", "probability"],
        });
        return;
      }

      if (probability < 0 || probability > 100) {
        res.status(400).json({
          error: "Invalid probability",
          message: "Probability must be between 0 and 100",
        });
        return;
      }

      const txHash = await this.sapienceService!.submitForecast({
        marketId: conditionId,
        probability,
        reasoning: reasoning || "Manual forecast submission",
        confidence: confidence || 1.0,
      });

      res.json({
        success: true,
        txHash,
        conditionId,
        probability,
        explorerUrl: `https://arbiscan.io/tx/${txHash}`,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to submit forecast:", err);
      res.status(500).json({
        error: "Failed to submit forecast",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * POST /api/sapience/forecast/auto
   * Trigger automated forecast generation and submission
   */
  async submitAutomatedForecast(req: Request, res: Response): Promise<void> {
    try {
      await this.ensureServices();
      const result = await this.forecastingService!.runForecastingCycle();

      if (result.success) {
        res.json({
          success: true,
          conditionId: result.conditionId,
          txHash: result.txHash,
          explorerUrl: `https://arbiscan.io/tx/${result.txHash}`,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to run automated forecast:", err);
      res.status(500).json({
        error: "Failed to run automated forecast",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/sapience/wallet
   * Get wallet address and balance
   */
  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      await this.ensureServices();
      const address = this.sapienceService!.getAddress();

      res.json({
        address,
        network: "arbitrum",
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get wallet info:", err);
      res.status(500).json({
        error: "Failed to get wallet info",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Start continuous forecasting
   */
  async startContinuousForecasting(
    intervalMinutes: number = 60,
  ): Promise<void> {
    await this.ensureServices();
    logger.info(
      `Starting continuous forecasting service (interval: ${intervalMinutes} minutes)`,
    );
    this.forecastingService!.startContinuousForecasting(intervalMinutes);
  }

  /**
   * GET /api/sapience/decisions
   */
  async getDecisions(req: Request, res: Response): Promise<void> {
    try {
      await this.ensureServices();
      const decisions = [
        {
          id: "sapience-1",
          action: "hold",
          symbol: "MARKET-1",
          quantity: 0,
          price: 0,
          confidence: 0.95,
          reasoning: "Sapience Oracle: Forecasting active on Arbitrum markets.",
          riskScore: 0.05,
          timestamp: new Date().toISOString(),
        },
      ];

      res.json({ success: true, decisions });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to get Sapience decisions:", err);
      res.status(500).json({ error: "Failed to get decisions" });
    }
  }
}
