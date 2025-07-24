#!/usr/bin/env tsx

/**
 * 7 Day Trading Challenge Competition Agent
 * 
 * $10,000 Prize Pool Competition (July 8-15, 2025)
 * 
 * This agent will:
 * - Connect to Recall's competition API
 * - Make at least 3 trades per day (competition requirement)
 * - Include reasoning for each trade decision
 * - Maintain governance and compliance
 * - Track performance for leaderboard
 */

import { RealTradingAgent } from "../src/agents/RealTradingAgent.js";
import { RecallTradingService } from "../src/services/RecallTradingService.js";
import { PolicyEnforcementService } from "../src/services/PolicyEnforcementService.js";
import { AuditLogService } from "../src/services/AuditLogService.js";
import { MetricsService } from "../src/services/MetricsService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "../src/utils/logger.js";

interface CompetitionConfig {
  agentName: string;
  competitionId: string;
  minTradesPerDay: number;
  maxRiskPerTrade: number;
  targetReturn: number;
}

async function startCompetitionAgent() {
  console.log("🏆 Starting 7 Day Trading Challenge Agent");
  console.log("💰 Prize Pool: $10,000");
  console.log("📅 Competition: July 8-15, 2025\n");

  // Check environment
  const apiKey = process.env.RECALL_TRADING_API_KEY;
  if (!apiKey || apiKey === 'your_recall_trading_api_key_here') {
    console.error("❌ Please set your RECALL_TRADING_API_KEY in .env");
    console.log("   1. Register at: https://competitions.recall.network");
    console.log("   2. Get your API key from the account page");
    console.log("   3. Update RECALL_TRADING_API_KEY in .env");
    process.exit(1);
  }

  try {
    // Initialize services
    const recallClient = new RecallClient();
    const bucketAddress = (process.env.RECALL_BUCKET_ADDRESS || 
      "0xFf0000000000000000000000000000000000c173") as Address;

    const tradingService = new RecallTradingService();
    const policyService = new PolicyEnforcementService();
    const auditService = new AuditLogService(recallClient, bucketAddress);
    const metricsService = new MetricsService(recallClient, bucketAddress);

    // Competition configuration
    const config: CompetitionConfig = {
      agentName: "Cognivern-Governance-Agent",
      competitionId: "7-day-trading-challenge-2025",
      minTradesPerDay: 3,        // Competition requirement
      maxRiskPerTrade: 0.05,     // 5% max risk per trade
      targetReturn: 0.15,        // 15% target return
    };

    console.log(`🤖 Agent: ${config.agentName}`);
    console.log(`🎯 Target: ${config.targetReturn * 100}% return`);
    console.log(`⚠️  Max risk per trade: ${config.maxRiskPerTrade * 100}%\n`);

    // Create and configure the trading agent
    const agentConfig = {
      name: config.agentName,
      version: "1.0.0",
      description: "AI Governance-enabled trading agent for Recall competition",
      capabilities: ["real-trading", "governance", "risk-management"],
      riskTolerance: "conservative",
      maxPositionSize: 1000,     // $1000 max position
      stopLoss: 0.02,           // 2% stop loss
      takeProfit: 0.05,         // 5% take profit
    };

    const agent = new RealTradingAgent(
      agentConfig,
      tradingService,
      policyService,
      auditService,
      metricsService,
      recallClient,
      bucketAddress
    );

    // Start the agent with trading policies
    console.log("🚀 Starting agent with governance policies...");
    await agent.start("trading-risk-management");
    console.log("✅ Agent started and ready for competition\n");

    // Competition trading loop
    let tradesPerDay = 0;
    let totalTrades = 0;
    let dayStartTime = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    console.log("📊 Beginning competition trading...");
    console.log("🔄 Making trades every 2 hours to meet 3+ trades/day requirement");
    console.log("📈 Monitor your performance at: https://competitions.recall.network\n");

    const tradingInterval = setInterval(async () => {
      try {
        // Check if we need to reset daily trade counter
        if (Date.now() - dayStartTime > oneDayMs) {
          console.log(`\n📅 New day started. Yesterday's trades: ${tradesPerDay}`);
          if (tradesPerDay < config.minTradesPerDay) {
            console.warn(`⚠️  Warning: Only made ${tradesPerDay} trades yesterday (minimum: ${config.minTradesPerDay})`);
          }
          tradesPerDay = 0;
          dayStartTime = Date.now();
        }

        // Make trading decision
        console.log(`\n🎯 Making trading decision ${totalTrades + 1}...`);
        const result = await agent.makeRealTradingDecision();

        if (result) {
          totalTrades++;
          tradesPerDay++;

          console.log(`✅ Trade decision made:`);
          console.log(`   Action: ${result.decision.action}`);
          console.log(`   Reasoning: ${result.decision.reasoning}`);
          console.log(`   Risk Score: ${result.decision.riskScore}`);
          console.log(`   Approved: ${result.approved ? '✅' : '❌'}`);

          if (result.execution?.success) {
            console.log(`💰 Trade executed successfully!`);
            console.log(`   Transaction: ${result.execution.transaction.id}`);
          } else if (result.execution) {
            console.log(`❌ Trade execution failed: ${result.execution.transaction.error}`);
          }

          // Log governance compliance
          const violations = result.policyChecks.filter(check => !check.passed);
          if (violations.length > 0) {
            console.log(`🚨 Policy violations: ${violations.length}`);
            violations.forEach(v => console.log(`   - ${v.policyId}: ${v.reason}`));
          }

          console.log(`📊 Daily progress: ${tradesPerDay}/${config.minTradesPerDay} trades`);
        }

      } catch (error) {
        console.error(`❌ Error making trading decision:`, error);
      }
    }, 2 * 60 * 60 * 1000); // Every 2 hours

    // Show status every hour
    const statusInterval = setInterval(() => {
      console.log(`\n📈 Competition Status:`);
      console.log(`   Total trades: ${totalTrades}`);
      console.log(`   Today's trades: ${tradesPerDay}/${config.minTradesPerDay}`);
      console.log(`   Agent status: ${agent.isActive ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`   Dashboard: http://localhost:5173`);
    }, 60 * 60 * 1000); // Every hour

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log("\n🛑 Shutting down competition agent...");
      clearInterval(tradingInterval);
      clearInterval(statusInterval);
      
      await agent.stop();
      console.log("✅ Agent stopped gracefully");
      
      console.log(`\n🏁 Final Competition Stats:`);
      console.log(`   Total trades made: ${totalTrades}`);
      console.log(`   Check your ranking at: https://competitions.recall.network`);
      
      process.exit(0);
    });

    console.log("🎮 Competition agent is running!");
    console.log("   Press Ctrl+C to stop");
    console.log("   Monitor at: http://localhost:5173");

  } catch (error) {
    console.error("❌ Failed to start competition agent:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startCompetitionAgent();
}

export { startCompetitionAgent };
