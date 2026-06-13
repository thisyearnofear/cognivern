/**
 * End-to-end FHE test against the deployed ConfidentialSpendPolicy on Arbitrum Sepolia.
 *
 * Exercises:
 *   1. Encrypt policy limits and a spend amount with the coFHE SDK
 *   2. Register the policy on the deployed contract
 *   3. Submit evaluateSpend() with an encrypted amount
 *   4. Wait for the SpendEvaluated event
 *
 * This is a smoke test that proves the FHE path is alive on a public Arbitrum Sepolia
 * — the same contract that was deployed with scripts/deploy-fhenix.ts.
 *
 * Usage:
 *   npx hardhat --config contracts/fhenix/hardhat.config.cjs run \
 *     scripts/test-fhe-onchain.ts --network arbitrumSepolia
 *
 *   # Override the contract:
 *   FHENIX_POLICY_CONTRACT=0x... npx hardhat ...
 */

import hre from "hardhat";
import crypto from "node:crypto";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/node";
import { Encryptable } from "@cofhe/sdk";
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  type Hex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT_ADDRESS =
  process.env.FHENIX_POLICY_CONTRACT || "0xaf9F46913eFA99912c3a5069b98d4AEFB0404950";
const RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const CHAIN_ID = 421614;

const ABI = [
  {
    type: "function",
    name: "registerPolicy",
    inputs: [
      { name: "policyId", type: "bytes32" },
      {
        name: "dailyLimitCt",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
      {
        name: "perTxLimitCt",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
      {
        name: "approvalThresholdCt",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "evaluateSpend",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "policyId", type: "bytes32" },
      {
        name: "amountCt",
        type: "tuple",
        components: [
          { name: "ctHash", type: "uint256" },
          { name: "securityZone", type: "uint8" },
          { name: "utype", type: "uint8" },
          { name: "signature", type: "bytes" },
        ],
      },
      { name: "vendorHash", type: "bytes32" },
    ],
    outputs: [{ name: "decisionId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "SpendEvaluated",
    inputs: [
      { name: "decisionId", type: "bytes32", indexed: true },
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "policyId", type: "bytes32", indexed: true },
      { name: "outcome", type: "uint8" },
      { name: "attestation", type: "bytes" },
    ],
  },
] as const;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Contract: ${CONTRACT_ADDRESS}`);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  const code = await hre.ethers.provider.getCode(CONTRACT_ADDRESS);
  if (code === "0x") {
    throw new Error(`No contract at ${CONTRACT_ADDRESS} on ${hre.network.name}`);
  }
  console.log(`Contract bytecode: ${(code.length - 2) / 2} bytes\n`);

  const privateKey = process.env.FHENIX_PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Set FHENIX_PRIVATE_KEY or ARBITRUM_PRIVATE_KEY");
  }

  const config = createCofheConfig({
    environment: "node",
    supportedChains: [
      {
        id: CHAIN_ID,
        name: "Arbitrum Sepolia",
        network: "arb-sepolia",
        coFheUrl: "https://testnet-cofhe.fhenix.zone",
        verifierUrl: "https://testnet-cofhe-vrf.fhenix.zone",
        thresholdNetworkUrl: "https://testnet-cofhe-tn.fhenix.zone",
        environment: "TESTNET",
      },
    ],
  });

  const client = createCofheClient(config);
  const account = privateKeyToAccount(privateKey as Hex);
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(RPC_URL),
  });
  const walletClient = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(RPC_URL),
  });

  await client.connect(publicClient, walletClient);
  console.log("coFHE client connected");

  const agentId = ("0x" + "aa".repeat(32)) as Hex;
  // Unique policyId per run so the script is idempotent (registerPolicy
  // reverts with "policy exists" if the same id is reused). 32 bytes:
  // 8 bytes from a timestamp (epoch seconds) + 24 random bytes.
  const ts = BigInt(Math.floor(Date.now() / 1000));
  const rand = BigInt("0x" + crypto.getRandomValues(new Uint8Array(24))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), ""));
  const policyIdBytes = new Uint8Array(32);
  const tsBytes = new Uint8Array(8);
  let t = ts;
  for (let i = 7; i >= 0; i--) { tsBytes[i] = Number(t & 0xffn); t >>= 8n; }
  policyIdBytes.set(tsBytes, 0);
  policyIdBytes.set(new Uint8Array(24).map((_, i) => Number((rand >> BigInt((23 - i) * 8)) & 0xffn)), 8);
  const policyId = ("0x" + Array.from(policyIdBytes).map((b) => b.toString(16).padStart(2, "0")).join("")) as Hex;
  const vendorHash = ("0x" + "cc".repeat(32)) as Hex;

  // 1. Register the policy (with encrypted limits + threshold).
  console.log("\n[1/3] Registering policy (with encrypted limits) ...");
  const [dailyCt, perTxCt, thresholdCt] = await client
    .encryptInputs([
      Encryptable.uint128(1000n * 10n ** 18n), // 1000 USDe daily limit
      Encryptable.uint128(500n * 10n ** 18n), //  500 USDe per-tx limit
      Encryptable.uint128(50n * 10n ** 18n), //   50 USDe approval threshold
    ])
    .setChainId(CHAIN_ID)
    .execute();
  const regHash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS as Hex,
    abi: ABI,
    functionName: "registerPolicy",
    args: [policyId, dailyCt, perTxCt, thresholdCt],
  });
  const regReceipt = await publicClient.waitForTransactionReceipt({ hash: regHash });
  if (regReceipt.status !== "success") {
    throw new Error(`registerPolicy reverted (${regHash})`);
  }
  console.log(`  tx: ${regHash}  (block ${regReceipt.blockNumber})`);

  // 2. Encrypt a spend amount (100 USDe).
  console.log("\n[2/3] Encrypting 100 USDe spend amount ...");
  const encrypted = await client
    .encryptInputs([Encryptable.uint128(100n * 10n ** 18n)])
    .setChainId(CHAIN_ID)
    .execute();
  const amountCt = encrypted[0];
  console.log(`  ctHash:       ${amountCt.ctHash}`);
  console.log(`  securityZone: ${amountCt.securityZone}`);
  console.log(`  utype:        ${amountCt.utype}  (6 = uint128)`);

  // 3. evaluateSpend.
  console.log("\n[3/3] Submitting evaluateSpend ...");
  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS as Hex,
    abi: ABI,
    functionName: "evaluateSpend",
    args: [agentId, policyId, amountCt, vendorHash],
  });
  console.log(`  tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`evaluateSpend reverted (${hash})`);
  }
  console.log(`  block: ${receipt.blockNumber}, status: success`);

  let decisionId: string | null = null;
  let outcome: number | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: ABI,
        data: log.data,
        topics: log.topics,
      }) as { eventName: string; args: { decisionId: string; outcome: number } };
      if (decoded.eventName === "SpendEvaluated") {
        decisionId = decoded.args.decisionId;
        outcome = Number(decoded.args.outcome);
        break;
      }
    } catch {
      // not our event
    }
  }

  if (!decisionId) {
    throw new Error("SpendEvaluated event not found in receipt");
  }

  const outcomeLabel =
    ["Deny", "Hold", "Approve", "Pending"][outcome!] ?? `unknown(${outcome})`;
  console.log("\n✓ End-to-end FHE flow worked on Arbitrum Sepolia");
  console.log(`  decisionId: ${decisionId}`);
  console.log(`  outcome:    ${outcomeLabel}  (raw=${outcome})`);
  console.log(
    `\nThis proves the coFHE path is LIVE on Arbitrum Sepolia: encrypt (coFHE verifier) → onchain evaluateSpend (live TaskManager proxy) → SpendEvaluated event.`,
  );
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
