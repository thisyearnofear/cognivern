#!/usr/bin/env node

/**
 * Register Trading Agents in Smart Contracts
 * This script registers our Recall and Vincent trading agents in the governance contracts
 */

import dotenv from "dotenv";
import { ContractService } from "../src/services/ContractService.js";
import logger from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

async function registerTradingAgents() {
  try {
    logger.info("🚀 Starting trading agent registration...");

    // Initialize contract service
    const contractService = new ContractService();

    // Health check first
    const isHealthy = await contractService.healthCheck();
    if (!isHealthy) {
      throw new Error(
        "ContractService health check failed - cannot connect to contracts",
      );
    }

    logger.info("✅ ContractService health check passed");

    // Register Recall Trading Agent
    logger.info("📝 Registering Recall Trading Agent...");
    const recallResult = await contractService.registerTradingAgent({
      id: "recall-competition-agent",
      name: "Recall Competition Trading Agent",
      type: "recall",
      capabilities: [
        "high-frequency-trading",
        "technical-analysis",
        "market-data-analysis",
        "risk-management",
        "competition-trading",
      ],
    });

    logger.info("✅ Recall agent registered:", {
      governanceTx: recallResult.governanceTx,
      storageTx: recallResult.storageTx,
    });

    // Wait a moment between registrations
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Register Vincent Social Trading Agent
    logger.info("📝 Registering Vincent Social Trading Agent...");
    const vincentResult = await contractService.registerTradingAgent({
      id: "vincent-social-agent",
      name: "Vincent Social Trading Agent",
      type: "vincent",
      capabilities: [
        "sentiment-analysis",
        "social-media-monitoring",
        "community-governance",
        "policy-enforcement",
        "multi-chain-trading",
      ],
    });

    logger.info("✅ Vincent agent registered:", {
      governanceTx: vincentResult.governanceTx,
      storageTx: vincentResult.storageTx,
    });

    // Verify registration by checking stats
    logger.info("🔍 Verifying registration...");
    const stats = await contractService.getGovernanceStats();
    logger.info("📊 Updated governance stats:", stats);

    const storageStats = await contractService.getStorageStats();
    logger.info("💾 Updated storage stats:", storageStats);

    logger.info("🎉 Trading agent registration complete!");

    console.log("\n=== REGISTRATION SUMMARY ===");
    console.log("✅ Recall Trading Agent:");
    console.log(`   Governance TX: ${recallResult.governanceTx || "Failed"}`);
    console.log(`   Storage TX: ${recallResult.storageTx || "Failed"}`);
    console.log("✅ Vincent Social Trading Agent:");
    console.log(`   Governance TX: ${vincentResult.governanceTx || "Failed"}`);
    console.log(`   Storage TX: ${vincentResult.storageTx || "Failed"}`);
    console.log("\n📊 Contract Statistics:");
    console.log(`   Total Policies: ${stats.totalPolicies}`);
    console.log(`   Total Agents: ${stats.totalAgents}`);
    console.log(`   Total Actions: ${stats.totalActions}`);
    console.log("\n🎯 Next Steps:");
    console.log("   1. Sync historical trading decisions");
    console.log("   2. Update dashboard to read from contracts");
    console.log("   3. Verify unified data display");
  } catch (error) {
    logger.error("❌ Error registering trading agents:", error);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Check FILECOIN_PRIVATE_KEY is set in .env");
    console.error("   2. Ensure wallet has sufficient FIL for gas");
    console.error("   3. Verify contract addresses are correct");
    console.error("   4. Check Filecoin Calibration testnet connectivity");
    process.exit(1);
  }
}

// Run the registration
if (import.meta.url === `file://${process.argv[1]}`) {
  registerTradingAgents()
    .then(() => {
      logger.info("✅ Registration script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Registration script failed:", error);
      process.exit(1);
    });
}

export { registerTradingAgents };
