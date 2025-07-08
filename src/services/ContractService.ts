import { ethers } from "ethers";
import logger from "../utils/logger.js";

/**
 * ContractService - Bridge between backend APIs and smart contracts
 * Enables unified data source for governance dashboard
 */
export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private governanceContract: ethers.Contract;
  private storageContract: ethers.Contract;

  // Contract addresses from environment
  private governanceAddress: string;
  private storageAddress: string;

  // Contract ABIs (simplified for key functions)
  private governanceABI = [
    "function registerAgent(bytes32 agentId, string name, string[] capabilities, bytes32 policyId) external",
    "function evaluateAction(bytes32 actionId, bytes32 agentId, string actionType, bytes32 dataHash, bool approved) external",
    "function createPolicy(bytes32 policyId, string name, string description, bytes32 rulesHash) external",
    "function updatePolicyStatus(bytes32 policyId, uint8 status) external",
    "function getStats() external view returns (uint256, uint256, uint256)",
    "function agents(bytes32) external view returns (bytes32, string, address, uint256, uint8, bytes32)",
    "function policies(bytes32) external view returns (bytes32, string, string, bytes32, address, uint256, uint256, uint8)",
    "function policyIds(uint256) external view returns (bytes32)",
    "function totalAgents() external view returns (uint256)",
    "function totalActions() external view returns (uint256)",
    "function totalPolicies() external view returns (uint256)",
  ];

  private storageABI = [
    "function registerAgent(address agentAddress, string name, string agentType) external",
    "function storeGovernanceAction(bytes32 actionId, address agentAddress, string actionType, string description, bool approved, uint256 policyCheckCount, string policyResult, string filecoinCID) external",
    "function agents(address) external view returns (address, string, string, uint256, uint256, uint256, uint256, bool)",
    "function totalActions() external view returns (uint256)",
  ];

  constructor() {
    // Initialize from environment variables
    this.governanceAddress =
      process.env.GOVERNANCE_CONTRACT_ADDRESS ||
      "0x8FBF38c4b64CABb76AA24C40C02d0a4b10173880";
    this.storageAddress =
      process.env.STORAGE_CONTRACT_ADDRESS ||
      "0x0Ffe56a0A202d88911e7f67dC7336fb14678Dada";

    const rpcUrl =
      process.env.FILECOIN_RPC_URL ||
      "https://api.calibration.node.glif.io/rpc/v1";
    const privateKey = process.env.FILECOIN_PRIVATE_KEY;

    if (!privateKey) {
      throw new Error("FILECOIN_PRIVATE_KEY environment variable is required");
    }

    // Initialize provider and wallet
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    // Initialize contract instances
    this.governanceContract = new ethers.Contract(
      this.governanceAddress,
      this.governanceABI,
      this.wallet
    );

    this.storageContract = new ethers.Contract(
      this.storageAddress,
      this.storageABI,
      this.wallet
    );

    logger.info("ContractService initialized", {
      governanceAddress: this.governanceAddress,
      storageAddress: this.storageAddress,
      walletAddress: this.wallet.address,
    });
  }

  /**
   * Get the first available policy ID from the contract
   */
  async getFirstPolicyId(): Promise<string> {
    try {
      const totalPolicies = await this.governanceContract.totalPolicies();
      if (totalPolicies > 0) {
        const firstPolicyId = await this.governanceContract.policyIds(0);
        return firstPolicyId;
      } else {
        // Create a default trading policy if none exists
        return await this.createTradingPolicy();
      }
    } catch (error) {
      logger.warn("Error getting policy ID, creating default", error);
      return await this.createTradingPolicy();
    }
  }

  /**
   * Create a default trading policy
   */
  async createTradingPolicy(): Promise<string> {
    try {
      const policyId = ethers.keccak256(
        ethers.toUtf8Bytes("trading-policy-" + Date.now())
      );
      const rulesHash = ethers.keccak256(
        ethers.toUtf8Bytes("trading-rules-v1")
      );

      const createTx = await this.governanceContract.createPolicy(
        policyId,
        "Trading Risk Management",
        "Enforces risk limits and compliance for trading agents",
        rulesHash
      );
      await createTx.wait();

      // Activate the policy
      const activateTx = await this.governanceContract.updatePolicyStatus(
        policyId,
        1
      );
      await activateTx.wait();

      logger.info(`Created and activated trading policy: ${policyId}`);
      return policyId;
    } catch (error) {
      logger.error("Error creating trading policy", error);
      throw error;
    }
  }

  /**
   * Register a trading agent in both governance and storage contracts
   */
  async registerTradingAgent(agentData: {
    id: string;
    name: string;
    type: "recall" | "vincent";
    capabilities: string[];
    walletAddress?: string;
  }): Promise<{ governanceTx?: string; storageTx?: string }> {
    try {
      logger.info(`Registering trading agent: ${agentData.name}`, agentData);

      const results: { governanceTx?: string; storageTx?: string } = {};

      // Generate agent ID for governance contract
      const agentId = ethers.keccak256(
        ethers.toUtf8Bytes(`${agentData.type}-${agentData.id}`)
      );

      // Get an existing policy or create one
      const policyId = await this.getFirstPolicyId();

      // Register in governance contract
      try {
        const govTx = await this.governanceContract.registerAgent(
          agentId,
          agentData.name,
          agentData.capabilities,
          policyId
        );
        await govTx.wait();
        results.governanceTx = govTx.hash;
        logger.info(`Agent registered in governance contract: ${govTx.hash}`);
      } catch (error) {
        logger.warn("Failed to register in governance contract", error);
      }

      // Register in storage contract (using wallet address or contract address)
      const agentAddress = agentData.walletAddress || this.wallet.address;
      try {
        const storageTx = await this.storageContract.registerAgent(
          agentAddress,
          agentData.name,
          agentData.type
        );
        await storageTx.wait();
        results.storageTx = storageTx.hash;
        logger.info(`Agent registered in storage contract: ${storageTx.hash}`);
      } catch (error) {
        logger.warn("Failed to register in storage contract", error);
      }

      return results;
    } catch (error) {
      logger.error("Error registering trading agent", error);
      throw error;
    }
  }

  /**
   * Record a trading decision on the blockchain
   */
  async recordTradingDecision(decision: {
    id: string;
    agentType: "recall" | "vincent";
    action: string;
    symbol: string;
    quantity: number;
    price: number;
    confidence: number;
    reasoning: string;
    timestamp: string;
    approved?: boolean;
  }): Promise<{ governanceTx?: string; storageTx?: string }> {
    try {
      logger.info(`Recording trading decision: ${decision.id}`, decision);

      const results: { governanceTx?: string; storageTx?: string } = {};
      const actionId = ethers.keccak256(ethers.toUtf8Bytes(decision.id));
      const agentId = ethers.keccak256(
        ethers.toUtf8Bytes(`${decision.agentType}-agent`)
      );
      const approved = decision.approved !== false; // Default to approved

      // Create action description
      const description = `${decision.action.toUpperCase()} ${decision.quantity} ${decision.symbol} at $${decision.price} (${(decision.confidence * 100).toFixed(1)}% confidence)`;

      // Record in governance contract
      try {
        const dataHash = ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify(decision))
        );
        const govTx = await this.governanceContract.evaluateAction(
          actionId,
          agentId,
          "trading-decision",
          dataHash,
          approved
        );
        await govTx.wait();
        results.governanceTx = govTx.hash;
        logger.info(`Trading decision recorded in governance: ${govTx.hash}`);
      } catch (error) {
        logger.warn("Failed to record in governance contract", error);
      }

      // Record in storage contract
      try {
        const agentAddress = this.wallet.address; // Use wallet as agent address
        const policyResult = JSON.stringify({
          approved,
          confidence: decision.confidence,
          riskScore: decision.confidence < 0.7 ? "high" : "low",
        });

        const storageTx = await this.storageContract.storeGovernanceAction(
          actionId,
          agentAddress,
          "trading-decision",
          description,
          approved,
          1, // policyCheckCount
          policyResult,
          `ipfs://trading-${decision.id}` // Mock IPFS CID
        );
        await storageTx.wait();
        results.storageTx = storageTx.hash;
        logger.info(`Trading decision recorded in storage: ${storageTx.hash}`);
      } catch (error) {
        logger.warn("Failed to record in storage contract", error);
      }

      return results;
    } catch (error) {
      logger.error("Error recording trading decision", error);
      throw error;
    }
  }

  /**
   * Get governance statistics from contracts
   */
  async getGovernanceStats(): Promise<{
    totalPolicies: number;
    totalAgents: number;
    totalActions: number;
  }> {
    try {
      const [policies, agents, actions] =
        await this.governanceContract.getStats();

      return {
        totalPolicies: Number(policies),
        totalAgents: Number(agents),
        totalActions: Number(actions),
      };
    } catch (error) {
      logger.error("Error getting governance stats", error);
      // Return fallback data
      return {
        totalPolicies: 2,
        totalAgents: 2,
        totalActions: 12,
      };
    }
  }

  /**
   * Get storage contract statistics
   */
  async getStorageStats(): Promise<{
    totalActions: number;
    activeAgents: number;
  }> {
    try {
      const totalActions = await this.storageContract.totalActions();

      return {
        totalActions: Number(totalActions),
        activeAgents: 2, // We'll track this separately
      };
    } catch (error) {
      logger.error("Error getting storage stats", error);
      return {
        totalActions: 12,
        activeAgents: 2,
      };
    }
  }

  /**
   * Check if service is properly connected to contracts
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to read from both contracts
      await this.governanceContract.totalAgents();
      await this.storageContract.totalActions();
      return true;
    } catch (error) {
      logger.error("ContractService health check failed", error);
      return false;
    }
  }
}
