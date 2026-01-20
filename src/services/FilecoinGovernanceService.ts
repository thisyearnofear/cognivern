import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AgentAction, PolicyCheck } from "../types/Agent.js";
import logger from "../utils/logger.js";

// Filecoin Calibration testnet configuration
const FILECOIN_CALIBRATION = {
  id: 314159,
  name: "Filecoin Calibration",
  network: "filecoin-calibration",
  nativeCurrency: {
    decimals: 18,
    name: "testFIL",
    symbol: "tFIL",
  },
  rpcUrls: {
    default: {
      http: ["https://api.calibration.node.glif.io/rpc/v1"],
    },
    public: {
      http: ["https://api.calibration.node.glif.io/rpc/v1"],
    },
  },
  blockExplorers: {
    default: { name: "Filfox", url: "https://calibration.filfox.info/en" },
  },
  testnet: true,
} as const;

export interface GovernanceRecord {
  actionId: string;
  agentAddress: string;
  actionType: string;
  description: string;
  approved: boolean;
  policyCheckCount: number;
  policyResult: string;
  timestamp: number;
  filecoinCID: string;
  immutable: boolean;
}

export interface AgentInfo {
  agentAddress: string;
  name: string;
  agentType: string;
  totalActions: number;
  approvedActions: number;
  violations: number;
  registrationTime: number;
  active: boolean;
}

/**
 * Service for interacting with AI Governance Storage contract on Filecoin Virtual Machine
 */
export class FilecoinGovernanceService {
  private publicClient: any;
  private walletClient: any;
  private account: any;
  private contractAddress: string;
  private isConfigured: boolean = false;

