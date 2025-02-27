import { elizaLogger, UUID, Service, ServiceType, DatabaseAdapter } from '@elizaos/core';
import { ChainName, getChain, testnet } from '@recallnet/chains';
import { AccountInfo } from '@recallnet/sdk/account';
import { ListResult } from '@recallnet/sdk/bucket';
import { RecallClient, walletClientFromPrivateKey } from '@recallnet/sdk/client';
import { CreditAccount } from '@recallnet/sdk/credit';
import { Address, Hex, parseEther, TransactionReceipt } from 'viem';
import { ICotAgentRuntime } from '../../types/index.ts';

type Result<T = unknown> = {
  result: T;
  meta?: {
    tx?: TransactionReceipt;
  };
};

const privateKey = process.env.RECALL_PRIVATE_KEY as Hex;
const envAlias = process.env.RECALL_BUCKET_ALIAS as string;
const envPrefix = process.env.RECALL_COT_LOG_PREFIX as string;
const network = process.env.RECALL_NETWORK as string;
const intervalPeriod = process.env.RECALL_SYNC_INTERVAL as string;
const batchSize = process.env.RECALL_BATCH_SIZE as string;
const SYNC_STATE_KEY = 'last_synced_timestamp'; // Key for storing sync state in Recall

export class RecallService extends Service {
  static serviceType: ServiceType = 'recall' as ServiceType;
  private client: RecallClient;
  private runtime: ICotAgentRuntime;
  private syncInterval: NodeJS.Timeout | undefined;
  private alias: string;
  private prefix: string;
  private intervalMs: number;
  private batchSizeKB: number;
  private lastSyncedTimestamp: Date | null = null;
  private pendingBatch: {
    logs: string[];
    size: number;
    lastProcessedTimestamp: Date | null;
  } = {
    logs: [],
    size: 0,
    lastProcessedTimestamp: null,
  };

  getInstance(): RecallService {
    return RecallService.getInstance();
  }

  async initialize(_runtime: ICotAgentRuntime): Promise<void> {
    try {
      if (!privateKey) {
        throw new Error('RECALL_PRIVATE_KEY is required');
      }
      if (!envAlias) {
        throw new Error('RECALL_BUCKET_ALIAS is required');
      }
      if (!envPrefix) {
        throw new Error('RECALL_COT_LOG_PREFIX is required');
      }
      const chain = network ? getChain(network as ChainName) : testnet;
      const wallet = walletClientFromPrivateKey(privateKey, chain);
      this.client = new RecallClient({ walletClient: wallet });
      this.alias = envAlias;
      this.prefix = envPrefix;
      this.runtime = _runtime;
      // Use user-defined sync interval and batch size, if provided
      this.intervalMs = intervalPeriod ? parseInt(intervalPeriod, 10) : 2 * 60 * 1000;
      this.batchSizeKB = batchSize ? parseInt(batchSize, 10) : 4;

      // Load the last synced timestamp from Recall
      await this.loadSyncState();

      this.startPeriodicSync(this.intervalMs, this.batchSizeKB);
      elizaLogger.success('RecallService initialized successfully, starting periodic sync.');
    } catch (error) {
      elizaLogger.error(`Error initializing RecallService: ${error.message}`);
    }
  }

