import { ethers } from 'ethers';
import logger from '@backend/utils/logger.js';
import {
  buildCommitments,
  policySetFromChecks,
  type ZeroGV2PolicySet,
  type ZeroGDecision,
} from '../../../shared/zerog-proof-v2.js';

/**
 * Rail-parameterized GovernanceProofV2 client.
 *
 * The contract is identical on every EVM chain and the proof ID is
 * domain-separated by chainId + contract address, so one implementation can
 * anchor the same canonical commitments on any rail (0G Mainnet, X Layer
 * Mainnet, …). Each rail instance is configured explicitly by a thin wrapper
 * (ZeroGProofV2Service, XLayerProofV2Service); nothing here reads process.env
 * or hardcodes a chain.
 *
 * Posting is fire-and-forget: recordDecision returns null on failure and never
 * throws, so a proof rail can never block governance or audit persistence.
 */

export interface GovernanceProofV2RailConfig {
  /** Stable rail id recorded in receipts and run evidence (e.g. "0g-mainnet"). */
  network: string;
  /** Log prefix, e.g. "[ZeroGProofV2]". */
  logTag: string;
  /** Human label for refusal and log messages, e.g. "0G Mainnet". */
  displayName: string;
  /** Resolved opt-in flag; when false the service stays disabled. */
  enabled: boolean;
  rpcUrl: string;
  chainId: number;
  /** Chain ID the RPC must report; the service refuses anything else. */
  expectedChainId: number;
  posterPrivateKey: string;
  contractAddress: string;
  /** Explorer base for tx pages, without trailing slash or `/tx`. */
  explorerTxBase: string;
  /** Explorer base for address pages, without trailing slash or `/address`. */
  explorerAddressBase: string;
}

export interface GovernanceProofV2Result {
  txHash: string;
  proofId: string;
  decisionHash: string;
  runIdHash: string;
  evidenceHash: string;
  policySetHash: string;
  blockNumber: number | null;
  explorerUrl: string;
  network: string;
  chainId: number;
}

export interface GovernanceProofV2Input {
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

export class GovernanceProofV2Service {
  protected readonly config: GovernanceProofV2RailConfig;
  private readonly provider?: ethers.JsonRpcProvider;
  private readonly wallet?: ethers.Wallet;
  private readonly contract?: ethers.Contract;
  private readonly enabled: boolean;
  private networkCheck?: Promise<void>;

  constructor(config: GovernanceProofV2RailConfig) {
    this.config = config;
    const { logTag } = config;

    if (!config.enabled) {
      this.enabled = false;
      return;
    }
    if (config.chainId !== config.expectedChainId) {
      logger.warn(
        `${logTag} Refusing unexpected chain configuration: ${config.chainId} (expected ${config.expectedChainId} for ${config.displayName})`,
      );
      this.enabled = false;
      return;
    }
    if (!config.posterPrivateKey || !config.contractAddress) {
      logger.info(`${logTag} Poster key or contract not configured — proof posting disabled`);
      this.enabled = false;
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
      this.wallet = new ethers.Wallet(config.posterPrivateKey, this.provider);
      this.contract = new ethers.Contract(config.contractAddress, PROOF_ABI, this.wallet);
      this.enabled = true;
      logger.info(
        `${logTag} Initialized — contract: ${config.contractAddress}, poster: ${this.wallet.address}`,
      );
    } catch (error) {
      this.enabled = false;
      logger.error(`${logTag} Failed to initialize: ${error}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getInfo() {
    const { config } = this;
    return {
      enabled: this.enabled,
      version: 'v2',
      contractAddress: config.contractAddress || null,
      explorerUrl: config.contractAddress
        ? `${config.explorerAddressBase}/address/${config.contractAddress}`
        : null,
      network: config.network,
      chainId: config.chainId,
    };
  }

  async recordDecision(input: GovernanceProofV2Input): Promise<GovernanceProofV2Result | null> {
    const { config } = this;
    const { logTag } = config;
    if (!this.enabled || !this.contract || !this.provider) return null;

    try {
      await this.ensureChain();
      const commitments = buildCommitments({
        contractAddress: config.contractAddress,
        chainId: BigInt(config.chainId),
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

      const result: GovernanceProofV2Result = {
        txHash: tx.hash,
        proofId: commitments.proofId,
        decisionHash: commitments.proofId,
        runIdHash: commitments.runIdHash,
        evidenceHash: commitments.evidenceHash,
        policySetHash: commitments.policySetHash,
        blockNumber: receipt?.blockNumber ?? null,
        explorerUrl: `${config.explorerTxBase}/tx/${tx.hash}`,
        network: config.network,
        chainId: config.chainId,
      };

      logger.info(
        `${logTag} Decision recorded — run=${input.runId}, proof=${result.proofId}, tx=${tx.hash}`,
      );
      return result;
    } catch (error) {
      logger.error(`${logTag} Failed to record decision: ${error}`);
      return null;
    }
  }

  private async readExistingProof(
    commitments: ReturnType<typeof buildCommitments>,
  ): Promise<GovernanceProofV2Result | null> {
    const { config } = this;
    const runBlock = Number(await this.contract!.runBlock(commitments.runIdHash));
    const eventTopic = ethers.id('GovernanceDecision(bytes32,bytes32,bytes32,uint8,uint64,uint64)');
    const logs = await this.provider!.getLogs({
      address: config.contractAddress,
      topics: [eventTopic, commitments.proofId],
      fromBlock: runBlock,
      toBlock: runBlock,
    });
    const log = logs[0];
    if (!log) {
      logger.warn(
        `${config.logTag} Run index exists but its event is not available yet — run=${commitments.evidenceBundle.runId}`,
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
      explorerUrl: `${config.explorerTxBase}/tx/${log.transactionHash}`,
      network: config.network,
      chainId: config.chainId,
    };
  }

  private async ensureChain(): Promise<void> {
    const { config } = this;
    this.networkCheck ||= this.provider!.getNetwork().then((network) => {
      if (network.chainId !== BigInt(config.expectedChainId)) {
        throw new Error(
          `GovernanceProofV2 RPC returned chain ${network.chainId}; expected ${config.expectedChainId} (${config.displayName})`,
        );
      }
    });
    return this.networkCheck;
  }
}
