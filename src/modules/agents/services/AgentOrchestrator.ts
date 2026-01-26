/**
 * Agent Orchestrator Service
 * Manages multiple trading agents and coordinates their activities
 */

import {
  TradingAgent,
  TradingDecision,
  AgentActivity,
} from "../types/TradingAgent.js";
import { BaseService } from "../../../shared/services/BaseService.js";
import {
  ServiceConfig,
  DependencyHealth,
} from "../../../shared/types/index.js";
import { TradingScheduler } from "./TradingScheduler.js";
import { tradingConfig } from "../../../shared/config/index.js";

export interface OrchestrationConfig {
  maxConcurrentTrades: number;
  riskAllocationPerAgent: number;
  coordinationStrategy: "independent" | "coordinated" | "hierarchical";
  conflictResolution: "first_wins" | "highest_confidence" | "risk_weighted";
}

export interface AgentAllocation {
  agentId: string;
  allocation: number; // Percentage of total capital
  maxRisk: number;
  priority: number;
}

export class AgentOrchestrator extends BaseService {
  private agents: Map<string, TradingAgent> = new Map();
  private allocations: Map<string, AgentAllocation> = new Map();
  private activeTrades: Map<string, TradingDecision[]> = new Map();
  private orchestrationConfig: OrchestrationConfig;
  private tradingScheduler: TradingScheduler;

  constructor(config: OrchestrationConfig) {
    const serviceConfig: ServiceConfig = {
      name: "AgentOrchestrator",
      version: "1.0.0",
      environment:
        (process.env.NODE_ENV as "development" | "production" | "test") ||
        "development",
      logLevel: "info",
    };
    super(serviceConfig);
    this.orchestrationConfig = config;

    // Initialize trading scheduler
    this.tradingScheduler = new TradingScheduler({
      intervalMinutes: 10, // Trade every 10 minutes
      enabled: tradingConfig.enabled,
      maxRiskPerTrade: tradingConfig.maxRiskPerTrade,
    });
  }

  protected async onInitialize(): Promise<void> {
    // Initialize trading scheduler
    await this.tradingScheduler.initialize();

    this.logger.info("Agent Orchestrator initialized");
  }

  protected async onShutdown(): Promise<void> {
    // Stop trading scheduler
    await this.tradingScheduler.shutdown();

    // Stop all agents
    for (const agent of this.agents.values()) {
      try {
        await agent.stop();
      } catch (error) {
        this.logger.error(`Error stopping agent ${agent.id}:`, error);
      }
    }
    this.logger.info("Agent Orchestrator shut down");
  }

  protected async checkDependencies(): Promise<
    Record<string, DependencyHealth>
  > {
    return {
      agents: {
        status: "healthy",
      },
    };
  }

  async initialize(): Promise<void> {
    await super.initialize();
    this.logger.info("Agent Orchestrator initialized");
  }

