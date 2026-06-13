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
  AgentStatus,
} from "../types/TradingAgent.js";
import { Logger } from "../../../shared/logging/Logger.js";
import {
  GovernanceClient,
  sharedGovernanceClient,
} from "../../../services/GovernanceClient.js";

const logger = new Logger("UserTradingAgent");

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
  private governance: GovernanceClient;

  constructor(
    params: {
      id: string;
      name: string;
      type: string;
      address: string;
      description?: string;
      riskLevel?: string;
      config?: TradingAgentConfig;
    },
    governance?: GovernanceClient,
  ) {
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
    this.governance = governance || sharedGovernanceClient;
  }

  async initialize(): Promise<void> {
    this.status = "inactive";
    logger.info(
      `User Agent ${this.name} (${this.id}) initialized at address ${this.address}`,
    );
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

    // Governance preview — the agent must pass through cognivern_preview_spend
    // even for simulated trades, so the audit trail reflects the intent.
    try {
      const amountUsdc = decision.price * decision.quantity;
      const preview = await this.governance.previewSpend({
        agentId: this.id,
        recipient: decision.symbol,
        amount: (amountUsdc * 1e6).toString(), // USDC 6 decimals
        asset: "USDC",
        reason: decision.reasoning || `User agent ${decision.action}`,
        metadata: {
          protocol: "user-agent",
          asset: "USDC",
          tradeType: "mint",
          side: decision.action === "buy" ? "YES" : "NO",
          amountUsdc,
          confidence: decision.confidence,
          owner: this.address,
        },
      });

      if (preview.status === "denied") {
        return {
          id: `trade_${Date.now()}`,
          decision,
          status: "failed",
          error: `governance denied: ${preview.reason}`,
          timestamp: new Date(),
        };
      }

      // For user agents the trade is still simulated (we don't have a
      // real exchange integration here), but we record it via execute_spend
      // so the audit trail is consistent.
      if (preview.attestationHash) {
        await this.governance.executeSpend({
          agentId: this.id,
          recipient: decision.symbol,
          amount: (amountUsdc * 1e6).toString(),
          asset: "USDC",
          reason: decision.reasoning || `User agent ${decision.action}`,
          metadata: {
            protocol: "user-agent",
            asset: "USDC",
            tradeType: "mint",
            side: decision.action === "buy" ? "YES" : "NO",
            amountUsdc,
            owner: this.address,
          },
          attestationHash: preview.attestationHash,
          humanConfirmationToken: `user-agent-auto-${Date.now()}`,
        });
      }
    } catch (error) {
      // Fail-closed: if governance is unreachable, the trade fails.
      return {
        id: `trade_${Date.now()}`,
        decision,
        status: "failed",
        error: `governance unreachable: ${error instanceof Error ? error.message : "unknown"}`,
        timestamp: new Date(),
      };
    }

    // Trade execution is still simulated — the point of the user agent
    // is to surface governance decisions in the dashboard, not to
    // integrate with a real exchange.
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
    const lastTimestamp =
      this.history.length > 0
        ? this.history[this.history.length - 1].timestamp
        : new Date();
    const startDate =
      lastTimestamp instanceof Date ? lastTimestamp : new Date(lastTimestamp);

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
    try {
      const result = await this.governance.evaluate({
        agentId: this.id,
        action: {
          type: "user_agent_trade_intent",
          description: `User agent ${decision.action} ${decision.symbol}`,
          input: JSON.stringify(decision),
          metadata: {
            protocol: "user-agent",
            asset: "USDC",
            tradeType: "mint",
            side: decision.action === "buy" ? "YES" : "NO",
            amountUsdc: decision.price * decision.quantity,
            confidence: decision.confidence,
            owner: this.address,
          },
        },
      });
      return {
        isCompliant: result.approved,
        violations: result.approved
          ? []
          : [
              {
                rule: result.policyId,
                severity: "high" as const,
                message: result.reason,
                suggestedAction: "review policy or override",
              },
            ],
        warnings: [],
      };
    } catch (error) {
      // Fail-closed: if governance is unreachable, deny the trade.
      return {
        isCompliant: false,
        violations: [
          {
            rule: "governance-unreachable",
            severity: "critical" as const,
            message: `governance unreachable: ${error instanceof Error ? error.message : "unknown"}`,
            suggestedAction: "verify Cognivern API is reachable and COGNIVERN_API_KEY is set",
          },
        ],
        warnings: [],
      };
    }
  }

  async reportActivity(activity: AgentActivity): Promise<void> {
    logger.debug(`Activity: ${activity.type}`, { agentId: activity.agentId });
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
      status: this.status as AgentStatus,
      config: this.config,
      createdAt: new Date(),
      lastActivity: new Date().toISOString(),
      owner: "user",
      capabilities: ["manual-trading", "user-connection"],
      registeredAt: new Date().toISOString(),
      source: "managed",
    };
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
        owner: "user",
      },
    };
  }

  async getRecentDecisions(limit: number = 10): Promise<TradingDecision[]> {
    return this.history.slice(0, limit);
  }
}
