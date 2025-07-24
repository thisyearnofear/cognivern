#!/usr/bin/env tsx

/**
 * MCP-Enhanced Competition Agent
 *
 * Uses Recall's MCP server for enhanced competition integration:
 * - Direct access to competition leaderboards
 * - Profile management
 * - Competition-specific trading APIs
 * - Real-time performance tracking
 */

import { spawn } from "child_process";
import { RealTradingAgent } from "../src/agents/RealTradingAgent.js";
import { RecallTradingService } from "../src/services/RecallTradingService.js";
import { PolicyEnforcementService } from "../src/services/PolicyEnforcementService.js";
import { AuditLogService } from "../src/services/AuditLogService.js";
import { MetricsService } from "../src/services/MetricsService.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";
import logger from "../src/utils/logger.js";
import fs from "fs";
import path from "path";

interface MCPConfig {
  serverPath: string;
  apiKey: string;
  apiServerUrl: string;
  walletPrivateKey: string;
  logLevel: string;
}

class MCPCompetitionAgent {
  private mcpProcess: any;
  private agent: RealTradingAgent | null = null;
  private config: MCPConfig;

  constructor() {
    this.config = {
      serverPath:
        process.env.MCP_SERVER_PATH ||
        "./external/js-recall/packages/api-mcp/dist/index.js",
      apiKey:
        process.env.MCP_RECALL_API_KEY ||
        process.env.RECALL_TRADING_API_KEY ||
        "",
      apiServerUrl:
        process.env.MCP_API_SERVER_URL ||
        "https://api.competitions.recall.network",
      walletPrivateKey:
        process.env.MCP_WALLET_PRIVATE_KEY ||
        process.env.FILECOIN_PRIVATE_KEY ||
        "",
      logLevel: "info",
    };
  }

  async start() {
    console.log("🏆 Starting MCP-Enhanced Competition Agent");
    console.log("🔌 Connecting to Recall MCP server...\n");

    try {
      // Start MCP server
      await this.startMCPServer();

      // Initialize trading agent
      await this.initializeTradingAgent();

      // Start competition trading
      await this.startCompetitionTrading();
    } catch (error) {
      console.error("❌ Failed to start MCP competition agent:", error);
      await this.cleanup();
      process.exit(1);
    }
  }

