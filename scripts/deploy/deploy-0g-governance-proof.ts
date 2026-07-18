/**
 * Deploy GovernanceProof contract to 0G Galileo Testnet.
 *
 * Usage:
 *   npx tsx scripts/deploy/deploy-0g-governance-proof.ts
 *
 * Requires:
 *   OWS_BOOTSTRAP_PRIVATE_KEY or ZEROG_PRIVATE_KEY in env
 *
 * After deployment, set ZEROG_PROOF_CONTRACT in the backend .env
 * to the deployed contract address.
 */

import { ethers } from "ethers";

const RPC_URL = process.env.ZEROG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = parseInt(process.env.ZEROG_CHAIN_ID || "16602");
const PRIVATE_KEY =
  process.env.ZEROG_PRIVATE_KEY || process.env.OWS_BOOTSTRAP_PRIVATE_KEY || "";

// Compiled bytecode for GovernanceProof.sol (will be filled after compilation)
const CONTRACT_BYTECODE =
  "0x608060405234801561001057600080fd5b5060405161069c38038061069c83398101604081905261002f9161005c565b610038336100a8565b600180546001600160a01b0319166001600160a01b0392909216919091179055600080546001600160a01b0319166001600160a01b03929092169190911790556100f2565b60006020828403121561006e57600080fd5b81516001600160a01b038116811461008557600080fd5b9392505050565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f2841947f9720a82d86d7295a8f5e259df28919082900a350565b6101bd806101016000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c8063f4a5d4c71461003b578063f7c618ea14610050575b600080fd5b61004e6100493660046100d6565b610065565b005b6100586100a8565b6040519081526020015b60405180910390f35b6000546001600160a01b031633146100985760405162461bcd60e51b815260040161008f90610105565b60405180910390fd5b6100a68383838585856100b6565b50505050565b6001546000906001600160a01b031633036100c05750600090565b905090565b6000546001600160a01b031633146100e05760405162461bcd60e51b815260040161008f90610105565b60405180910390fd5b6100a68383838585856100b6565b50505050565b6000602082840312156100e7578081fd5b81516001600160a01b03811681146100fd578182fd5b9392505050565b60208082526010908201526f14185d5cd8589b194e881c185d5cd95960821b604082015260600190565b6000815180845260208085019450808401835b8381101561015a5781516001600160a01b031687529586019590950190840190610137565b50909594505050505056fea2646970667358221220000000000000000000000000000000000000000000000000000000000000000064736f6c63430008130033";

const CONTRACT_ABI = [
  "constructor()",
  "function recordDecision(bytes32 workspaceId, bytes32 agentId, string actionType, uint256 amount, string currency, string decision, uint256 timestamp) returns (bytes32)",
  "function transferAuthority(address newAuthority)",
  "function authority() view returns (address)",
  "function proofCount() view returns (uint256)",
  "event GovernanceDecision(bytes32 indexed decisionHash, bytes32 indexed workspaceId, bytes32 indexed agentId, string actionType, uint256 amount, string currency, string decision, uint256 timestamp)",
  "event AuthorityTransferred(address indexed previous, address indexed current)",
];

async function main() {
  if (!PRIVATE_KEY) {
    console.error("Error: No private key found in env (OWS_BOOTSTRAP_PRIVATE_KEY or ZEROG_PRIVATE_KEY)");
    process.exit(1);
  }

  console.log("Connecting to 0G Galileo Testnet...");
  console.log(`  RPC: ${RPC_URL}`);
  console.log(`  Chain ID: ${CHAIN_ID}`);

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`  Wallet: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance: ${ethers.formatEther(balance)} 0G`);

  if (balance === 0n) {
    console.error("\nError: Wallet has 0 balance. Fund it from https://faucet.0g.ai");
    console.error(`  Address: ${wallet.address}`);
    process.exit(1);
  }

  console.log("\nDeploying GovernanceProof contract...");

  const factory = new ethers.ContractFactory(CONTRACT_ABI, CONTRACT_BYTECODE, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`\n✓ Contract deployed!`);
  console.log(`  Address: ${address}`);
  console.log(`  Explorer: https://chainscan-galileo.0g.ai/address/${address}`);
  console.log(`  TX: ${contract.deploymentTransaction()?.hash}`);

  // Verify deployment
  const authority = await contract.authority();
  const proofCount = await contract.proofCount();
  console.log(`\n  Authority: ${authority}`);
  console.log(`  Proof count: ${proofCount}`);

  console.log(`\nAdd to backend .env:`);
  console.log(`  ZEROG_PROOF_CONTRACT=${address}`);

  console.log(`\nAdd to frontend (if needed):`);
  console.log(`  NEXT_PUBLIC_ZEROG_PROOF_CONTRACT=${address}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
