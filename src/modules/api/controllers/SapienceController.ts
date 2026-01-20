/**
 * Sapience Controller
 * 
 * API endpoints for Sapience forecasting and market data
 */

import { Request, Response } from 'express';
import { SapienceService } from '../../../services/SapienceService.js';
import { AutomatedForecastingService } from '../../../services/AutomatedForecastingService.js';
import { Logger } from '../../../shared/logging/Logger.js';

const logger = new Logger('SapienceController');

export class SapienceController {
  private sapienceService: SapienceService;
  private forecastingService: AutomatedForecastingService;

  constructor() {
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
      const stats = this.forecastingService.getStats();
      const walletAddress = this.sapienceService.getAddress();

      res.json({
        status: 'operational',
        wallet: walletAddress,
        forecasting: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to get Sapience status:', error);
      res.status(500).json({
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/sapience/forecast
   * Submit a manual forecast
   */
  async submitForecast(req: Request, res: Response): Promise<void> {
    try {
      const { conditionId, probability, reasoning, confidence } = req.body;

      if (!conditionId || probability === undefined) {
        res.status(400).json({
          error: 'Missing required fields',
          required: ['conditionId', 'probability'],
        });
        return;
      }

      if (probability < 0 || probability > 100) {
        res.status(400).json({
          error: 'Invalid probability',
          message: 'Probability must be between 0 and 100',
        });
        return;
      }

      const txHash = await this.sapienceService.submitForecast({
        marketId: conditionId,
        probability,
        reasoning: reasoning || 'Manual forecast submission',
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
      logger.error('Failed to submit forecast:', error);
      res.status(500).json({
        error: 'Failed to submit forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * POST /api/sapience/forecast/auto
   * Trigger automated forecast generation and submission
   */
  async submitAutomatedForecast(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.forecastingService.runForecastingCycle();

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
      logger.error('Failed to run automated forecast:', error);
      res.status(500).json({
        error: 'Failed to run automated forecast',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * GET /api/sapience/wallet
   * Get wallet address and balance
   */
  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const address = this.sapienceService.getAddress();

      res.json({
        address,
        network: 'arbitrum',
        // Note: Balance check would require provider integration
      });
    } catch (error) {
      logger.error('Failed to get wallet info:', error);
      res.status(500).json({
        error: 'Failed to get wallet info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Start continuous forecasting
   */
  startContinuousForecasting(intervalMinutes: number = 60): void {
    logger.info(`Starting continuous forecasting service (interval: ${intervalMinutes} minutes)`);
    this.forecastingService.startContinuousForecasting(intervalMinutes);
  }
}
