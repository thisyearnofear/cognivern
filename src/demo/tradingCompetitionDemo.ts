import { TradingCompetitionGovernanceService } from "../services/TradingCompetitionGovernanceService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "../utils/logger.js";

/**
 * Enhanced Demo: AI Agent Governance on Filecoin's Sovereign Data Layer
 *
 * This demonstrates:
 * - Real trading execution via Recall's Trading API
 * - Immutable governance storage on Filecoin Virtual Machine
 * - Real-time policy enforcement for trading decisions
 * - Comprehensive audit trails for regulatory compliance
 * - Performance monitoring and risk management
 * - Automated governance actions (warnings, suspensions, disqualifications)
 * - Cryptographic proofs of AI decision-making
 */

interface DemoConfig {
  competitionId: string;
  numberOfAgents: number;
  numberOfRounds: number;
  roundInterval: number; // milliseconds
}

export class TradingCompetitionDemo {
  private governanceService: TradingCompetitionGovernanceService;
  private isRunning: boolean = false;

  constructor(recallClient: RecallClient, bucketAddress: Address) {
    this.governanceService = new TradingCompetitionGovernanceService(
      recallClient,
      bucketAddress
    );
  }

  /**
   * Run the complete trading competition demo
   */
  async runDemo(config: DemoConfig): Promise<void> {
    logger.info("🚀 Starting Trading Competition Governance Demo");
    logger.info(`📊 Competition: ${config.competitionId}`);
    logger.info(`🤖 Agents: ${config.numberOfAgents}`);
    logger.info(`🔄 Rounds: ${config.numberOfRounds}`);

    try {
      // Step 1: Start the governed competition
      await this.startCompetition(config.competitionId);

      // Step 2: Register trading agents
      await this.registerAgents(config.competitionId, config.numberOfAgents);

      // Step 3: Run trading rounds with governance oversight
      await this.runTradingRounds(config);

      // Step 4: Show final results and governance summary
      await this.showResults(config.competitionId);
    } catch (error) {
      logger.error("Demo failed:", error);
      throw error;
    } finally {
      // Cleanup
      await this.cleanup(config.competitionId);
    }
  }

  /**
   * Start a governed trading competition
   */
  private async startCompetition(competitionId: string): Promise<void> {
    logger.info("📋 Starting governed trading competition...");

    const governanceConfig = {
      maxAgents: 10,
      tradingPolicyId: "trading-competition-policy",
      riskLimits: {
        maxDailyLoss: 10000,
        maxPositionSize: 50000,
        maxRiskScore: 85,
      },
      complianceThresholds: {
        minComplianceScore: 70,
        maxViolations: 3,
      },
      monitoringInterval: 5000, // 5 seconds
    };

    await this.governanceService.startGovernedCompetition(
      competitionId,
      governanceConfig
    );
    logger.info("✅ Competition started with governance policies active");
  }

  /**
   * Register multiple trading agents
   */
  private async registerAgents(
    competitionId: string,
    numberOfAgents: number
  ): Promise<void> {
    logger.info(`🤖 Registering ${numberOfAgents} trading agents...`);

    const agentConfig = {
      maxAgents: 10,
      tradingPolicyId: "trading-competition-policy",
      riskLimits: {
        maxDailyLoss: 10000,
        maxPositionSize: 50000,
        maxRiskScore: 85,
      },
      complianceThresholds: {
        minComplianceScore: 70,
        maxViolations: 3,
      },
      monitoringInterval: 5000,
    };

    for (let i = 1; i <= numberOfAgents; i++) {
      const agentId = `trading-agent-${i}`;
      try {
        await this.governanceService.registerAgent(
          competitionId,
          agentId,
          agentConfig
        );
        logger.info(`✅ Registered ${agentId}`);
      } catch (error) {
        logger.error(`❌ Failed to register ${agentId}:`, error);
      }
    }
  }

  /**
   * Run trading rounds with governance oversight
   */
  private async runTradingRounds(config: DemoConfig): Promise<void> {
    logger.info(`🔄 Starting ${config.numberOfRounds} trading rounds...`);
    this.isRunning = true;

    for (
      let round = 1;
      round <= config.numberOfRounds && this.isRunning;
      round++
    ) {
      logger.info(
        `\n📈 === Trading Round ${round}/${config.numberOfRounds} ===`
      );

      // Generate realistic market data
      const marketData = this.generateMarketData(round);

      try {
        // Execute trading round with governance
        const result = await this.governanceService.executeTradingRound(
          config.competitionId,
          marketData
        );

        // Log round results
        this.logRoundResults(round, result);

        // Show governance events
        if (result.violations.length > 0) {
          logger.warn(
            `⚠️  ${result.violations.length} governance violations detected:`
          );
          result.violations.forEach((violation) => {
            logger.warn(`   - ${violation.agentId}: ${violation.message}`);
          });
        }

        // Show current rankings
        logger.info("🏆 Current Rankings:");
        result.rankings.slice(0, 5).forEach((agent, index) => {
          const status =
            agent.status === "active"
              ? "🟢"
              : agent.status === "suspended"
                ? "🟡"
                : "🔴";
          logger.info(
            `   ${index + 1}. ${status} ${agent.agent.getConfig().name} - Score: ${agent.score.toFixed(2)} (Compliance: ${agent.complianceScore}%)`
          );
        });
      } catch (error) {
        logger.error(`❌ Error in round ${round}:`, error);
      }

      // Wait before next round
      if (round < config.numberOfRounds) {
        await new Promise((resolve) =>
          setTimeout(resolve, config.roundInterval)
        );
      }
    }
  }

