import logger from '../utils/logger.js';
import {
  FhenixPolicyService,
  sharedFhenixPolicyService,
  ConfidentialOutcome,
} from './FhenixPolicyService.js';
import {
  FheThresholdClient,
  sharedFheThresholdClient,
} from './FheThresholdClient.js';

/**
 * FheDecisionWatcher — resolves pending FHE decisions asynchronously.
 *
 * After `evaluateSpend` emits `Pending` on the Fhenix contract,
 * the FHEOS server runs the actual FHE math off-chain. This watcher:
 *
 * 1. Reads pending decisions from FhenixPolicyService (queued during evaluateEncrypted)
 * 2. Polls FheThresholdClient for the decrypted outcome
 * 3. Calls resolveDecision() on the contract to commit the real outcome
 * 4. Clears the pending decision from the service
 *
 * Gated by FHE_WATCHER_ENABLED=true. Runs as a background interval
 * managed by server.ts lifecycle hooks.
 */

interface FheDecisionWatcherConfig {
  pollIntervalMs: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: FheDecisionWatcherConfig = {
  pollIntervalMs: Number(process.env.FHE_WATCHER_POLL_INTERVAL_MS || '5000'),
  enabled: process.env.FHE_WATCHER_ENABLED === 'true',
};

export class FheDecisionWatcher {
  private fhenixService: FhenixPolicyService;
  private thresholdClient: FheThresholdClient;
  private config: FheDecisionWatcherConfig;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(
    fhenixService?: FhenixPolicyService,
    thresholdClient?: FheThresholdClient,
    config?: Partial<FheDecisionWatcherConfig>,
  ) {
    this.fhenixService = fhenixService || sharedFhenixPolicyService;
    this.thresholdClient = thresholdClient || sharedFheThresholdClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the watcher loop. No-op if not enabled.
   */
  start(): void {
    if (!this.config.enabled) {
      logger.info('FheDecisionWatcher not enabled (FHE_WATCHER_ENABLED !== true)');
      return;
    }

    if (this.intervalHandle) {
      logger.warn('FheDecisionWatcher already running');
      return;
    }

    logger.info(
      `FheDecisionWatcher starting (poll every ${this.config.pollIntervalMs}ms)`,
    );

    this.intervalHandle = setInterval(() => {
      this.processPending().catch((err) => {
        logger.error(
          `FheDecisionWatcher processPending failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop the watcher loop.
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('FheDecisionWatcher stopped');
    }
  }

  /**
   * Check if the watcher is currently running.
   */
  isRunning(): boolean {
    return this.intervalHandle !== null;
  }

  /**
   * Get the number of pending decisions.
   */
  getPendingCount(): number {
    return this.fhenixService.getPendingDecisions().size;
  }

  /**
   * Process all pending decisions. Called by the interval loop.
   * Skips if a previous processPending is still running.
   */
  async processPending(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const pending = this.fhenixService.getPendingDecisions();

      if (pending.size === 0) return;

      logger.info(
        `FheDecisionWatcher processing ${pending.size} pending decision(s)`,
      );

      const entries = Array.from(pending.entries());

      for (const [decisionId, entry] of entries) {
        try {
          await this.resolveDecision(decisionId, entry.ctHash);
        } catch (err) {
          logger.error(
            `FheDecisionWatcher failed to resolve decision ${decisionId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Resolve a single pending decision: poll FHEOS, then commit on-chain.
   */
  private async resolveDecision(
    decisionId: string,
    ctHash: bigint | string,
  ): Promise<void> {
    logger.info(`Resolving pending decision ${decisionId}`);

    const result = await this.thresholdClient.pollOutcome(decisionId, ctHash);

    if (!result) {
      logger.warn(
        `FHEOS threshold decryption did not return a result for decision ${decisionId} — will retry next cycle`,
      );
      return;
    }

    const outcome: ConfidentialOutcome = result.outcome;

    logger.info(
      `FHEOS returned outcome ${outcome} for decision ${decisionId} — committing on-chain`,
    );

    const txHash = await this.fhenixService.resolveDecision(decisionId, outcome);

    logger.info(
      `Decision ${decisionId} resolved on-chain: outcome=${outcome} tx=${txHash}`,
    );

    this.fhenixService.clearPendingDecision(decisionId);
  }
}

export const sharedFheDecisionWatcher = new FheDecisionWatcher();
