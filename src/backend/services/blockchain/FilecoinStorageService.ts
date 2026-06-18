import crypto from "node:crypto";
import { ethers } from "ethers";
import logger from "../../utils/logger.js";
import { CircuitBreaker } from "../../shared/utils/circuitBreaker.js";
import { filecoinConfig } from "../../shared/config/index.js";

export interface FilecoinUploadResult {
  cid: string;
  localHash: string;
  txHash?: string;
  network: "filecoin-calibration";
  timestamp: string;
}

const STORAGE_ABI = [
  "function storeGovernanceAction(bytes32 actionId, address agentAddress, string actionType, string description, bool approved, uint256 policyCheckCount, string policyResult, string filecoinCID) external",
  "function getGovernanceRecord(bytes32 actionId) external view returns (tuple(bytes32 actionId, address agentAddress, string actionType, string description, bool approved, uint256 policyCheckCount, string policyResult, uint256 timestamp, string filecoinCID, bool isImmutable))",
  "function agents(address) external view returns (address agentAddress, string name, string agentType, uint256 totalActions, uint256 approvedActions, uint256 violations, uint256 registrationTime, bool active)",
  "function registerAgent(address agentAddress, string name, string agentType) external",
];

const TX_TIMEOUT_MS = 60_000;
const AGENT_NAME = "Cognivern Audit Anchor";
const AGENT_TYPE = "governance-auditor";

export class FilecoinStorageService {
  private enabled: boolean;
  private circuit = new CircuitBreaker("FilecoinStorage", {
    threshold: 3,
    resetAfterMs: 30000,
  });
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private agentRegistered = false;

  constructor() {
    this.enabled = filecoinConfig.enabled;
    if (this.enabled) {
      logger.info("FilecoinStorageService initialized (FVM Calibration)");
    } else {
      logger.info(
        "FilecoinStorageService: FILECOIN_PRIVATE_KEY or STORAGE_CONTRACT_ADDRESS not set — running in log-only mode",
      );
    }
  }

  getStatus(): { enabled: boolean; rpcUrl: string; contractAddress: string } {
    return {
      enabled: this.enabled,
      rpcUrl: filecoinConfig.rpcUrl,
      contractAddress: filecoinConfig.contracts.storage,
    };
  }

  private getContract(): ethers.Contract {
    if (this.contract) return this.contract;
    this.provider = new ethers.JsonRpcProvider(filecoinConfig.rpcUrl);
    this.wallet = new ethers.Wallet(filecoinConfig.privateKey, this.provider);
    this.contract = new ethers.Contract(
      filecoinConfig.contracts.storage,
      STORAGE_ABI,
      this.wallet,
    );
    return this.contract;
  }

  private async ensureAgentRegistered(): Promise<void> {
    if (this.agentRegistered) return;
    const contract = this.getContract();
    const agentAddress = this.wallet!.address;

    try {
      const agentInfo = await contract.agents(agentAddress);
      if (agentInfo.registrationTime > 0n) {
        this.agentRegistered = true;
        return;
      }
    } catch {
      // agent not found — register below
    }

    const tx = await contract.registerAgent(
      agentAddress,
      AGENT_NAME,
      AGENT_TYPE,
    );
    await tx.wait();
    this.agentRegistered = true;
    logger.info(
      `FilecoinStorageService: registered agent ${agentAddress} on AIGovernanceStorage`,
    );
  }

  async anchorAuditRecord(
    record: Record<string, unknown>,
  ): Promise<FilecoinUploadResult | null> {
    if (!this.enabled) return null;

    try {
      return await this.circuit.execute(async () => {
        const payload = JSON.stringify(record);
        const localHash = crypto
          .createHash("sha256")
          .update(payload)
          .digest("hex");

        const contract = this.getContract();
        await this.ensureAgentRegistered();

        const actionId = ethers.keccak256(ethers.toUtf8Bytes(payload));
        const actionType = String(record.workflow || "governance");
        const description = `Audit: ${actionType} run ${record.runId || "unknown"}`;
        const approved = record.outcome !== "denied";
        const policyCheckCount = 1n;
        const policyResult = JSON.stringify({
          evidenceHash: localHash,
          timestamp: new Date().toISOString(),
        });
        const filecoinCID = `sha256:${localHash}`;

        const tx = await contract.storeGovernanceAction(
          actionId,
          this.wallet!.address,
          actionType,
          description,
          approved,
          policyCheckCount,
          policyResult,
          filecoinCID,
        );

        const receipt = await Promise.race([
          tx.wait(),
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error(`tx.wait() timed out after ${TX_TIMEOUT_MS}ms`)),
              TX_TIMEOUT_MS,
            ),
          ),
        ]);

        logger.info(
          `FilecoinStorageService: anchored audit record — cid=${filecoinCID} tx=${receipt?.hash}`,
        );

        return {
          cid: filecoinCID,
          localHash,
          txHash: receipt?.hash,
          network: "filecoin-calibration" as const,
          timestamp: new Date().toISOString(),
        };
      });
    } catch (err) {
      logger.warn(
        `FilecoinStorageService: anchor failed (non-fatal) — ${(err as Error).message}`,
      );
      return null;
    }
  }

  async retrieveRecord(
    actionId: string,
  ): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null;

    try {
      return await this.circuit.execute(async () => {
        const contract = this.getContract();
        const record = await contract.getGovernanceRecord(actionId);

        if (!record || record.timestamp === 0n) return null;

        return {
          actionId: record.actionId,
          agentAddress: record.agentAddress,
          actionType: record.actionType,
          description: record.description,
          approved: record.approved,
          policyCheckCount: record.policyCheckCount?.toString() ?? "0",
          policyResult: record.policyResult,
          timestamp: record.timestamp?.toString() ?? "0",
          filecoinCID: record.filecoinCID,
          isImmutable: record.isImmutable,
        };
      });
    } catch (err) {
      logger.warn(
        `FilecoinStorageService: retrieve failed (non-fatal) — ${(err as Error).message}`,
      );
      return null;
    }
  }

  async verify(actionId: string, expectedHash: string): Promise<boolean> {
    const record = await this.retrieveRecord(actionId);
    if (!record) return false;

    const cid = record.filecoinCID as string;
    return cid === `sha256:${expectedHash}`;
  }
}

export const filecoinStorageService = new FilecoinStorageService();
