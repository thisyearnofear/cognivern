import logger from "@backend/utils/logger.js";

/**
 * FheThresholdClient — polls the FHEOS threshold decryption endpoint
 * for the resolved outcome of a pending FHE decision.
 *
 * In the coFHE architecture, after `evaluateSpend` emits `Pending`,
 * the FHEOS server runs the actual FHE math off-chain. This client
 * polls until the result is available or timeout is reached.
 */

export interface ThresholdDecryptionResult {
  outcome: 'approve' | 'hold' | 'deny';
  outcomeRaw: number;
  decryptedAt: string;
}

interface FheThresholdClientConfig {
  thresholdNetworkUrl: string;
  pollIntervalMs: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: FheThresholdClientConfig = {
  thresholdNetworkUrl: process.env.FHENIX_TN_URL || 'https://testnet-cofhe-tn.fhenix.zone',
  pollIntervalMs: 2000,
  timeoutMs: 60_000,
};

export class FheThresholdClient {
  private config: FheThresholdClientConfig;

  constructor(config?: Partial<FheThresholdClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Poll the FHEOS threshold decryption endpoint for a pending decision.
   * Returns the decrypted outcome, or null if timeout is reached.
   */
  async pollOutcome(
    decisionId: string,
    ctHash: bigint | string,
  ): Promise<ThresholdDecryptionResult | null> {
    const startTime = Date.now();
    const url = `${this.config.thresholdNetworkUrl}/api/v1/decrypt/status`;

    logger.info(
      `Polling FHEOS threshold decryption for decision ${decisionId}`,
    );

    while (Date.now() - startTime < this.config.timeoutMs) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decisionId,
            ctHash: typeof ctHash === 'bigint' ? ctHash.toString() : ctHash,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          logger.warn(
            `FHEOS threshold decryption returned ${response.status} for decision ${decisionId}`,
          );
          await this.sleep(this.config.pollIntervalMs);
          continue;
        }

        const data = (await response.json()) as {
          status?: string;
          outcome?: number;
        };

        if (data.status === 'completed' && data.outcome !== undefined) {
          const outcome = this.mapOutcome(data.outcome);
          logger.info(
            `FHEOS threshold decryption completed for decision ${decisionId}: ${outcome}`,
          );
          return {
            outcome,
            outcomeRaw: data.outcome,
            decryptedAt: new Date().toISOString(),
          };
        }

        if (data.status === 'failed') {
          logger.error(
            `FHEOS threshold decryption failed for decision ${decisionId}`,
          );
          return null;
        }

        logger.debug(
          `FHEOS threshold decryption still pending for decision ${decisionId} (status: ${data.status})`,
        );
      } catch (err) {
        logger.warn(
          `FHEOS threshold decryption poll error for decision ${decisionId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      await this.sleep(this.config.pollIntervalMs);
    }

    logger.warn(
      `FHEOS threshold decryption timed out for decision ${decisionId} after ${this.config.timeoutMs}ms`,
    );
    return null;
  }

  private mapOutcome(raw: number): 'approve' | 'hold' | 'deny' {
    switch (raw) {
      case 2:
        return 'approve';
      case 1:
        return 'hold';
      default:
        return 'deny';
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const sharedFheThresholdClient = new FheThresholdClient();
