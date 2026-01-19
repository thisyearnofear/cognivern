/**
 * Agents Module - Unified Agent Management
 *
 * This module manages all trading agents with:
 * - DRY agent architecture
 * - Shared trading logic
 * - Centralized governance
 * - Modular agent types
 */

import { BaseService } from "../../shared/services/BaseService.js";
import {
  ServiceConfig,
  DependencyHealth,
  Agent,
  TradingDecision,
} from "../../shared/index.js";
import { tradingConfig } from "../../shared/config/index.js";
import { TradingAgent } from "./types/TradingAgent.js";
import { SapienceTradingAgent } from "./implementations/SapienceTradingAgent.js";
import { AgentOrchestrator } from "./services/AgentOrchestrator.js";
import { TradingService } from "./services/TradingService.js";
import { GovernanceService } from "./services/GovernanceService.js";

export class AgentsModule extends BaseService {
  private agents: Map<string, TradingAgent> = new Map();
  private orchestrator: AgentOrchestrator;
  private tradingService: TradingService;
  private governanceService: GovernanceService;
  private isRunning = false;

  constructor() {
    const config: ServiceConfig = {
      name: "agents",
      version: "1.0.0",
      environment: (process.env.NODE_ENV as any) || "development",
      logLevel: "info",
    };

    super(config);
  }

  protected async onInitialize(): Promise<void> {
    await this.initializeServices();
    await this.initializeAgents();
    await this.startOrchestrator();
  }

  protected async onShutdown(): Promise<void> {
    await this.stopOrchestrator();
    await this.shutdownAgents();
    await this.shutdownServices();
  }

  protected async checkDependencies(): Promise<
    Record<string, DependencyHealth>
  > {
    const dependencies: Record<string, DependencyHealth> = {};

    // Check trading service
    try {
      await this.tradingService.healthCheck();
      dependencies.tradingService = { status: "healthy" };
    } catch (error) {
      dependencies.tradingService = {
        status: "unhealthy",
        error: error.message,
      };
    }

    // Check governance service
    try {
      await this.governanceService.healthCheck();
      dependencies.governanceService = { status: "healthy" };
    } catch (error) {
      dependencies.governanceService = {
        status: "unhealthy",
        error: error.message,
      };
    }

    // Check individual agents
    for (const [agentId, agent] of this.agents) {
      try {
        const isHealthy = await agent.isHealthy();
        dependencies[`agent_${agentId}`] = {
          status: isHealthy ? "healthy" : "unhealthy",
        };
      } catch (error) {
        dependencies[`agent_${agentId}`] = {
          status: "unhealthy",
          error: error.message,
        };
      }
    }

    return dependencies;
  }

  private async initializeServices(): Promise<void> {
    this.logger.info("Initializing agent services...");

    // Initialize shared services
    this.tradingService = new TradingService();
    this.governanceService = new GovernanceService();
    this.orchestrator = new AgentOrchestrator({
      maxConcurrentTrades: 5,
      riskAllocationPerAgent: 0.2,
      coordinationStrategy: "independent",
      conflictResolution: "highest_confidence",
    });

    await this.tradingService.initialize();
    await this.governanceService.initialize();
    await this.orchestrator.initialize();
  }

  private async initializeAgents(): Promise<void> {
    this.logger.info("Initializing trading agents...");

    // Initialize Sapience Trading Agent
    const sapienceAgent = new SapienceTradingAgent(
      "sapience-agent-1",
      "Sapience Forecasting Agent",
      {
        maxTradeSize: 1000,
        riskTolerance: 0.1,
        tradingPairs: ["ETH/USD", "BTC/USD"], // Can be market IDs
        strategies: ["forecasting"],
        governanceRules: [],
      }
    );

    // Register agents
    this.agents.set(sapienceAgent.getId(), sapienceAgent);

    // Initialize all agents
    for (const [agentId, agent] of this.agents) {
      try {
        await agent.initialize();
        await agent.start(); // Start the agent to make it active
        this.logger.info(
          `Agent ${agentId} initialized and started successfully`
        );
      } catch (error) {
        this.logger.error(`Failed to initialize agent ${agentId}:`, error);
        // Remove failed agent
        this.agents.delete(agentId);
      }
    }

    this.logger.info(`${this.agents.size} agents initialized successfully`);
  }

  private async startOrchestrator(): Promise<void> {
    if (this.agents.size === 0) {
      this.logger.warn("No agents available to orchestrate");
      return;
    }

    this.logger.info("Starting agent orchestrator...");

    // Register all agents with orchestrator
    for (const agent of this.agents.values()) {
      await this.orchestrator.registerAgent(agent, {
        agentId: agent.getId(),
        allocation: 1.0, // 100% allocation
        maxRisk: 1000,
        priority: 5,
      });
    }

    // Start automated trading
    this.orchestrator.startAutomatedTrading();
    this.isRunning = true;

    this.logger.info("Agent orchestrator started successfully");
  }

  private async stopOrchestrator(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info("Stopping agent orchestrator...");
    await this.orchestrator.stop();
    this.isRunning = false;
    this.logger.info("Agent orchestrator stopped");
  }

  private async shutdownAgents(): Promise<void> {
    this.logger.info("Shutting down agents...");

    const shutdownPromises = Array.from(this.agents.values()).map(
      async (agent) => {
        try {
          await agent.shutdown();
          this.logger.debug(`Agent ${agent.getId()} shut down successfully`);
        } catch (error) {
          this.logger.error(
            `Error shutting down agent ${agent.getId()}:`,
            error
          );
        }
      }
    );

    await Promise.allSettled(shutdownPromises);
    this.agents.clear();
    this.logger.info("All agents shut down");
  }

  private async shutdownServices(): Promise<void> {
    this.logger.info("Shutting down agent services...");

    if (this.orchestrator) {
      await this.orchestrator.shutdown();
    }

    if (this.tradingService) {
      await this.tradingService.shutdown();
    }

    if (this.governanceService) {
      await this.governanceService.shutdown();
    }

    this.logger.info("Agent services shut down");
  }

  /**
   * Get all registered agents
   */
  getAgents(): Agent[] {
    return Array.from(this.agents.values()).map((agent) => agent.getInfo());
  }

  /**
   * Get specific agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    const agent = this.agents.get(agentId);
    return agent ? agent.getInfo() : undefined;
  }

  /**
   * Get agent status
   */
  async getAgentStatus(agentId: string): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return await agent.getStatus();
  }

  /**
   * Get agent trading decisions
   */
  async getAgentDecisions(
    agentId: string,
    limit = 10
  ): Promise<TradingDecision[]> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    return await agent.getRecentDecisions(limit);
  }

  /**
   * Get orchestrator metrics
   */
  getOrchestratorMetrics(): any {
    return this.orchestrator ? this.orchestrator.getMetrics() : null;
  }

  /**
   * Check if agents module is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}