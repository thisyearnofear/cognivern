import fs from 'node:fs';
import process from 'node:process';
import { ethers } from 'ethers';
import {
  buildCommitments,
  type ZeroGV2EvidenceBundle,
  type ZeroGV2PolicySet,
} from '../../../src/shared/governance-proof-v2.js';

/**
 * Read-only GovernanceProofV2 receipt verifier. Rail-aware: the same contract
 * and canonicalization run on 0G Mainnet and X Layer Mainnet, with the proof
 * ID domain-separated by chainId + contract address.
 *
 * Usage:
 *   pnpm zerog:proof:verify <evidence.json> <policy-set.json> <receipt.json>
 *   pnpm xlayer:proof:verify <evidence.json> <policy-set.json> <receipt.json>
 */

type RailId = '0g-mainnet' | 'xlayer-mainnet';

const RAILS: Record<RailId, { chainId: bigint; rpcUrl: string; label: string }> = {
  '0g-mainnet': {
    chainId: 16661n,
    rpcUrl:
      process.env.ZEROG_PROOF_V2_RPC_URL ||
      process.env.ZEROG_MAINNET_RPC_URL ||
      'https://evmrpc.0g.ai',
    label: '0G Mainnet',
  },
  'xlayer-mainnet': {
    chainId: 196n,
    rpcUrl:
      process.env.XLAYER_PROOF_V2_RPC_URL ||
      process.env.XLAYER_MAINNET_RPC_URL ||
      'https://rpc.xlayer.tech',
    label: 'X Layer Mainnet',
  },
};

type Receipt = {
  chainId: number | string;
  contractAddress: string;
  proofId: string;
  txHash?: string;
};

const PROOF_ABI = [
  'function SCHEMA_VERSION() view returns (uint8)',
  'function computeProofId(bytes32,bytes32,bytes32,uint8,uint64) view returns (bytes32)',
  'function proofBlock(bytes32) view returns (uint256)',
  'function runBlock(bytes32) view returns (uint256)',
  'function runProofId(bytes32) view returns (bytes32)',
];

function usage(): never {
  throw new Error(
    'Usage: tsx governance-proof-v2.ts [--rail 0g-mainnet|xlayer-mainnet] <evidence.json> <policy-set.json> <receipt.json>',
  );
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/**
 * The deployments registry (contracts/deployments/<chainId>.json) records the
 * known GovernanceProofV2 address for each rail. When an address is recorded,
 * receipts must match it — verifying against a superseded or unknown
 * deployment is an error. A `planned` entry (null address) only warns, since
 * the receipt itself carries the address for first-verification flows.
 */
function registryEntryFor(chainId: bigint): { address: string | null; status: string } | null {
  try {
    const url = new URL(`../../../contracts/deployments/${chainId}.json`, import.meta.url);
    const registry = JSON.parse(fs.readFileSync(url, 'utf8')) as {
      contracts?: Array<{ name: string; address: string | null; status: string }>;
    };
    const entry = registry.contracts?.find((c) => c.name === 'GovernanceProofV2');
    return entry ? { address: entry.address, status: entry.status } : null;
  } catch {
    return null;
  }
}

function parseArgs(argv: string[]): { rail: RailId; files: string[] } {
  let rail: RailId = '0g-mainnet';
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--rail') {
      const value = argv[++i];
      if (value !== '0g-mainnet' && value !== 'xlayer-mainnet') {
        throw new Error(`Unknown rail: ${value}. Expected one of: ${Object.keys(RAILS).join(', ')}`);
      }
      rail = value;
      continue;
    }
    if (arg.startsWith('--rail=')) {
      const value = arg.slice('--rail='.length);
      if (value !== '0g-mainnet' && value !== 'xlayer-mainnet') {
        throw new Error(`Unknown rail: ${value}. Expected one of: ${Object.keys(RAILS).join(', ')}`);
      }
      rail = value;
      continue;
    }
    files.push(arg);
  }
  return { rail, files };
}