  /**
   * Generate realistic market data for trading simulation
   */
  private generateMarketData(round: number): any {
    const symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "NVDA"];
    const basePrice = 100 + round * 2; // Trending upward
    const volatility = 0.1 + Math.random() * 0.3; // 10-40% volatility

    return {
      round,
      timestamp: new Date().toISOString(),
      currentPrice: basePrice + (Math.random() - 0.5) * basePrice * volatility,
      volatility,
      trend: Math.random() > 0.5 ? "bullish" : "bearish",
      volume: Math.floor(Math.random() * 1000000) + 100000,
      symbols,
      marketConditions: {
        vix: 15 + Math.random() * 20, // Volatility index
        sentiment: Math.random() > 0.5 ? "positive" : "negative",
      },
    };
  }

  /**
   * Log trading round results
   */
  private logRoundResults(round: number, result: any): void {
    logger.info(`📊 Round ${round} Results:`);
    logger.info(`   💰 Trades executed: ${result.decisions.length}`);
    logger.info(`   ⚠️  Violations: ${result.violations.length}`);
    logger.info(
      `   🤖 Active agents: ${result.rankings.filter((a: any) => a.status === "active").length}`
    );

    if (result.decisions.length > 0) {
      const totalVolume = result.decisions.reduce(
        (sum: number, d: any) => sum + d.quantity * d.price,
        0
      );
      logger.info(`   📈 Total volume: $${totalVolume.toFixed(2)}`);
    }
  }

  /**
   * Show final competition results and governance summary
   */
  private async showResults(competitionId: string): Promise<void> {
    logger.info("\n🏁 === FINAL COMPETITION RESULTS ===");

    const status = this.governanceService.getCompetitionStatus(competitionId);

    // Final rankings
    logger.info("\n🏆 Final Rankings:");
    status.agents.forEach((agent, index) => {
      const statusIcon =
        agent.status === "active"
          ? "🟢"
          : agent.status === "suspended"
            ? "🟡"
            : "🔴";
      const metrics = agent.metrics;

      logger.info(
        `${index + 1}. ${statusIcon} ${agent.agent.getConfig().name}`
      );
      logger.info(
        `   Score: ${agent.score.toFixed(2)} | Compliance: ${agent.complianceScore}%`
      );
      logger.info(
        `   Return: ${metrics.totalReturn.toFixed(2)}% | Win Rate: ${metrics.winRate.toFixed(1)}%`
      );
      logger.info(
        `   Trades: ${metrics.totalTrades} | Violations: ${agent.violations}`
      );
    });

    // Governance summary
    logger.info("\n📋 Governance Summary:");
    logger.info(`   Total Agents: ${status.summary.totalAgents}`);
    logger.info(`   Active: ${status.summary.activeAgents}`);
    logger.info(`   Suspended: ${status.summary.suspendedAgents}`);
    logger.info(`   Total Violations: ${status.summary.totalViolations}`);
    logger.info(
      `   Avg Compliance Score: ${status.summary.avgComplianceScore.toFixed(1)}%`
    );

    // Recent governance events
    logger.info("\n⚠️  Recent Governance Events:");
    const recentEvents = status.events.slice(-10);
    recentEvents.forEach((event) => {
      const severityIcon =
        event.severity === "critical"
          ? "🔴"
          : event.severity === "high"
            ? "🟠"
            : event.severity === "medium"
              ? "🟡"
              : "🟢";
      logger.info(`   ${severityIcon} ${event.type}: ${event.message}`);
      if (event.action_taken) {
        logger.info(`      Action: ${event.action_taken}`);
      }
    });

    logger.info("\n✅ Demo completed successfully!");
    logger.info("🔍 Key Governance Features Demonstrated:");
    logger.info("   ✓ Real-time policy enforcement");
    logger.info("   ✓ Automated compliance monitoring");
    logger.info("   ✓ Risk management controls");
    logger.info("   ✓ Comprehensive audit trails");
    logger.info("   ✓ Performance tracking");
    logger.info("   ✓ Automated governance actions");
  }

  /**
   * Cleanup competition resources
   */
  private async cleanup(competitionId: string): Promise<void> {
    logger.info("🧹 Cleaning up competition resources...");
    this.isRunning = false;

    try {
      await this.governanceService.stopCompetition(competitionId);
      logger.info("✅ Cleanup completed");
    } catch (error) {
      logger.error("❌ Cleanup failed:", error);
    }
  }

  /**
   * Stop the demo
   */
  stop(): void {
    logger.info("🛑 Stopping demo...");
    this.isRunning = false;
  }
}

/**
 * Run the demo if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = async () => {
    try {
      const recallClient = new RecallClient();
      const bucketAddress = (process.env.RECALL_BUCKET_ADDRESS ||
        "0x0000000000000000000000000000000000000000") as Address;

      const tradingDemo = new TradingCompetitionDemo(
        recallClient,
        bucketAddress
      );

      const config: DemoConfig = {
        competitionId: "demo-trading-competition-2024",
        numberOfAgents: 5,
        numberOfRounds: 10,
        roundInterval: 3000, // 3 seconds between rounds
      };

      await tradingDemo.runDemo(config);
    } catch (error) {
      logger.error("Demo execution failed:", error);
      process.exit(1);
    }
  };

  demo();
}
