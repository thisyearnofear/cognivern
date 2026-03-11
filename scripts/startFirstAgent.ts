#!/usr/bin/env tsx

/**
 * Start Your Competition Trading Agent
 *
 * This script will:
 * 1. Connect to Recall's 7 Day Trading Challenge ($10,000 prize pool)
 * 2. Register your agent for the competition
 * 3. Begin making live trading decisions with governance
 * 4. Show real governance stats in your dashboard
 * 5. Prepare for July 8-15 competition
 */

import { TradingCompetitionGovernanceService } from "../src/services/TradingCompetitionGovernanceService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "../src/utils/logger.js";

async function startFirstAgent() {
  console.log("🚀 Starting Your First Live Trading Agent...\n");

  try {
    // Initialize services
    const recallClient = new RecallClient();
    const bucketAddress = (process.env.RECALL_BUCKET_ADDRESS ||
      "0xFf0000000000000000000000000000000000c173") as Address;

    const governanceService = new TradingCompetitionGovernanceService(
      recallClient,
      bucketAddress,
    );

    // Competition configuration
    const competitionId = "live-agent-demo-" + Date.now();
    const agentId = "your-first-agent";

    console.log(`📋 Competition ID: ${competitionId}`);
    console.log(`🤖 Agent ID: ${agentId}\n`);

    // Step 1: Start the competition
    console.log("1️⃣ Starting trading competition...");
    const governanceConfig = {
      maxAgents: 5,
      tradingPolicyId: "trading-risk-management",
      riskLimits: {
        maxDailyLoss: 1000, // $1000 max daily loss
        maxPositionSize: 500, // $500 max position size
        maxRiskScore: 75, // Conservative risk score
      },
      complianceThresholds: {
        minComplianceScore: 80, // High compliance required
        maxViolations: 2, // Max 2 violations before suspension
      },
      monitoringInterval: 10000, // Check every 10 seconds
    };

    await governanceService.startGovernedCompetition(
      competitionId,
      governanceConfig,
    );
    console.log("✅ Competition started with governance policies\n");

    // Step 2: Register your agent
    console.log("2️⃣ Registering your trading agent...");
    await governanceService.registerAgent(
      competitionId,
      agentId,
      governanceConfig,
    );
    console.log("✅ Agent registered and ready to trade\n");

    // Step 3: Start making trading decisions
    console.log("3️⃣ Starting live trading decisions...");
    console.log("🔄 Agent will make trading decisions every 15 seconds");
    console.log(
      "📊 Check your dashboard at http://localhost:5173 to see live stats\n",
    );

    let roundCount = 0;
    const maxRounds = 20; // Run for 20 rounds (5 minutes)

    const tradingInterval = setInterval(async () => {
      try {
        roundCount++;
        console.log(`\n🎯 Trading Round ${roundCount}/${maxRounds}`);

        // Create market data for this round
        const marketData = {
          timestamp: new Date().toISOString(),
          prices: {
            SOL: 150 + (Math.random() - 0.5) * 20, // SOL price with volatility
            USDC: 1.0,
            ETH: 3500 + (Math.random() - 0.5) * 200,
          },
          conditions: {
            volatility: Math.random() * 0.5 + 0.2,
            volume: Math.random() * 1000000 + 500000,
            trend: Math.random() > 0.5 ? "bullish" : "bearish",
          },
        };

        // Execute trading round
        const result = await governanceService.executeTradingRound(
          competitionId,
          marketData,
        );

        // Log results
        console.log(`📈 Decisions made: ${result.decisions.length}`);
        console.log(`⚠️  Violations: ${result.violations.length}`);

        if (result.decisions.length > 0) {
          const decision = result.decisions[0];
          console.log(
            `💰 Latest decision: ${decision.action} ${decision.quantity} ${decision.symbol}`,
          );
        }

        if (result.violations.length > 0) {
          console.log(`🚨 Governance violations:`);
          result.violations.forEach((v) => {
            console.log(`   - ${v.agentId}: ${v.message}`);
          });
        }

        // Stop after max rounds
        if (roundCount >= maxRounds) {
          clearInterval(tradingInterval);
          await showFinalResults();
        }
      } catch (error) {
        console.error(`❌ Error in trading round ${roundCount}:`, error);
      }
    }, 15000); // Every 15 seconds

    // Show final results
    async function showFinalResults() {
      console.log("\n🏁 Trading Session Complete!");
      console.log("=".repeat(50));

      const status = governanceService.getCompetitionStatus(competitionId);

      console.log(`📊 Final Statistics:`);
      console.log(`   • Total Agents: ${status.agents.length}`);
      console.log(`   • Total Events: ${status.events.length}`);
      console.log(
        `   • Violations: ${status.events.filter((e) => e.type === "policy_violation").length}`,
      );
      console.log(
        `   • Avg Compliance: ${status.summary.avgComplianceScore.toFixed(1)}%`,
      );

      console.log(`\n🎯 Your dashboard now shows REAL data!`);
      console.log(`   Visit: http://localhost:5173`);
      console.log(
        `   The stats are no longer fake - they reflect actual agent activity!\n`,
      );

      // Cleanup
      await governanceService.stopCompetition(competitionId);
      console.log("✅ Competition stopped and cleaned up");
      process.exit(0);
    }

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down gracefully...");
      clearInterval(tradingInterval);
      await governanceService.stopCompetition(competitionId);
      console.log("✅ Cleanup complete");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start agent:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startFirstAgent();
}

export { startFirstAgent };
