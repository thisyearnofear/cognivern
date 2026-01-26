/**
 * Sapience Trading Agent Implementation
 */

import {
  TradingAgent,
  TradingAgentConfig,
  TradingDecision,
  TradeResult,
  Portfolio,
  PerformanceMetrics,
  ComplianceResult,
  AgentActivity,
  AgentInfo,
} from "../types/TradingAgent.js";
import { SapienceService, ForecastRequest } from "../../../services/SapienceService.js";
import { RecallService } from "../../../services/RecallService.js";
import { AutomatedForecastingService } from "../../../services/AutomatedForecastingService.js";

export class SapienceTradingAgent implements TradingAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly type = "sapience" as const;
  public status: "active" | "inactive" | "paused" | "error" = "inactive";
  public config: TradingAgentConfig;

  private sapienceService: SapienceService;
  private recallService: RecallService;
  private forecastingService: AutomatedForecastingService;
  private portfolio: Portfolio | null = null;
  private history: TradingDecision[] = [];

  constructor(id: string, name: string, config: TradingAgentConfig) {
    this.id = id;
    this.name = name;
    this.config = config;
    this.sapienceService = new SapienceService();
    this.recallService = new RecallService();
    this.forecastingService = new AutomatedForecastingService({
        sapienceService: this.sapienceService
    });
  }

  async initialize(): Promise<void> {
    try {
      this.status = "inactive";
    } catch (error) {
      this.status = "error";
      throw new Error(`Failed to initialize Sapience Trading Agent: ${error}`);
    }
  }

  async start(): Promise<void> {
    if (this.status === "error") {
      throw new Error("Cannot start agent in error state");
    }

    this.status = "active";
    await this.reportActivity({
      agentId: this.id,
      type: "status_change",
      data: { status: "active" },
      timestamp: new Date(),
    });
  }

  async stop(): Promise<void> {
    this.status = "inactive";
    await this.reportActivity({
      agentId: this.id,
      type: "status_change",
      data: { status: "inactive" },
      timestamp: new Date(),
    });
  }

  async pause(): Promise<void> {
    this.status = "paused";
    await this.reportActivity({
      agentId: this.id,
      type: "status_change",
      data: { status: "paused" },
      timestamp: new Date(),
    });
  }

  async resume(): Promise<void> {
    this.status = "active";
    await this.reportActivity({
      agentId: this.id,
      type: "status_change",
      data: { status: "active" },
      timestamp: new Date(),
    });
  }

  /**
   * Perform a Real Forecast Cycle
   * This is called by the orchestrator instead of a mock trade.
   */
  async performForecastCycle(): Promise<void> {
      if (this.status !== "active") return;

      try {
          const result = await this.forecastingService.runForecastingCycle();
          
          if (result.success) {
              // Create a decision record for the history/frontend
              const decision: TradingDecision = {
                  id: result.txHash || `forecast-${Date.now()}`,
                  agentId: this.id,
                  timestamp: new Date(),
                  action: "buy", // Mapping forecast to 'buy' for dashboard consistency
                  symbol: result.conditionId || "Sapience Market",
                  quantity: 1,
                  price: 0,
                  confidence: result.forecast.probability / 100,
                  reasoning: result.forecast.reasoning,
                  riskScore: 0.1
              };
              
              this.history.unshift(decision);
              if (this.history.length > 50) this.history.pop();
          }
      } catch (error) {
          console.error("Agent forecast cycle failed:", error);
      }
  }

  async executeTrade(decision: TradingDecision): Promise<TradeResult> {
    if (this.status !== "active") {
      throw new Error("Agent is not active");
    }

    // Check compliance before executing
    const compliance = await this.checkCompliance(decision);
    if (!compliance.isCompliant) {
      return {
        id: `forecast_${Date.now()}`,
        decision,
        status: "failed",
        error: `Compliance violation: ${compliance.violations[0]?.message}`,
        timestamp: new Date(),
      };
    }

    try {
      // Execute forecast/trade through Sapience Service
      const forecast: ForecastRequest = {
        marketId: decision.symbol, // Using symbol as marketId for now
        probability: decision.confidence,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
      };

      const txHash = await this.sapienceService.submitForecast(forecast);

      // Store reasoning in Recall Memory
      try {
        await this.recallService.store({
            agentId: this.id,
            type: "reasoning",
            content: `Forecast submitted for ${forecast.marketId}. Probability: ${forecast.probability}%. Reasoning: ${forecast.reasoning}`,
            confidence: forecast.confidence,
            metadata: {
            txHash,
            marketId: forecast.marketId,
            action: "forecast_submission"
            }
        });
      } catch (recallError) {
          console.error("Failed to store memory in Recall:", recallError);
      }

      const tradeResult: TradeResult = {
        id: `forecast_${Date.now()}`,
        decision,
        status: "executed",
        executedPrice: decision.price,
        executedQuantity: decision.quantity,
        fees: 0, 
        timestamp: new Date(),
      };

      // Add to local history
      this.history.unshift(decision);
      if (this.history.length > 50) this.history.pop();

      await this.reportActivity({
        agentId: this.id,
        type: "trade",
        data: tradeResult,
        timestamp: new Date(),
      });

      return tradeResult;
    } catch (error) {
      const failedResult: TradeResult = {
        id: `forecast_${Date.now()}`,
        decision,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date(),
      };

      await this.reportActivity({
        agentId: this.id,
        type: "error",
        data: { error: failedResult.error, decision },
        timestamp: new Date(),
      });

      return failedResult;
    }
  }

  async getPortfolio(): Promise<Portfolio> {
    try {
        const balance = await this.sapienceService.getEthBalance();
        this.portfolio = {
            totalValue: parseFloat(balance),
            cash: parseFloat(balance),
            positions: [],
            lastUpdated: new Date(),
        };
    } catch (e) {
        console.warn("Failed to fetch real portfolio balance:", e);
        if (!this.portfolio) {
            this.portfolio = { totalValue: 0, cash: 0, positions: [], lastUpdated: new Date() };
        }
    }
    return this.portfolio;
  }

  async getPerformance(): Promise<PerformanceMetrics> {
    const totalForecasts = this.history.length;
    const avgConfidence = totalForecasts > 0 
        ? this.history.reduce((sum, d) => sum + d.confidence, 0) / totalForecasts 
        : 0;

    return {
      totalReturn: 0, // No trading PnL yet, only forecasting
      totalReturnPercent: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0, // Win rate depends on market resolution (not yet implemented)
      totalTrades: totalForecasts,
      profitableTrades: 0,
      averageTradeReturn: avgConfidence, // Using confidence as a session metric
      period: {
        start: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : new Date(),
        end: new Date(),
      },
    };
  }

  async checkCompliance(decision: TradingDecision): Promise<ComplianceResult> {
    // Basic compliance check
    return {
      isCompliant: true,
      violations: [],
      warnings: [],
    };
  }

  async reportActivity(activity: AgentActivity): Promise<void> {
    // Log locally for now, could integrate with Sapience logging if available
    console.log(`[${this.name}] Activity:`, activity);
  }

  getId(): string {
    return this.id;
  }

  async isHealthy(): Promise<boolean> {
    return this.status !== "error";
  }

  async shutdown(): Promise<void> {
    await this.stop();
  }

  getInfo(): AgentInfo {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      status: this.status,
      config: this.config,
      createdAt: new Date(),
      lastActivity: new Date().toISOString(),
      owner: "system",
      capabilities: ["forecasting", "sapience-integration"],
      registeredAt: new Date().toISOString(),
    };
  }

  async getStatus(): Promise<any> {
    return {
      id: this.id,
      status: this.status,
      isHealthy: await this.isHealthy(),
      lastHeartbeat: new Date(),
      performance: await this.getPerformance(),
      portfolio: await this.getPortfolio(),
    };
  }

  async getRecentDecisions(limit: number = 10): Promise<TradingDecision[]> {
    return this.history.slice(0, limit);
  }
}