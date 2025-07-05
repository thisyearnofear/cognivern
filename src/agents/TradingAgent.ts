import { AgentAction, AgentConfig, PolicyCheck } from "../types/Agent.js";
import {
  RecallCompetitionService,
  TradingMetrics,
} from "../services/RecallCompetitionService.js";
import { PolicyEnforcementService } from "../services/PolicyEnforcementService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { MetricsService } from "../services/MetricsService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "../utils/logger.js";

export interface TradingDecision {
  action: "buy" | "sell" | "hold";
  symbol: string;
  quantity: number;
  price: number;
  confidence: number;
  reasoning: string;
  riskScore: number;
  timestamp: string;
}

export interface TradingPolicy {
  maxPositionSize: number;
  maxRiskPerTrade: number;
  allowedSymbols: string[];
  forbiddenSymbols: string[];
  maxDailyTrades: number;
  requireHumanApproval: boolean;
  stopLossRequired: boolean;
}

export class TradingAgent {
  private config: AgentConfig;
  private recallCompetitionService: RecallCompetitionService;
  private policyEnforcementService: PolicyEnforcementService;
  private auditLogService: AuditLogService;
  private metricsService: MetricsService;
  private tradingHistory: TradingDecision[] = [];
  private currentMetrics: TradingMetrics;
  private isActive: boolean = false;

  constructor(
    agentId: string,
    recallClient: RecallClient,
    bucketAddress: Address
  ) {
    this.config = {
      name: `Trading Agent ${agentId}`,
      type: "trading",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      status: "active" as const,
      capabilities: [
        "trading-decisions",
        "risk-assessment",
        "policy-compliance",
        "performance-tracking",
        "audit-logging",
      ],
    };

    // Initialize services
    this.recallCompetitionService = new RecallCompetitionService();
    this.policyEnforcementService = new PolicyEnforcementService();
    this.auditLogService = new AuditLogService(recallClient, bucketAddress);
    this.metricsService = new MetricsService(recallClient, bucketAddress);

    // Initialize trading metrics
    this.currentMetrics = {
      totalReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      avgTradeSize: 0,
      totalTrades: 0,
      profitFactor: 0,
      volatility: 0,
    };

    logger.info(`Trading Agent ${agentId} initialized`);
  }

  /**
   * Start the trading agent with governance policies
   */
  async start(policyId: string): Promise<void> {
    try {
      // Load and enforce trading policies
      await this.policyEnforcementService.loadPolicy(policyId);

      this.isActive = true;
      logger.info(
        `Trading Agent ${this.config.name} started with policy ${policyId}`
      );

      // Log agent start action
      await this.logAction({
        id: `start-${Date.now()}`,
        type: "agent-start",
        timestamp: new Date().toISOString(),
        description: `Trading agent started with policy ${policyId}`,
        policyChecks: [],
        metadata: {
          agent: this.config.name,
          policyId,
          version: this.config.version,
        },
      });
    } catch (error) {
      logger.error(`Failed to start trading agent: ${error}`);
      throw error;
    }
  }

  /**
   * Make a trading decision with governance checks
   */
  async makeTradingDecision(
    symbol: string,
    marketData: any,
    portfolioData: any
  ): Promise<TradingDecision | null> {
    if (!this.isActive) {
      throw new Error("Trading agent is not active");
    }

    const startTime = Date.now();

    try {
      // Generate trading decision using AI/ML logic
      const decision = await this.generateTradingDecision(
        symbol,
        marketData,
        portfolioData
      );

      // Create agent action for governance check
      const action: AgentAction = {
        id: `trade-${Date.now()}`,
        type: "trading-decision",
        timestamp: new Date().toISOString(),
        description: `Trading decision: ${decision.action} ${decision.quantity} ${decision.symbol} at $${decision.price}`,
        policyChecks: [],
        metadata: {
          agent: this.config.name,
          symbol: decision.symbol,
          action: decision.action,
          quantity: decision.quantity,
          price: decision.price,
          confidence: decision.confidence,
          riskScore: decision.riskScore,
        },
      };

      // Enforce governance policies
      const policyChecks =
        await this.policyEnforcementService.evaluateAction(action);
      const isAllowed =
        await this.policyEnforcementService.enforcePolicy(action);

      // Log the action and policy checks
      await this.auditLogService.logAction(action, policyChecks, isAllowed);

      // Record metrics
      const latency = Date.now() - startTime;
      await this.metricsService.recordAction(action, policyChecks, latency);

      if (!isAllowed) {
        logger.warn(
          `Trading decision blocked by policy: ${action.description}`
        );
        return null;
      }

      // Execute the trade (in a real system, this would interact with a broker API)
      await this.executeTrade(decision);

      // Update trading history and metrics
      this.tradingHistory.push(decision);
      await this.updateTradingMetrics(decision);

      logger.info(
        `Trading decision executed: ${decision.action} ${decision.quantity} ${decision.symbol}`
      );
      return decision;
    } catch (error) {
      logger.error(`Error making trading decision: ${error}`);
      throw error;
    }
  }

