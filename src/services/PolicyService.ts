import { Policy, PolicyRule } from "../types/Policy.js";
import logger from "../utils/logger.js";
import { RecallClient } from "@recallnet/sdk/client";
import { Address } from "viem";

/**
 * @deprecated This service is being migrated to the new clean architecture structure.
 * Use domain/policy/PolicyService.js, application/policy/PolicyApplicationService.js,
 * and infrastructure/storage/recall/RecallPolicyRepository.js instead.
 *
 * This file will be removed once the migration is complete.
 */
export class PolicyService {
  private policies: Map<string, Policy>;
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.policies = new Map();
    this.recall = recall;
    this.bucketAddress = bucketAddress;
    this.initializeSamplePolicies().catch((error) => {
      logger.error("Failed to initialize sample policies:", error);
    });
    logger.info("PolicyService initialized");
  }

  async createPolicy(
    name: string,
    description: string,
    rules: PolicyRule[]
  ): Promise<Policy> {
    const id = `policy-${Date.now()}`;
    const now = new Date().toISOString();

    const policy: Policy = {
      id,
      name,
      description,
      version: "1.0.0",
      rules,
      createdAt: now,
      updatedAt: now,
      metadata: {},
      status: "active",
    };

    try {
      const bucketManager = this.recall.bucketManager();
      await bucketManager.add(
        this.bucketAddress,
        `policies/${id}.json`,
        new TextEncoder().encode(JSON.stringify(policy))
      );
      this.policies.set(id, policy);
      logger.info(`Created new policy: ${id}`);
      return policy;
    } catch (error) {
      logger.error("Error creating policy:", error);
      throw new Error(
        `Failed to create policy: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async getPolicy(id: string): Promise<Policy | null> {
    // Check cache first
    const cachedPolicy = this.policies.get(id);
    if (cachedPolicy) {
      return cachedPolicy;
    }

    try {
      const bucketManager = this.recall.bucketManager();
      const { result } = await bucketManager.get(
        this.bucketAddress,
        `policies/${id}.json`
      );

      if (!result) {
        logger.warn(`No policy found for ${id}`);
        return null;
      }

      const contentStr = new TextDecoder().decode(result as Uint8Array);
      const policy = JSON.parse(contentStr) as Policy;

      if (policy) {
        this.policies.set(id, policy);
      }
      return policy;
    } catch (error) {
      logger.error(`Error fetching policy ${id}:`, error);
      return null;
    }
  }

  async listPolicies(): Promise<Policy[]> {
    try {
      const bucketManager = this.recall.bucketManager();
      const { result } = await bucketManager.query(this.bucketAddress, {
        prefix: "policies/",
      });

      if (!result || !result.objects || result.objects.length === 0) {
        logger.info("No policies found in bucket");
        return [];
      }

      const policies = await Promise.all(
        result.objects.map(async (obj) => {
          const id = obj.key.replace("policies/", "").replace(".json", "");
          return this.getPolicy(id);
        })
      );

      return policies.filter((policy): policy is Policy => policy !== null);
    } catch (error) {
      logger.error("Error listing policies:", error);
      return [];
    }
  }

  async updatePolicy(id: string, updates: Partial<Policy>): Promise<Policy> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    const updatedPolicy: Policy = {
      ...policy,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    try {
      const bucketManager = this.recall.bucketManager();
      await bucketManager.add(
        this.bucketAddress,
        `policies/${id}.json`,
        new TextEncoder().encode(JSON.stringify(updatedPolicy))
      );
      this.policies.set(id, updatedPolicy);
      logger.info(`Updated policy: ${id}`);
      return updatedPolicy;
    } catch (error) {
      logger.error(`Error updating policy ${id}:`, error);
      throw new Error(
        `Failed to update policy: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  private async initializeSamplePolicies() {
    try {
      logger.info("Initializing sample policies");
      const policies = await this.listPolicies();

      if (policies.length === 0) {
        logger.info("No policies found, creating samples");
        try {
          // Create policies one by one with error handling
          await this.createSampleResourcePolicy();
          await this.createSampleDataAccessPolicy();
          await this.createSampleModelBehaviorPolicy();
        } catch (error) {
          logger.error("Error creating sample policies:", error);
          // Continue execution even if sample creation fails
        }
      } else {
        logger.info(`Found ${policies.length} existing policies`);
      }
    } catch (error) {
      logger.error("Error in policy initialization:", error);
      // Don't throw to prevent app startup failure
    }
  }

  private async createSampleResourcePolicy() {
    try {
      return await this.createPolicy(
        "Resource Usage Control",
        "Enforces limits on computational resources and API usage",
        [
          {
            id: "cpu-limit",
            type: "rate_limit",
            condition: "cpu_usage > 80%",
            action: {
              type: "block",
              parameters: { threshold: 80, period: "5m" },
            },
            metadata: {},
          },
          {
            id: "api-rate",
            type: "rate_limit",
            condition: "requests_per_minute > 100",
            action: {
              type: "notify",
              parameters: { threshold: 100, period: "1m" },
            },
            metadata: {},
          },
        ]
      );
    } catch (error) {
      logger.error("Failed to create resource policy:", error);
      return null;
    }
  }

  private async createSampleDataAccessPolicy() {
    try {
      return await this.createPolicy(
        "Data Access Governance",
        "Controls access to sensitive data and enforces privacy rules",
        [
          {
            id: "pii-access",
            type: "deny",
            condition: "contains_pii = true AND encryption = false",
            action: {
              type: "block",
              parameters: { severity: "high" },
            },
            metadata: {},
          },
          {
            id: "audit-log",
            type: "require",
            condition: "data_access = true",
            action: {
              type: "log",
              parameters: { retention: "90d" },
            },
            metadata: {},
          },
        ]
      );
    } catch (error) {
      logger.error("Failed to create data access policy:", error);
      return null;
    }
  }

  private async createSampleModelBehaviorPolicy() {
    try {
      return await this.createPolicy(
        "Model Behavior Control",
        "Ensures AI models operate within defined ethical boundaries",
        [
          {
            id: "content-filter",
            type: "deny",
            condition: "content_risk_score > 0.8",
            action: {
              type: "escalate",
              parameters: { threshold: 0.8 },
            },
            metadata: {},
          },
          {
            id: "bias-check",
            type: "require",
            condition: "bias_score < 0.2",
            action: {
              type: "log",
              parameters: { threshold: 0.2 },
            },
            metadata: {},
          },
        ]
      );
    } catch (error) {
      logger.error("Failed to create model behavior policy:", error);
      return null;
    }
  }

  async updatePolicyStatus(
    id: string,
    status: Policy["status"]
  ): Promise<void> {
    const policy = await this.getPolicy(id);
    if (!policy) {
      throw new Error(`Policy ${id} not found`);
    }

    const updatedPolicy: Policy = {
      ...policy,
      status,
      updatedAt: new Date().toISOString(),
    };

    // Update in Recall
    const bucketManager = this.recall.bucketManager();
    await bucketManager.add(
      this.bucketAddress,
      `policies/${id}.json`,
      new TextEncoder().encode(JSON.stringify(updatedPolicy))
    );

    // Update cache
    this.policies.set(id, updatedPolicy);

    logger.info(`Updated status for policy: ${id}`);
  }
}
