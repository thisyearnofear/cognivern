import { config } from "../config.js";
import logger from "../utils/logger.js";

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

export class VersionManagementService {
  private static instance: VersionManagementService;
  private currentModelVersion: ModelVersion;
  private currentPolicyVersion: PolicyVersion;
  private modelHistory: ModelVersion[] = [];
  private policyHistory: PolicyVersion[] = [];

  private constructor() {
    this.currentModelVersion = {
      name: config.MODEL_NAME || "default-model",
      version: "1.0.0",
      provider: "openai",
      capabilities: ["text-generation"],
      lastUpdated: new Date().toISOString(),
    };

    this.currentPolicyVersion = {
      id: "default-policy",
      name: config.DEFAULT_POLICY || "Default Policy",
      version: "1.0.0",
      description: "Default governance policy",
      lastUpdated: new Date().toISOString(),
      status: "active",
    };

    logger.info("VersionManagementService initialized (Local Mode)");
  }

  public static getInstance(): VersionManagementService {
    if (!VersionManagementService.instance) {
      VersionManagementService.instance = new VersionManagementService();
    }
    return VersionManagementService.instance;
  }

  public getVersionInfo(): VersionInfo {
    return {
      modelVersion: this.currentModelVersion.version,
      policyVersion: this.currentPolicyVersion.version,
      timestamp: new Date().toISOString(),
    };
  }

  public getModelInfo(): ModelVersion { return { ...this.currentModelVersion }; }
  public getPolicyInfo(): PolicyVersion { return { ...this.currentPolicyVersion }; }

  public getMetadataForAgent(agentId: string, context?: any): any {
    return {
      modelVersion: this.currentModelVersion.version,
      policyVersion: this.currentPolicyVersion.version,
      agentId,
      timestamp: new Date().toISOString(),
      context: context || {},
    };
  }
}

export const versionManager = VersionManagementService.getInstance();
