/**
 * X Layer API Service - Frontend Integration
 *
 * Integrates with X Layer (OKX L2 zkEVM) for:
 * - Fetching account information and balances
 * - Interacting with deployed governance contracts
 * - Monitoring network status and connectivity
 */

import { ethers } from "ethers";

// X Layer RPC endpoint
const XLAYER_RPC_ENDPOINT =
  import.meta.env.VITE_XLAYER_RPC_URL || "https://testrpc.xlayer.tech";

// Contract addresses (deployed on X Layer)
export const CONTRACT_ADDRESSES = {
  GOVERNANCE_CONTRACT:
    import.meta.env.VITE_GOVERNANCE_CONTRACT_ADDRESS ||
    "0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6",
  STORAGE_CONTRACT:
    import.meta.env.VITE_STORAGE_CONTRACT_ADDRESS ||
    "0x1E0317beFf188e314BbC3483e06773EEfa28bB2D",
  AI_GOVERNANCE_STORAGE:
    import.meta.env.VITE_AI_GOVERNANCE_STORAGE_ADDRESS ||
    "0x1E0317beFf188e314BbC3483e06773EEfa28bB2D",
};

// Minimal ABI for governance contract interactions
const GOVERNANCE_ABI = [
  "function getPolicy(bytes32 policyId) view returns (tuple(bytes32 id, string name, string description, bytes32 rulesHash, address creator, uint256 createdAt, uint256 updatedAt, uint8 status))",
  "function getAgent(bytes32 agentId) view returns (tuple(bytes32 id, string name, address owner, string[] capabilities, uint256 registeredAt, uint8 status, bytes32 currentPolicyId))",
  "function getStats() view returns (uint256 totalPolicies, uint256 totalAgents, uint256 totalActions)",
  "function getAllPolicyIds() view returns (bytes32[])",
  "function getAllAgentIds() view returns (bytes32[])",
];

// Minimal ABI for storage contract interactions
const STORAGE_ABI = [
  "function getStorageRequest(bytes32 requestId) view returns (tuple(bytes32 id, address requester, bytes32 dataHash, uint256 size, uint256 duration, uint256 price, uint8 status, uint256 createdAt, uint256 expiresAt, address provider))",
  "function getUserStorageRequests(address user) view returns (bytes32[])",
  "function getStats() view returns (uint256 totalStorageRequests, uint256 totalRetrievalRequests, uint256 totalProviders)",
  "function getActiveProviders() view returns (address[])",
];

// Minimal ABI for AI governance storage contract
const AI_GOVERNANCE_ABI = [
  "function getGovernanceRecord(bytes32 actionId) view returns (tuple(bytes32 actionId, address agentAddress, string actionType, string description, bool approved, uint256 policyCheckCount, string policyResult, uint256 timestamp, string filecoinCID, bool isImmutable))",
  "function getAgentInfo(address agentAddress) view returns (tuple(address agentAddress, string name, string agentType, uint256 totalActions, uint256 approvedActions, uint256 violations, uint256 registrationTime, bool active))",
  "function getGovernanceStats() view returns (uint256 _totalActions, uint256 _totalViolations, uint256 _totalAgents, uint256 _approvalRate)",
];

/**
 * Create an ethers provider for X Layer
 */
export const getXLayerProvider = () => {
  return new ethers.JsonRpcProvider(XLAYER_RPC_ENDPOINT);
};

/**
 * Create a contract instance for governance interactions
 */
export const getGovernanceContract = (
  signerOrProvider: ethers.Provider | ethers.Signer,
) => {
  return new ethers.Contract(
    CONTRACT_ADDRESSES.GOVERNANCE_CONTRACT,
    GOVERNANCE_ABI,
    signerOrProvider,
  );
};

/**
 * Create a contract instance for storage interactions
 */
export const getStorageContract = (
  signerOrProvider: ethers.Provider | ethers.Signer,
) => {
  return new ethers.Contract(
    CONTRACT_ADDRESSES.STORAGE_CONTRACT,
    STORAGE_ABI,
    signerOrProvider,
  );
};

/**
 * Create a contract instance for AI governance storage interactions
 */
export const getAIGovernanceContract = (
  signerOrProvider: ethers.Provider | ethers.Signer,
) => {
  return new ethers.Contract(
    CONTRACT_ADDRESSES.AI_GOVERNANCE_STORAGE,
    AI_GOVERNANCE_ABI,
    signerOrProvider,
  );
};

/**
 * Fetch governance statistics from X Layer
 */
