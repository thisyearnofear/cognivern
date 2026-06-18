import { randomUUID } from "node:crypto";
import { mongoDbService } from "./MongoDbService.js";
import logger from "@backend/utils/logger.js";

export interface MemoryEntry {
  id: string;
  agentId: string;
  type: "short_term" | "long_term" | "reasoning" | "observation";
  content: string | object;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  agentId: string;
  text?: string;
  type?: MemoryEntry["type"];
  limit?: number;
}

const MEMORY_COLLECTION = "agent_memory";

export class MongoDbMemoryService {
  private ready = false;

  private async ensureConnected(): Promise<void> {
    if (!this.ready) {
      await mongoDbService.connect();
      this.ready = true;
    }
  }

  async store(memory: Omit<MemoryEntry, "id" | "timestamp">): Promise<string> {
    if (!mongoDbService.isConnected()) {
      throw new Error("MongoDB not configured — set MONGODB_URI");
    }

    await this.ensureConnected();
    const col = mongoDbService.collection(MEMORY_COLLECTION);
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    await col.insertOne({ ...memory, id, timestamp } as unknown as Parameters<typeof col.insertOne>[0]);
    logger.debug(`Stored memory: ${id} for agent ${memory.agentId}`);
    return id;
  }

  async retrieve(id: string): Promise<MemoryEntry | null> {
    if (!mongoDbService.isConnected()) return null;

    await this.ensureConnected();
    const col = mongoDbService.collection(MEMORY_COLLECTION);
    const doc = await col.findOne({ id });
    return doc as unknown as MemoryEntry | null;
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!mongoDbService.isConnected()) return [];

    await this.ensureConnected();
    const col = mongoDbService.collection(MEMORY_COLLECTION);
    const filter: Record<string, unknown> = { agentId: query.agentId };
    if (query.type) filter.type = query.type;

    const docs = await col
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(query.limit ?? 10)
      .toArray();

    return docs as unknown as MemoryEntry[];
  }

  async deleteAgentMemories(agentId: string): Promise<number> {
    if (!mongoDbService.isConnected()) return 0;

    await this.ensureConnected();
    const col = mongoDbService.collection(MEMORY_COLLECTION);
    const result = await col.deleteMany({ agentId });
    return result.deletedCount;
  }
}
