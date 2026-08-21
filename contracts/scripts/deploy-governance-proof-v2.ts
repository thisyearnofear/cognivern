/**
 * Deploy GovernanceProofV2 to a supported mainnet rail.
 *
 * The contract source is chain-agnostic; the rail is selected by the Hardhat
 * `--network` flag and all chain-specific values come from the rail table
 * below plus a per-rail env prefix. Adding a rail is a table entry, not a new
 * script.
 *
 * Required environment (prefix per rail, e.g. ZEROG_MAINNET_* / XLAYER_MAINNET_*;
 * keep in the ignored .env.<rail>-mainnet file or inject from a secret manager):
 *   <PREFIX>_MAINNET_DEPLOYER_PRIVATE_KEY=<transaction payer>
 *   <PREFIX>_MAINNET_DEPLOYER_ADDRESS=<transaction payer address>
 *   <PREFIX>_MAINNET_ADMIN=<multisig or admin address>
 *   <PREFIX>_MAINNET_POSTER=<dedicated Cognivern proof-poster address>
 *   <PREFIX>_MAINNET_POSTER_PRIVATE_KEY=<dedicated poster key>
 *
 * Usage:
 *   ZEROG_MAINNET_ENV_FILE=.env.0g-mainnet pnpm zerog:proof:preflight
 *   XLAYER_MAINNET_ENV_FILE=.env.xlayer-mainnet \
 *   npx hardhat run contracts/scripts/deploy-governance-proof-v2.ts \
 *     --config contracts/hardhat.config.cjs --network xlayerMainnet
 *
 * The script refuses any network outside the rail table, any chain ID
 * mismatch, and any redeploy while <PREFIX>_MAINNET_PROOF_CONTRACT is set. It
 * does not update the backend environment or deploy any other contract.
 */

import hre from 'hardhat';

const { ethers } = hre as typeof hre & { ethers: any };

interface RailDeployment {
  envPrefix: string;
  chainId: bigint;
  displayName: string;
  currency: string;
  rpcDefault: string;
  explorerAddressBase: string;
}

const RAILS: Record<string, RailDeployment> = {
  zeroGMainnet: {
    envPrefix: 'ZEROG',
    chainId: 16661n,
    displayName: '0G Mainnet',
    currency: '0G',
    rpcDefault: 'https://evmrpc.0g.ai',
    explorerAddressBase: 'https://chainscan.0g.ai',
  },
  xlayerMainnet: {
    envPrefix: 'XLAYER',
    chainId: 196n,
    displayName: 'X Layer Mainnet',
    currency: 'OKB',
    rpcDefault: 'https://rpc.xlayer.tech',
    explorerAddressBase: 'https://www.oklink.com/xlayer',
  },
};

function railVar(rail: RailDeployment, suffix: string): string {
  return `${rail.envPrefix}_MAINNET_${suffix}`;
}

function requiredAddress(rail: RailDeployment, suffix: string): string {
  const name = railVar(rail, suffix);
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

function requiredPosterKey(rail: RailDeployment): string {
  const name = railVar(rail, 'POSTER_PRIVATE_KEY');
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to verify the dedicated poster address`);
  }
  try {
    // Validate without logging or retaining the derived wallet beyond this check.
    ethers.getAddress(new ethers.Wallet(value).address);
  } catch {
    throw new Error(`${name} must be a valid EVM private key`);
  }
  return value;
}

async function main() {
  const networkName = hre.network.name;
  const rail = RAILS[networkName];
  if (!rail) {
    throw new Error(
      `Refusing deployment: network "${networkName}" is not a supported GovernanceProofV2 rail. Supported: ${Object.keys(RAILS).join(', ')}`,
    );
  }

  const network = await ethers.provider.getNetwork();
  if (network.chainId !== rail.chainId) {
    throw new Error(
      `Refusing deployment: expected ${rail.displayName} chain ${rail.chainId}, got ${network.chainId}`,
    );
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      `${railVar(rail, 'DEPLOYER_PRIVATE_KEY')} must be configured for the ${networkName} network`,
    );
  }

  const expectedDeployer = requiredAddress(rail, 'DEPLOYER_ADDRESS');
  const admin = requiredAddress(rail, 'ADMIN');
  const poster = requiredAddress(rail, 'POSTER');
  const posterKey = requiredPosterKey(rail);
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
    process.env[railVar(rail, 'PROOF_CONTRACT')] &&
    process.env[railVar(rail, 'ALLOW_REDEPLOY')] !== 'true'
  ) {
    throw new Error(
      `${railVar(rail, 'PROOF_CONTRACT')} is already set; refusing a second deployment. Set ${railVar(rail, 'ALLOW_REDEPLOY')}=true only after explicit review.`,
    );
  }

  console.log(`${rail.displayName} GovernanceProofV2 preflight passed:`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Admin:    ${admin}`);
  console.log(`  Poster:   ${poster}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ${rail.currency}`);
  if (balance === 0n) {
    throw new Error(`Deployment wallet has no ${rail.currency}: ${deployer.address}`);
  }
  const posterBalance = await ethers.provider.getBalance(poster);
  console.log(`  Poster balance: ${ethers.formatEther(posterBalance)} ${rail.currency}`);
  if (posterBalance === 0n) {
    throw new Error(`Poster wallet has no ${rail.currency} for future proof posting: ${poster}`);
  }

  if (process.env[railVar(rail, 'PREFLIGHT_ONLY')] === 'true') {
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
  console.log(`  Explorer: ${rail.explorerAddressBase}/address/${address}`);
  console.log(`  TX:       ${deploymentTransaction?.hash ?? 'unknown'}`);
  console.log(`  Admin:    ${await contract.admin()}`);
  console.log(`  Poster:   ${await contract.poster()}`);
  console.log(`  Schema:   ${await contract.SCHEMA_VERSION()}`);

  console.log('\nMainnet backend values to review before applying:');
  console.log(`  ${rail.envPrefix}_PROOF_VERSION=v2`);
  console.log(`  ${railVar(rail, 'RPC_URL')}=${rail.rpcDefault}`);
  console.log(`  ${railVar(rail, 'CHAIN_ID')}=${rail.chainId}`);
  console.log(`  ${railVar(rail, 'PROOF_CONTRACT')}=${address}`);
  console.log(`  ${railVar(rail, 'POSTER_PRIVATE_KEY')}=<private-key-for-the-configured-poster>`);
  console.log(
    '\nAlso record address/deployTx/roles in contracts/deployments/' +
      `${rail.chainId}.json and flip status to active.`,
  );
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exitCode = 1;
});
