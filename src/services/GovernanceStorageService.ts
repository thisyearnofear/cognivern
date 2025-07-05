import { RecallClient } from "@recallnet/sdk/client";
import type { Address } from "viem";
import { CryptoUtils } from "../utils/crypto.js";
import { RecallService } from "./RecallService.js";
import logger from "../utils/logger.js";

export interface GovernanceObject {
  key: string;
  size: number;
  timestamp: number;
  data: any;
  metadata?: {
    agentId?: string;
    type?:
      | "cot-log"
      | "action"
      | "metric"
      | "policy"
      | "listing"
      | "asset-match"
      | "subscription"
      | "model-version"
      | "policy-version";
    version?: string;
    signature?: string;
  };
}

export interface BucketConfig {
  name: string;
  type: "agent" | "marketplace" | "governance";
  encryption: boolean;
  retention: number; // days
}

export class GovernanceStorageService {
  private recallService: RecallService | null = null;
  private bucketConfigs: Map<string, BucketConfig>;

  constructor(recallClient?: RecallClient, bucketAddress?: Address) {
    if (recallClient && bucketAddress) {
      this.recallService = new RecallService(recallClient, bucketAddress);
      logger.info(
        "GovernanceStorageService initialized with Recall integration"
      );
    } else {
      logger.warn(
        "GovernanceStorageService initialized without Recall client - will operate in simulation mode"
      );
    }
    this.bucketConfigs = new Map();
  }

  /**
   * Initialize with RecallService (for dependency injection)
   */
  initializeWithRecall(
    recallClient: RecallClient,
    bucketAddress: Address
  ): void {
    this.recallService = new RecallService(recallClient, bucketAddress);
    logger.info("GovernanceStorageService initialized with Recall client");
  }

  async initializeSystem(): Promise<void> {
    // Initialize standard buckets for the governance system
    const standardBuckets: BucketConfig[] = [
      {
        name: "agents",
        type: "agent",
        encryption: true,
        retention: 365,
      },
      {
        name: "marketplace",
        type: "marketplace",
        encryption: true,
        retention: 90,
      },
      {
        name: "governance",
        type: "governance",
        encryption: true,
        retention: 730,
      },
    ];

    for (const config of standardBuckets) {
      await this.getOrCreateBucket(config.name, config);
    }
  }

  async getOrCreateBucket(
    bucketName: string,
    config: BucketConfig
  ): Promise<void> {
    try {
      if (this.recallService) {
        // Store bucket configuration metadata in Recall
        await this.recallService.storeObject(
          `buckets/${bucketName}`,
          "config",
          config
        );
      }

      this.bucketConfigs.set(bucketName, config);
      logger.info(`Bucket configured: ${bucketName}`, {
        type: config.type,
        encryption: config.encryption,
        retention: config.retention,
        mode: this.recallService ? "recall" : "simulation",
      });
    } catch (error) {
      this.handleError("getOrCreateBucket", error);
      throw error;
    }
  }

  async addObject(bucketName: string, object: GovernanceObject): Promise<void> {
    try {
      const config = this.bucketConfigs.get(bucketName);
      if (!config && this.recallService) {
        // Try to load bucket config from storage
        await this.loadBucketConfig(bucketName);
      }

      const bucketConfig = this.bucketConfigs.get(bucketName);
      if (!bucketConfig) {
        throw new Error(`Bucket ${bucketName} not found`);
      }

      // Create a copy to avoid mutating the original
      const objectToStore = { ...object };

      // Encrypt data if required
      if (bucketConfig.encryption && objectToStore.data) {
        objectToStore.data = await CryptoUtils.encrypt(
          objectToStore.data,
          "default-encryption-key"
        );
      }

      // Add timestamp and size metadata
      objectToStore.timestamp = Date.now();
      objectToStore.size = this.calculateObjectSize(objectToStore);

      if (this.recallService) {
        // Store object in Recall with bucket prefix
        await this.recallService.storeObject(
          bucketName,
          object.key,
          objectToStore
        );
      }

      logger.info(`Object stored successfully in bucket ${bucketName}`, {
        key: object.key,
        size: objectToStore.size,
        type: object.metadata?.type,
        encrypted: bucketConfig.encryption,
        mode: this.recallService ? "recall" : "simulation",
      });
    } catch (error) {
      this.handleError("addObject", error);
      throw error;
    }
  }

