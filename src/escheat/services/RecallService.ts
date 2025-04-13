import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import logger from '../utils/logger.js';

export class RecallService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.RECALL_API_URL;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.RECALL_API_KEY}`,
      },
    });
    logger.info('RecallService initialized', { baseUrl: this.baseUrl });
  }

  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      await this.client.head(`/buckets/${bucketName}`);
      logger.debug(`Bucket ${bucketName} exists`);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.info(`Creating bucket: ${bucketName}`);
        await this.client.post('/buckets', { name: bucketName });
      } else {
        logger.error(`Error checking bucket ${bucketName}:`, error);
        throw new Error(
          `Failed to check/create bucket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }
  }

  async storeObject<T>(bucketName: string, objectKey: string, data: T): Promise<void> {
    try {
      await this.ensureBucketExists(bucketName);

      const response = await this.client.put(`/buckets/${bucketName}/objects/${objectKey}`, data);
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }

      logger.debug(`Stored object in bucket ${bucketName}:`, { objectKey });
    } catch (error) {
      logger.error(`Error storing object in bucket ${bucketName}:`, error);
      throw new Error(
        `Failed to store object: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getObject<T>(bucketName: string, objectKey: string): Promise<T | null> {
    try {
      const response = await this.client.get<T>(`/buckets/${bucketName}/objects/${objectKey}`);
      logger.debug(`Retrieved object from bucket ${bucketName}:`, { objectKey });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.debug(`Object not found in bucket ${bucketName}:`, { objectKey });
        return null;
      }
      logger.error(`Error retrieving object from bucket ${bucketName}:`, error);
      throw new Error(
        `Failed to retrieve object: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listObjects(bucketName: string, prefix: string = ''): Promise<string[]> {
    try {
      const response = await this.client.get<{ objects: Array<{ key: string }> }>(
        `/buckets/${bucketName}/objects`,
        { params: { prefix } },
      );

      const objects = response.data.objects.map((obj) => obj.key);
      logger.debug(`Listed objects in bucket ${bucketName}:`, {
        prefix,
        count: objects.length,
      });

      return objects;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.debug(`Bucket ${bucketName} not found`);
        return [];
      }
      logger.error(`Error listing objects in bucket ${bucketName}:`, error);
      throw new Error(
        `Failed to list objects: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
