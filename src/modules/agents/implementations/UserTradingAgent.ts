/**
 * User Trading Agent Implementation
 *
 * A generic agent implementation for user-owned/connected agents.
 * Follows DRY + ENHANCEMENT FIRST principles by providing a base for external agent connections.
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
  AgentType,
} from "../types/TradingAgent.js";

export class UserTradingAgent implements TradingAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly type: AgentType;
  public status: "active" | "inactive" | "paused" | "error" = "inactive";
  public config: TradingAgentConfig;
  public readonly owner: string = "user";

  private portfolio: Portfolio | null = null;
  private history: TradingDecision[] = [];
  private description?: string;
  private riskLevel: string = "medium";
  private address: string;

  constructor(params: {
    id: string;
    name: string;
    type: string;
    address: string;
    description?: string;
    riskLevel?: string;
    config?: TradingAgentConfig;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.type = params.type as AgentType;
    this.address = params.address;
    this.description = params.description;
    this.riskLevel = params.riskLevel || "medium";
    this.config = params.config || {
      maxTradeSize: 100,
      riskTolerance: 0.05,
      tradingPairs: [],
      strategies: ["manual"],
      governanceRules: [],
    };
  }

  async initialize(): Promise<void> {
    this.status = "inactive";
    console.log(`User Agent ${this.name} (${this.id}) initialized at address ${this.address}`);
  }

  async start(): Promise<void> {
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
  }

  async resume(): Promise<void> {
    this.status = "active";
  }

  async executeTrade(decision: TradingDecision): Promise<TradeResult> {
    if (this.status !== "active") {
      throw new Error("Agent is not active");
    }

    const compliance = await this.checkCompliance(decision);
    if (!compliance.isCompliant) {
      return {
        id: `trade_${Date.now()}`,
        decision,
        status: "failed",
        error: `Compliance violation: ${compliance.violations[0]?.message}`,
        timestamp: new Date(),
      };
    }

    // Simulate trade execution
    const tradeResult: TradeResult = {
      id: `trade_${Date.now()}`,
      decision,
      status: "executed",
      executedPrice: decision.price,
      executedQuantity: decision.quantity,
      fees: decision.price * decision.quantity * 0.001,
      timestamp: new Date(),
    };

    this.history.unshift(decision);
    if (this.history.length > 50) this.history.pop();

    await this.reportActivity({
      agentId: this.id,
      type: "trade",
      data: tradeResult,
      timestamp: new Date(),
    });

    return tradeResult;
  }

  async getPortfolio(): Promise<Portfolio> {
    if (!this.portfolio) {
      this.portfolio = {
        totalValue: 1000, // Initial simulated balance
        cash: 1000,
        positions: [],
        lastUpdated: new Date(),
      };
    }
    return this.portfolio;
  }

  async getPerformance(): Promise<PerformanceMetrics> {
    const lastTimestamp = this.history.length > 0 ? this.history[this.history.length - 1].timestamp : new Date();
    const startDate = lastTimestamp instanceof Date ? lastTimestamp : new Date(lastTimestamp);

    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: this.history.length,
      profitableTrades: 0,
      averageTradeReturn: 0,
      period: {
        start: startDate,
        end: new Date(),
      },
    };
  }

  async checkCompliance(decision: TradingDecision): Promise<ComplianceResult> {
    return {
      isCompliant: true,
      violations: [],
      warnings: [],
    };
  }

  async reportActivity(activity: AgentActivity): Promise<void> {
    console.log(`[User Agent: ${this.name}]`, activity);
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
      status: this.status as any,
      config: this.config,
      createdAt: new Date(),
      lastActivity: new Date().toISOString(),
      owner: "user",
      capabilities: ["manual-trading", "user-connection"],
      description: this.description,
      address: this.address,
      registeredAt: new Date().toISOString(),
    } as any;
  }

  async getStatus(): Promise<any> {
    return {
      id: this.id,
      status: this.status,
      isHealthy: await this.isHealthy(),
      lastHeartbeat: new Date(),
      internalThought: "Awaiting instructions...",
      thoughtHistory: [],
      nextActionAt: null,
      performance: await this.getPerformance(),
      portfolio: await this.getPortfolio(),
      metadata: {
        riskLevel: this.riskLevel,
        address: this.address,
        owner: "user"
      }
    };
  }

  async getRecentDecisions(limit: number = 10): Promise<TradingDecision[]> {
    return this.history.slice(0, limit);
  }
}
