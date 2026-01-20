import { ethers } from "ethers";
import dotenv from "dotenv";

// Load environment variables from .env.local or .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import logger from "../src/utils/logger.js";

async function deployContracts() {
  try {
    if (
      !process.env.FILECOIN_RPC_URL ||
      !process.env.FILECOIN_PRIVATE_KEY ||
      !process.env.USDFC_TOKEN_ADDRESS
    ) {
      throw new Error(
        "Missing required environment variables for deployment. Please set FILECOIN_RPC_URL, FILECOIN_PRIVATE_KEY, and USDFC_TOKEN_ADDRESS in your .env file."
      );
    }
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.FILECOIN_RPC_URL);
    const wallet = new ethers.Wallet(
      process.env.FILECOIN_PRIVATE_KEY,
      provider
    );

    logger.info("Deploying contracts to Filecoin Calibration testnet...");
    logger.info(`Deployer address: ${wallet.address}`);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    logger.info(`Deployer balance: ${ethers.formatEther(balance)} FIL`);

    if (balance === 0n) {
      throw new Error(
        "Insufficient balance for deployment. Please fund the deployer wallet."
      );
    }

    // Deploy GovernanceContract
    logger.info("Deploying GovernanceContract...");
    const GovernanceContract = await ethers.getContractFactory(
      "GovernanceContract",
      wallet
    );
    const governanceContract = await GovernanceContract.deploy();
    await governanceContract.waitForDeployment();
    const governanceAddress = await governanceContract.getAddress();
    logger.info(`GovernanceContract deployed at: ${governanceAddress}`);

    // Deploy AIGovernanceStorage (specialized for AI governance)
    logger.info("Deploying AIGovernanceStorage...");
    const AIGovernanceStorage = await ethers.getContractFactory(
      "AIGovernanceStorage",
      wallet
    );
    const storageContract = await AIGovernanceStorage.deploy();
    await storageContract.waitForDeployment();
    const storageAddress = await storageContract.getAddress();
    logger.info(`AIGovernanceStorage deployed at: ${storageAddress}`);

    // Create a sample policy
    logger.info("Creating sample governance policy...");
    const policyId = ethers.keccak256(
      ethers.toUtf8Bytes("sample-policy-" + Date.now())
    );
    const createPolicyTx = await governanceContract.createPolicy(
      policyId,
      "Sample Governance Policy",
      "A sample policy for demonstrating governance capabilities",
      ethers.keccak256(ethers.toUtf8Bytes("sample-rules-hash"))
    );
    await createPolicyTx.wait();
    logger.info(`Sample policy created with ID: ${policyId}`);

    // Activate the policy
    logger.info("Activating sample policy...");
    const activatePolicyTx = await governanceContract.updatePolicyStatus(
      policyId,
      1
    ); // Active
    await activatePolicyTx.wait();
    logger.info("Sample policy activated");

    // Register a sample agent
    logger.info("Registering sample agent...");
    const agentId = ethers.keccak256(
      ethers.toUtf8Bytes("sample-agent-" + Date.now())
    );
    const registerAgentTx = await governanceContract.registerAgent(
      agentId,
      "Sample AI Agent",
      ["policy-enforcement", "data-analysis", "decision-making"],
      policyId
    );
    await registerAgentTx.wait();
    logger.info(`Sample agent registered with ID: ${agentId}`);

    // Output deployment information
    console.log("\n=== DEPLOYMENT COMPLETE ===");
    console.log(`GovernanceContract: ${governanceAddress}`);
    console.log(`StorageContract: ${storageAddress}`);
    console.log(`Sample Policy ID: ${policyId}`);
    console.log(`Sample Agent ID: ${agentId}`);
    console.log("\nAdd these to your .env file:");
    console.log(`GOVERNANCE_CONTRACT_ADDRESS=${governanceAddress}`);
    console.log(`STORAGE_CONTRACT_ADDRESS=${storageAddress}`);

    // Verify deployment
    logger.info("Verifying deployment...");
    const stats = await governanceContract.getStats();
    logger.info(
      `Governance stats - Policies: ${stats[0]}, Agents: ${stats[1]}, Actions: ${stats[2]}`
    );

    const storageStats = await storageContract.getStats();
    logger.info(
      `Storage stats - Storage Requests: ${storageStats[0]}, Retrieval Requests: ${storageStats[1]}, Providers: ${storageStats[2]}`
    );

    logger.info("Deployment verification complete!");
  } catch (error) {
    logger.error("Deployment failed:", error);
    process.exit(1);
  }
}

// Run deployment
deployContracts()
  .then(() => {
    logger.info("Deployment script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Deployment script failed:", error);
    process.exit(1);
  });