  async getObject(
    bucketName: string,
    key: string
  ): Promise<GovernanceObject | null> {
    try {
      const config = this.bucketConfigs.get(bucketName);
      if (!config && this.recallService) {
        // Try to load bucket config from storage
        await this.loadBucketConfig(bucketName);
      }

      const bucketConfig = this.bucketConfigs.get(bucketName);
      if (!bucketConfig) {
        throw new Error(`Bucket ${bucketName} not found`);
      }

      if (!this.recallService) {
        // Simulation mode - return null as if object doesn't exist
        logger.debug(
          `Simulation mode: Object not found in bucket ${bucketName}`,
          { key }
        );
        return null;
      }

      // Retrieve object from Recall with bucket prefix
      const object = await this.recallService.getObject<GovernanceObject>(
        bucketName,
        key
      );

      if (!object) {
        logger.debug(`Object not found in bucket ${bucketName}`, { key });
        return null;
      }

      // Decrypt data if it was encrypted
      if (bucketConfig.encryption && object.data) {
        try {
          object.data = await CryptoUtils.decrypt(
            object.data,
            "default-encryption-key"
          );
        } catch (decryptError) {
          logger.warn(
            `Failed to decrypt object ${key} in bucket ${bucketName}`,
            {
              error:
                decryptError instanceof Error
                  ? decryptError.message
                  : "Unknown error",
            }
          );
          // Return the object but log the decryption failure
        }
      }

      logger.debug(`Object retrieved successfully from bucket ${bucketName}`, {
        key,
        size: object.size,
        type: object.metadata?.type,
      });

      return object;
    } catch (error) {
      this.handleError("getObject", error);
      throw error;
    }
  }

  async listObjects(
    bucketName: string,
    prefix?: string
  ): Promise<GovernanceObject[]> {
    try {
      const config = this.bucketConfigs.get(bucketName);
      if (!config && this.recallService) {
        // Try to load bucket config from storage
        await this.loadBucketConfig(bucketName);
      }

      const bucketConfig = this.bucketConfigs.get(bucketName);
      if (!bucketConfig) {
        throw new Error(`Bucket ${bucketName} not found`);
      }

      if (!this.recallService) {
        // Simulation mode - return empty array
        logger.debug(`Simulation mode: No objects in bucket ${bucketName}`, {
          prefix,
        });
        return [];
      }

      // List objects from Recall with bucket prefix
      const bucketPrefix = prefix ? `${bucketName}/${prefix}` : bucketName;
      const objectKeys = await this.recallService.listObjects(bucketPrefix);

      const governanceObjects: GovernanceObject[] = [];

      for (const objectKey of objectKeys) {
        try {
          // Extract the actual key by removing the bucket prefix
          const actualKey = objectKey.startsWith(`${bucketName}/`)
            ? objectKey.substring(`${bucketName}/`.length)
            : objectKey;

          const object = await this.recallService.getObject<GovernanceObject>(
            bucketName,
            actualKey
          );
          if (object) {
            object.key = actualKey;

            // Decrypt if needed (but might be expensive for listing)
            if (
              bucketConfig.encryption &&
              object.data &&
              typeof object.data === "string"
            ) {
              try {
                object.data = await CryptoUtils.decrypt(
                  object.data,
                  "default-encryption-key"
                );
              } catch (decryptError) {
                // For listing, we can skip decryption errors and just log them
                logger.debug(
                  `Skipping decryption for object ${actualKey} during listing`,
                  {
                    error:
                      decryptError instanceof Error
                        ? decryptError.message
                        : "Unknown error",
                  }
                );
              }
            }

            governanceObjects.push(object);
          }
        } catch (objectError) {
          logger.warn(`Failed to retrieve object ${objectKey} during listing`, {
            error:
              objectError instanceof Error
                ? objectError.message
                : "Unknown error",
          });
          // Continue with other objects
        }
      }

      logger.debug(
        `Listed ${governanceObjects.length} objects from bucket ${bucketName}`,
        {
          prefix,
          totalObjects: objectKeys.length,
        }
      );

      return governanceObjects;
    } catch (error) {
      this.handleError("listObjects", error);
      throw error;
    }
  }

  /**
   * Load bucket configuration from storage
   */
  private async loadBucketConfig(bucketName: string): Promise<void> {
    if (!this.recallService) {
      return; // Can't load config in simulation mode
    }

    try {
      const config = await this.recallService.getObject<BucketConfig>(
        `buckets/${bucketName}`,
        "config"
      );

      if (config) {
        this.bucketConfigs.set(bucketName, config);
        logger.debug(`Loaded bucket configuration for ${bucketName}`, config);
      }
    } catch (error) {
      logger.warn(`Failed to load bucket configuration for ${bucketName}`, {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Calculate object size for storage metrics
   */
  private calculateObjectSize(object: GovernanceObject): number {
    try {
      const serialized = JSON.stringify(object);
      return new TextEncoder().encode(serialized).length;
    } catch (error) {
      logger.warn("Failed to calculate object size", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return 0;
    }
  }

  /**
   * Enhanced error handling with structured logging
   */
  private handleError(operation: string, error: any): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error(`GovernanceStorageService error in ${operation}`, {
      operation,
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get storage statistics for a bucket
   */
  async getBucketStats(bucketName: string): Promise<{
    objectCount: number;
    totalSize: number;
    lastModified: string | null;
  }> {
    try {
      const objects = await this.listObjects(bucketName);
      const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0);
      const lastModified =
        objects.length > 0
          ? new Date(
              Math.max(...objects.map((obj) => obj.timestamp))
            ).toISOString()
          : null;

      return {
        objectCount: objects.length,
        totalSize,
        lastModified,
      };
    } catch (error) {
      this.handleError("getBucketStats", error);
      throw error;
    }
  }

  private async retry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delay * Math.pow(2, i))
          );
        }
      }
    }
    throw lastError;
  }
}
