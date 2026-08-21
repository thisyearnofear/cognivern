import { ethers } from "ethers";
import logger from "@backend/utils/logger.js";
import { executionRails } from "@backend/shared/config/index.js";
import { circuitBreakers } from "@backend/shared/utils/circuitBreaker.js";
import { withTimeout, retry } from "@backend/shared/utils/index.js";
import { explorerTxUrl } from "@cognivern/shared";

/** Default EVM execution rail (alias historically known as blockchainConfig). */
const executionRail = executionRails.default;

const GOVERNANCE_ABI = [
  "function evaluateAction(bytes32 actionId, bytes32 agentId, string memory actionType, bytes32 dataHash, bool approved) external",
  "function getAgent(bytes32 agentId) view returns (bytes32 id, string name, address owner, string[] capabilities, uint256 registeredAt, uint8 status, bytes32 currentPolicyId)",
  "function getPolicy(bytes32 policyId) view returns (bytes32 id, string name, string description, bytes32 rulesHash, address creator, uint256 createdAt, uint256 updatedAt, uint8 status)",
  "function registerAgent(bytes32 agentId, string memory name, string[] memory capabilities, bytes32 policyId) external",
  "function updateAgentStatus(bytes32 agentId, uint8 status) external",
  "function createPolicy(bytes32 policyId, string memory name, string memory description, bytes32 rulesHash) external",
  "function updatePolicyStatus(bytes32 policyId, uint8 status) external",
  "function authorizeEvaluator(address evaluator) external",
];

const DEFAULT_POLICY_ID = ethers.id("cognivern-default-spend-policy");
const DEFAULT_RULES_HASH = ethers.id("cognivern-default-rules-v1");
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export class OwsWalletOnChainManager {
  private onChainProvider: ethers.JsonRpcProvider | null = null;
  private onChainWallet: ethers.Wallet | null = null;
  private onChainContract: ethers.Contract | null = null;
  private lastProviderHealthCheck: number = 0;

  async getOnChainSigner(): Promise<{ wallet: ethers.Wallet; contract: ethers.Contract } | null> {
    const pk = executionRail.privateKey;
    if (!pk) return null;

    if (this.onChainWallet && this.onChainContract) {
      const now = Date.now();
      if (now - this.lastProviderHealthCheck > HEALTH_CHECK_INTERVAL_MS) {
        try {
          await withTimeout(this.onChainProvider!.getBlockNumber(), 5000);
          this.lastProviderHealthCheck = now;
        } catch {
          this.onChainProvider = null;
          this.onChainWallet = null;
          this.onChainContract = null;
        }
      }
      if (this.onChainWallet && this.onChainContract) {
        return { wallet: this.onChainWallet, contract: this.onChainContract };
      }
    }

    try {
      this.onChainProvider = new ethers.JsonRpcProvider(executionRail.rpcUrl);
      this.onChainWallet = new ethers.Wallet(pk, this.onChainProvider);
      this.onChainContract = new ethers.Contract(
        executionRail.contracts.governance,
        GOVERNANCE_ABI,
        this.onChainWallet,
      );
      this.lastProviderHealthCheck = Date.now();
      return { wallet: this.onChainWallet, contract: this.onChainContract };
    } catch (error) {
      logger.warn("Failed to initialize on-chain signer:", error);
      return null;
    }
  }

  async recordOnChainApproval(params: {
    intentId: string;
    agentId: string;
    actionType: string;
    metadata: Record<string, any>;
  }): Promise<{
    success: boolean;
    txHash?: string;
    dataHash?: string;
    chainId?: number;
    railId?: string;
    explorerUrl?: string;
  }> {
    const signer = await this.getOnChainSigner();
    if (!signer) return { success: false };

    try {
      return await circuitBreakers.blockchain.execute(async () => {
        const actionId = ethers.id(params.intentId);
        const agentBytes32 = ethers.id(params.agentId);
        // Commit to the actual decision payload, not ZeroHash. A zero
        // dataHash makes the on-chain record look like an evidence anchor
        // while committing to nothing — an unverifiable claim dressed as
        // proof. Hash the canonical decision fields so the on-chain record
        // is a real commitment that off-chain evidence can be checked against.
        const dataHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            JSON.stringify({
              intentId: params.intentId,
              agentId: params.agentId,
              actionType: params.actionType,
              metadata: params.metadata ?? {},
            }),
          ),
        );
        const gas = executionRail.gasLimits;

        await this.ensureOnChainAgent(signer.wallet, signer.contract, params.agentId);

        const tx = await signer.contract.evaluateAction(
          actionId,
          agentBytes32,
          params.actionType,
          dataHash,
          true,
          { gasLimit: gas.evaluateAction },
        );
        const receipt = await withTimeout<ethers.ContractTransactionReceipt | null>(
          tx.wait(),
          60000,
        );
        const txHash = receipt?.hash;
        logger.info(`On-chain approval recorded: ${txHash}`);
        return {
          success: true,
          txHash,
          dataHash,
          chainId: executionRail.chainId,
          railId: executionRail.railId,
          explorerUrl: txHash
            ? explorerTxUrl(executionRail.chainId, txHash)
            : undefined,
        };
      });
    } catch (error) {
      logger.error("On-chain record failed:", error);
      return { success: false };
    }
  }

  private async ensureOnChainAgent(
    wallet: ethers.Wallet,
    contract: ethers.Contract,
    agentIdStr: string,
  ): Promise<void> {
    const agentId = ethers.id(agentIdStr);
    const gas = executionRail.gasLimits;
    try {
      const agent = await retry(() => contract.getAgent(agentId), 2, 2000);
      if (agent.status === 1) return;
      if (agent.status === 0) {
        await (
          await contract.updateAgentStatus(agentId, 1, { gasLimit: gas.updateStatus })
        ).wait();
        logger.info(`On-chain agent ${agentIdStr} activated (was Registered)`);
      }
      return;
    } catch {
      // Agent doesn't exist — register + activate
    }

    try {
      const policyId = DEFAULT_POLICY_ID;
      const rulesHash = DEFAULT_RULES_HASH;

      try {
        await retry(() => contract.getPolicy(policyId), 2, 2000);
      } catch {
        await (
          await contract.createPolicy(
            policyId,
            "Cognivern Default Spend Policy",
            "Auto-created default policy for governed agent spends",
            rulesHash,
            { gasLimit: gas.createPolicy },
          )
        ).wait();
        await (
          await contract.updatePolicyStatus(policyId, 1, { gasLimit: gas.updateStatus })
        ).wait();
      }

      await (
        await contract.registerAgent(
          agentId,
          `${agentIdStr}`,
          ["spend-governance"],
          policyId,
          { gasLimit: gas.registerAgent },
        )
      ).wait();
      await (
        await contract.updateAgentStatus(agentId, 1, { gasLimit: gas.updateStatus })
      ).wait();
      logger.info(`On-chain agent ${agentIdStr} registered and activated`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to register on-chain agent ${agentIdStr}: ${reason}`);
    }
  }
}
