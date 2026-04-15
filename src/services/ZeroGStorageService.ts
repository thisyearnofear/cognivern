import logger from "../utils/logger.js";

/**
 * ZeroGStorageService — anchors audit log records to 0G decentralized storage.
 *
 * Uses the 0G Storage HTTP API (no native SDK dependency required) to upload
 * JSON-encoded audit records and return a root hash as a permanent CID-equivalent.
 *
 * Network: 0G Newton Testnet
 * RPC:     https://evmrpc-testnet.0g.ai
 * Indexer: https://indexer-storage-testnet-standard.0g.ai
 */

const ZEROG_INDEXER_URL =
  process.env.ZEROG_INDEXER_URL ||
  "https://indexer-storage-testnet-standard.0g.ai";

export interface ZeroGUploadResult {
  rootHash: string;
  txHash?: string;
  network: "0g-newton-testnet";
  timestamp: string;
}

export class ZeroGStorageService {
  private enabled: boolean;

  constructor() {
    this.enabled = !!process.env.ZEROG_PRIVATE_KEY;
    if (this.enabled) {
      logger.info("ZeroGStorageService initialized (0G Newton Testnet)");
    } else {
      logger.info(
        "ZeroGStorageService: ZEROG_PRIVATE_KEY not set — running in log-only mode"
      );
    }
  }

  /**
   * Anchors a JSON-serialisable audit record to 0G Storage.
   * Returns a ZeroGUploadResult on success, or null if not configured / upload fails.
   */
  async anchorAuditRecord(
    record: Record<string, unknown>
  ): Promise<ZeroGUploadResult | null> {
    if (!this.enabled) return null;

    try {
      const payload = JSON.stringify(record);
      const bytes = Buffer.from(payload, "utf-8");

      // Use the 0G indexer upload endpoint (multipart form)
      const formData = new FormData();
      formData.append(
        "file",
        new Blob([bytes], { type: "application/json" }),
        "audit.json"
      );

      const response = await fetch(`${ZEROG_INDEXER_URL}/upload`, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        logger.warn(
          `ZeroGStorageService: upload returned ${response.status} — skipping anchor`
        );
        return null;
      }

      const result = (await response.json()) as {
        root?: string;
        rootHash?: string;
        txHash?: string;
      };

      const rootHash = result.root || result.rootHash || "pending";

      logger.info(`ZeroGStorageService: anchored audit record — root=${rootHash}`);

      return {
        rootHash,
        txHash: result.txHash,
        network: "0g-newton-testnet",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      // Non-fatal — governance pipeline must not fail due to storage issues
      logger.warn(
        `ZeroGStorageService: anchor failed (non-fatal) — ${(err as Error).message}`
      );
      return null;
    }
  }
}

export const zeroGStorageService = new ZeroGStorageService();
