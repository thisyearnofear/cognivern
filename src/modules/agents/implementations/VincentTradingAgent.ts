/**
 * Vincent Social Trading Agent Implementation
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
  AgentStatus,
} from "../types/TradingAgent.js";

export class VincentTradingAgent implements TradingAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly type = "vincent" as const;
  public status: "active" | "inactive" | "paused" | "error" = "inactive";
  public config: TradingAgentConfig;

  private portfolio: Portfolio | null = null;
  private appId: string;
  private managementWallet: string;

  constructor(id: string, name: string, config: TradingAgentConfig) {
    this.id = id;
    this.name = name;
    this.config = config;

    this.appId = process.env.VINCENT_APP_ID || "827";
    this.managementWallet =
      process.env.VINCENT_MANAGEMENT_WALLET ||
      "0x8502d079f93AEcdaC7B0Fe71Fa877721995f1901";
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Vincent Framework connection
      this.status = "inactive";
    } catch (error) {
      this.status = "error";
      throw new Error(`Failed to initialize Vincent Trading Agent: ${error}`);
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
      data: { status: "active", appId: this.appId },
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
        id: `vincent_trade_${Date.now()}`,
        decision,
        status: "failed",
        error: `Compliance violation: ${compliance.violations[0]?.message}`,
        timestamp: new Date(),
      };
    }

    try {
      // Execute trade through Vincent Framework
      // This would integrate with Vincent's social trading features
      const tradeResult: TradeResult = {
        id: `vincent_trade_${Date.now()}`,
        decision,
        status: "executed",
        executedPrice: decision.price || 0,
        executedQuantity: decision.quantity,
        fees: decision.quantity * 0.0015, // 0.15% fee for social trading
        timestamp: new Date(),
      };

      await this.reportActivity({
        agentId: this.id,
        type: "trade",
        data: {
          ...tradeResult,
          socialFeatures: {
            appId: this.appId,
            managementWallet: this.managementWallet,
          },
        },
        timestamp: new Date(),
      });

      return tradeResult;
    } catch (error) {
      const failedResult: TradeResult = {
        id: `vincent_trade_${Date.now()}`,
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
    // Vincent social trading portfolio
    if (!this.portfolio) {
      this.portfolio = {
        totalValue: 8930.25,
        cash: 3500,
        positions: [
          {
            symbol: "ETH/USD",
            quantity: 2.5,
            averagePrice: 2800,
            currentPrice: 2950,
            unrealizedPnL: 375,
            realizedPnL: 150,
          },
          {
            symbol: "BTC/USD",
            quantity: 0.05,
            averagePrice: 46000,
            currentPrice: 47000,
            unrealizedPnL: 50,
            realizedPnL: 0,
          },
        ],
        lastUpdated: new Date(),
      };
    }

    return this.portfolio;
  }

  async getPerformance(): Promise<PerformanceMetrics> {
    // Vincent social trading performance metrics
    return {
      totalReturn: 890.4,
      totalReturnPercent: 9.97,
      sharpeRatio: 1.6,
      maxDrawdown: -3.8,
      winRate: 0.78,
      totalTrades: 28,
      profitableTrades: 22,
      averageTradeReturn: 31.8,
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        end: new Date(),
      },
    };
  }

  async checkCompliance(decision: TradingDecision): Promise<ComplianceResult> {
    const violations = [];
    const warnings = [];

    // Check trade size limits
    if (decision.quantity * (decision.price || 0) > this.config.maxTradeSize) {
      violations.push({
        rule: "max_trade_size",
        severity: "high" as const,
        message: `Trade size exceeds maximum allowed (${this.config.maxTradeSize})`,
        suggestedAction: "Reduce trade quantity",
      });
    }

    // Check if trading pair is allowed
    if (!this.config.tradingPairs.includes(decision.symbol)) {
      violations.push({
        rule: "allowed_trading_pairs",
        severity: "critical" as const,
        message: `Trading pair ${decision.symbol} is not in allowed list`,
        suggestedAction: "Use an approved trading pair",
      });
    }

    // Vincent-specific: Check social trading limits
    if (decision.quantity > 10) {
      // Social trading position limit
      warnings.push({
        rule: "social_trading_limit",
        message: "Large position size may impact social trading followers",
        recommendation:
          "Consider splitting into smaller trades for better social impact",
      });
    }

    // Check confidence threshold for social trading
    if (decision.confidence < 0.75) {
      warnings.push({
        rule: "social_confidence_threshold",
        message: "Trade confidence is below social trading threshold",
        recommendation:
          "Higher confidence recommended for social trading signals",
      });
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
    };
  }

  async reportActivity(activity: AgentActivity): Promise<void> {
    // Report to Vincent Framework and governance system
    console.log(`[${this.name}] Social Trading Activity:`, activity);
  }

  // Additional methods required by AgentsModule
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
      createdAt: new Date(), // In real implementation, this would be stored
      lastActivity: new Date().toISOString(),
      owner: "system",
      capabilities: ["social_trading", "copy_trading", "risk_management"],
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
    // In a real implementation, this would fetch from storage
    return [];
  }
}
