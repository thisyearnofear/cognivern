import { CreRun } from "@backend/cre/types.js";
import { CreRunPersistence } from "@backend/cre/persistence/CreRunPersistence.js";
import { mongoDbService } from "@backend/services/MongoDbService.js";
import logger from "@backend/utils/logger.js";

const CACHE_COLLECTION = "cre_runs";
const DEFAULT_MAX_RUNS = 1000;

// MongoDB duplicate-key error code (E11000).
const DUPLICATE_KEY = 11000;

/**
 * Durable MongoDB mirror of the JSONL run store.
 *
 * Multi-process safety mirrors JsonlCreRunPersistence:
 * - append() is an UPSERT (not insertOne), so re-adding a run another
 *   process already persisted is idempotent and can never duplicate it.
 * - writeAll() MERGES via bulkWrite upserts keyed on runId instead of
 *   deleteMany + insertMany, so a process holding a stale in-memory
 *   snapshot can never evict runs another process added. Newer versions
 *   of the same runId win, and the collection stays bounded at maxRuns
 *   (newest kept by recency).
 * - A unique index on runId backs the upserts. Two processes racing to
 *   insert the same brand-new runId can still trip E11000; both upsert
 *   paths retry the loser as a plain update (the winner's doc now
 *   exists), so no write is ever dropped by the index.
 *
 * The unique index is created LAZILY on the first append()/writeAll() call
 * (see ensureUniqueIndex()); it is not created at construction or load time.
 * A freshly deployed process that only reads runs (e.g. right after a code
 * update, before any new run is recorded) will therefore find the collection
 * WITHOUT the index. That is expected, not a defect: the next run write
 * creates it, and createIndex is idempotent so an operator can also pre-create
 * it (name `cre_runs_runid_unique`, spec { runId: 1 } unique) with zero
 * conflict.
 */
export class MongoDbCreRunPersistence implements CreRunPersistence {
  private ready = false;
  private indexEnsured = false;
  private maxRuns: number;

  constructor(params: { maxRuns?: number } = {}) {
    this.maxRuns = params.maxRuns ?? DEFAULT_MAX_RUNS;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.ready) {
      await mongoDbService.connect();
      this.ready = true;
    }
  }

  /**
   * Best-effort unique index on runId, ensured once per process (createIndex
   * is idempotent, so a second call is a wasted round trip). Called from
   * append() and writeAll() only — never at construction or load time — so
   * the index appears lazily on the first run WRITE after a deploy. On a
   * collection whose runs were written by older code, the index may not
   * exist yet until the next write; that is expected (see class doc) and an
   * operator can pre-create it with the same name/spec. A pre-existing
   * collection with duplicates would fail the build; that only degrades the
   * duplicate-prevention guarantee (merge still works), so warn once and
   * move on rather than retry a doomed build on every write.
   */
  private async ensureUniqueIndex(): Promise<void> {
    if (this.indexEnsured) return;
    try {
      const col = mongoDbService.collection(CACHE_COLLECTION);
      await col.createIndex({ runId: 1 }, { unique: true, name: "cre_runs_runid_unique" });
    } catch (error) {
      logger.warn(`Failed to ensure unique runId index on ${CACHE_COLLECTION}:`, error);
    }
    this.indexEnsured = true;
  }

  /**
   * Upsert a run, surviving the E11000 race where a concurrent process
   * inserted the same brand-new runId while we were between the filter
   * check and the insert. The retry is a non-upsert update: the winner's
   * document now exists, so the data lands without creating a duplicate.
   */
  private async upsertRun(
    col: ReturnType<typeof mongoDbService.collection>,
    run: CreRun,
  ): Promise<void> {
    try {
      await col.updateOne({ runId: run.runId }, { $set: { ...run } }, { upsert: true });
    } catch (error: any) {
      if (error?.code !== DUPLICATE_KEY) throw error;
      await col.updateOne({ runId: run.runId }, { $set: { ...run } });
    }
  }

  async append(run: CreRun): Promise<void> {
    try {
      await this.ensureConnected();
      await this.ensureUniqueIndex();
      const col = mongoDbService.collection(CACHE_COLLECTION);
      // Upsert by runId instead of insertOne: idempotent against re-adds
      // from a retried headless run, and never duplicates a run another
      // process persisted. $set serializes a copy, so MongoDB cannot
      // mutate the shared run object with a storage _id (the JSONL store
      // would otherwise hash a _id-bearing object and every run would
      // false-flag as tampered after the next reload).
      await this.upsertRun(col, run);
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
        .sort({ startedAt: -1, finishedAt: -1 })
        .limit(this.maxRuns)
        .toArray();
      // Strip Mongo's storage _id so it never participates in run hashing
      // (see append()); _id is a Mongo concern, not part of the CreRun domain.
      return docs.map(({ _id, ...rest }) => rest) as unknown as CreRun[];
    } catch (error) {
      logger.error("Failed to load CRE runs from MongoDB:", error);
      return [];
    }
  }

  /**
   * Merge, never replace: a stale snapshot from another process must not
   * evict runs it never loaded. Newer versions of the same runId win, and
   * the collection stays bounded at maxRuns keeping the newest. NOTE: an
   * empty `runs` array leaves the collection intact (merge of nothing);
   * use truncate() to clear the store.
   */
  async writeAll(runs: CreRun[]): Promise<void> {
    try {
      await this.ensureConnected();
      await this.ensureUniqueIndex();
      const col = mongoDbService.collection(CACHE_COLLECTION);
      if (runs.length > 0) {
        try {
          await col.bulkWrite(
            runs.map((run) => ({
              updateOne: {
                filter: { runId: run.runId },
                update: { $set: { ...run } },
                upsert: true,
              },
            })),
            { ordered: false },
          );
        } catch (error: any) {
          // One E11000 rejects the whole batch even with ordered: false.
          // The offending docs now exist (a concurrent process inserted
          // them), so re-apply each run as an individual upsert that
          // retries the race as a plain update. No run is dropped.
          if (error?.code !== DUPLICATE_KEY) throw error;
          for (const run of runs) {
            await this.upsertRun(col, run);
          }
        }
      }
      // Bound the collection to maxRuns by recency, dropping the oldest.
      // The deleteMany only touches documents outside the newest maxRuns,
      // so it can never remove a run another process just added. (Note:
      // recency here is startedAt-then-finishedAt, while the JSONL layer
      // prefers startedAt || finishedAt — store-created runs always carry
      // startedAt, so the layers agree in practice.)
      const total = await col.countDocuments({});
      if (total > this.maxRuns) {
        const keep = await col
          .find({}, { projection: { _id: 1 } })
          .sort({ startedAt: -1, finishedAt: -1 })
          .limit(this.maxRuns)
          .toArray();
        await col.deleteMany({ _id: { $nin: keep.map((doc) => doc._id) } });
      }
      logger.debug(
        `Merged ${runs.length} CRE runs into MongoDB (collection bounded at ${this.maxRuns})`,
      );
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
