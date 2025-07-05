import { RecallClient } from "@recallnet/sdk/client";
import type { Address } from "viem";
import { RecallService } from "../../services/RecallService.js";
import {
  GovernanceStorageService,
  GovernanceObject,
} from "../../services/GovernanceStorageService.js";
import logger from "../../utils/logger.js";

export interface FilecoinStorageConfig {
  recallClient?: RecallClient;
  bucketAddress?: Address;
  governanceService?: GovernanceStorageService;
}

// This class handles Filecoin storage integration using Recall SDK.
export class FilecoinService {
  private recallService: RecallService | null = null;
  private governanceService: GovernanceStorageService | null = null;

  constructor(config?: FilecoinStorageConfig) {
    if (config?.recallClient && config?.bucketAddress) {
      this.recallService = new RecallService(
        config.recallClient,
        config.bucketAddress
      );
      logger.info("FilecoinService initialized with Recall integration");
    } else {
      logger.warn(
        "FilecoinService initialized without Recall client - will operate in simulation mode"
      );
    }

    if (config?.governanceService) {
      this.governanceService = config.governanceService;
    }
  }

  /**
   * Initialize with RecallService (for dependency injection)
   */
  initializeWithRecall(
    recallClient: RecallClient,
    bucketAddress: Address
  ): void {
    this.recallService = new RecallService(recallClient, bucketAddress);
    logger.info("FilecoinService initialized with Recall client");
  }

  /**
   * Initialize with GovernanceStorageService (for dependency injection)
   */
  initializeWithGovernance(governanceService: GovernanceStorageService): void {
    this.governanceService = governanceService;
    logger.info("FilecoinService initialized with GovernanceStorageService");
  }

  async storeData(path: string, data: any): Promise<void> {
    try {
      if (this.recallService) {
        // Use Recall for actual storage
        const pathParts = path.split("/");
        const prefix = pathParts.slice(0, -1).join("/") || "default";
        const key = pathParts[pathParts.length - 1];

        await this.recallService.storeObject(prefix, key, data);
        logger.info(`Successfully stored data at ${path} using Recall`);
      } else {
        // Simulation mode - just log
        logger.info(`[SIMULATION] Storing data at ${path}`, {
          dataSize: JSON.stringify(data).length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error(`Error storing data at ${path}:`, error);
      throw new Error(
        `Failed to store data: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async retrieveData<T>(path: string): Promise<T | null> {
    try {
      if (this.recallService) {
        // Use Recall for actual retrieval
        const pathParts = path.split("/");
        const prefix = pathParts.slice(0, -1).join("/") || "default";
        const key = pathParts[pathParts.length - 1];

        const result = await this.recallService.getObject<T>(prefix, key);
        logger.info(`Successfully retrieved data from ${path} using Recall`);
        return result;
      } else {
        // Simulation mode - return null
        logger.info(`[SIMULATION] Retrieving data from ${path}`);
        return null;
      }
    } catch (error) {
      logger.error(`Error retrieving data from ${path}:`, error);
      return null;
    }
  }

  async listObjects(prefix: string): Promise<string[]> {
    try {
      if (this.recallService) {
        // Use Recall for actual listing
        const keys = await this.recallService.listObjects(prefix);
        logger.info(
          `Successfully listed ${keys.length} objects with prefix ${prefix} using Recall`
        );
        return keys;
      } else {
        // Simulation mode - return empty array
        logger.info(`[SIMULATION] Listing objects with prefix ${prefix}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error listing objects with prefix ${prefix}:`, error);
      return [];
    }
  }

  async getGovernanceStats(): Promise<any> {
    try {
      if (this.governanceService) {
        // Get stats from governance service
        const agentObjects = await this.governanceService.listObjects(
          "agents",
          ""
        );
        const governanceObjects = await this.governanceService.listObjects(
          "governance",
          ""
        );

        // Count different types of objects
        let agentCount = 0;
        let actionCount = 0;
        let policyCount = 0;

        for (const obj of [...agentObjects, ...governanceObjects]) {
          if (obj.metadata?.type === "action") actionCount++;
          else if (obj.metadata?.type === "policy") policyCount++;
          else if (obj.metadata?.agentId) agentCount++;
        }

        const stats = {
          agents: agentCount,
          actions: actionCount,
          policies: policyCount,
          totalObjects: agentObjects.length + governanceObjects.length,
          lastUpdated: new Date().toISOString(),
        };

        logger.info("Retrieved governance stats", stats);
        return stats;
      } else {
        // Fallback stats
        const stats = {
          agents: 0,
          actions: 0,
          policies: 0,
          totalObjects: 0,
          lastUpdated: new Date().toISOString(),
        };
        logger.info("[SIMULATION] Retrieving governance stats", stats);
        return stats;
      }
    } catch (error) {
      logger.error("Error retrieving governance stats:", error);
      return {
        agents: 0,
        actions: 0,
        policies: 0,
        totalObjects: 0,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAgentActions(agentId: string): Promise<any[]> {
    try {
      if (this.governanceService) {
        // Get actions for specific agent
        const objects = await this.governanceService.listObjects(
          "agents",
          `${agentId}/actions/`
        );
        const actions = objects
          .filter((obj) => obj.metadata?.type === "action")
          .map((obj) => ({
            ...obj.data,
            id: obj.key,
            timestamp: obj.timestamp,
            metadata: obj.metadata,
          }))
          .sort((a, b) => b.timestamp - a.timestamp); // Most recent first

        logger.info(`Retrieved ${actions.length} actions for agent ${agentId}`);
        return actions;
      } else {
        logger.info(`[SIMULATION] Retrieving actions for agent ${agentId}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error retrieving actions for agent ${agentId}:`, error);
      return [];
    }
  }

  async getAgentViolations(agentId: string): Promise<any[]> {
    try {
      if (this.governanceService) {
        // Get all actions for the agent and filter for violations
        const actions = await this.getAgentActions(agentId);
        const violations = actions.filter(
          (action) =>
            action.metadata?.complianceStatus === "non-compliant" ||
            action.metadata?.policyViolation === true ||
            (action.output && action.output.violation)
        );

        logger.info(
          `Retrieved ${violations.length} violations for agent ${agentId}`
        );
        return violations;
      } else {
        logger.info(`[SIMULATION] Retrieving violations for agent ${agentId}`);
        return [];
      }
    } catch (error) {
      logger.error(`Error retrieving violations for agent ${agentId}:`, error);
      return [];
    }
  }
}
