import { config } from "../config.js";
import logger from "../utils/logger.js";
import { GovernanceStorageService } from "./GovernanceStorageService.js";

export interface ModelVersion {
  name: string;
  version: string;
  provider: string;
  capabilities: string[];
  lastUpdated: string;
}

export interface PolicyVersion {
  id: string;
  name: string;
  version: string;
  description: string;
  lastUpdated: string;
  status: "active" | "draft" | "archived";
}

export interface VersionInfo {
  modelVersion: string;
  policyVersion: string;
  timestamp: string;
}

/**
 * Service for managing model and policy versions across the system
 */
export class VersionManagementService {
  private static instance: VersionManagementService;
  private currentModelVersion: ModelVersion;
  private currentPolicyVersion: PolicyVersion;
  private storageService: GovernanceStorageService;
  private modelHistory: ModelVersion[] = [];
  private policyHistory: PolicyVersion[] = [];

  private constructor() {
    // Initialize storage service
    this.storageService = new GovernanceStorageService();

    // Initialize with default versions from config
    this.currentModelVersion = {
      name: config.MODEL_NAME,
      version: this.generateModelVersion(),
      provider: "openai",
      capabilities: ["text-generation", "reasoning", "analysis"],
      lastUpdated: new Date().toISOString(),
    };

    this.currentPolicyVersion = {
      id: "default-policy",
      name: config.DEFAULT_POLICY,
      version: "1.0.0",
      description: "Default governance policy for AI agents",
      lastUpdated: new Date().toISOString(),
      status: "active",
    };

    logger.info("VersionManagementService initialized", {
      modelVersion: this.currentModelVersion.version,
      policyVersion: this.currentPolicyVersion.version,
    });

    // Initialize storage asynchronously (don't await in constructor)
    this.initializeStorage().catch((error) => {
      logger.error("Failed to initialize version storage:", error);
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): VersionManagementService {
    if (!VersionManagementService.instance) {
      VersionManagementService.instance = new VersionManagementService();
    }
    return VersionManagementService.instance;
  }

  /**
   * Generate a model version based on the model name and current date
   */
  private generateModelVersion(): string {
    const modelName = config.MODEL_NAME.toLowerCase();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    // Create version based on model name
    if (modelName.includes("gpt-4")) {
      return `gpt-4-${year}${month}`;
    } else if (modelName.includes("gpt-3.5")) {
      return `gpt-3.5-${year}${month}`;
    } else if (modelName.includes("gemini")) {
      return `gemini-pro-${year}${month}`;
    } else {
      return `${modelName}-${year}${month}`;
    }
  }

  /**
   * Get current model version
   */
  public getCurrentModelVersion(): string {
    return this.currentModelVersion.version;
  }

  /**
   * Get current policy version
   */
  public getCurrentPolicyVersion(): string {
    return this.currentPolicyVersion.version;
  }

  /**
   * Get complete version information
   */
  public getVersionInfo(): VersionInfo {
    return {
      modelVersion: this.currentModelVersion.version,
      policyVersion: this.currentPolicyVersion.version,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get detailed model information
   */
  public getModelInfo(): ModelVersion {
    return { ...this.currentModelVersion };
  }

  /**
   * Get detailed policy information
   */
  public getPolicyInfo(): PolicyVersion {
    return { ...this.currentPolicyVersion };
  }

  /**
   * Initialize storage system and load version history
   */
  private async initializeStorage(): Promise<void> {
    try {
      await this.storageService.initializeSystem();

      // Load existing version history first
      await this.loadVersionHistory();

      // Only store current versions if they don't already exist in history
      const existingModelVersion = this.modelHistory.find(
        (v) => v.version === this.currentModelVersion.version
      );
      const existingPolicyVersion = this.policyHistory.find(
        (v) => v.version === this.currentPolicyVersion.version
      );

      if (!existingModelVersion) {
        await this.persistModelVersion(this.currentModelVersion);
      }

      if (!existingPolicyVersion) {
        await this.persistPolicyVersion(this.currentPolicyVersion);
      }

      logger.info("Version storage initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize version storage:", error);
    }
  }

  /**
   * Load version history from storage
   */
  private async loadVersionHistory(): Promise<void> {
    try {
      // Load model history
      const modelObjects = await this.storageService.listObjects(
        "governance",
        "versions/models/"
      );
      this.modelHistory = modelObjects
        .map((obj) => obj.data as ModelVersion)
        .sort(
          (a, b) =>
            new Date(b.lastUpdated).getTime() -
            new Date(a.lastUpdated).getTime()
        );

      // Load policy history
      const policyObjects = await this.storageService.listObjects(
        "governance",
        "versions/policies/"
      );
      this.policyHistory = policyObjects
        .map((obj) => obj.data as PolicyVersion)
        .sort(
          (a, b) =>
            new Date(b.lastUpdated).getTime() -
            new Date(a.lastUpdated).getTime()
        );

      logger.info("Version history loaded", {
        modelVersions: this.modelHistory.length,
        policyVersions: this.policyHistory.length,
      });
    } catch (error) {
      logger.error("Failed to load version history:", error);
    }
  }

  /**
   * Persist a model version to storage
   */
  private async persistModelVersion(modelVersion: ModelVersion): Promise<void> {
    const object = {
      key: `versions/models/${modelVersion.version}.json`,
      size: JSON.stringify(modelVersion).length,
      timestamp: Date.now(),
      data: modelVersion,
      metadata: {
        type: "model-version" as const,
        version: modelVersion.version,
        name: modelVersion.name,
      },
    };

    await this.storageService.addObject("governance", object);
  }

  /**
   * Persist a policy version to storage
   */
  private async persistPolicyVersion(
    policyVersion: PolicyVersion
  ): Promise<void> {
    const object = {
      key: `versions/policies/${policyVersion.version}.json`,
      size: JSON.stringify(policyVersion).length,
      timestamp: Date.now(),
      data: policyVersion,
      metadata: {
        type: "policy-version" as const,
        version: policyVersion.version,
        id: policyVersion.id,
      },
    };

    await this.storageService.addObject("governance", object);
  }

  /**
   * Update model version (for when model is changed)
   */
  public async updateModelVersion(modelName?: string): Promise<void> {
    // Store previous version in history
    this.modelHistory.unshift({ ...this.currentModelVersion });

    if (modelName) {
      this.currentModelVersion.name = modelName;
    }
    this.currentModelVersion.version = this.generateModelVersion();
    this.currentModelVersion.lastUpdated = new Date().toISOString();

    // Persist to storage
    await this.persistModelVersion(this.currentModelVersion);

    logger.info("Model version updated", {
      name: this.currentModelVersion.name,
      version: this.currentModelVersion.version,
    });
  }

  /**
   * Update policy version (for when policy is changed)
   */
  public async updatePolicyVersion(
    policyName?: string,
    version?: string
  ): Promise<void> {
    // Store previous version in history
    this.policyHistory.unshift({ ...this.currentPolicyVersion });

    if (policyName) {
      this.currentPolicyVersion.name = policyName;
    }
    if (version) {
      this.currentPolicyVersion.version = version;
    } else {
      // Auto-increment patch version
      const parts = this.currentPolicyVersion.version.split(".");
      const patch = parseInt(parts[2] || "0") + 1;
      this.currentPolicyVersion.version = `${parts[0]}.${parts[1]}.${patch}`;
    }
    this.currentPolicyVersion.lastUpdated = new Date().toISOString();

    // Persist to storage
    await this.persistPolicyVersion(this.currentPolicyVersion);

    logger.info("Policy version updated", {
      name: this.currentPolicyVersion.name,
      version: this.currentPolicyVersion.version,
    });
  }

  /**
   * Set a specific policy version
   */
  public setPolicyVersion(policyInfo: Partial<PolicyVersion>): void {
    this.currentPolicyVersion = {
      ...this.currentPolicyVersion,
      ...policyInfo,
      lastUpdated: new Date().toISOString(),
    };

    logger.info("Policy version set", {
      id: this.currentPolicyVersion.id,
      name: this.currentPolicyVersion.name,
      version: this.currentPolicyVersion.version,
    });
  }

  /**
   * Get version metadata for agent actions
   */
  public getMetadataForAgent(agentId: string, context?: any): any {
    return {
      modelVersion: this.currentModelVersion.version,
      policyVersion: this.currentPolicyVersion.version,
      agentId,
      timestamp: new Date().toISOString(),
      context: context || {},
      systemInfo: {
        modelName: this.currentModelVersion.name,
        policyName: this.currentPolicyVersion.name,
        environment: config.NODE_ENV,
      },
    };
  }

  /**
   * Check if versions are compatible
   */
  public areVersionsCompatible(
    modelVersion: string,
    policyVersion: string
  ): boolean {
    // Simple compatibility check - in production this would be more sophisticated
    const currentModel = this.currentModelVersion.version;
    const currentPolicy = this.currentPolicyVersion.version;

    // Check if major versions match
    const modelMajor = currentModel.split("-")[0];
    const policyMajor = currentPolicy.split(".")[0];
    const checkModelMajor = modelVersion.split("-")[0];
    const checkPolicyMajor = policyVersion.split(".")[0];

    return modelMajor === checkModelMajor && policyMajor === checkPolicyMajor;
  }

  /**
   * Get version history from storage
   */
  public async getVersionHistory(): Promise<{
    models: ModelVersion[];
    policies: PolicyVersion[];
  }> {
    // Ensure we have the latest data from storage
    await this.loadVersionHistory();

    return {
      models: [...this.modelHistory, this.currentModelVersion],
      policies: [...this.policyHistory, this.currentPolicyVersion],
    };
  }

  /**
   * Get version history for a specific model
   */
  public async getModelVersionHistory(
    modelName?: string
  ): Promise<ModelVersion[]> {
    await this.loadVersionHistory();

    if (modelName) {
      return this.modelHistory.filter((version) => version.name === modelName);
    }

    return [...this.modelHistory, this.currentModelVersion];
  }

  /**
   * Get version history for a specific policy
   */
  public async getPolicyVersionHistory(
    policyId?: string
  ): Promise<PolicyVersion[]> {
    await this.loadVersionHistory();

    if (policyId) {
      return this.policyHistory.filter((version) => version.id === policyId);
    }

    return [...this.policyHistory, this.currentPolicyVersion];
  }

  /**
   * Get version statistics
   */
  public async getVersionStatistics(): Promise<{
    totalModelVersions: number;
    totalPolicyVersions: number;
    oldestModelVersion?: string;
    newestModelVersion?: string;
    oldestPolicyVersion?: string;
    newestPolicyVersion?: string;
  }> {
    await this.loadVersionHistory();

    const allModels = [...this.modelHistory, this.currentModelVersion];
    const allPolicies = [...this.policyHistory, this.currentPolicyVersion];

    return {
      totalModelVersions: allModels.length,
      totalPolicyVersions: allPolicies.length,
      oldestModelVersion: allModels[allModels.length - 1]?.version,
      newestModelVersion: allModels[0]?.version,
      oldestPolicyVersion: allPolicies[allPolicies.length - 1]?.version,
      newestPolicyVersion: allPolicies[0]?.version,
    };
  }
}

// Export singleton instance for easy access
export const versionManager = VersionManagementService.getInstance();
