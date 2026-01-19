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

export class SapienceTradingAgent implements TradingAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly type = "sapience" as const;
  public status: "active" | "inactive" | "paused" | "error" = "inactive";
  public config: TradingAgentConfig;

  private sapienceService: SapienceService;
  private portfolio: Portfolio | null = null;

  constructor(id: string, name: string, config: TradingAgentConfig) {
    this.id = id;
    this.name = name;
    this.config = config;
    this.sapienceService = new SapienceService();
  }

  async initialize(): Promise<void> {
    try {
      // Check Sapience connection?
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

      await this.sapienceService.submitForecast(forecast);

      const tradeResult: TradeResult = {
        id: `forecast_${Date.now()}`,
        decision,
        status: "executed",
        executedPrice: decision.price,
        executedQuantity: decision.quantity,
        fees: 0, 
        timestamp: new Date(),
      };

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
    if (!this.portfolio) {
      this.portfolio = {
        totalValue: 0,
        cash: 0,
        positions: [],
        lastUpdated: new Date(),
      };
    }
    return this.portfolio;
  }

  async getPerformance(): Promise<PerformanceMetrics> {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
      profitableTrades: 0,
      averageTradeReturn: 0,
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
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
    return [];
  }
}