export async function fetchGovernanceStats() {
  try {
    const provider = getXLayerProvider();
    const contract = getGovernanceContract(provider);
    const [totalPolicies, totalAgents, totalActions] =
      await contract.getStats();

    return {
      totalPolicies: Number(totalPolicies),
      totalAgents: Number(totalAgents),
      totalActions: Number(totalActions),
    };
  } catch (error) {
    console.error("Failed to fetch X Layer governance stats:", error);
    return {
      totalPolicies: 0,
      totalAgents: 0,
      totalActions: 0,
    };
  }
}

/**
 * Fetch storage statistics from X Layer
 */
export async function fetchStorageStats() {
  try {
    const provider = getXLayerProvider();
    const contract = getStorageContract(provider);
    const [totalStorageRequests, totalRetrievalRequests, totalProviders] =
      await contract.getStats();

    return {
      totalStorageRequests: Number(totalStorageRequests),
      totalRetrievalRequests: Number(totalRetrievalRequests),
      totalProviders: Number(totalProviders),
    };
  } catch (error) {
    console.error("Failed to fetch X Layer storage stats:", error);
    return {
      totalStorageRequests: 0,
      totalRetrievalRequests: 0,
      totalProviders: 0,
    };
  }
}

/**
 * Fetch AI governance statistics from X Layer
 */
export async function fetchAIGovernanceStats() {
  try {
    const provider = getXLayerProvider();
    const contract = getAIGovernanceContract(provider);
    const [_totalActions, _totalViolations, _totalAgents, _approvalRate] =
      await contract.getGovernanceStats();

    return {
      totalActions: Number(_totalActions),
      totalViolations: Number(_totalViolations),
      totalAgents: Number(_totalAgents),
      approvalRate: Number(_approvalRate),
    };
  } catch (error) {
    console.error("Failed to fetch X Layer AI governance stats:", error);
    return {
      totalActions: 0,
      totalViolations: 0,
      totalAgents: 0,
      approvalRate: 0,
    };
  }
}

/**
 * Get all policy IDs from the governance contract
 */
export async function fetchAllPolicyIds() {
  try {
    const provider = getXLayerProvider();
    const contract = getGovernanceContract(provider);
    const policyIds = await contract.getAllPolicyIds();

    return policyIds.map((id) => id.toString());
  } catch (error) {
    console.error("Failed to fetch policy IDs:", error);
    return [];
  }
}

/**
 * Get all agent IDs from the governance contract
 */
export async function fetchAllAgentIds() {
  try {
    const provider = getXLayerProvider();
    const contract = getGovernanceContract(provider);
    const agentIds = await contract.getAllAgentIds();

    return agentIds.map((id) => id.toString());
  } catch (error) {
    console.error("Failed to fetch agent IDs:", error);
    return [];
  }
}

/**
 * Get active storage providers
 */
export async function fetchActiveProviders() {
  try {
    const provider = getXLayerProvider();
    const contract = getStorageContract(provider);
    const providers = await contract.getActiveProviders();

    return providers;
  } catch (error) {
    console.error("Failed to fetch active providers:", error);
    return [];
  }
}

/**
 * Check X Layer network connectivity
 */
export async function checkXLayerConnection() {
  try {
    const provider = getXLayerProvider();
    const blockNumber = await provider.getBlockNumber();
    return {
      connected: true,
      blockNumber: Number(blockNumber),
    };
  } catch (error) {
    console.error("Failed to connect to X Layer:", error);
    return {
      connected: false,
      blockNumber: 0,
    };
  }
}

/**
 * Get governance policy details by ID
 */
export async function fetchPolicyDetails(policyId: string) {
  try {
    const provider = getXLayerProvider();
    const contract = getGovernanceContract(provider);
    const policy = await contract.getPolicy(policyId);

    return {
      id: policy.id.toString(),
      name: policy.name,
      description: policy.description,
      rulesHash: policy.rulesHash,
      creator: policy.creator,
      createdAt: Number(policy.createdAt),
      updatedAt: Number(policy.updatedAt),
      status: policy.status, // 0: Draft, 1: Active, 2: Archived
    };
  } catch (error) {
    console.error("Failed to fetch policy details:", error);
    return null;
  }
}

/**
 * Get governance agent details by ID
 */
export async function fetchAgentDetails(agentId: string) {
  try {
    const provider = getXLayerProvider();
    const contract = getGovernanceContract(provider);
    const agent = await contract.getAgent(agentId);

    return {
      id: agent.id.toString(),
      name: agent.name,
      owner: agent.owner,
      capabilities: agent.capabilities,
      registeredAt: Number(agent.registeredAt),
      status: agent.status, // 0: Registered, 1: Active, 2: Suspended, 3: Deregistered
      currentPolicyId: agent.currentPolicyId.toString(),
    };
  } catch (error) {
    console.error("Failed to fetch agent details:", error);
    return null;
  }
}
