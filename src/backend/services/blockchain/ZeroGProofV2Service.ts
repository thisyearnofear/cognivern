import { ethers } from 'ethers';
import logger from '@backend/utils/logger.js';
import {
  buildCommitments,
  policySetFromChecks,
  type ZeroGV2PolicySet,
  type ZeroGDecision,
} from '../../../shared/zerog-proof-v2.js';

const MAINNET_CHAIN_ID = 16661;
const RPC_URL = process.env.ZEROG_MAINNET_RPC_URL || 'https://evmrpc.0g.ai';
const CHAIN_ID = Number(process.env.ZEROG_MAINNET_CHAIN_ID || MAINNET_CHAIN_ID);
const PRIVATE_KEY = process.env.ZEROG_MAINNET_POSTER_PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.ZEROG_MAINNET_PROOF_CONTRACT || '';

const PROOF_ABI = [
  {
    inputs: [
      { name: 'runIdHash', type: 'bytes32' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'policySetHash', type: 'bytes32' },
      { name: 'decision', type: 'uint8' },
      { name: 'decisionTimestamp', type: 'uint64' },
    ],
    name: 'recordDecision',
    outputs: [{ name: 'proofId', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'runIdHash', type: 'bytes32' },
      { name: 'evidenceHash', type: 'bytes32' },
      { name: 'policySetHash', type: 'bytes32' },
      { name: 'decision', type: 'uint8' },
      { name: 'decisionTimestamp', type: 'uint64' },
    ],
    name: 'computeProofId',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'runIdHash', type: 'bytes32' }],
    name: 'runBlock',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'runIdHash', type: 'bytes32' }],
    name: 'runProofId',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'proofId', type: 'bytes32' },
      { indexed: true, name: 'evidenceHash', type: 'bytes32' },
      { indexed: true, name: 'policySetHash', type: 'bytes32' },
      { indexed: false, name: 'decision', type: 'uint8' },
      { indexed: false, name: 'decisionTimestamp', type: 'uint64' },
      { indexed: false, name: 'recordedAt', type: 'uint64' },
    ],
    name: 'GovernanceDecision',
    type: 'event',
  },
];

export interface ZeroGProofV2Result {
  txHash: string;
  proofId: string;
  decisionHash: string;
  runIdHash: string;
  evidenceHash: string;
  policySetHash: string;
  blockNumber: number | null;
  explorerUrl: string;
  network: '0g-mainnet';
  chainId: number;
}

export interface ZeroGProofV2Input {
  runId: string;
  decision: ZeroGDecision;
  decisionTimestamp: number;
  action: unknown;
  policyChecks: Array<{
    policyId: string;
    result: boolean;
    reason?: string;
    metadata?: Record<string, unknown>;
  }>;
  policySet?: ZeroGV2PolicySet;
  evidence?: unknown;
}

export class ZeroGProofV2Service {
  private readonly provider?: ethers.JsonRpcProvider;
  private readonly wallet?: ethers.Wallet;
  private readonly contract?: ethers.Contract;
  private readonly enabled: boolean;
  private networkCheck?: Promise<void>;

