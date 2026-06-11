import { MongoClient, Db, Collection } from "mongodb";
import logger from "../utils/logger.js";

export interface MongoDbConfig {
  uri?: string;
  dbName?: string;
}

export class MongoDbService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: MongoDbConfig;
  private connected = false;

  constructor(config: Partial<MongoDbConfig> = {}) {
    this.config = {
      uri: config.uri || process.env.MONGODB_URI,
      dbName: config.dbName || process.env.MONGODB_DB_NAME || "cognivern",
    };
  }

  async connect(): Promise<Db> {
    if (this.db) return this.db;

    if (!this.config.uri) {
      throw new Error(
        "MongoDB URI not configured. Set MONGODB_URI env var or pass uri to constructor.",
      );
    }

    this.client = new MongoClient(this.config.uri);
    await this.client.connect();
    this.db = this.client.db(this.config.dbName);
    this.connected = true;
    logger.info(`Connected to MongoDB: ${this.config.dbName}`);
    return this.db;
  }

  collection<T extends Document>(name: string): Collection<T> {
    if (!this.db) {
      throw new Error("MongoDB not connected. Call connect() first.");
    }
    return this.db.collection<T>(name);
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connected = false;
      logger.info("Disconnected from MongoDB");
    }
  }
}

export const mongoDbService = new MongoDbService();
