#!/usr/bin/env node

/**
 * Test Contract Connectivity
 * Simple script to test if we can read from the deployed contracts
 */

import dotenv from "dotenv";
import { ethers } from "ethers";
import logger from "../src/utils/logger.js";

// Load environment variables
dotenv.config();

async function testContracts() {
  try {
    logger.info("🔍 Testing contract connectivity...");

    // Initialize provider and wallet
    const rpcUrl = process.env.FILECOIN_RPC_URL || "https://api.calibration.node.glif.io/rpc/v1";
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    const governanceAddress = process.env.GOVERNANCE_CONTRACT_ADDRESS || "0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880";
    const storageAddress = process.env.STORAGE_CONTRACT_ADDRESS || "0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada";

    if (!privateKey) {
      throw new Error("FILECOIN_PRIVATE_KEY environment variable is required");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    logger.info("✅ Provider and wallet initialized", {
      rpcUrl,
      walletAddress: wallet.address,
      governanceAddress,
      storageAddress
    });

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    logger.info(`💰 Wallet balance: ${ethers.formatEther(balance)} FIL`);

    // Simple contract ABIs for testing
    const governanceABI = [
      "function totalAgents() external view returns (uint256)",
      "function totalActions() external view returns (uint256)",
      "function totalPolicies() external view returns (uint256)",
      "function getStats() external view returns (uint256, uint256, uint256)"
    ];

    const storageABI = [
      "function totalActions() external view returns (uint256)"
    ];

    // Test governance contract
    logger.info("📋 Testing governance contract...");
    const governanceContract = new ethers.Contract(governanceAddress, governanceABI, provider);
    
    try {
      const totalAgents = await governanceContract.totalAgents();
      const totalActions = await governanceContract.totalActions();
      const totalPolicies = await governanceContract.totalPolicies();
      
      logger.info("✅ Governance contract stats:", {
        totalAgents: Number(totalAgents),
        totalActions: Number(totalActions),
        totalPolicies: Number(totalPolicies)
      });
    } catch (error) {
      logger.error("❌ Error reading governance contract:", error);
    }

    // Test storage contract
    logger.info("💾 Testing storage contract...");
    const storageContract = new ethers.Contract(storageAddress, storageABI, provider);
    
    try {
      const totalActions = await storageContract.totalActions();
      logger.info("✅ Storage contract stats:", {
        totalActions: Number(totalActions)
      });
    } catch (error) {
      logger.error("❌ Error reading storage contract:", error);
    }

    logger.info("🎉 Contract connectivity test complete!");

  } catch (error) {
    logger.error("❌ Contract test failed:", error);
    process.exit(1);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testContracts()
    .then(() => {
      logger.info("✅ Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error("❌ Test failed:", error);
      process.exit(1);
    });
}

export { testContracts };
