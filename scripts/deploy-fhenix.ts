/**
 * Deploy ConfidentialSpendPolicy to a Fhenix-enabled network (baseSepolia by default).
 *
 * Usage:
 *   npx hardhat run scripts/deploy-fhenix.ts --network baseSepolia
 *   # or via pnpm:
 *   pnpm deploy:fhenix
 */

import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying ConfidentialSpendPolicy with account: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${hre.ethers.formatEther(balance)} ETH`);

  const ConfidentialSpendPolicy = await hre.ethers.getContractFactory("ConfidentialSpendPolicy");
  const contract = await ConfidentialSpendPolicy.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nConfidentialSpendPolicy deployed to: ${address}`);
  console.log(`Network: ${hre.network.name} (chain ${hre.network.config.chainId})`);

  console.log(`\nSet this in your .env:`);
  console.log(`  FHENIX_POLICY_CONTRACT=${address}`);
  console.log(`  FHENIX_RPC_URL=${hre.network.config.url || "https://api.testnet.fhenix.zone"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
