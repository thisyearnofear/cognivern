/**
 * Deploy GovernanceProofV2 to 0G Mainnet / Aristotle.
 *
 * Required environment:
 *   ZEROG_MAINNET_DEPLOYER_PRIVATE_KEY=<transaction payer>
 *   ZEROG_MAINNET_ADMIN=<multisig or admin address>
 *   ZEROG_MAINNET_POSTER=<dedicated Cognivern proof-poster address>
 *
 * Usage:
 *   npx hardhat run contracts/scripts/deploy-0g-governance-proof-v2.ts \
 *     --config contracts/hardhat.config.cjs --network zeroGMainnet
 *
 * This script refuses every network other than 0G Mainnet (chain ID 16661).
 * It does not update the backend environment or deploy any other contract.
 */

import hre from 'hardhat';

const { ethers } = hre as typeof hre & { ethers: any };

const ZERO_G_MAINNET_CHAIN_ID = 16661n;

function requiredAddress(name: string): string {
  const value = process.env[name];
  if (!value || !ethers.isAddress(value)) {
    throw new Error(`${name} must be a valid EVM address`);
  }
  return ethers.getAddress(value);
}

function assertDifferent(leftName: string, left: string, rightName: string, right: string): void {
  if (left.toLowerCase() === right.toLowerCase()) {
    throw new Error(`${leftName} and ${rightName} must be different addresses`);
  }
}

function requiredPosterKey(): string {
  const value = process.env.ZEROG_MAINNET_POSTER_PRIVATE_KEY;
  if (!value) {
    throw new Error(
      'ZEROG_MAINNET_POSTER_PRIVATE_KEY is required to verify the dedicated poster address',
    );
  }
  try {
    // Validate without logging or retaining the derived wallet beyond this check.
    ethers.getAddress(new ethers.Wallet(value).address);
  } catch {
    throw new Error('ZEROG_MAINNET_POSTER_PRIVATE_KEY must be a valid EVM private key');
  }
  return value;
}

async function main() {
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== ZERO_G_MAINNET_CHAIN_ID) {
    throw new Error(
      `Refusing deployment: expected 0G Mainnet chain ${ZERO_G_MAINNET_CHAIN_ID}, got ${network.chainId}`,
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      'ZEROG_MAINNET_DEPLOYER_PRIVATE_KEY must be configured for the zeroGMainnet network',
    );
  }

  const expectedDeployer = requiredAddress('ZEROG_MAINNET_DEPLOYER_ADDRESS');
  const admin = requiredAddress('ZEROG_MAINNET_ADMIN');
  const poster = requiredAddress('ZEROG_MAINNET_POSTER');
  const posterKey = requiredPosterKey();
  const derivedPoster = new ethers.Wallet(posterKey).address;

  if (deployer.address.toLowerCase() !== expectedDeployer.toLowerCase()) {
    throw new Error(
      `Deployer key/address mismatch: key=${deployer.address}, configured=${expectedDeployer}`,
    );
  }
  if (derivedPoster.toLowerCase() !== poster.toLowerCase()) {
    throw new Error(`Poster key/address mismatch: key=${derivedPoster}, configured=${poster}`);
  }
  assertDifferent('deployer', deployer.address, 'admin', admin);
  assertDifferent('deployer', deployer.address, 'poster', poster);
  assertDifferent('admin', admin, 'poster', poster);

  if (
    process.env.ZEROG_MAINNET_PROOF_CONTRACT &&
    process.env.ZEROG_MAINNET_ALLOW_REDEPLOY !== 'true'
  ) {
    throw new Error(
      'ZEROG_MAINNET_PROOF_CONTRACT is already set; refusing a second deployment. Set ZEROG_MAINNET_ALLOW_REDEPLOY=true only after explicit review.',
    );
  }

  console.log('0G Mainnet GovernanceProofV2 preflight passed:');
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Admin:    ${admin}`);
  console.log(`  Poster:   ${poster}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${ethers.formatEther(balance)} 0G`);
  if (balance === 0n) {
    throw new Error(`Deployment wallet has no 0G: ${deployer.address}`);
  }
  const posterBalance = await ethers.provider.getBalance(poster);
  console.log(`  Poster balance: ${ethers.formatEther(posterBalance)} 0G`);
  if (posterBalance === 0n) {
    throw new Error(`Poster wallet has no 0G for future proof posting: ${poster}`);
  }

  if (process.env.ZEROG_MAINNET_PREFLIGHT_ONLY === 'true') {
    console.log('Preflight only — no deployment transaction was sent.');
    return;
  }

  const GovernanceProofV2 = await ethers.getContractFactory('GovernanceProofV2');
  const contract = await GovernanceProofV2.deploy(admin, poster);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deploymentTransaction = contract.deploymentTransaction();

  console.log('\nGovernanceProofV2 deployed:');
  console.log(`  Address:  ${address}`);
  console.log(`  Explorer: https://chainscan.0g.ai/address/${address}`);
  console.log(`  TX:       ${deploymentTransaction?.hash ?? 'unknown'}`);
  console.log(`  Admin:    ${await contract.admin()}`);
  console.log(`  Poster:   ${await contract.poster()}`);
  console.log(`  Schema:   ${await contract.SCHEMA_VERSION()}`);

  console.log('\nMainnet backend values to review before applying:');
  console.log('  ZEROG_MAINNET_RPC_URL=https://evmrpc.0g.ai');
  console.log(`  ZEROG_MAINNET_PROOF_CONTRACT=${address}`);
  console.log('  ZEROG_MAINNET_CHAIN_ID=16661');
  console.log('  ZEROG_PROOF_VERSION=v2');
  console.log('  ZEROG_MAINNET_POSTER_PRIVATE_KEY=<private-key-for-the-configured-poster>');
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exitCode = 1;
});
