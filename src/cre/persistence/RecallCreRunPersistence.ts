import { CreRun } from "../types.js";
import { CreRunPersistence } from "./CreRunPersistence.js";
import { RecallService } from "../../services/RecallService.js";
import logger from "../../utils/logger.js";

/**
 * Recall Network persistence for CRE runs.
 *
 * Provides permanent, immutable storage for signed runs.
 */
export class RecallCreRunPersistence implements CreRunPersistence {
  private recall: RecallService;

  constructor(recall?: RecallService) {
    this.recall = recall || new RecallService();
  }

  async append(run: CreRun): Promise<void> {
    // Only push completed or failed runs to permanent storage (avoid spamming WIP)
    if (run.status === "completed" || run.status === "failed") {
      try {
        await this.recall.storeObject(`cre_run_${run.runId}`, run);
        logger.info(`Persisted CRE run ${run.runId} to Recall Network`);
      } catch (error) {
        logger.error(`Failed to persist CRE run ${run.runId} to Recall:`, error);
        // We don't throw here to avoid failing the local write if Recall is down
      }
    }
  }

  async loadAll(): Promise<CreRun[]> {
    // Recall doesn't currently support a 'listAll' for objects easily via API in this client
    // We return empty and let the MultiPersistence layer handle local loading.
    return [];
  }

  async writeAll(runs: CreRun[]): Promise<void> {
    // We only push the newest run from the batch to avoid massive API overhead
    if (runs.length > 0) {
      await this.append(runs[0]);
    }
  }

  async truncate(): Promise<void> {
    // Destructive operations are not supported on Recall's immutable storage
  }
}

/**
 * Orchestrates multiple persistence layers.
 * Typically: [Local JSONL (hot), Recall (permanent)]
 */
export class MultiCreRunPersistence implements CreRunPersistence {
  constructor(private layers: CreRunPersistence[]) {}

  async append(run: CreRun): Promise<void> {
    await Promise.all(this.layers.map((l) => l.append(run)));
  }

  async loadAll(): Promise<CreRun[]> {
    // Load from the first layer (usually local JSONL for speed)
    return await this.layers[0].loadAll();
  }

  async writeAll(runs: CreRun[]): Promise<void> {
    await Promise.all(this.layers.map((l) => l.writeAll(runs)));
  }

  async truncate(): Promise<void> {
    await Promise.all(this.layers.map((l) => l.truncate()));
  }
}
