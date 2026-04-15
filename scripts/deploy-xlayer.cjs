const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

async function main() {
  console.log("🚀 Deploying Cognivern contracts to X Layer Testnet...");

  if (!process.env.XLAYER_PRIVATE_KEY) {
    throw new Error("❌ XLAYER_PRIVATE_KEY not found in environment variables");
  }

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer address:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "OKB");

  if (balance === 0n) {
    throw new Error(
      "❌ Insufficient balance. Fund the deployer wallet with X Layer testnet OKB.",
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
    "AIGovernanceStorage",
  );
  const storageContract = await AIGovernanceStorage.deploy();
  await storageContract.waitForDeployment();
  const storageAddress = await storageContract.getAddress();
  console.log("✅ AIGovernanceStorage deployed at:", storageAddress);

  // Create a sample policy
  console.log("\n📜 Creating sample governance policy...");
  const policyId = ethers.keccak256(
    ethers.toUtf8Bytes("cognivern-xlayer-policy-" + Date.now()),
  );
  const createPolicyTx = await governanceContract.createPolicy(
    policyId,
    "Cognivern AI Governance Policy",
    "AI agent spend governance policy deployed on X Layer",
    ethers.keccak256(ethers.toUtf8Bytes("xlayer-rules-hash")),
  );
  await createPolicyTx.wait();
  console.log("✅ Sample policy created with ID:", policyId);

  // Activate the policy
  console.log("\n🔄 Activating sample policy...");
  const activatePolicyTx = await governanceContract.updatePolicyStatus(
    policyId,
    1,
  );
  await activatePolicyTx.wait();
  console.log("✅ Sample policy activated");

  // Register a sample agent
  console.log("\n🤖 Registering sample agent...");
  const agentId = ethers.keccak256(
    ethers.toUtf8Bytes("cognivern-agent-" + Date.now()),
  );
  const registerAgentTx = await governanceContract.registerAgent(
    agentId,
    "Cognivern Trading Agent",
    ["policy-enforcement", "spend-governance", "trading"],
    policyId,
  );
  await registerAgentTx.wait();
  console.log("✅ Sample agent registered with ID:", agentId);

  // Register agent in AIGovernanceStorage
  console.log("\n📝 Registering agent in AIGovernanceStorage...");
  const registerStorageTx = await storageContract.registerAgent(
    deployer.address,
    "Cognivern AI Trading Agent",
    "trading",
  );
  await registerStorageTx.wait();
  console.log("✅ Agent registered in storage contract");

  // Output deployment information
  console.log("\n🎉 === X LAYER TESTNET DEPLOYMENT COMPLETE ===");
  console.log("📋 GovernanceContract:", governanceAddress);
  console.log("🗄️  AIGovernanceStorage:", storageAddress);
  console.log("📜 Sample Policy ID:", policyId);
  console.log("🤖 Sample Agent ID:", agentId);
  console.log("\n📝 Add these to your .env file:");
  console.log(`XLAYER_GOVERNANCE_CONTRACT_ADDRESS=${governanceAddress}`);
  console.log(`XLAYER_STORAGE_CONTRACT_ADDRESS=${storageAddress}`);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const stats = await governanceContract.getStats();
  console.log(
    "📊 Governance stats - Policies:",
    stats[0].toString(),
    "Agents:",
    stats[1].toString(),
    "Actions:",
    stats[2].toString(),
  );

  const storageStats = await storageContract.getGovernanceStats();
  console.log(
    "📊 Storage stats - Actions:",
    storageStats[0].toString(),
    "Violations:",
    storageStats[1].toString(),
    "Agents:",
    storageStats[2].toString(),
  );

  console.log("\n✅ Deployment verification complete!");
  console.log("🌟 Cognivern: AI Agent Governance on X Layer");
  console.log("🔗 X Layer Testnet Explorer: https://www.okx.com/explorer/xlayer-test");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