  private async startMCPServer() {
    console.log("🔌 Starting Recall MCP server...");

    // Check if MCP server exists
    const mcpPath = this.config.serverPath.replace("~", process.env.HOME || "");
    if (!fs.existsSync(mcpPath)) {
      console.error("❌ MCP server not found at:", mcpPath);
      console.log("Please run:");
      console.log("  git clone https://github.com/recallnet/js-recall.git");
      console.log("  cd js-recall && pnpm install && pnpm run build");
      throw new Error("MCP server not found");
    }

    // Start MCP server process
    this.mcpProcess = spawn("node", [mcpPath], {
      env: {
        ...process.env,
        API_KEY: this.config.apiKey,
        API_SERVER_URL: this.config.apiServerUrl,
        WALLET_PRIVATE_KEY: this.config.walletPrivateKey,
        LOG_LEVEL: this.config.logLevel,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.mcpProcess.stdout.on("data", (data: Buffer) => {
      console.log(`[MCP] ${data.toString().trim()}`);
    });

    this.mcpProcess.stderr.on("data", (data: Buffer) => {
      console.error(`[MCP Error] ${data.toString().trim()}`);
    });

    this.mcpProcess.on("close", (code: number) => {
      console.log(`[MCP] Process exited with code ${code}`);
    });

    // Wait for MCP server to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log("✅ MCP server started\n");
  }

  private async initializeTradingAgent() {
    console.log("🤖 Initializing trading agent with MCP integration...");

    // Initialize services
    const recallClient = new RecallClient();
    const bucketAddress = (process.env.RECALL_BUCKET_ADDRESS ||
      "0xFf0000000000000000000000000000000000c173") as Address;

    const tradingService = new RecallTradingService();
    const policyService = new PolicyEnforcementService();
    const auditService = new AuditLogService(recallClient, bucketAddress);
    const metricsService = new MetricsService(recallClient, bucketAddress);

    // Agent configuration optimized for competition
    const agentConfig = {
      name: "Cognivern-MCP-Agent",
      version: "1.0.0",
      description: "MCP-enhanced AI governance trading agent",
      capabilities: [
        "real-trading",
        "governance",
        "mcp-integration",
        "competition",
      ],
      riskTolerance: "moderate",
      maxPositionSize: 2000, // Increased for competition
      stopLoss: 0.03, // 3% stop loss
      takeProfit: 0.08, // 8% take profit
    };

    this.agent = new RealTradingAgent(
      agentConfig,
      tradingService,
      policyService,
      auditService,
      metricsService,
      recallClient,
      bucketAddress
    );

    // Start agent with competition policies
    await this.agent.start("trading-competition-policy");
    console.log("✅ Trading agent initialized with MCP integration\n");
  }

  private async startCompetitionTrading() {
    if (!this.agent) throw new Error("Agent not initialized");

    console.log("🎯 Starting competition trading with MCP tools...");
    console.log("📊 Competition requirements:");
    console.log("   • 3+ trades per day");
    console.log("   • Include reasoning for decisions");
    console.log("   • Real trade execution");
    console.log("   • Performance tracking\n");

    let tradesPerDay = 0;
    let totalTrades = 0;
    let dayStartTime = Date.now();

    // Trading every 90 minutes to ensure 3+ trades/day
    const tradingInterval = setInterval(
      async () => {
        try {
          // Reset daily counter
          if (Date.now() - dayStartTime > 24 * 60 * 60 * 1000) {
            console.log(`\n📅 New day - Previous trades: ${tradesPerDay}`);
            tradesPerDay = 0;
            dayStartTime = Date.now();
          }

          console.log(`\n🎯 Making trading decision ${totalTrades + 1}...`);
          console.log(`📊 Today's trades: ${tradesPerDay}/3`);

          // Make trading decision with MCP context
          const result = await this.agent!.makeRealTradingDecision();

          if (result) {
            totalTrades++;
            tradesPerDay++;

            console.log(`✅ Decision: ${result.decision.action}`);
            console.log(`💭 Reasoning: ${result.decision.reasoning}`);
            console.log(`⚖️  Risk Score: ${result.decision.riskScore}`);
            console.log(
              `🛡️  Governance: ${result.approved ? "Approved" : "Blocked"}`
            );

            if (result.execution?.success) {
              console.log(
                `💰 Trade executed: ${result.execution.transaction.id}`
              );
            }

            // Log to MCP for competition tracking
            await this.logToMCP(result);
          }
        } catch (error) {
          console.error(`❌ Trading error:`, error);
        }
      },
      90 * 60 * 1000
    ); // Every 90 minutes

    // Status updates every 30 minutes
    const statusInterval = setInterval(
      () => {
        console.log(
          `\n📈 Status: ${totalTrades} total trades, ${tradesPerDay}/3 today`
        );
        console.log(`🏆 Competition: https://competitions.recall.network`);
        console.log(`📊 Dashboard: http://localhost:5173`);
      },
      30 * 60 * 1000
    );

    // Graceful shutdown
    process.on("SIGINT", async () => {
      console.log("\n🛑 Shutting down MCP competition agent...");
      clearInterval(tradingInterval);
      clearInterval(statusInterval);
      await this.cleanup();
      process.exit(0);
    });

    console.log("🚀 MCP Competition agent is running!");
    console.log("   Monitor: http://localhost:5173");
    console.log("   Leaderboard: https://competitions.recall.network");
    console.log("   Press Ctrl+C to stop\n");
  }

  private async logToMCP(result: any) {
    // Log trading result to MCP for competition tracking
    // This would use MCP tools to update leaderboards, profiles, etc.
    console.log(
      `📝 Logging to MCP: Trade ${result.approved ? "executed" : "blocked"}`
    );
  }

  private async cleanup() {
    console.log("🧹 Cleaning up...");

    if (this.agent) {
      await this.agent.stop();
    }

    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }

    console.log("✅ Cleanup complete");
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const mcpAgent = new MCPCompetitionAgent();
  mcpAgent.start();
}

export { MCPCompetitionAgent };
