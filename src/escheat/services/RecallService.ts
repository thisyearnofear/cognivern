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

      const { result } = await bucketManager.getObjectValue(this.bucketAddress, fullKey);

      if (!result) {
        return null;
      }

      const content = new TextDecoder().decode(result as unknown as Uint8Array);
      return JSON.parse(content) as T;
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

      if (!result || !result.objects) {
        return [];
      }

      return result.objects.map((obj) => obj.key);
    } catch (error) {
      logger.error(`Error listing objects in bucket ${prefix}:`, error);
      throw new Error(
        `Failed to list objects: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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