  constructor() {
    if (process.env.ZEROG_PROOF_VERSION !== 'v2') {
      this.enabled = false;
      return;
    }
    if (CHAIN_ID !== MAINNET_CHAIN_ID) {
      logger.warn(`[ZeroGProofV2] Refusing non-mainnet chain configuration: ${CHAIN_ID}`);
      this.enabled = false;
      return;
    }
    if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
      logger.info('[ZeroGProofV2] Mainnet poster key or contract not configured — V2 disabled');
      this.enabled = false;
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
      this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, PROOF_ABI, this.wallet);
      this.enabled = true;
      logger.info(
        `[ZeroGProofV2] Initialized — contract: ${CONTRACT_ADDRESS}, poster: ${this.wallet.address}`,
      );
    } catch (error) {
      this.enabled = false;
      logger.error(`[ZeroGProofV2] Failed to initialize: ${error}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getInfo() {
    return {
      enabled: this.enabled,
      version: 'v2',
      contractAddress: CONTRACT_ADDRESS || null,
      explorerUrl: CONTRACT_ADDRESS ? `https://chainscan.0g.ai/address/${CONTRACT_ADDRESS}` : null,
      network: '0g-mainnet',
      chainId: CHAIN_ID,
    };
  }

  async recordDecision(input: ZeroGProofV2Input): Promise<ZeroGProofV2Result | null> {
    if (!this.enabled || !this.contract || !this.provider) return null;

    try {
      await this.ensureMainnet();
      const commitments = buildCommitments({
        contractAddress: CONTRACT_ADDRESS,
        chainId: BigInt(CHAIN_ID),
        runId: input.runId,
        evidence: {
          action: input.action as never,
          policyChecks: input.policyChecks as never,
          evidence: (input.evidence ?? {}) as never,
        },
        policySet: input.policySet || policySetFromChecks(input.policyChecks),
        decision: input.decision,
        decisionTimestamp: input.decisionTimestamp,
      });

      const contractProofId = await this.contract.computeProofId(
        commitments.runIdHash,
        commitments.evidenceHash,
        commitments.policySetHash,
        commitments.decisionCode,
        commitments.decisionTimestamp,
      );
      if (contractProofId.toLowerCase() !== commitments.proofId.toLowerCase()) {
        throw new Error(
          `Contract proof ID mismatch: local=${commitments.proofId}, chain=${contractProofId}`,
        );
      }

      // First-write-wins is enforced on-chain. Check the run index before
      // submitting a retry so a network timeout cannot create a second
      // transaction that is guaranteed to revert. A changed payload for an
      // existing run is rejected locally rather than being treated as a
      // successful retry.
      const existingProofId = (await this.contract.runProofId(commitments.runIdHash)) as string;
      if (existingProofId !== ethers.ZeroHash) {
        if (existingProofId.toLowerCase() !== commitments.proofId.toLowerCase()) {
          throw new Error(
            `Existing GovernanceProofV2 run has a different proof ID: existing=${existingProofId}, local=${commitments.proofId}`,
          );
        }
        return this.readExistingProof(commitments);
      }

      const tx = await this.contract.recordDecision(
        commitments.runIdHash,
        commitments.evidenceHash,
        commitments.policySetHash,
        commitments.decisionCode,
        commitments.decisionTimestamp,
        { gasLimit: 200000 },
      );
      const receipt = await tx.wait(1);

      const result: ZeroGProofV2Result = {
        txHash: tx.hash,
        proofId: commitments.proofId,
        decisionHash: commitments.proofId,
        runIdHash: commitments.runIdHash,
        evidenceHash: commitments.evidenceHash,
        policySetHash: commitments.policySetHash,
        blockNumber: receipt?.blockNumber ?? null,
        explorerUrl: `https://chainscan.0g.ai/tx/${tx.hash}`,
        network: '0g-mainnet',
        chainId: CHAIN_ID,
      };

      logger.info(
        `[ZeroGProofV2] Decision recorded — run=${input.runId}, proof=${result.proofId}, tx=${tx.hash}`,
      );
      return result;
    } catch (error) {
      logger.error(`[ZeroGProofV2] Failed to record decision: ${error}`);
      return null;
    }
  }

  private async readExistingProof(
    commitments: ReturnType<typeof buildCommitments>,
  ): Promise<ZeroGProofV2Result | null> {
    const runBlock = Number(await this.contract!.runBlock(commitments.runIdHash));
    const eventTopic = ethers.id('GovernanceDecision(bytes32,bytes32,bytes32,uint8,uint64,uint64)');
    const logs = await this.provider!.getLogs({
      address: CONTRACT_ADDRESS,
      topics: [eventTopic, commitments.proofId],
      fromBlock: runBlock,
      toBlock: runBlock,
    });
    const log = logs[0];
    if (!log) {
      logger.warn(
        `[ZeroGProofV2] Run index exists but its event is not available yet — run=${commitments.evidenceBundle.runId}`,
      );
      return null;
    }

    return {
      txHash: log.transactionHash,
      proofId: commitments.proofId,
      decisionHash: commitments.proofId,
      runIdHash: commitments.runIdHash,
      evidenceHash: commitments.evidenceHash,
      policySetHash: commitments.policySetHash,
      blockNumber: log.blockNumber ?? (runBlock || null),
      explorerUrl: `https://chainscan.0g.ai/tx/${log.transactionHash}`,
      network: '0g-mainnet',
      chainId: CHAIN_ID,
    };
  }

  private async ensureMainnet(): Promise<void> {
    this.networkCheck ||= this.provider!.getNetwork().then((network) => {
      if (network.chainId !== BigInt(MAINNET_CHAIN_ID)) {
        throw new Error(
          `0G Proof V2 RPC returned chain ${network.chainId}; expected ${MAINNET_CHAIN_ID}`,
        );
      }
    });
    return this.networkCheck;
  }
}
