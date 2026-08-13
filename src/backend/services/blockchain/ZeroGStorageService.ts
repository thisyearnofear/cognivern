import crypto from "node:crypto";
import logger from "@backend/utils/logger.js";
import { CircuitBreaker } from "@backend/shared/utils/circuitBreaker.js";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";

/**
 * ZeroGStorageService — anchors audit log records to 0G decentralized storage.
 *
 * Uses the official 0G Storage TypeScript SDK for Galileo testnet. Uploads are
 * signed with the configured testnet wallet; downloads use the SDK's proof
 * capable path. Storage is optional and always fails open for Cognivern's
 * authoritative ledger and policy/execution paths.
 *
 * Network: 0G Galileo Testnet (chain 16602)
 * RPC:     https://evmrpc-testnet.0g.ai
 * Indexer: https://indexer-storage-testnet-standard.0g.ai by default; set
 *          ZEROG_INDEXER_URL to the active Turbo endpoint for staging.
 */

const ZEROG_INDEXER_URL =
  process.env.ZEROG_INDEXER_URL ||
  "https://indexer-storage-testnet-standard.0g.ai";
const ZEROG_RPC_URL =
  process.env.ZEROG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const ZEROG_CHAIN_ID = Number(process.env.ZEROG_CHAIN_ID || "16602");

export interface ZeroGUploadResult {
  rootHash: string;
  localHash: string;
  txHash?: string;
  network: "0g-galileo-testnet";
  timestamp: string;
}

/**
 * Three-way anchor verification outcome. Unlike the boolean verify(), this
 * distinguishes a real integrity failure ("mismatch") from a best-effort miss
 * ("unavailable" — network/indexer down, record not found) or a service that
 * isn't configured ("disabled"). Only "mismatch" should be treated as tampering.
 */
export type AnchorVerification =
  | { status: "verified"; actual: string }
  | { status: "mismatch"; actual: string; expected: string }
  | { status: "unavailable" }
  | { status: "disabled" };

export interface ZeroGIndexerHealth {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Contract for 0G decentralized storage operations.
 * Enables mocking in tests and swapping implementations (e.g. mainnet).
 */
export interface IZeroGStorage {
  anchorAuditRecord(record: Record<string, unknown>): Promise<ZeroGUploadResult | null>;
  retrieveRecord(rootHash: string): Promise<Record<string, unknown> | null>;
  verify(rootHash: string, expectedHash: string): Promise<boolean>;
  verifyDetailed(
    rootHash: string,
    expectedHash: string,
  ): Promise<AnchorVerification>;
  getStatus(): { enabled: boolean; indexerUrl: string };
  checkIndexer(): Promise<ZeroGIndexerHealth>;
}

function hashPayload(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function getUploadResult(result: {
  rootHash?: string;
  txHash?: string;
  rootHashes?: string[];
  txHashes?: string[];
}): { rootHash: string; txHash?: string } {
  if (typeof result.rootHash === "string" && result.rootHash.length > 0) {
    return { rootHash: result.rootHash, txHash: result.txHash };
  }

  const rootHash = result.rootHashes?.[0];
  if (typeof rootHash === "string" && rootHash.length > 0) {
    return { rootHash, txHash: result.txHashes?.[0] };
  }

  throw new Error("0G SDK upload response did not contain a root hash");
}

export class ZeroGStorageService implements IZeroGStorage {
  private enabled: boolean;
  private circuit = new CircuitBreaker("ZeroGStorage", {
    threshold: 3,
    resetAfterMs: 30000,
  });
  private healthCircuit = new CircuitBreaker("ZeroGIndexerHealth", {
    threshold: 3,
    resetAfterMs: 30000,
  });
  private indexer?: Indexer;
  private signer?: ethers.Wallet;

  constructor() {
    this.enabled = !!process.env.ZEROG_PRIVATE_KEY;
    if (this.enabled) {
      logger.info("ZeroGStorageService initialized (0G Galileo Testnet SDK)");
    } else {
      logger.info(
        "ZeroGStorageService: ZEROG_PRIVATE_KEY not set — running in log-only mode",
      );
    }
  }

  getStatus(): { enabled: boolean; indexerUrl: string } {
    return { enabled: this.enabled, indexerUrl: ZEROG_INDEXER_URL };
  }

  async checkIndexer(): Promise<ZeroGIndexerHealth> {
    const start = Date.now();
    if (!this.enabled) {
      return { healthy: true, latencyMs: Date.now() - start };
    }

    try {
      const nodes = await this.healthCircuit.execute(() =>
        this.getIndexer().getShardedNodes(),
      );
      if (!Array.isArray(nodes.trusted) || nodes.trusted.length === 0) {
        throw new Error("0G indexer returned no trusted storage nodes");
      }
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async anchorAuditRecord(
    record: Record<string, unknown>,
  ): Promise<ZeroGUploadResult | null> {
    if (!this.enabled) return null;

    try {
      return await this.circuit.execute(async () => {
        const payload = JSON.stringify(record);
        const bytes = Buffer.from(payload, "utf-8");
        const localHash = hashPayload(payload);
        const file = new MemData(bytes);

        const [rawResult, uploadError] = await this.getIndexer().upload(
          file,
          ZEROG_RPC_URL,
          this.getSigner() as unknown as Parameters<Indexer["upload"]>[2],
          { expectedReplica: 1 },
        );
        if (uploadError) {
          throw uploadError;
        }

        const result = getUploadResult(rawResult);
        logger.info(
          `ZeroGStorageService: anchored audit record — root=${result.rootHash}`,
        );

        return {
          rootHash: result.rootHash,
          localHash,
          txHash: result.txHash,
          network: "0g-galileo-testnet",
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
        const [blob, downloadError] = await this.getIndexer().downloadToBlob(
          rootHash,
          { proof: true },
        );
        if (downloadError) {
          throw downloadError;
        }

        const raw = await blob.arrayBuffer();
        const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf-8"));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("0G download did not contain a JSON object");
        }
        return parsed as Record<string, unknown>;
      });
    } catch (err) {
      logger.warn(
        `ZeroGStorageService: retrieve failed (non-fatal) — ${(err as Error).message}`,
      );
      return null;
    }
  }

  async verifyDetailed(
    rootHash: string,
    expectedHash: string,
  ): Promise<AnchorVerification> {
    if (!this.enabled) return { status: "disabled" };

    const record = await this.retrieveRecord(rootHash);
    if (!record) return { status: "unavailable" };

    const actualHash = hashPayload(JSON.stringify(record));
    if (actualHash === expectedHash) {
      return { status: "verified", actual: actualHash };
    }
    return { status: "mismatch", actual: actualHash, expected: expectedHash };
  }

  async verify(rootHash: string, expectedHash: string): Promise<boolean> {
    const result = await this.verifyDetailed(rootHash, expectedHash);
    return result.status === "verified";
  }

  private getIndexer(): Indexer {
    return (this.indexer ??= new Indexer(ZEROG_INDEXER_URL));
  }

  private getSigner(): ethers.Wallet {
    const privateKey = process.env.ZEROG_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("ZEROG_PRIVATE_KEY is required for 0G storage uploads");
    }
    return (this.signer ??= new ethers.Wallet(
      privateKey,
      new ethers.JsonRpcProvider(ZEROG_RPC_URL, ZEROG_CHAIN_ID),
    ));
  }
}

export const zeroGStorageService = new ZeroGStorageService();
