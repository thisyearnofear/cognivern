import logger from "../utils/logger.js";
import { randomUUID } from "crypto";
import { circuitBreakers } from "../shared/utils/circuitBreaker.js";

export interface RecallMemory {
  id: string;
  agentId: string;
  type: "short_term" | "long_term" | "reasoning" | "observation";
  content: string | object;
  confidence: number;
  timestamp: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface RecallConfig {
  apiKey?: string;
  bucket?: string;
  endpoint?: string;
}

/**
 * Service for interacting with Recall Network for Agent Memory
 */
export class RecallService {
  private config: RecallConfig;
  private isConnected: boolean = false;

  constructor(config: Partial<RecallConfig> = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.RECALL_API_KEY,
      bucket: config.bucket || process.env.RECALL_BUCKET || "agent-memory",
      endpoint:
        config.endpoint ||
        process.env.RECALL_ENDPOINT ||
        "https://api.recall.network/v1",
    };

    if (!this.config.apiKey) {
      logger.error("RECALL_API_KEY is missing. memory storage will fail.");
    } else {
      this.isConnected = true;
      logger.info("RecallService initialized with API key");
    }
  }

  /**
   * Store a new memory unit to Recall
   */
  async store(memory: Omit<RecallMemory, "id" | "timestamp">): Promise<string> {
    if (!this.isConnected || !this.config.apiKey) {
      throw new Error("RecallService: Missing API Key");
    }

    return circuitBreakers.recall.execute(async () => {
      const memoryId = randomUUID();
      const timestamp = new Date().toISOString();

      const newMemory: RecallMemory = {
        ...memory,
        id: memoryId,
        timestamp,
      };

      const response = await fetch(`${this.config.endpoint}/objects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucket: this.config.bucket,
          key: memoryId,
          data: newMemory,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Recall API Error: ${response.status} ${response.statusText}`,
        );
      }

      logger.info(`Stored memory to Recall Network: ${memoryId}`);
      return memoryId;
    });
  }

  /**
   * Retrieve memory by ID
   */
  async retrieve(id: string): Promise<RecallMemory | null> {
    if (!this.isConnected || !this.config.apiKey) {
      throw new Error("RecallService: Missing API Key");
    }

    return circuitBreakers.recall.execute(async () => {
      const response = await fetch(`${this.config.endpoint}/objects/${id}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`Recall API Retrieve Error: ${response.status}`);
      }

      const data = await response.json();
      return data as RecallMemory;
    });
  }

  /**
   * Search useful memories
   */
  async query(
    agentId: string,
    queryText: string,
    limit: number = 5,
  ): Promise<RecallMemory[]> {
    if (!this.isConnected || !this.config.apiKey) {
      throw new Error("RecallService: Missing API Key");
    }

    return circuitBreakers.recall.execute(async () => {
      const response = await fetch(`${this.config.endpoint}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          text: queryText,
          limit,
        }),
      });

      if (!response.ok) {
        throw new Error(`Recall Query Failure: ${response.status}`);
      }

      const results = await response.json();
      return results as RecallMemory[];
    });
  }

  /**
   * Get total memory count
   */
  async getStats(): Promise<{ totalMemories: number; storageUsed: string }> {
    if (!this.isConnected) {
      throw new Error("RecallService: Missing API Key");
    }

    return circuitBreakers.recall.execute(async () => {
      const response = await fetch(`${this.config.endpoint}/stats`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (!response.ok) return { totalMemories: 0, storageUsed: "0 KB" };
      return await response.json();
    });
  }

  /**
   * Check connection status
   */
  isReady(): boolean {
    return this.isConnected;
  }
}
