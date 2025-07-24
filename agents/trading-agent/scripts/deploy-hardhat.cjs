const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

async function main() {
  console.log(
    "🚀 Deploying Cognivern contracts to Filecoin Calibration testnet..."
  );

  // Check if we have the required environment variables
  if (!process.env.FILECOIN_PRIVATE_KEY) {
    throw new Error(
      "❌ FILECOIN_PRIVATE_KEY not found in environment variables"
    );
  }

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer address:", deployer.address);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "FIL");

  if (balance === 0n) {
    throw new Error(
      "❌ Insufficient balance for deployment. Please fund the deployer wallet."
    );
  }

  // Deploy GovernanceContract
  console.log("\n📋 Deploying GovernanceContract...");
  const GovernanceContract =
    await ethers.getContractFactory("GovernanceContract");
  const governanceContract = await GovernanceContract.deploy();
  await governanceContract.waitForDeployment();
  const governanceAddress = await governanceContract.getAddress();
  console.log("✅ GovernanceContract deployed at:", governanceAddress);

  // Deploy AIGovernanceStorage
  console.log("\n🗄️  Deploying AIGovernanceStorage...");
  const AIGovernanceStorage = await ethers.getContractFactory(
    "AIGovernanceStorage"
  );
  const storageContract = await AIGovernanceStorage.deploy();
  await storageContract.waitForDeployment();
  const storageAddress = await storageContract.getAddress();
  console.log("✅ AIGovernanceStorage deployed at:", storageAddress);

  // Create a sample policy
  console.log("\n📜 Creating sample governance policy...");
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
  console.log("✅ Sample policy created with ID:", policyId);

  // Activate the policy
  console.log("\n🔄 Activating sample policy...");
  const activatePolicyTx = await governanceContract.updatePolicyStatus(
    policyId,
    1
  ); // Active
  await activatePolicyTx.wait();
  console.log("✅ Sample policy activated");

  // Register a sample agent
  console.log("\n🤖 Registering sample agent...");
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
  console.log("✅ Sample agent registered with ID:", agentId);

  // Register agent in AIGovernanceStorage
  console.log("\n📝 Registering agent in AIGovernanceStorage...");
  const registerStorageTx = await storageContract.registerAgent(
    deployer.address,
    "Sample AI Trading Agent",
    "trading"
  );
  await registerStorageTx.wait();
  console.log("✅ Agent registered in storage contract");

  // Output deployment information
  console.log("\n🎉 === DEPLOYMENT COMPLETE ===");
  console.log("📋 GovernanceContract:", governanceAddress);
  console.log("🗄️  AIGovernanceStorage:", storageAddress);
  console.log("📜 Sample Policy ID:", policyId);
  console.log("🤖 Sample Agent ID:", agentId);
  console.log("\n📝 Add these to your .env file:");
  console.log(`GOVERNANCE_CONTRACT_ADDRESS=${governanceAddress}`);
  console.log(`STORAGE_CONTRACT_ADDRESS=${storageAddress}`);
  console.log(
    `USDFC_TOKEN_ADDRESS=${process.env.USDFC_TOKEN_ADDRESS || "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9"}`
  );

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const stats = await governanceContract.getStats();
  console.log(
    "📊 Governance stats - Policies:",
    stats[0].toString(),
    "Agents:",
    stats[1].toString(),
    "Actions:",
    stats[2].toString()
  );

  const storageStats = await storageContract.getGovernanceStats();
  console.log(
    "📊 Storage stats - Actions:",
    storageStats[0].toString(),
    "Violations:",
    storageStats[1].toString(),
    "Agents:",
    storageStats[2].toString()
  );

  console.log("\n✅ Deployment verification complete!");
  console.log(
    "🌟 Cognivern: AI Agent Governance on Filecoin's Sovereign Data Layer"
  );
  console.log("🔗 Filecoin Explorer: https://calibration.filfox.info/en");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
