import { CreRun } from "@backend/cre/types.js";
import { CreRunPersistence } from "@backend/cre/persistence/CreRunPersistence.js";
import { mongoDbService } from "@backend/services/MongoDbService.js";
import logger from "@backend/utils/logger.js";

const CACHE_COLLECTION = "cre_runs";

export class MongoDbCreRunPersistence implements CreRunPersistence {
  private ready = false;

  private async ensureConnected(): Promise<void> {
    if (!this.ready) {
      await mongoDbService.connect();
      this.ready = true;
    }
  }

  async append(run: CreRun): Promise<void> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(CACHE_COLLECTION);
      // Insert a shallow copy so MongoDB's auto _id assignment doesn't
      // mutate the shared run object. CreRunStore.add() records the ledger
      // hash AFTER append(); if insertOne added _id in place, the ledger
      // would hash a _id-bearing object while the canonical JSONL store
      // holds the _id-free version — every run would false-flag as
      // "tampered" after the next reload from JSONL.
      await col.insertOne({ ...run } as unknown as Parameters<typeof col.insertOne>[0]);
      logger.debug(`Persisted CRE run ${run.runId} to MongoDB`);
    } catch (error) {
      logger.error(`Failed to persist CRE run ${run.runId} to MongoDB:`, error);
    }
  }

  async loadAll(): Promise<CreRun[]> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(CACHE_COLLECTION);
      const docs = await col
        .find({})
        .sort({ startedAt: -1 })
        .limit(100)
        .toArray();
      // Strip Mongo's storage _id so it never participates in run hashing
      // (see append()); _id is a Mongo concern, not part of the CreRun domain.
      return docs.map(({ _id, ...rest }) => rest) as unknown as CreRun[];
    } catch (error) {
      logger.error("Failed to load CRE runs from MongoDB:", error);
      return [];
    }
  }

  async writeAll(runs: CreRun[]): Promise<void> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(CACHE_COLLECTION);
      await col.deleteMany({});
      if (runs.length > 0) {
        // Insert shallow copies (see append() for the _id-mutation rationale).
        await col.insertMany(
          runs.map((r) => ({ ...r })) as unknown as Parameters<typeof col.insertMany>[0],
        );
      }
      logger.debug(`Replaced all CRE runs in MongoDB (${runs.length} runs)`);
    } catch (error) {
      logger.error("Failed to write CRE runs to MongoDB:", error);
    }
  }

  async truncate(): Promise<void> {
    try {
      await this.ensureConnected();
      const col = mongoDbService.collection(CACHE_COLLECTION);
      await col.deleteMany({});
      logger.debug("Truncated CRE runs collection in MongoDB");
    } catch (error) {
      logger.error("Failed to truncate CRE runs in MongoDB:", error);
    }
  }
}