  async registerAgent(
    agent: TradingAgent,
    allocation: AgentAllocation
  ): Promise<void> {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} is already registered`);
    }

    // Agent should already be initialized and started by AgentsModule
    this.agents.set(agent.id, agent);
    this.allocations.set(agent.id, allocation);
    this.activeTrades.set(agent.id, []);

    // Register with trading scheduler for automated trading
    this.tradingScheduler.registerAgent({
      id: agent.id,
      name: agent.name,
      trade: async () => {
        try {
          // If it's a Sapience agent, perform a real forecast cycle
          if (agent.type === "sapience" && (agent as any).performForecastCycle) {
              this.logger.info(`Starting real-time forecast cycle for ${agent.name}`);
              await (agent as any).performForecastCycle();
              return;
          }

          // Fallback for other agent types (placeholder/legacy)
          const decision: TradingDecision = {
            id: `auto-${Date.now()}`,
            agentId: agent.id,
            timestamp: new Date(),
            action: "buy",
            symbol: "ETH/USD",
            quantity: 10,
            price: 0,
            confidence: 0.7,
            reasoning: "Automated trading test",
            riskScore: 0.1,
          };

          await agent.executeTrade(decision);
          this.logger.info(`Automated trade executed for ${agent.name}`, {
            decision,
          });
        } catch (error) {
          this.logger.error(`Automated trade failed for ${agent.name}:`, error);
        }
      },
    });

    this.logger.info(`Registered agent: ${agent.name} (${agent.id})`);
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.stop();
    this.agents.delete(agentId);
    this.allocations.delete(agentId);
    this.activeTrades.delete(agentId);

    this.logger.info(`Unregistered agent: ${agentId}`);
  }

  async startAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.start();
    this.logger.info(`Started agent: ${agentId}`);
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.stop();
    this.logger.info(`Stopped agent: ${agentId}`);
  }

  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.pause();
    this.logger.info(`Paused agent: ${agentId}`);
  }

  async resumeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await agent.resume();
    this.logger.info(`Resumed agent: ${agentId}`);
  }

  async coordinateTrade(
    agentId: string,
    decision: TradingDecision
  ): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Check if trade conflicts with other agents
    const conflicts = await this.checkTradeConflicts(agentId, decision);
    if (conflicts.length > 0) {
      const resolution = await this.resolveConflicts(
        agentId,
        decision,
        conflicts
      );
      if (!resolution.approved) {
        this.logger.warn(
          `Trade rejected due to conflicts: ${resolution.reason}`
        );
        return false;
      }
    }

    // Check risk allocation
    const allocation = this.allocations.get(agentId);
    if (!allocation) {
      throw new Error(`No allocation found for agent ${agentId}`);
    }

    const tradeValue = decision.quantity * (decision.price || 0);
    if (tradeValue > allocation.maxRisk) {
      this.logger.warn(`Trade exceeds risk allocation for agent ${agentId}`);
      return false;
    }

    // Check concurrent trade limits
    const activeTrades = this.activeTrades.get(agentId) || [];
    if (activeTrades.length >= this.orchestrationConfig.maxConcurrentTrades) {
      this.logger.warn(
        `Agent ${agentId} has reached maximum concurrent trades`
      );
      return false;
    }

    // Approve trade
    activeTrades.push(decision);
    this.activeTrades.set(agentId, activeTrades);

    this.logger.info(
      `Trade approved for agent ${agentId}: ${decision.action} ${decision.quantity} ${decision.symbol}`
    );
    return true;
  }

  async reportTradeCompletion(agentId: string, tradeId: string): Promise<void> {
    const activeTrades = this.activeTrades.get(agentId) || [];
    const updatedTrades = activeTrades.filter(
      (trade) => `${trade.symbol}_${trade.timestamp.getTime()}` !== tradeId
    );
    this.activeTrades.set(agentId, updatedTrades);
  }

  async getAgentStatus(agentId?: string): Promise<any> {
    if (agentId) {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const allocation = this.allocations.get(agentId);
      const activeTrades = this.activeTrades.get(agentId) || [];

      return {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        allocation,
        activeTrades: activeTrades.length,
        performance: await agent.getPerformance(),
        portfolio: await agent.getPortfolio(),
      };
    }

    // Return all agents
    const statuses = [];
    for (const [id, agent] of this.agents) {
      statuses.push(await this.getAgentStatus(id));
    }
    return statuses;
  }

  private async checkTradeConflicts(
    agentId: string,
    decision: TradingDecision
  ): Promise<string[]> {
    const conflicts = [];

    for (const [otherId, otherTrades] of this.activeTrades) {
      if (otherId === agentId) continue;

      for (const trade of otherTrades) {
        // Check for opposite trades on same symbol
        if (
          trade.symbol === decision.symbol &&
          trade.action !== decision.action
        ) {
          conflicts.push(
            `Conflicting ${trade.action} order from agent ${otherId}`
          );
        }

        // Check for large trades on same symbol
        if (
          trade.symbol === decision.symbol &&
          trade.quantity > decision.quantity * 0.5
        ) {
          conflicts.push(`Large concurrent trade from agent ${otherId}`);
        }
      }
    }

    return conflicts;
  }

  private async resolveConflicts(
    agentId: string,
    decision: TradingDecision,
    conflicts: string[]
  ): Promise<{ approved: boolean; reason?: string }> {
    switch (this.orchestrationConfig.conflictResolution) {
      case "first_wins":
        return { approved: false, reason: "Another agent has priority" };

      case "highest_confidence":
        // Compare confidence with conflicting trades
        let highestConfidence = decision.confidence;
        for (const [otherId, otherTrades] of this.activeTrades) {
          if (otherId === agentId) continue;
          for (const trade of otherTrades) {
            if (
              trade.symbol === decision.symbol &&
              trade.confidence > highestConfidence
            ) {
              return {
                approved: false,
                reason: "Lower confidence than existing trade",
              };
            }
          }
        }
        return { approved: true };

      case "risk_weighted":
        const allocation = this.allocations.get(agentId);
        if (!allocation) {
          return { approved: false, reason: "No allocation found" };
        }

        // Simple risk-weighted approval based on allocation priority
        return { approved: allocation.priority > 5 };

      default:
        return {
          approved: false,
          reason: "Unknown conflict resolution strategy",
        };
    }
  }

  async getOrchestrationMetrics(): Promise<any> {
    const totalAgents = this.agents.size;
    const activeAgents = Array.from(this.agents.values()).filter(
      (a) => a.status === "active"
    ).length;
    const totalActiveTrades = Array.from(this.activeTrades.values()).reduce(
      (sum, trades) => sum + trades.length,
      0
    );

    return {
      totalAgents,
      activeAgents,
      totalActiveTrades,
      config: this.orchestrationConfig,
      allocations: Array.from(this.allocations.entries()).map(
        ([id, allocation]) => ({
          agentId: id,
          ...allocation,
        })
      ),
    };
  }

  async stop(): Promise<void> {
    // Stop all agents
    for (const agent of this.agents.values()) {
      try {
        await agent.stop();
      } catch (error) {
        this.logger.error(`Error stopping agent ${agent.id}:`, error);
      }
    }
    await this.shutdown();
  }

  async getMetrics(): Promise<any> {
    return this.getOrchestrationMetrics();
  }

  /**
   * Start automated trading for all registered agents
   */
  startAutomatedTrading(): void {
    this.tradingScheduler.start();
    this.logger.info("Automated trading started");
  }

  /**
   * Stop automated trading
   */
  stopAutomatedTrading(): void {
    this.tradingScheduler.stop();
    this.logger.info("Automated trading stopped");
  }

  /**
   * Get trading scheduler status
   */
  getTradingStatus(): any {
    return this.tradingScheduler.getStatus();
  }
}
