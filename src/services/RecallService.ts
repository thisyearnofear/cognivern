import { RecallClient } from '@recallnet/sdk/client';
import type { Address } from 'viem';
import logger from '../utils/logger.js';

export class RecallService {
  private recall: RecallClient;
  private bucketAddress: Address;

  constructor(recall: RecallClient, bucketAddress: Address) {
    this.recall = recall;
    this.bucketAddress = bucketAddress;
    logger.info('RecallService initialized');
  }

  async storeObject(prefix: string, key: string, data: any): Promise<void> {
    try {
      const bucketManager = this.recall.bucketManager();
      const fullKey = `${prefix}/${key}`;

      // Convert data to string if it's an object
      const content = typeof data === 'string' ? data : JSON.stringify(data);

      // Use add method instead of storeObjectValue
      await bucketManager.add(this.bucketAddress, fullKey, new TextEncoder().encode(content));

      logger.info(`Successfully stored object at ${fullKey}`);
    } catch (error) {
      logger.error(`Error storing object in bucket ${prefix}:`, error);
      throw new Error(
        `Failed to store object: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getObject<T>(prefix: string, key: string): Promise<T | null> {
    try {
      const bucketManager = this.recall.bucketManager();
      const fullKey = `${prefix}/${key}`;

      // Use get instead of getObjectValue to get the raw object data
      const { result } = await bucketManager.get(this.bucketAddress, fullKey);

      if (!result) {
        logger.warn(`No data found for ${fullKey}`);
        return null;
      }

      let contentStr: string;

      // Handle different types of results
      if (
        typeof result === 'object' &&
        result !== null &&
        ('buffer' in result || Object.prototype.toString.call(result) === '[object Uint8Array]')
      ) {
        contentStr = new TextDecoder().decode(result as Uint8Array);
      } else if (typeof result === 'string') {
        contentStr = result;
      } else {
        // Try to convert to string if it's a different type
        try {
          contentStr = JSON.stringify(result);
        } catch (stringifyError) {
          logger.error(`Failed to stringify result for ${fullKey}`, stringifyError);
          return null;
        }
      }

      try {
        return JSON.parse(contentStr) as T;
      } catch (parseError) {
        logger.error(`Failed to parse JSON for ${fullKey}`, parseError);
        return null;
      }
    } catch (error) {
      logger.error(`Error getting object from bucket ${prefix}:`, error);
      return null;
    }
  }

  async listObjects(prefix: string): Promise<string[]> {
    try {
      const bucketManager = this.recall.bucketManager();
      const { result } = await bucketManager.query(this.bucketAddress, {
        prefix: prefix ? `${prefix}/` : undefined,
      });

      // Improved error handling
      if (!result) {
        logger.warn(`No result from bucket query for prefix ${prefix}`);
        return [];
      }

      if (!result.objects) {
        logger.warn(`No objects found in bucket for prefix ${prefix}`);
        return [];
      }

      logger.info(`Found ${result.objects.length} objects for prefix ${prefix}`);
      return result.objects.map((obj) => obj.key);
    } catch (error) {
      logger.error(`Error listing objects in bucket ${prefix}:`, error);
      // Return empty array instead of throwing to prevent cascading errors
      return [];
    }
  }

  async deleteObject(prefix: string, key: string): Promise<void> {
    try {
      const bucketManager = this.recall.bucketManager();
      const fullKey = `${prefix}/${key}`;

      // Use delete method instead of removeObject
      await bucketManager.delete(this.bucketAddress, fullKey);
      logger.info(`Successfully deleted object at ${fullKey}`);
    } catch (error) {
      logger.error(`Error deleting object from bucket ${prefix}:`, error);
      throw new Error(
        `Failed to delete object: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
