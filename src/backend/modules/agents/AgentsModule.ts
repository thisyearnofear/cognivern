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
  BaseAgent,
} from "../../shared/index.js";
import { TradingAgent } from "./types/TradingAgent.js";
import { UserTradingAgent } from "./implementations/UserTradingAgent.js";
import { AgentOrchestrator } from "./services/AgentOrchestrator.js";
import { TradingService } from "./services/TradingService.js";
import { GovernanceService } from "./services/GovernanceService.js";
import { getWorkerClient } from "../../services/CloudflareWorkerClient.js";
import { getDb } from "../../db/index.js";

/**
 * Database row shape for the `workspace_agents` table.
 * Mirrors the Drizzle schema in `src/backend/db/schema.ts`.
 */
interface WorkspaceAgentRow {
  id: string;
  workspace_id: string;
  name: string;
  role: string;
  status: string;
  chain: string;
  wallet_address: string | null;
  budget: string | null;
  trades: number;
  spend_history: string;
  source: string;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export class AgentsModule extends BaseService {
  private agents: Map<string, TradingAgent> = new Map();
  private orchestrator!: AgentOrchestrator;
  private tradingService!: TradingService;
  private governanceService!: GovernanceService;
  private workerClient = getWorkerClient();
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
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Check governance service
    try {
      await this.governanceService.healthCheck();
      dependencies.governanceService = { status: "healthy" };
    } catch (error) {
      dependencies.governanceService = {
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
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
          error: error instanceof Error ? error.message : String(error),
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

    // Load persisted agents from database first
    await this.loadAgentsFromDb();

    const sapienceEnabled =
      (process.env.SAPIENCE_ENABLED || "false").toLowerCase() === "true";

    if (sapienceEnabled) {
      try {
        const { SapienceTradingAgent } = await import(
          "./implementations/SapienceTradingAgent.js"
        );

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
          },
        );

        // Register agents
        this.agents.set(sapienceAgent.getId(), sapienceAgent);
        this.logger.info(
          "SapienceTradingAgent initialized and added to registry",
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error("Failed to lazy-load SapienceTradingAgent:", err);
      }
    } else {
      this.logger.info(
        "SapienceTradingAgent disabled (set SAPIENCE_ENABLED=true to enable)",
      );
    }

    // Initialize all agents
    for (const [agentId, agent] of this.agents) {
      try {
        await agent.initialize();
        await agent.start(); // Start the agent to make it active
        this.logger.info(
          `Agent ${agentId} initialized and started successfully`,
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`Failed to initialize agent ${agentId}:`, err);
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
          const err = error instanceof Error ? error : new Error(String(error));
          this.logger.error(
            `Error shutting down agent ${agent.getId()}:`,
            err,
          );
        }
      },
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
    limit = 10,
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
   * Register a new user-owned agent
   */
  async registerUserAgent(params: {
    type: string;
    name: string;
    address: string;
    description?: string;
    riskLevel?: string;
  }): Promise<Agent> {
    const id = `user-agent-${Date.now()}`;

    // Register with Cloudflare Worker if enabled
    if (this.workerClient.isEnabled()) {
      try {
        await this.workerClient.registerAgent({
          name: params.name,
          type: params.type,
          capabilities: ["user-agent", params.type],
          metadata: {
            address: params.address,
            riskLevel: params.riskLevel,
            description: params.description,
          },
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Failed to register agent with Cloudflare Worker: ${err.message}`,
        );
      }
    }

    const agent = new UserTradingAgent({
      id,
      name: params.name,
      type: params.type,
      address: params.address,
      description: params.description,
      riskLevel: params.riskLevel,
    });

    await agent.initialize();
    await agent.start();

    this.agents.set(id, agent);
    this.logger.info(`User agent ${id} registered and started`);

    // Persist to database (default-workspace for now; multi-workspace support planned)
    const workspaceId = process.env.WORKSPACE_ID || "default-workspace";
    this.persistAgent(workspaceId, id, params.name, params.type, "Ethereum", params.address, "unlimited");

    return agent.getInfo();
  }

  /**
   * Check if agents module is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Load agents from the database on startup
   */
  private async loadAgentsFromDb(): Promise<void> {
    try {
      const db = getDb();
      const agents = db.prepare(
        "SELECT * FROM workspace_agents WHERE status != 'deleted' ORDER BY created_at",
      ).all() as WorkspaceAgentRow[];

      for (const row of agents) {
        const id = row.id;
        // Skip if already in memory (from hardcoded agents)
        if (this.agents.has(id)) continue;

        const agent = new UserTradingAgent({
          id,
          name: row.name,
          type: row.role,
          address: row.wallet_address || "",
          description: row.role,
          riskLevel: "medium",
        });

        // Restore additional state
        // Status is a known union; assert it explicitly since the DB stores plain strings.
        agent.getInfo().status = row.status as BaseAgent["status"];
        agent.getInfo().chain = row.chain;
        agent.getInfo().budget = row.budget ?? undefined;
        agent.getInfo().trades = row.trades || 0;

        this.agents.set(id, agent);
        this.logger.info(`Loaded agent ${id} (${row.name}) from database`);
      }

      this.logger.info(`Loaded ${agents.length} agents from database`);
    } catch (error) {
      this.logger.warn(`Failed to load agents from database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Persist an agent to the database
   */
  private persistAgent(
    workspaceId: string,
    id: string,
    name: string,
    role: string,
    chain: string,
    walletAddress: string,
    budget: string,
  ): void {
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO workspace_agents (id, workspace_id, name, role, status, chain, wallet_address, budget, trades, spend_history, created_at, updated_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', datetime('now'), datetime('now'), 'managed')`,
      ).run(id, workspaceId, name, role, "active", chain, walletAddress, budget);
      this.logger.info(`Persisted agent ${id} (workspace: ${workspaceId}) to database`);
    } catch (error) {
      this.logger.warn(`Failed to persist agent ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
