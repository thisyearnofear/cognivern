const { ethers } = require("hardhat");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

async function main() {
  console.log("Deploying GovernedVault to Mantle Sepolia...");

  if (!process.env.MANTLE_PRIVATE_KEY) {
    throw new Error("MANTLE_PRIVATE_KEY not found in environment variables");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "MNT");

  if (balance === 0n) {
    throw new Error(
      "Insufficient balance. Fund the deployer wallet with Mantle Sepolia MNT.",
    );
  }

  // Deploy GovernedVault — the agent execution layer on Mantle
  console.log("\nDeploying GovernedVault...");
  const GovernedVault = await ethers.getContractFactory("GovernedVault");
  const vault = await GovernedVault.deploy();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("GovernedVault deployed at:", vaultAddress);

  // Configure Hyperlane — connect vault to Fhenix policy decisions
  // These values will be set once Hyperlane is deployed on Mantle Sepolia
  // For now we log the owner so the config can be called later
  console.log("\nVault owner (can configure Hyperlane):", deployer.address);
  console.log("Call setHyperlaneConfig(mailbox, fhenixDomain, fhenixSender) once Hyperlane is live.");

  // Output deployment information
  console.log("\n=== MANTLE SEPOLIA DEPLOYMENT COMPLETE ===");
  console.log("GovernedVault:", vaultAddress);
  console.log("\nAdd to your .env file:");
  console.log(`MANTLE_VAULT_ADDRESS=${vaultAddress}`);
  console.log("\nMantle Sepolia Explorer: https://sepolia.mantlescan.xyz/address/" + vaultAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
