/**
 * Deploy GovernanceProof contract to 0G Galileo Testnet.
 *
 * Usage:
 *   npx hardhat run scripts/deploy/deploy-0g-governance-proof.ts --network zeroGTestnet
 *
 * After deployment, set ZEROG_PROOF_CONTRACT in the backend .env
 * to the deployed contract address.
 */

import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying GovernanceProof to 0G Galileo Testnet...");
  console.log(`  Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance: ${ethers.formatEther(balance)} 0G`);

  if (balance === 0n) {
    console.error("\nError: Wallet has 0 balance. Fund it from https://faucet.0g.ai");
    console.error(`  Address: ${deployer.address}`);
    process.exit(1);
  }

  const GovernanceProof = await ethers.getContractFactory("GovernanceProof");
  const contract = await GovernanceProof.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\nGovernanceProof deployed!`);
  console.log(`  Address: ${address}`);
  console.log(`  Explorer: https://chainscan-galileo.0g.ai/address/${address}`);
  console.log(`  TX: ${contract.deploymentTransaction()?.hash}`);

  // Verify
  const authority = await contract.authority();
  const proofCount = await contract.proofCount();
  console.log(`  Authority: ${authority}`);
  console.log(`  Proof count: ${proofCount}`);

  console.log(`\nAdd to backend .env:`);
  console.log(`  ZEROG_PROOF_CONTRACT=${address}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
