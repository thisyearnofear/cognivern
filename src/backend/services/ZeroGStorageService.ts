import crypto from "node:crypto";
import logger from "../utils/logger.js";
import { CircuitBreaker } from "../shared/utils/circuitBreaker.js";

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
  localHash: string;
  txHash?: string;
  network: "0g-newton-testnet";
  timestamp: string;
}

/**
 * Contract for 0G decentralized storage operations.
 * Enables mocking in tests and swapping implementations (e.g. mainnet).
 */
export interface IZeroGStorage {
  anchorAuditRecord(record: Record<string, unknown>): Promise<ZeroGUploadResult | null>;
  retrieveRecord(rootHash: string): Promise<Record<string, unknown> | null>;
  verify(rootHash: string, expectedHash: string): Promise<boolean>;
  getStatus(): { enabled: boolean; indexerUrl: string };
}

interface UploadResponseShape {
  root?: string;
  rootHash?: string;
  txHash?: string;
}

function parseUploadResponse(data: unknown): UploadResponseShape {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid response: not an object");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.root !== "string" && typeof obj.rootHash !== "string") {
    throw new Error("Missing root hash in response");
  }
  const result: UploadResponseShape = {};
  if (typeof obj.root === "string") result.root = obj.root;
  if (typeof obj.rootHash === "string") result.rootHash = obj.rootHash;
  if (typeof obj.txHash === "string") result.txHash = obj.txHash;
  return result;
}

export class ZeroGStorageService implements IZeroGStorage {
  private enabled: boolean;
  private circuit = new CircuitBreaker("ZeroGStorage", {
    threshold: 3,
    resetAfterMs: 30000,
  });

  constructor() {
    this.enabled = !!process.env.ZEROG_PRIVATE_KEY;
    if (this.enabled) {
      logger.info("ZeroGStorageService initialized (0G Newton Testnet)");
    } else {
      logger.info(
        "ZeroGStorageService: ZEROG_PRIVATE_KEY not set — running in log-only mode",
      );
    }
  }

  getStatus(): { enabled: boolean; indexerUrl: string } {
    return { enabled: this.enabled, indexerUrl: ZEROG_INDEXER_URL };
  }

  async anchorAuditRecord(
    record: Record<string, unknown>,
  ): Promise<ZeroGUploadResult | null> {
    if (!this.enabled) return null;

    try {
      return await this.circuit.execute(async () => {
        const payload = JSON.stringify(record);
        const bytes = Buffer.from(payload, "utf-8");
        const localHash = crypto
          .createHash("sha256")
          .update(payload)
          .digest("hex");

        const formData = new FormData();
        formData.append(
          "file",
          new Blob([bytes], { type: "application/json" }),
          "audit.json",
        );

        const response = await fetch(`${ZEROG_INDEXER_URL}/upload`, {
          method: "POST",
          body: formData,
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          logger.warn(
            `ZeroGStorageService: upload returned ${response.status} — skipping anchor`,
          );
          return null;
        }

        const raw = await response.json();
        const result = parseUploadResponse(raw);
        const rootHash = result.root || result.rootHash || "pending";

        logger.info(
          `ZeroGStorageService: anchored audit record — root=${rootHash}`,
        );

        return {
          rootHash,
          localHash,
          txHash: result.txHash,
          network: "0g-newton-testnet",
          timestamp: new Date().toISOString(),
        };
      });
    } catch (err) {
      logger.warn(
        `ZeroGStorageService: anchor failed (non-fatal) — ${(err as Error).message}`,
      );
      return null;
    }
  }

  async retrieveRecord(
    rootHash: string,
  ): Promise<Record<string, unknown> | null> {
    if (!this.enabled) return null;

    try {
      return await this.circuit.execute(async () => {
        const response = await fetch(
          `${ZEROG_INDEXER_URL}/download/${rootHash}`,
          { signal: AbortSignal.timeout(15_000) },
        );

        if (!response.ok) {
          logger.warn(
            `ZeroGStorageService: retrieve returned ${response.status}`,
          );
          return null;
        }

        return (await response.json()) as Record<string, unknown>;
      });
    } catch (err) {
      logger.warn(
        `ZeroGStorageService: retrieve failed (non-fatal) — ${(err as Error).message}`,
      );
      return null;
    }
  }

  async verify(rootHash: string, expectedHash: string): Promise<boolean> {
    const record = await this.retrieveRecord(rootHash);
    if (!record) return false;

    const serialized = JSON.stringify(record);
    const actualHash = crypto
      .createHash("sha256")
      .update(serialized)
      .digest("hex");

    return actualHash === expectedHash;
  }
}

export const zeroGStorageService = new ZeroGStorageService();