  // Contract ABI (simplified for key functions)
  private readonly CONTRACT_ABI = [
    {
      inputs: [
        { name: "agentAddress", type: "address" },
        { name: "name", type: "string" },
        { name: "agentType", type: "string" },
      ],
      name: "registerAgent",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { name: "actionId", type: "bytes32" },
        { name: "agentAddress", type: "address" },
        { name: "actionType", type: "string" },
        { name: "description", type: "string" },
        { name: "approved", type: "bool" },
        { name: "policyCheckCount", type: "uint256" },
        { name: "policyResult", type: "string" },
        { name: "filecoinCID", type: "string" },
      ],
      name: "storeGovernanceAction",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ name: "actionId", type: "bytes32" }],
      name: "getGovernanceRecord",
      outputs: [
        {
          components: [
            { name: "actionId", type: "bytes32" },
            { name: "agentAddress", type: "address" },
            { name: "actionType", type: "string" },
            { name: "description", type: "string" },
            { name: "approved", type: "bool" },
            { name: "policyCheckCount", type: "uint256" },
            { name: "policyResult", type: "string" },
            { name: "timestamp", type: "uint256" },
            { name: "filecoinCID", type: "string" },
            { name: "immutable", type: "bool" },
          ],
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getGovernanceStats",
      outputs: [
        { name: "_totalActions", type: "uint256" },
        { name: "_totalViolations", type: "uint256" },
        { name: "_totalAgents", type: "uint256" },
        { name: "_approvalRate", type: "uint256" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, name: "actionId", type: "bytes32" },
        { indexed: true, name: "agentAddress", type: "address" },
        { name: "actionType", type: "string" },
        { name: "approved", type: "bool" },
        { name: "timestamp", type: "uint256" },
      ],
      name: "GovernanceActionStored",
      type: "event",
    },
  ] as const;

  constructor() {
    this.contractAddress =
      process.env.GOVERNANCE_CONTRACT_ADDRESS ||
      process.env.FILECOIN_GOVERNANCE_CONTRACT ||
      "";

    // Attempt to initialize. If it fails, we remain unconfigured.
    // Methods will throw if accessed in this state.
    try {
      this.initializeClients();
    } catch (error) {
      logger.warn(
        "FilecoinGovernanceService configuration missing. Service will fail if used.",
        error
      );
    }
  }

  /**
   * Initialize Filecoin clients
   */
  private initializeClients(): void {
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;
    const rpcUrl =
      process.env.FILECOIN_RPC_URL ||
      "https://api.calibration.node.glif.io/rpc/v1";

    if (!privateKey) {
      throw new Error("FILECOIN_PRIVATE_KEY not provided");
    }

    if (!this.contractAddress) {
      throw new Error("GOVERNANCE_CONTRACT_ADDRESS not provided");
    }

    // Create public client for reading
    this.publicClient = createPublicClient({
      chain: FILECOIN_CALIBRATION,
      transport: http(rpcUrl),
    });

    // Create wallet client for writing
    this.account = privateKeyToAccount(privateKey as `0x${string}`);
    this.walletClient = createWalletClient({
      account: this.account,
      chain: FILECOIN_CALIBRATION,
      transport: http(rpcUrl),
    });

    this.isConfigured = true;
    logger.info("FilecoinGovernanceService initialized with FVM integration");
  }

  /**
   * Store governance action on Filecoin
   */
  async storeGovernanceAction(
    action: AgentAction,
    policyChecks: PolicyCheck[],
    approved: boolean,
    filecoinCID: string = ""
  ): Promise<string> {
    if (!this.isConfigured || !this.contractAddress) {
      throw new Error("Filecoin Governance Service is not configured. Check environment variables.");
    }

    try {
      // Generate action ID hash
      const actionIdHash = keccak256(toBytes(action.id));

      // Prepare policy result
      const policyResult = JSON.stringify({
        checks: policyChecks.map((check) => ({
          policyId: check.policyId,
          result: check.result,
          reason: check.reason,
        })),
        approved,
        timestamp: action.timestamp,
      });

      // Generate agent address (deterministic for now, but real on-chain)
      const agentAddress = this.generateAgentAddress(
        action.metadata?.agent || "unknown"
      );

      // Call contract function
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: this.CONTRACT_ABI,
        functionName: "storeGovernanceAction",
        args: [
          actionIdHash,
          agentAddress,
          action.type,
          action.description,
          approved,
          BigInt(policyChecks.length),
          policyResult,
          filecoinCID || `ipfs_${action.id}`,
        ],
      });

      logger.info(`📦 Governance action stored on Filecoin: ${hash}`);
      logger.info(
        `🔗 View on Filfox: https://calibration.filfox.info/en/tx/${hash}`
      );

      return hash;
    } catch (error) {
      logger.error("Failed to store governance action on Filecoin:", error);
      throw error;
    }
  }

  /**
   * Register an agent on Filecoin
   */
  async registerAgent(agentName: string, agentType: string): Promise<string> {
    if (!this.isConfigured || !this.contractAddress) {
      throw new Error("Filecoin Governance Service is not configured. Check environment variables.");
    }

    try {
      const agentAddress = this.generateAgentAddress(agentName);

      const hash = await this.walletClient.writeContract({
        address: this.contractAddress as `0x${string}`,
        abi: this.CONTRACT_ABI,
        functionName: "registerAgent",
        args: [agentAddress, agentName, agentType],
      });

      logger.info(`🤖 Agent registered on Filecoin: ${hash}`);
      return hash;
    } catch (error) {
      logger.error("Failed to register agent on Filecoin:", error);
      throw error;
    }
  }

  /**
   * Get governance record from Filecoin
   */
  async getGovernanceRecord(
    actionId: string
  ): Promise<GovernanceRecord | null> {
    if (!this.isConfigured || !this.contractAddress) {
      throw new Error("Filecoin Governance Service is not configured. Check environment variables.");
    }

    try {
      const actionIdHash = keccak256(toBytes(actionId));

      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: this.CONTRACT_ABI,
        functionName: "getGovernanceRecord",
        args: [actionIdHash],
      });

      return result as GovernanceRecord;
    } catch (error) {
      logger.error("Failed to get governance record from Filecoin:", error);
      throw error;
    }
  }

  /**
   * Get governance statistics from Filecoin
   */
  async getGovernanceStats(): Promise<{
    totalActions: number;
    totalViolations: number;
    totalAgents: number;
    approvalRate: number;
  }> {
    if (!this.isConfigured || !this.contractAddress) {
      throw new Error("Filecoin Governance Service is not configured. Check environment variables.");
    }

    try {
      const result = await this.publicClient.readContract({
        address: this.contractAddress as `0x${string}`,
        abi: this.CONTRACT_ABI,
        functionName: "getGovernanceStats",
      });

      return {
        totalActions: Number(result[0]),
        totalViolations: Number(result[1]),
        totalAgents: Number(result[2]),
        approvalRate: Number(result[3]),
      };
    } catch (error) {
      logger.error("Failed to get governance stats from Filecoin:", error);
      throw error;
    }
  }

  /**
   * Generate deterministic agent address for demo
   */
  private generateAgentAddress(agentName: string): `0x${string}` {
    const hash = keccak256(toBytes(agentName));
    return `0x${hash.slice(2, 42)}` as `0x${string}`;
  }

  /**
   * Check if service is properly configured
   */
  isReady(): boolean {
    return this.isConfigured && !!this.contractAddress;
  }

  /**
   * Get service configuration status
   */
  getStatus(): {
    configured: boolean;
    contractAddress: string;
    hasPrivateKey: boolean;
    chainId: number;
  } {
    return {
      configured: this.isConfigured,
      contractAddress: this.contractAddress,
      hasPrivateKey: !!process.env.FILECOIN_PRIVATE_KEY,
      chainId: FILECOIN_CALIBRATION.id,
    };
  }

  /**
   * Get Filecoin explorer URL for transaction
   */
  getExplorerUrl(txHash: string): string {
    return `https://calibration.filfox.info/en/tx/${txHash}`;
  }
}
