import { Policy } from "@backend/types/Policy.js";
import { PolicyPersistence } from './PolicyPersistence.js';
import { mongoDbService } from "@backend/services/MongoDbService.js";
import logger from "@backend/utils/logger.js";

const COLLECTION = 'policies';

export class MongoDbPolicyPersistence implements PolicyPersistence {
  private ready = false;

  private async ensureConnected(): Promise<void> {
    if (!this.ready) {
      await mongoDbService.connect();
      this.ready = true;
    }
  }

  async create(policy: Policy): Promise<Policy> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(COLLECTION);
      await col.insertOne(policy as unknown as Parameters<typeof col.insertOne>[0]);
      logger.debug(`Persisted policy ${policy.id} to MongoDB`);
      return policy;
    } catch (error) {
      logger.error(`Failed to persist policy ${policy.id} to MongoDB:`, error);
      throw error;
    }
  }

  async get(id: string): Promise<Policy | null> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(COLLECTION);
      const doc = await col.findOne({ id });
      return doc as Policy | null;
    } catch (error) {
      logger.error(`Failed to get policy ${id} from MongoDB:`, error);
      return null;
    }
  }

  async list(): Promise<Policy[]> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(COLLECTION);
      const docs = await col.find({}).toArray();
      return docs as unknown as Policy[];
    } catch (error) {
      logger.error('Failed to list policies from MongoDB:', error);
      return [];
    }
  }

  async update(id: string, updates: Partial<Policy>): Promise<Policy> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(COLLECTION);
      const result = await col.findOneAndUpdate(
        { id },
        { $set: { ...updates, updatedAt: new Date().toISOString() } },
        { returnDocument: 'after' },
      );
      if (!result) {
        throw new Error(`Policy ${id} not found`);
      }
      logger.debug(`Updated policy ${id} in MongoDB`);
      return result as unknown as Policy;
    } catch (error) {
      logger.error(`Failed to update policy ${id} in MongoDB:`, error);
      throw error;
    }
  }
}
