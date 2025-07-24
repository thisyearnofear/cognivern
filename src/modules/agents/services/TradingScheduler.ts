import { BaseService } from "../../../shared/services/BaseService.js";
import {
  ServiceConfig,
  DependencyHealth,
} from "../../../shared/types/index.js";
import { tradingConfig } from "../../../shared/config/index.js";
import logger from "../../../utils/logger.js";

export interface TradingSchedulerConfig {
  intervalMinutes: number;
  enabled: boolean;
  maxRiskPerTrade: number;
}

export class TradingScheduler extends BaseService {
  private intervalId: NodeJS.Timeout | null = null;
  private schedulerConfig: TradingSchedulerConfig;
  private agents: Array<{
    id: string;
    name: string;
    trade: () => Promise<void>;
  }> = [];

  constructor(config: TradingSchedulerConfig) {
    const serviceConfig: ServiceConfig = {
      name: "TradingScheduler",
      version: "1.0.0",
      environment:
        (process.env.NODE_ENV as "development" | "production" | "test") ||
        "development",
      logLevel: "info",
    };
    super(serviceConfig);
    this.schedulerConfig = config;
  }

  protected async onInitialize(): Promise<void> {
    logger.info("Trading Scheduler initialized", {
      intervalMinutes: this.schedulerConfig.intervalMinutes,
      enabled: this.schedulerConfig.enabled,
      maxRiskPerTrade: this.schedulerConfig.maxRiskPerTrade,
    });
  }

  protected async checkDependencies(): Promise<
    Record<string, DependencyHealth>
  > {
    return {
      scheduler: {
        status: "healthy",
      },
    };
  }

  protected async onShutdown(): Promise<void> {
    this.stop();
    logger.info("Trading Scheduler shut down");
  }

  public registerAgent(agent: {
    id: string;
    name: string;
    trade: () => Promise<void>;
  }): void {
    this.agents.push(agent);
    logger.info(`Registered trading agent: ${agent.name} (${agent.id})`);
  }

  public start(): void {
    if (!this.schedulerConfig.enabled) {
      logger.info("Trading scheduler disabled");
      return;
    }

    if (this.intervalId) {
      logger.warn("Trading scheduler already running");
      return;
    }

    const intervalMs = this.schedulerConfig.intervalMinutes * 60 * 1000;

    logger.info(
      `Starting trading scheduler - trades every ${this.schedulerConfig.intervalMinutes} minutes`
    );

    // Execute first trade immediately
    this.executeTrades();

    // Schedule recurring trades
    this.intervalId = setInterval(() => {
      this.executeTrades();
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info("Trading scheduler stopped");
    }
  }

  private async executeTrades(): Promise<void> {
    if (this.agents.length === 0) {
      logger.warn("No trading agents registered");
      return;
    }

    logger.info(`Executing trades for ${this.agents.length} agents`);

    for (const agent of this.agents) {
      try {
        logger.info(`Executing trade for agent: ${agent.name}`);
        await agent.trade();
        logger.info(`Trade completed for agent: ${agent.name}`);
      } catch (error) {
        logger.error(`Trade failed for agent: ${agent.name}`, {
          error: error instanceof Error ? error.message : String(error),
          agentId: agent.id,
        });
      }
    }
  }

  public getStatus(): {
    enabled: boolean;
    running: boolean;
    intervalMinutes: number;
    registeredAgents: number;
    nextTradeIn?: number;
  } {
    return {
      enabled: this.schedulerConfig.enabled,
      running: this.intervalId !== null,
      intervalMinutes: this.schedulerConfig.intervalMinutes,
      registeredAgents: this.agents.length,
    };
  }
}