  /**
   * Generate trading decision using AI/ML logic
   */
  private async generateTradingDecision(
    symbol: string,
    marketData: any,
    portfolioData: any
  ): Promise<TradingDecision> {
    // Simulate AI/ML trading logic
    const price = marketData.currentPrice || 100;
    const volatility = marketData.volatility || 0.2;
    const trend = marketData.trend || "neutral";

    // Simple decision logic (in reality, this would be much more sophisticated)
    let action: "buy" | "sell" | "hold" = "hold";
    let confidence = 0.5;
    let quantity = 0;
    let reasoning = "Market analysis inconclusive";

    if (trend === "bullish" && volatility < 0.3) {
      action = "buy";
      confidence = 0.7 + Math.random() * 0.2;
      quantity = Math.floor(Math.random() * 100) + 10;
      reasoning =
        "Bullish trend with low volatility indicates good buying opportunity";
    } else if (trend === "bearish" && portfolioData.position > 0) {
      action = "sell";
      confidence = 0.6 + Math.random() * 0.3;
      quantity = Math.min(
        portfolioData.position,
        Math.floor(Math.random() * 50) + 10
      );
      reasoning = "Bearish trend suggests selling to minimize losses";
    }

    const riskScore = this.calculateRiskScore(
      action,
      quantity,
      price,
      volatility
    );

    return {
      action,
      symbol,
      quantity,
      price,
      confidence,
      reasoning,
      riskScore,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate risk score for a trading decision
   */
  private calculateRiskScore(
    action: string,
    quantity: number,
    price: number,
    volatility: number
  ): number {
    const positionValue = quantity * price;
    const baseRisk = volatility * 100;
    const sizeRisk = Math.min(positionValue / 10000, 1) * 50; // Risk increases with position size

    return Math.min(baseRisk + sizeRisk, 100);
  }

  /**
   * Execute the trade (simulated)
   */
  private async executeTrade(decision: TradingDecision): Promise<void> {
    // In a real system, this would interact with a broker API
    // For now, we'll just simulate the execution
    logger.info(
      `Executing trade: ${decision.action} ${decision.quantity} ${decision.symbol} at $${decision.price}`
    );

    // Simulate execution delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Update trading metrics
   */
  private async updateTradingMetrics(decision: TradingDecision): Promise<void> {
    this.currentMetrics.totalTrades += 1;

    // Simulate profit/loss calculation
    const pnl =
      (Math.random() - 0.4) * decision.quantity * decision.price * 0.1;
    this.currentMetrics.totalReturn += pnl;

    // Update other metrics (simplified)
    this.currentMetrics.avgTradeSize =
      (this.currentMetrics.avgTradeSize *
        (this.currentMetrics.totalTrades - 1) +
        decision.quantity * decision.price) /
      this.currentMetrics.totalTrades;

    const winningTrades = this.tradingHistory.filter(
      (t) => this.calculatePnL(t) > 0
    ).length;
    this.currentMetrics.winRate =
      (winningTrades / this.currentMetrics.totalTrades) * 100;

    logger.info(
      `Updated trading metrics: Total trades: ${this.currentMetrics.totalTrades}, Win rate: ${this.currentMetrics.winRate.toFixed(2)}%`
    );
  }

  /**
   * Calculate P&L for a trade (simplified)
   */
  private calculatePnL(decision: TradingDecision): number {
    // Simplified P&L calculation
    return (Math.random() - 0.4) * decision.quantity * decision.price * 0.1;
  }

  /**
   * Log an action for audit purposes
   */
  private async logAction(action: AgentAction): Promise<void> {
    try {
      const policyChecks: PolicyCheck[] = [
        {
          policyId: "system-action",
          result: true,
          reason: "System action logged",
        },
      ];

      await this.auditLogService.logAction(action, policyChecks, true);
    } catch (error) {
      logger.error("Failed to log action:", error);
    }
  }

  /**
   * Get current trading metrics
   */
  getTradingMetrics(): TradingMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get trading history
   */
  getTradingHistory(): TradingDecision[] {
    return [...this.tradingHistory];
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Stop the trading agent
   */
  async stop(): Promise<void> {
    this.isActive = false;

    await this.logAction({
      id: `stop-${Date.now()}`,
      type: "agent-stop",
      timestamp: new Date().toISOString(),
      description: "Trading agent stopped",
      policyChecks: [],
      metadata: {
        agent: this.config.name,
        finalMetrics: this.currentMetrics,
      },
    });

    logger.info(`Trading Agent ${this.config.name} stopped`);
  }
}
