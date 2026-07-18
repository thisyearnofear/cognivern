import { ethers } from "ethers";
import logger from "@backend/utils/logger.js";

/**
 * ZeroGProofService — posts governance decision proofs to 0G Chain.
 *
 * Every time the governance engine evaluates a spend action, this service
 * records the decision (approved/denied/held) as an on-chain event on the
 * GovernanceProof contract deployed on 0G Galileo Testnet.
 *
 * The proof is fire-and-forget: if 0G Chain is unreachable, governance
 * still works — the decision is recorded in the local audit log. The
 * on-chain proof is an additional layer of verifiability, not a dependency.
 *
 * Network: 0G Galileo Testnet (chain ID 16602)
 * RPC:     https://evmrpc-testnet.0g.ai
 * Explorer: https://chainscan-galileo.0g.ai
 */

const ZEROG_RPC_URL =
  process.env.ZEROG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZEROG_CHAIN_ID = parseInt(process.env.ZEROG_CHAIN_ID || "16602");
const ZEROG_PRIVATE_KEY =
  process.env.ZEROG_PRIVATE_KEY || process.env.OWS_BOOTSTRAP_PRIVATE_KEY || "";
const ZEROG_PROOF_CONTRACT =
  process.env.ZEROG_PROOF_CONTRACT || "";

// ABI — just the recordDecision function
const PROOF_ABI = [
  {
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
      { name: "actionType", type: "string" },
      { name: "amount", type: "uint256" },
      { name: "currency", type: "string" },
      { name: "decision", type: "string" },
      { name: "timestamp", type: "uint256" },
    ],
    name: "recordDecision",
    outputs: [{ name: "decisionHash", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "decisionHash", type: "bytes32" },
      { indexed: true, name: "workspaceId", type: "bytes32" },
      { indexed: true, name: "agentId", type: "bytes32" },
      { indexed: false, name: "actionType", type: "string" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "currency", type: "string" },
      { indexed: false, name: "decision", type: "string" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "GovernanceDecision",
    type: "event",
  },
  {
    inputs: [],
    name: "proofCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export interface GovernanceProofResult {
  txHash: string;
  decisionHash: string;
  blockNumber: number | null;
  explorerUrl: string;
  network: string;
}

class ZeroGProofService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private enabled = false;

  constructor() {
    if (!ZEROG_PRIVATE_KEY) {
      logger.warn(
        "[ZeroGProof] No private key configured — on-chain proofs disabled",
      );
      return;
    }
    if (!ZEROG_PROOF_CONTRACT) {
      logger.warn(
        "[ZeroGProof] No contract address configured — on-chain proofs disabled",
      );
      return;
    }

    try {
      this.provider = new ethers.JsonRpcProvider(
        ZEROG_RPC_URL,
        ZEROG_CHAIN_ID,
      );
      this.wallet = new ethers.Wallet(ZEROG_PRIVATE_KEY, this.provider);
      this.contract = new ethers.Contract(
        ZEROG_PROOF_CONTRACT,
        PROOF_ABI,
        this.wallet,
      );
      this.enabled = true;
      logger.info(
        `[ZeroGProof] Initialized — contract: ${ZEROG_PROOF_CONTRACT}, wallet: ${this.wallet.address}`,
      );
    } catch (err) {
      logger.error(`[ZeroGProof] Failed to initialize: ${err}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a governance decision on 0G Chain.
   * Fire-and-forget — returns null on failure, never throws.
   */
  async recordDecision(params: {
    workspaceId: string;
    agentId: string;
    actionType: string;
    amount: number;
    currency: string;
    decision: string;
    timestamp: number;
  }): Promise<GovernanceProofResult | null> {
    if (!this.enabled || !this.contract || !this.provider) {
      return null;
    }

    try {
      // Hash workspace and agent IDs to bytes32 for on-chain efficiency
      const workspaceHash = ethers.id(params.workspaceId);
      const agentHash = ethers.id(params.agentId);
      const amountWei = BigInt(Math.round(params.amount * 1e6)); // store in micro-units

      const tx = await this.contract.recordDecision(
        workspaceHash,
        agentHash,
        params.actionType,
        amountWei,
        params.currency || "USDC",
        params.decision,
        params.timestamp,
        {
          gasLimit: 200000, // fixed gas limit — estimate can fail on cold RPC
        },
      );

      const receipt = await tx.wait(1); // wait for 1 confirmation
      const decisionHash = ethers.solidityPackedKeccak256(
        ["bytes32", "bytes32", "string", "uint256", "string", "string", "uint256"],
        [workspaceHash, agentHash, params.actionType, amountWei, params.currency || "USDC", params.decision, params.timestamp],
      );

      const result: GovernanceProofResult = {
        txHash: tx.hash,
        decisionHash,
        blockNumber: receipt?.blockNumber ?? null,
        explorerUrl: `https://chainscan-galileo.0g.ai/tx/${tx.hash}`,
        network: "0g-galileo-testnet",
      };

      logger.info(
        `[ZeroGProof] Decision recorded — tx: ${tx.hash}, block: ${receipt?.blockNumber}`,
      );

      return result;
    } catch (err) {
      logger.error(`[ZeroGProof] Failed to record decision: ${err}`);
      return null;
    }
  }

  /**
   * Get the contract address and explorer URL for display.
   */
  getInfo() {
    return {
      enabled: this.enabled,
      contractAddress: ZEROG_PROOF_CONTRACT,
      explorerUrl: ZEROG_PROOF_CONTRACT
        ? `https://chainscan-galileo.0g.ai/address/${ZEROG_PROOF_CONTRACT}`
        : null,
      network: "0g-galileo-testnet",
      chainId: ZEROG_CHAIN_ID,
    };
  }
}

// Singleton
export const sharedZeroGProofService = new ZeroGProofService();