async function main() {
  const { rail, files } = parseArgs(process.argv.slice(2));
  const [evidenceFile, policyFile, receiptFile] = files;
  if (!evidenceFile || !policyFile || !receiptFile) usage();

  const railConfig = RAILS[rail];
  const EXPECTED_CHAIN_ID = railConfig.chainId;

  const evidence = readJson<ZeroGV2EvidenceBundle>(evidenceFile);
  const policySet = readJson<ZeroGV2PolicySet>(policyFile);
  const receipt = readJson<Receipt>(receiptFile);

  if (evidence.schemaVersion !== 1) {
    throw new Error(`Unsupported evidence schema version: ${evidence.schemaVersion}`);
  }
  if (!policySet || policySet.schemaVersion !== 1 || !Array.isArray(policySet.policies)) {
    throw new Error('Policy set must use schemaVersion 1 with an ordered policies array');
  }
  if (!/^\d+$/.test(evidence.decisionTimestamp)) {
    throw new Error('decisionTimestamp must be a decimal string');
  }
  const decisionTimestamp = BigInt(evidence.decisionTimestamp);
  if (decisionTimestamp > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('decisionTimestamp exceeds the verifier safe-integer range');
  }

  const contractAddress = assertAddress('receipt.contractAddress', receipt.contractAddress);
  const registryEntry = registryEntryFor(EXPECTED_CHAIN_ID);
  if (registryEntry?.address) {
    if (ethers.getAddress(registryEntry.address) !== contractAddress) {
      throw new Error(
        `Receipt contract ${contractAddress} does not match the deployments registry ` +
          `(${registryEntry.address}, status "${registryEntry.status}") for chain ${EXPECTED_CHAIN_ID}`,
      );
    }
  } else if (registryEntry) {
    console.error(
      `Note: deployments registry has no recorded GovernanceProofV2 address for chain ` +
        `${EXPECTED_CHAIN_ID} (status "${registryEntry.status}") — verifying the receipt-supplied address only.`,
    );
  }

  const provider = new ethers.JsonRpcProvider(railConfig.rpcUrl, Number(EXPECTED_CHAIN_ID));
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(
      `Expected ${railConfig.label} chain ${EXPECTED_CHAIN_ID}, got ${network.chainId}`,
    );
  }

  const contract = new ethers.Contract(contractAddress, PROOF_ABI, provider);
  const schemaVersion = await contract.SCHEMA_VERSION();
  if (schemaVersion !== 2n) {
    throw new Error(`Expected GovernanceProofV2 schema 2, got ${schemaVersion}`);
  }

  const commitments = buildCommitments({
    contractAddress,
    chainId: EXPECTED_CHAIN_ID,
    runId: evidence.runId,
    evidence: {
      action: evidence.action,
      policyChecks: evidence.policyChecks,
      evidence: evidence.evidence,
    },
    policySet,
    decision: evidence.decision,
    decisionTimestamp: Number(decisionTimestamp),
  });
  const contractProofId = await contract.computeProofId(
    commitments.runIdHash,
    commitments.evidenceHash,
    commitments.policySetHash,
    commitments.decisionCode,
    commitments.decisionTimestamp,
  );
  if (contractProofId.toLowerCase() !== commitments.proofId.toLowerCase()) {
    throw new Error(
      `Contract proofId mismatch: expected ${commitments.proofId}, got ${contractProofId}`,
    );
  }

  if (receipt.proofId && receipt.proofId.toLowerCase() !== commitments.proofId.toLowerCase()) {
    throw new Error(
      `Receipt proofId mismatch: expected ${commitments.proofId}, got ${receipt.proofId}`,
    );
  }
  if (receipt.chainId !== undefined && BigInt(receipt.chainId) !== EXPECTED_CHAIN_ID) {
    throw new Error(`Receipt chainId mismatch: expected ${EXPECTED_CHAIN_ID}`);
  }
  if (receipt.txHash) {
    const transactionReceipt = await provider.getTransactionReceipt(receipt.txHash);
    if (!transactionReceipt || transactionReceipt.status !== 1) {
      throw new Error(`Receipt transaction is missing or failed: ${receipt.txHash}`);
    }
    if (transactionReceipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
      throw new Error(`Receipt transaction target mismatch: ${transactionReceipt.to}`);
    }
  }

  const proofBlock = await contract.proofBlock(commitments.proofId);
  const runBlock = await contract.runBlock(commitments.runIdHash);
  const runProofId = await contract.runProofId(commitments.runIdHash);
  if (
    proofBlock === 0n ||
    runBlock === 0n ||
    runProofId.toLowerCase() !== commitments.proofId.toLowerCase()
  ) {
    throw new Error(`No matching first-write proof found for ${evidence.runId}`);
  }

  console.log(
    JSON.stringify(
      {
        verified: true,
        rail,
        chainId: Number(EXPECTED_CHAIN_ID),
        contractAddress,
        proofId: commitments.proofId,
        runIdHash: commitments.runIdHash,
        evidenceHash: commitments.evidenceHash,
        policySetHash: commitments.policySetHash,
        decision: commitments.decisionCode,
        decisionTimestamp: evidence.decisionTimestamp,
        proofBlock: proofBlock.toString(),
        runBlock: runBlock.toString(),
        txHash: receipt.txHash || null,
      },
      null,
      2,
    ),
  );
}

function assertAddress(name: string, value: string): string {
  if (!ethers.isAddress(value)) throw new Error(`${name} is not a valid address`);
  return ethers.getAddress(value);
}

main().catch((error) => {
  console.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
