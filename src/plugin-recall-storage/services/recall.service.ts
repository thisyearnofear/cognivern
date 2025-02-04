import {
  RecallClient,
  testnet,
  walletClientFromPrivateKey,
  CreditAccount,
  BuyResult,
  ListResult,
  CreateBucketResult,
  AddObjectResult,
  QueryResult,
} from "../../../../js-recall/packages/sdk/dist/index.js"; // to replace with import from recall-sdk
import { elizaLogger, IAgentRuntime, UUID } from "@elizaos/core";
import { parseEther } from "viem";
import { ICotAgentRuntime } from "../../types/index.js";

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
  private client: RecallClient;
  private runtime: ICotAgentRuntime;
  private syncInterval: NodeJS.Timeout | undefined;

  private constructor(runtime: ICotAgentRuntime) {
    if (!process.env.RECALL_PRIVATE_KEY) {
      throw new Error("RECALL_PRIVATE_KEY is required");
    }
    const wallet = walletClientFromPrivateKey(privateKey, testnet);
    this.client = new RecallClient({ walletClient: wallet });
    this.runtime = runtime;
  }

  public static getInstance(runtime: ICotAgentRuntime): RecallService {
    if (!RecallService.instance) {
      RecallService.instance = new RecallService(runtime);
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

  async storeBatchToRecall(bucketAddress: Address, batch: string[]): Promise<string | undefined> {
    try {
      // Query existing log keys to determine the next log file index
      const prefix = "cot";
      const queryResult = await this.queryObjects(bucketAddress, { prefix });

      // Determine the next log index
      let maxIndex = 0;
      if (queryResult?.objects.length) {
        const logIndexes = queryResult.objects
          .map(({ key }) => {
            const match = key.match(/^cot\/(\d+)\.jsonl$/);
            return match ? parseInt(match[1], 10) : null;
          })
          .filter((num): num is number => num !== null);
        maxIndex = logIndexes.length ? Math.max(...logIndexes) : 0;
      }

      // Construct new log file name
      const nextLogKey = `cot/${maxIndex + 1}.jsonl`;

      // Join batch into a single JSONL file
      const batchData = batch.join("\n");

      // Store in Recall
      const result = await this.addObject(
        bucketAddress,
        nextLogKey,
        new TextEncoder().encode(batchData)
      );

      if (result) {
        elizaLogger.info(`Batched JSONL logs stored under key: ${nextLogKey}`);
        return nextLogKey;
      }
    } catch (error) {
      elizaLogger.error(`Error storing JSONL logs in Recall: ${error.message}`);
    }
    return undefined;
  }

  async syncLogsToRecall(bucketAlias: string, batchSizeKB = 4): Promise<void> {
    try {
      const bucketAddress = await this.getOrCreateLogBucket(bucketAlias);

      // Fetch unsynced logs from SQLite
      const unsyncedLogs = await this.runtime.databaseAdapter.getUnsyncedLogs();
      if (unsyncedLogs.length === 0) {
        elizaLogger.info("No unsynced logs to process.");
        return;
      }

      let batch: string[] = [];
      let batchSize = 0; // in bytes
      let syncedLogIds: UUID[] = [];

      for (const log of unsyncedLogs) {
        try {
          // Parse JSON stored in body
          const parsedLog = JSON.parse(log.body);
          const jsonlEntry = JSON.stringify({
            userId: parsedLog.userId,
            agentId: parsedLog.agentId,
            userMessage: parsedLog.userMessage,
            log: parsedLog.log,
          });

          const logSize = new TextEncoder().encode(jsonlEntry).length; // Get byte size

          if (batchSize + logSize > batchSizeKB * 1024) {
            // Sync current batch
            const logFileKey = await this.storeBatchToRecall(bucketAddress, batch);
            if (logFileKey) {
              await this.runtime.databaseAdapter.markLogsAsSynced(syncedLogIds);
            }
            // Reset batch
            batch = [];
            batchSize = 0;
            syncedLogIds = [];
          }

          batch.push(jsonlEntry);
          batchSize += logSize;
          syncedLogIds.push(log.id);
        } catch (error) {
          elizaLogger.error(`Error parsing log entry: ${error.message}`);
        }
      }

      // Final batch sync if any remaining
      if (batch.length > 0) {
        const logFileKey = await this.storeBatchToRecall(bucketAddress, batch);
        if (logFileKey) {
          await this.runtime.databaseAdapter.markLogsAsSynced(syncedLogIds);
        }
      }

      elizaLogger.success("All unsynced logs successfully synced to Recall.");
    } catch (error) {
      elizaLogger.error(`Error syncing logs to Recall: ${error.message}`);
      throw error;
    }
  }

  /**
     * Starts periodic syncing of logs to Recall every X minutes.
     * Ensures only one interval runs at a time.
     */
  public startPeriodicSync(intervalMs = 10 * 60 * 1000): void {
    if (this.syncInterval) {
      elizaLogger.warn("Log sync is already running.");
      return;
    }

    elizaLogger.info("Starting periodic log sync...");
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncLogsToRecall("cot-logs");
      } catch (error) {
        elizaLogger.error(`Periodic log sync failed: ${error.message}`);
      }
    }, intervalMs);

    // Perform an immediate sync on startup
    this.syncLogsToRecall("cot-logs").catch(error =>
      elizaLogger.error(`Initial log sync failed: ${error.message}`)
    );
  }

  /**
   * Stops the periodic log syncing.
   */
  public stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      elizaLogger.info("Stopped periodic log syncing.");
    }
  }

}

