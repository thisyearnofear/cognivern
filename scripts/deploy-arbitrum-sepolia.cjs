/**
 * Deploy GovernanceContract + GovernedVault to Arbitrum Sepolia.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-arbitrum-sepolia.cjs --network arbitrumSepolia
 */

const hre = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${hre.ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      "Deployer has no ETH on Arbitrum Sepolia. Fund the wallet first.",
    );
  }

  // 1. GovernanceContract
  console.log("\nDeploying GovernanceContract...");
  const GovernanceContract = await hre.ethers.getContractFactory(
    "GovernanceContract",
  );
  const governance = await GovernanceContract.deploy();
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log(`  GovernanceContract -> ${governanceAddress}`);

  // 2. GovernedVault
  console.log("Deploying GovernedVault...");
  const GovernedVault = await hre.ethers.getContractFactory("GovernedVault");
  const vault = await GovernedVault.deploy();
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`  GovernedVault     -> ${vaultAddress}`);

  // 3. Sanity: verify the contracts are usable
  const owner = await governance.owner();
  const stats = await governance.getStats();
  console.log(`\nVerification:`);
  console.log(`  GovernanceContract owner: ${owner}`);
  console.log(
    `  GovernanceContract stats: policies=${stats[0]} agents=${stats[1]} actions=${stats[2]}`,
  );
  console.log(`  GovernedVault owner:      ${await vault.owner()}`);

  // 4. Write addresses to a JSON manifest for the docs step
  const out = {
    network: "arbitrumSepolia",
    chainId: 421614,
    deployer: deployer.address,
    contracts: {
      GovernanceContract: governanceAddress,
      GovernedVault: vaultAddress,
    },
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(
    __dirname,
    "..",
    "deploy-bundle",
    "arbitrum-sepolia-deployment.json",
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote deployment manifest: ${outPath}`);

  console.log(`\nAdd to .env:`);
  console.log(`  ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc`);
  console.log(`  ARBITRUM_GOVERNANCE_CONTRACT_ADDRESS=${governanceAddress}`);
  console.log(`  ARBITRUM_VAULT_ADDRESS=${vaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
