import { config } from '../config.js';
import logger from '../utils/logger.js';

export class RecallService {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor() {
    this.baseUrl = `https://api.recall.ai/v1`;
    this.headers = {
      Authorization: `Bearer ${config.RECALL_PRIVATE_KEY}`,
      'Content-Type': 'application/json',
    };
    logger.info('RecallService initialized with config:', {
      baseUrl: this.baseUrl,
      hasPrivateKey: !!config.RECALL_PRIVATE_KEY,
      bucketAlias: config.RECALL_BUCKET_ALIAS,
      network: config.RECALL_NETWORK,
    });
  }

  async storeObject(bucket: string, key: string, data: unknown): Promise<void> {
    try {
      const url = `${this.baseUrl}/buckets/${bucket}/objects/${key}`;
      logger.info(`Attempting to store object at: ${url}`);

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Recall API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url,
          headers: this.headers,
        });
        throw new Error(`Failed to store object: ${response.statusText} - ${errorText}`);
      }

      logger.info(`Successfully stored object: ${bucket}/${key}`);
    } catch (error) {
      logger.error(`Error storing object ${bucket}/${key}:`, error);
      throw error;
    }
  }

  async getObject<T>(bucket: string, key: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}/buckets/${bucket}/objects/${key}`, {
        headers: this.headers,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get object: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      logger.error(`Error getting object ${bucket}/${key}:`, error);
      throw error;
    }
  }

  async listObjects(bucket: string, prefix: string): Promise<string[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`,
        {
          headers: this.headers,
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to list objects: ${response.statusText}`);
      }

      const data = await response.json();
      return data.objects.map((obj: { key: string }) => obj.key);
    } catch (error) {
      logger.error(`Error listing objects in ${bucket}:`, error);
      throw error;
    }
  }
}
