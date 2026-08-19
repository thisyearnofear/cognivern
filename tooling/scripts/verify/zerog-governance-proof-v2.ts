import fs from 'node:fs';
import process from 'node:process';
import { ethers } from 'ethers';
import {
  buildCommitments,
  type ZeroGV2EvidenceBundle,
  type ZeroGV2PolicySet,
} from '../../../src/shared/zerog-proof-v2.js';

type Receipt = {
  chainId: number | string;
  contractAddress: string;
  proofId: string;
  txHash?: string;
};

const RPC_URL =
  process.env.ZEROG_PROOF_V2_RPC_URL || process.env.ZEROG_MAINNET_RPC_URL || 'https://evmrpc.0g.ai';
const EXPECTED_CHAIN_ID = 16661n;
const PROOF_ABI = [
  'function SCHEMA_VERSION() view returns (uint8)',
  'function computeProofId(bytes32,bytes32,bytes32,uint8,uint64) view returns (bytes32)',
  'function proofBlock(bytes32) view returns (uint256)',
  'function runBlock(bytes32) view returns (uint256)',
  'function runProofId(bytes32) view returns (bytes32)',
];

function usage(): never {
  throw new Error(
    'Usage: pnpm zerog:proof:verify <evidence.json> <policy-set.json> <receipt.json>',
  );
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

async function main() {
  const [evidenceFile, policyFile, receiptFile] = process.argv.slice(2);
  if (!evidenceFile || !policyFile || !receiptFile) usage();

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
  const provider = new ethers.JsonRpcProvider(RPC_URL, Number(EXPECTED_CHAIN_ID));
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    throw new Error(`Expected 0G Mainnet chain ${EXPECTED_CHAIN_ID}, got ${network.chainId}`);
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