  /**
   * Utility function to handle timeouts for async operations.
   * @param promise The promise to execute.
   * @param timeoutMs The timeout in milliseconds.
   * @param operationName The name of the operation for logging.
   * @returns The result of the promise.
   */
  async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${operationName} operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Gets the account information for the current user.
   * @returns The account information.
   */
  public async getAccountInfo(): Promise<AccountInfo> | undefined {
    try {
      const info = await this.client.accountManager().info();
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error getting account info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lists all buckets in Recall.
   * @returns The list of buckets.
   */
  public async listBuckets(): Promise<ListResult> | undefined {
    try {
      const info = await this.client.bucketManager().list();
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error listing buckets: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets the credit information for the account.
   * @returns The credit information.
   */
  public async getCreditInfo(): Promise<CreditAccount> | undefined {
    try {
      const info = await this.client.creditManager().getAccount();
      return info.result;
    } catch (error) {
      elizaLogger.error(`Error getting credit info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Buys credit for the account.
   * @param amount The amount of credit to buy.
   * @returns The result of the buy operation.
   */
  public async buyCredit(amount: string): Promise<Result> {
    try {
      const info = await this.client.creditManager().buy(parseEther(amount));
      return info; // Return the full Result object
    } catch (error) {
      elizaLogger.error(`Error buying credit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets or creates a log bucket in Recall.
   * @param bucketAlias The alias of the bucket to retrieve or create.
   * @returns The address of the log bucket.
   */
  public async getOrCreateBucket(bucketAlias: string): Promise<Address> {
    try {
      elizaLogger.info(`Looking for bucket with alias: ${bucketAlias}`);

      // Try to find the bucket by alias
      const buckets = await this.client.bucketManager().list();
      if (buckets?.result) {
        const bucket = buckets.result.find((b) => b.metadata?.alias === bucketAlias);
        if (bucket) {
          elizaLogger.info(`Found existing bucket "${bucketAlias}" at ${bucket.addr}`);
          return bucket.addr; // Return existing bucket address
        } else {
          elizaLogger.info(`Bucket with alias "${bucketAlias}" not found, creating a new one.`);
        }
      }

      // Ensure bucketAlias is correctly passed during creation
      const query = await this.client.bucketManager().create({
        metadata: { alias: bucketAlias },
      });

      const newBucket = query.result;
      if (!newBucket) {
        elizaLogger.error(`Failed to create new bucket with alias: ${bucketAlias}`);
        throw new Error(`Failed to create bucket: ${bucketAlias}`);
      }

      elizaLogger.info(`Successfully created new bucket "${bucketAlias}" at ${newBucket.bucket}`);
      return newBucket.bucket;
    } catch (error) {
      elizaLogger.error(`Error in getOrCreateBucket: ${error.message}`);
      throw error;
    }
  }

  /**
   * Adds an object to a bucket.
   * @param bucket The address of the bucket.
   * @param key The key under which to store the object.
   * @param data The data to store (string, File, or Uint8Array).
   * @param options Optional parameters:
   *   - overwrite: Whether to overwrite existing object with same key (default: false)
   *   - ttl: Time-to-live in seconds (must be >= MIN_TTL if specified)
   *   - metadata: Additional metadata key-value pairs
   * @returns A Result object containing:
   *   - result: Empty object ({})
   *   - meta: Optional metadata including transaction receipt
   * @throws {InvalidValue} If object size exceeds MAX_OBJECT_SIZE or TTL is invalid
   * @throws {ActorNotFound} If the bucket or actor is not found
   * @throws {AddObjectError} If the object addition fails
   */
  public async addObject(
    bucket: Address,
    key: string,
    data: string | File | Uint8Array,
    options?: { overwrite?: boolean },
  ): Promise<Result> {
    try {
      const info = await this.client.bucketManager().add(bucket, key, data, {
        overwrite: options?.overwrite ?? false,
      });
      return info; // Return the full Result object
    } catch (error) {
      elizaLogger.error(`Error adding object: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets an object from a bucket.
   * @param bucket The address of the bucket.
   * @param key The key under which the object is stored.
   * @returns The data stored under the specified key.
   */
  public async getObject(bucket: Address, key: string): Promise<Uint8Array | undefined> {
    try {
      const info = await this.client.bucketManager().get(bucket, key);
      return info.result;
    } catch (error) {
      elizaLogger.warn(`Error getting object: ${error.message}`);
      // Return undefined instead of throwing to allow graceful handling of missing objects
      return undefined;
    }
  }

  /**
   * Enhanced state saving to handle pending batches
   */
  async saveSyncState(timestamp: Date, includeTracking: boolean = false): Promise<void> {
    try {
      // Don't update if the new timestamp is earlier than our current one
      // This prevents losing progress when syncing small batches
      if (this.lastSyncedTimestamp && timestamp <= this.lastSyncedTimestamp && !includeTracking) {
        elizaLogger.info(
          `Skipping sync state update: new timestamp (${timestamp.toISOString()}) ` +
            `is not newer than current (${this.lastSyncedTimestamp.toISOString()})`,
        );
        return;
      }

      const bucketAddress = await this.getOrCreateBucket(this.alias);
      const stateKey = `${this.prefix}${SYNC_STATE_KEY}`;

      // Enhanced state object that includes tracking of pending logs
      const stateData = JSON.stringify({
        lastSyncedTimestamp: timestamp.toISOString(),
        pendingBatch: includeTracking
          ? {
              size: this.pendingBatch.size,
              count: this.pendingBatch.logs.length,
              lastProcessedTimestamp:
                this.pendingBatch.lastProcessedTimestamp?.toISOString() || null,
            }
          : undefined,
      });

      await this.withTimeout(
        this.client
          .bucketManager()
          .add(bucketAddress, stateKey, new TextEncoder().encode(stateData), { overwrite: true }),
        15000,
        'Save sync state',
      );

      this.lastSyncedTimestamp = timestamp;
      elizaLogger.info(
        `Saved sync state with timestamp: ${timestamp.toISOString()}${
          includeTracking
            ? ` and tracking info for ${this.pendingBatch.logs.length} pending logs`
            : ''
        }`,
      );
    } catch (error) {
      elizaLogger.error(`Error saving sync state: ${error.message}`);
    }
  }

  /**
   * Enhanced state loading that handles pending batch tracking
   */
  async loadSyncState(): Promise<void> {
    try {
      const bucketAddress = await this.getOrCreateBucket(this.alias);
      const stateKey = `${this.prefix}${SYNC_STATE_KEY}`;

      const stateData = await this.getObject(bucketAddress, stateKey);
      if (stateData) {
        const stateJson = new TextDecoder().decode(stateData);
        const state = JSON.parse(stateJson);

        if (state.lastSyncedTimestamp) {
          this.lastSyncedTimestamp = new Date(state.lastSyncedTimestamp);
          elizaLogger.info(
            `Loaded last synced timestamp: ${this.lastSyncedTimestamp.toISOString()}`,
          );

          // If we have pending batch info, log it
          if (state.pendingBatch) {
            elizaLogger.info(
              `Found tracking information for ${state.pendingBatch.count} pending logs ` +
                `(${state.pendingBatch.size} bytes) with last timestamp: ${
                  state.pendingBatch.lastProcessedTimestamp || 'none'
                }`,
            );
          }
        } else {
          elizaLogger.info(`No previous sync state found, will sync all available logs.`);
        }
      } else {
        elizaLogger.info(`No previous sync state found, will sync all available logs.`);
      }
    } catch (error) {
      elizaLogger.warn(`Could not load sync state, will sync all available logs: ${error.message}`);
    }
  }

  /**
   * Stores a batch of logs to Recall.
   * @param bucketAddress The address of the bucket to store logs.
   * @param batch The batch of logs to store.
   * @param timestamp The timestamp to use in the key.
   * @returns The key under which the logs were stored.
   */
  async storeBatchToRecall(
    bucketAddress: Address,
    batch: string[],
    timestamp: string,
  ): Promise<string | undefined> {
    try {
      const nextLogKey = `${this.prefix}${timestamp}.jsonl`;
      const batchData = batch.join('\n');

      // Add 30 second timeout to the add operation
      const addObject = await this.withTimeout(
        this.client
          .bucketManager()
          .add(bucketAddress, nextLogKey, new TextEncoder().encode(batchData)),
        30000, // 30 second timeout
        'Recall batch storage',
      );

      if (!addObject?.meta?.tx) {
        // Check for transaction receipt instead of result
        elizaLogger.error('Recall API returned invalid response for batch storage');
        return undefined;
      }

      elizaLogger.info(`Successfully stored batch at key: ${nextLogKey}`);
      return nextLogKey;
    } catch (error) {
      if (error.message.includes('timed out')) {
        elizaLogger.error(`Recall API timed out while storing batch`);
      } else {
        elizaLogger.error(`Error storing JSONL logs in Recall: ${error.message}`);
      }
      return undefined;
    }
  }

  /**
   * Fetches unsynchronized logs based on the createdAt timestamp.
   * @returns Array of logs that haven't been synced yet.
   */

  async getUnsyncedLogs(): Promise<any[]> {
    try {
      // Use lastSyncedTimestamp to determine which logs to fetch
      // If null, we'll fetch from the beginning
      const lastSyncTime = this.lastSyncedTimestamp ? this.lastSyncedTimestamp.toISOString() : null;

      const db: any = this.runtime.databaseAdapter;

      // If we have a pending batch with a lastProcessedTimestamp, we want to fetch logs
      // after the last processed timestamp instead of the last synced timestamp
      // This ensures we don't miss any logs that were generated while we were processing
      // the last batch
      let queryTimestamp = lastSyncTime;

      // If we have pending logs that we've processed but not synced,
      // we want to start from where we left off, not from the last synced timestamp
      if (this.pendingBatch.lastProcessedTimestamp) {
        const pendingLogTime = this.pendingBatch.lastProcessedTimestamp.toISOString();
        elizaLogger.info(
          `Using last processed timestamp ${pendingLogTime} instead of last synced timestamp ${lastSyncTime || 'none'}`,
        );
        queryTimestamp = pendingLogTime;
      }

      let query = `SELECT * FROM logs WHERE type = 'chain-of-thought'`;

      if (queryTimestamp) {
        // Using '>' not '>=' to avoid duplicating the last log we've already processed
        query += ` AND createdAt > '${queryTimestamp}'`;
      }

      // Ensure we're getting logs in chronological order
      query += ` ORDER BY createdAt ASC LIMIT 1000`;
      const newLogs = await this.runRawQuery(db, query);

      const logSource = this.pendingBatch.lastProcessedTimestamp
        ? 'last processed timestamp'
        : lastSyncTime
          ? 'last synced timestamp'
          : 'beginning';
      elizaLogger.info(
        `Found ${newLogs.length} new logs since ${logSource} (${queryTimestamp || 'none'})`,
      );

      // Combine existing pending logs with new logs
      let combinedLogs = [...newLogs];

      // Log the current state clearly
      if (this.pendingBatch.logs.length > 0) {
        elizaLogger.info(
          `We have ${this.pendingBatch.logs.length} logs in pending batch that have been processed but not synced`,
        );
      }

      return combinedLogs;
    } catch (error) {
      elizaLogger.error(`Error getting unsynced logs: ${error.message}`);
      return [];
    }
  }

  async runRawQuery<R>(dbAdapter: DatabaseAdapter, query: string, params?: any[]): Promise<R[]> {
    if ('pool' in dbAdapter) {
      // PostgreSQL (uses pool.query)
      return (await (dbAdapter as any).pool.query(query, params)).rows as R[];
    } else if ('db' in dbAdapter) {
      // SQLite (uses prepare + all)
      return (dbAdapter as any).db.prepare(query).all(...(params || [])) as R[];
    } else {
      throw new Error('Unsupported database adapter');
    }
  }

  /**
   * Syncs logs to Recall in batches.
   * @param bucketAlias The alias of the bucket to store logs.
   * @param batchSizeKB The maximum size of each batch in kilobytes.
   */
  async syncLogsToRecall(bucketAlias: string, batchSizeKB = 4): Promise<void> {
    try {
      // Add timeout to bucket creation/retrieval
      const bucketAddress = await this.withTimeout(
        this.getOrCreateBucket(bucketAlias),
        15000, // 15 second timeout
        'Get/Create bucket',
      );

      // Get logs created after the last synced timestamp
      const filteredLogs = await this.getUnsyncedLogs();

      if (filteredLogs.length === 0) {
        elizaLogger.info('No unsynced logs to process.');
        return;
      }

      elizaLogger.info(`Found ${filteredLogs.length} unsynced logs.`);

      // Initialize or use existing batch
      let batch = this.pendingBatch.logs;
      let batchSize = this.pendingBatch.size;
      let lastProcessedTimestamp = this.pendingBatch.lastProcessedTimestamp;

      let syncedUpToTimestamp: Date | null = null;
      let batchTimestamp = Date.now().toString();

      if (batch.length > 0) {
        elizaLogger.info(
          `Starting with existing batch of ${batch.length} logs (${batchSize} bytes)`,
        );
      }

      // Sort logs by createdAt to ensure we process in chronological order
      filteredLogs.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      for (const log of filteredLogs) {
        try {
          const parsedLog = JSON.parse(log.body);
          const jsonlEntry = JSON.stringify({
            userId: parsedLog.userId,
            agentId: parsedLog.agentId,
            userMessage: parsedLog.userMessage,
            log: parsedLog.log,
            createdAt: log.createdAt, // Include createdAt in the stored log
          });

          const logSize = new TextEncoder().encode(jsonlEntry).length;

          // If this log would make the batch exceed the size limit, store the current batch first
          if (batchSize + logSize > batchSizeKB * 1024) {
            elizaLogger.info(
              `Batch size ${batchSize + logSize} bytes exceeds ${batchSizeKB} KB limit. Attempting sync...`,
            );

            const logFileKey = await this.storeBatchToRecall(bucketAddress, batch, batchTimestamp);

            if (logFileKey) {
              elizaLogger.info(`Successfully synced batch of ${batch.length} logs`);

              // Update the synced timestamp to the timestamp of the last processed log
              syncedUpToTimestamp = lastProcessedTimestamp;

              // Save the sync state after successful batch sync
              if (syncedUpToTimestamp) {
                await this.saveSyncState(syncedUpToTimestamp);
              }

              // Clear pending batch tracking
              this.pendingBatch = {
                logs: [],
                size: 0,
                lastProcessedTimestamp: null,
              };
            } else {
              elizaLogger.warn(
                `Failed to sync batch of ${batch.length} logs - will retry on next sync`,
              );
              // Don't update timestamps if sync failed
              continue;
            }

            // Start a new batch
            batch = [];
            batchSize = 0;
            batchTimestamp = Date.now().toString();
          }

          batch.push(jsonlEntry);
          batchSize += logSize;

          // Always update last processed timestamp to track our progress
          lastProcessedTimestamp = new Date(log.createdAt);
        } catch (error) {
          elizaLogger.error(`Error processing log entry ${log.id}: ${error.message}`);
        }
      }

      // Handle remaining small batch - don't sync it but track it
      if (batch.length > 0) {
        elizaLogger.info(
          `Deferring sync of ${batch.length} logs (${batchSize} bytes) until next cycle`,
        );

        // Update pending batch tracking
        this.pendingBatch = {
          logs: batch,
          size: batchSize,
          lastProcessedTimestamp: lastProcessedTimestamp,
        };

        // Update sync state with tracking info
        if (syncedUpToTimestamp) {
          // If we've synced some logs in this cycle, use that timestamp but include tracking
          await this.saveSyncState(syncedUpToTimestamp, true);
        } else if (this.lastSyncedTimestamp) {
          // If we haven't synced anything new, maintain the last timestamp but add tracking
          await this.saveSyncState(this.lastSyncedTimestamp, true);
        } else if (lastProcessedTimestamp) {
          // First run with no successful sync, use a dummy timestamp
          const dummyTimestamp = new Date(0); // Epoch time
          await this.saveSyncState(dummyTimestamp, true);
        }
      }

      const logSyncInterval =
        this.intervalMs < 60000
          ? `${this.intervalMs / 1000} seconds`
          : `${this.intervalMs / 1000 / 60} minutes`;
      elizaLogger.info(`Sync cycle complete. Next sync in ${logSyncInterval}.`);
    } catch (error) {
      if (error.message.includes('timed out')) {
        elizaLogger.error(`Recall sync operation timed out: ${error.message}`);
      } else {
        elizaLogger.error(`Error in syncLogsToRecall: ${error.message}`);
      }
    }
  }

  /**
   * Retrieve and order all chain-of-thought logs from Recall.
   * @param bucketAlias The alias of the bucket to query.
   * @returns An array of ordered chain-of-thought logs.
   */
  async retrieveOrderedChainOfThoughtLogs(bucketAlias: string): Promise<any[]> {
    try {
      const bucketAddress = await this.getOrCreateBucket(bucketAlias);
      elizaLogger.info(`Retrieving chain-of-thought logs from bucket: ${bucketAddress}`);

      // Query all objects with the designated prefix
      const queryResult = await this.client
        .bucketManager()
        .query(bucketAddress, { prefix: this.prefix }); // Remove the extra '/'

      if (!queryResult.result?.objects.length) {
        elizaLogger.info(`No chain-of-thought logs found in bucket: ${bucketAlias}`);
        return [];
      }

      // Extract log filenames and sort by timestamp
      const logFiles = queryResult.result.objects
        .map((obj) => obj.key)
        .filter((key) => key.startsWith(this.prefix) && key.endsWith('.jsonl'))
        .sort((a, b) => {
          // Extract timestamps by removing prefix and .jsonl extension
          const timeA = parseInt(a.slice(this.prefix.length, -6), 10);
          const timeB = parseInt(b.slice(this.prefix.length, -6), 10);
          return timeA - timeB;
        });

      elizaLogger.info(
        `Retrieving ${logFiles.length} log files containing chain-of-thought data...`,
      );

      let allLogs: any[] = [];

      // Download and parse each log file
      for (const logFile of logFiles) {
        try {
          const logData = await this.client.bucketManager().get(bucketAddress, logFile);
          if (!logData.result) continue;

          // Decode and split JSONL content
          const decodedLogs = new TextDecoder().decode(logData.result).trim().split('\n');
          const parsedLogs = decodedLogs.map((line) => JSON.parse(line));

          allLogs.push(...parsedLogs);
        } catch (error) {
          elizaLogger.error(`Error retrieving log file ${logFile}: ${error.message}`);
        }
      }

      // Sort logs by createdAt if available, otherwise maintain file order
      allLogs.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return 0;
      });

      elizaLogger.info(
        `Successfully retrieved and ordered ${allLogs.length} chain-of-thought logs.`,
      );
      return allLogs;
    } catch (error) {
      elizaLogger.error(`Error retrieving ordered chain-of-thought logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Starts the periodic log syncing.
   * @param intervalMs The interval in milliseconds for syncing logs.
   * @param batchSizeKB The maximum size of each batch in kilobytes.
   */
  public startPeriodicSync(intervalMs = 2 * 60 * 1000, batchSizeKB = 4): void {
    if (this.syncInterval) {
      elizaLogger.warn('Log sync is already running.');
      return;
    }

    elizaLogger.info('Starting periodic log sync...');
    this.syncInterval = setInterval(async () => {
      try {
        await this.syncLogsToRecall(this.alias, batchSizeKB);
      } catch (error) {
        elizaLogger.error(`Periodic log sync failed: ${error.message}`);
      }
    }, intervalMs);

    // Perform an immediate sync on startup
    this.syncLogsToRecall(this.alias, batchSizeKB).catch((error) =>
      elizaLogger.error(`Initial log sync failed: ${error.message}`),
    );
  }

  /**
   * Stops the periodic log syncing.
   */
  public stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      elizaLogger.info('Stopped periodic log syncing.');
    }
  }
}
