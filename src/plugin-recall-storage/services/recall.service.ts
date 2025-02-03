import {
  HokuClient,
  testnet,
  walletClientFromPrivateKey,
  CreditAccount,
  BuyResult,
  ListResult,
  CreateBucketResult,
  AddObjectResult,
  QueryResult,
} from "../../../../js-recall/packages/sdk/dist/index.js"; // to replace with import from recall-sdk
import { elizaLogger } from "@elizaos/core";
import { parseEther } from "viem";

type Address = `0x${string}`;
type Result<T> = { result: T; error?: string };
type AccountInfo = {
  address: Address;
  nonce: number;
  balance: bigint;
  parentBalance?: bigint;
};

type QueryOps = {
  prefix?: string;
  delimiter?: string;
  startKey?: string;
  limit?: number;
  blockNumber?: bigint;
};

const privateKey = process.env.RECALL_PRIVATE_KEY as `0x${string}`;

export class RecallService {
  private static instance: RecallService;
  private client: HokuClient;

  private constructor() {
    if (!process.env.RECALL_PRIVATE_KEY) {
      throw new Error("RECALL_PRIVATE_KEY is required");
    }
    const wallet = walletClientFromPrivateKey(privateKey, testnet);
    this.client = new HokuClient({ walletClient: wallet });
  }
  public static getInstance(): RecallService {
    if (!RecallService.instance) {
      RecallService.instance = new RecallService();
    }
    return RecallService.instance;
  }

  public async getAccountInfo(): Promise<AccountInfo> | undefined {
    try {
      const info = await this.client.accountManager().info();
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error getting account info: ${error.message}`);
      throw error;
    }
  }

  public async getCreditInfo(): Promise<CreditAccount> | undefined {
    try {
      const info = await this.client.creditManager().getAccount();
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error getting credit info: ${error.message}`);
      throw error;
    }
  }

  public async buyCredit(amount: string): Promise<BuyResult> | undefined {
    try {
      const info = await this.client.creditManager().buy(parseEther(amount));
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error buying credit: ${error.message}`);
      throw error;
    }
  }

  public async listBuckets(): Promise<Result<ListResult> | undefined> {
    try {
      const info = await this.client.bucketManager().list();
      return info;
    } catch (error) {
      elizaLogger.error(`Error listing buckets: ${error.message}`);
      throw error;
    }
  }

  public async createBucket(
    metadata?: Record<string, string>
  ): Promise<CreateBucketResult> | undefined {
    try {
      const info = await this.client.bucketManager().create(metadata);
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error creating bucket: ${error.message}`);
      throw error;
    }
  }

  public async addObject(
    bucket: Address,
    key: string,
    data: string | File | Uint8Array,
    options?: { overwrite?: boolean }
  ): Promise<AddObjectResult | undefined> {
    try {
      const info = await this.client.bucketManager().add(bucket, key, data, {
        overwrite: options?.overwrite ?? false,
      });
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error adding object: ${error.message}`);
      throw error;
    }
  }

  public async getObject(
    bucket: Address,
    key: string
  ): Promise<Uint8Array | undefined> {
    try {
      const info = await this.client.bucketManager().get(bucket, key);
      return info.result;
    } catch (error) {
      elizaLogger.warn(`Error getting object: ${error.message}`);
      throw error;
    }
  }

  public async queryObjects(
    bucket: Address,
    ops?: QueryOps
  ): Promise<QueryResult> | undefined {
    try {
      const info = await this.client.bucketManager().query(bucket, ops);
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error querying objects: ${error.message}`);
      throw error;
    }
  }

  public async ensureBucketExists(bucketAlias: string): Promise<Address> {
    try {
      const buckets = await this.listBuckets();
      if (buckets?.result) {
        const bucket = buckets.result.find(
          (b) => b.metadata?.alias === bucketAlias
        );
        if (!bucket) {
          const createdBucket = await this.createBucket({ alias: bucketAlias });
          return createdBucket?.bucket;
        }
      }
      const newBucket = await this.createBucket({ alias: bucketAlias });
      return newBucket?.bucket;
    } catch (error) {
      elizaLogger.error(`Error ensuring bucket exists: ${error.message}`);
      throw error;
    }
  }

  public async getOrCreateLogBucket(bucketAlias: string): Promise<Address> {
    try {
      // Try to find the bucket by alias
      const buckets = await this.listBuckets();
      if (buckets?.result) {
        const bucket = buckets.result.find(
          (b) => b.metadata?.alias === bucketAlias
        );
        if (bucket) {
          return bucket.addr; // Return existing bucket address
        } else {
          elizaLogger.info(
            `Bucket with alias ${bucketAlias} not found, creating a new one.`
          );
        }
      }

      // If not found, create a new bucket with the same alias
      const newBucket = await this.createBucket({ alias: bucketAlias });
      if (!newBucket) {
        elizaLogger.error(
          `Failed to create new bucket with alias: ${bucketAlias}`
        );
      }

      elizaLogger.info(`Created new log bucket with alias: ${bucketAlias}`);
      return newBucket.bucket;
    } catch (error) {
      elizaLogger.error(
        `Error getting or creating log bucket: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Writes logs as separate objects with an incrementing key pattern (cot/1.log, cot/2.log, etc.).
   */
  public async createOrAppendLogs(
    bucketAddress: Address,
    prefix: string,
    logs: string
  ): Promise<{ success: boolean; logKey?: string }> {
    try {
      // Query existing log keys
      const queryResult = await this.queryObjects(bucketAddress, { prefix });

      // Find the highest index from existing log files
      let maxIndex = 0;
      if (queryResult?.objects.length) {
        const logIndexes = queryResult.objects
          .map(({ key }) => {
            const match = key.match(/^.+\/(\d+)\.log$/);
            return match ? parseInt(match[1], 10) : null;
          })
          .filter((num): num is number => num !== null); // Remove null values

        maxIndex = logIndexes.length ? Math.max(...logIndexes) : 0;
      }

      // Determine new log key
      const nextLogKey = `${prefix}/${maxIndex + 1}.log`;

      // Save new log as a separate object
      const result = await this.addObject(
        bucketAddress,
        nextLogKey,
        new TextEncoder().encode(logs)
      );

      if (result) {
        elizaLogger.info(`Log stored under key: ${nextLogKey}`);
        return { success: true, logKey: nextLogKey };
      }
    } catch (error) {
      elizaLogger.error(`Error appending logs: ${error.message}`);
      throw error;
    }

    return { success: false };
  }
}

