import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

const {
  mockUpload,
  mockDownloadToBlob,
  mockGetShardedNodes,
  mockIndexerConstructor,
} = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockDownloadToBlob: vi.fn(),
  mockGetShardedNodes: vi.fn(),
  mockIndexerConstructor: vi.fn(),
}));

vi.mock("@backend/utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@0gfoundation/0g-storage-ts-sdk", () => ({
  Indexer: class {
    constructor(url: string) {
      mockIndexerConstructor(url);
    }

    getShardedNodes(...args: unknown[]) {
      return mockGetShardedNodes(...args);
    }

    upload(...args: unknown[]) {
      return mockUpload(...args);
    }

    downloadToBlob(...args: unknown[]) {
      return mockDownloadToBlob(...args);
    }
  },
  MemData: class {
    data: ArrayLike<number>;

    constructor(data: ArrayLike<number>) {
      this.data = data;
    }
  },
}));

const TEST_PRIVATE_KEY = `0x${"11".repeat(32)}`;
const savedEnv = {
  key: process.env.ZEROG_PRIVATE_KEY,
  indexer: process.env.ZEROG_INDEXER_URL,
  rpc: process.env.ZEROG_RPC_URL,
  chainId: process.env.ZEROG_CHAIN_ID,
};

async function makeService(enabled: boolean) {
  if (enabled) {
    process.env.ZEROG_PRIVATE_KEY = TEST_PRIVATE_KEY;
    process.env.ZEROG_INDEXER_URL =
      "https://indexer-storage-testnet-turbo.0g.ai";
    process.env.ZEROG_RPC_URL = "https://evmrpc-testnet.0g.ai";
    process.env.ZEROG_CHAIN_ID = "16602";
  } else {
    delete process.env.ZEROG_PRIVATE_KEY;
  }
  vi.resetModules();
  const mod = await import(
    "@backend/services/blockchain/ZeroGStorageService.js"
  );
  return new mod.ZeroGStorageService();
}

function restoreEnv(): void {
  for (const [key, value] of [
    ["ZEROG_PRIVATE_KEY", savedEnv.key],
    ["ZEROG_INDEXER_URL", savedEnv.indexer],
    ["ZEROG_RPC_URL", savedEnv.rpc],
    ["ZEROG_CHAIN_ID", savedEnv.chainId],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("ZeroGStorageService", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockDownloadToBlob.mockReset();
    mockGetShardedNodes.mockReset();
    mockIndexerConstructor.mockReset();
    mockGetShardedNodes.mockResolvedValue({
      trusted: [{ url: "https://storage-node.test" }],
      discovered: [],
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  describe("anchorAuditRecord", () => {
    it("returns null when disabled", async () => {
      const service = await makeService(false);

      const result = await service.anchorAuditRecord({ test: true });

      expect(result).toBeNull();
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("uploads JSON through the SDK and returns the root hash", async () => {
      const service = await makeService(true);
      mockUpload.mockResolvedValueOnce([
        { rootHash: "0xabc123", txHash: "0xtx456", txSeq: 1 },
        null,
      ]);

      const result = await service.anchorAuditRecord({ runId: "test-run" });

      expect(result).toMatchObject({
        rootHash: "0xabc123",
        txHash: "0xtx456",
        network: "0g-galileo-testnet",
      });
      expect(result?.localHash).toBe(
        crypto
          .createHash("sha256")
          .update(JSON.stringify({ runId: "test-run" }))
          .digest("hex"),
      );
      expect(mockIndexerConstructor).toHaveBeenCalledWith(
        "https://indexer-storage-testnet-turbo.0g.ai",
      );
      expect(mockUpload).toHaveBeenCalledOnce();
      const [file, rpcUrl, signer, options] = mockUpload.mock.calls[0];
      expect(file.data).toBeInstanceOf(Buffer);
      expect(rpcUrl).toBe("https://evmrpc-testnet.0g.ai");
      expect(await signer.getAddress()).toBe(
        "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
      );
      expect(options).toEqual({ expectedReplica: 1 });
    });

    it("normalizes a fragmented SDK response", async () => {
      const service = await makeService(true);
      mockUpload.mockResolvedValueOnce([
        { rootHashes: ["0xfragment-1"], txHashes: ["0xtx-1"], txSeqs: [1] },
        null,
      ]);

      const result = await service.anchorAuditRecord({ test: true });

      expect(result?.rootHash).toBe("0xfragment-1");
      expect(result?.txHash).toBe("0xtx-1");
    });

    it("fails open when the SDK upload fails", async () => {
      const service = await makeService(true);
      mockUpload.mockResolvedValueOnce([
        { rootHash: "", txHash: "", txSeq: 0 },
        new Error("indexer unavailable"),
      ]);

      const result = await service.anchorAuditRecord({ test: true });

      expect(result).toBeNull();
    });
  });

  describe("retrieveRecord", () => {
    it("downloads through the SDK with proof verification", async () => {
      const service = await makeService(true);
      const record = { runId: "test", data: "value" };
      mockDownloadToBlob.mockResolvedValueOnce([
        new Blob([JSON.stringify(record)]),
        null,
      ]);

      const result = await service.retrieveRecord("0xabc123");

      expect(result).toEqual(record);
      expect(mockDownloadToBlob).toHaveBeenCalledWith("0xabc123", {
        proof: true,
      });
    });

    it("returns null when disabled", async () => {
      const service = await makeService(false);

      const result = await service.retrieveRecord("0xabc123");

      expect(result).toBeNull();
      expect(mockDownloadToBlob).not.toHaveBeenCalled();
    });

    it("returns null for malformed downloaded JSON", async () => {
      const service = await makeService(true);
      mockDownloadToBlob.mockResolvedValueOnce([
        new Blob([JSON.stringify(["not-an-object"])]),
        null,
      ]);

      const result = await service.retrieveRecord("0xabc123");

      expect(result).toBeNull();
    });
  });

  describe("verifyDetailed", () => {
    it("reports disabled when no key is configured", async () => {
      const service = await makeService(false);

      const result = await service.verifyDetailed("0xabc", "any-hash");

      expect(result.status).toBe("disabled");
    });

    it("reports unavailable when the SDK download fails", async () => {
      const service = await makeService(true);
      mockDownloadToBlob.mockResolvedValueOnce([
        new Blob(),
        new Error("indexer unavailable"),
      ]);

      const result = await service.verifyDetailed("0xabc", "any-hash");

      expect(result.status).toBe("unavailable");
    });

    it("reports mismatch when the anchored content hash differs", async () => {
      const service = await makeService(true);
      mockDownloadToBlob.mockResolvedValueOnce([
        new Blob([JSON.stringify({ runId: "tampered" })]),
        null,
      ]);

      const result = await service.verifyDetailed("0xabc", "expected-hash");

      expect(result.status).toBe("mismatch");
    });

    it("reports verified when the anchored content matches", async () => {
      const service = await makeService(true);
      const record = { runId: "test", value: 42 };
      mockDownloadToBlob.mockResolvedValueOnce([
        new Blob([JSON.stringify(record)]),
        null,
      ]);
      const expectedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(record))
        .digest("hex");

      const result = await service.verifyDetailed("0xabc", expectedHash);

      expect(result.status).toBe("verified");
    });
  });

  describe("checkIndexer", () => {
    it("uses the SDK JSON-RPC health path", async () => {
      const service = await makeService(true);

      const result = await service.checkIndexer();

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toEqual(expect.any(Number));
      expect(mockGetShardedNodes).toHaveBeenCalledOnce();
    });

    it("reports an unhealthy optional service when the SDK health call fails", async () => {
      const service = await makeService(true);
      mockGetShardedNodes.mockRejectedValueOnce(new Error("HTTP 503"));

      const result = await service.checkIndexer();

      expect(result).toMatchObject({ healthy: false, error: "HTTP 503" });
    });

    it("reports disabled storage as healthy for core readiness", async () => {
      const service = await makeService(false);

      const result = await service.checkIndexer();

      expect(result.healthy).toBe(true);
      expect(mockGetShardedNodes).not.toHaveBeenCalled();
    });
  });

  describe("getStatus", () => {
    it("reports the configured indexer", async () => {
      const service = await makeService(true);

      const status = service.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.indexerUrl).toContain("0g.ai");
    });
  });

  describe("circuit breaker", () => {
    it("opens after repeated SDK failures", async () => {
      const service = await makeService(true);
      mockUpload.mockRejectedValue(new Error("network down"));

      await service.anchorAuditRecord({ a: 1 });
      await service.anchorAuditRecord({ a: 2 });
      await service.anchorAuditRecord({ a: 3 });
      mockUpload.mockReset();

      const result = await service.anchorAuditRecord({ a: 4 });

      expect(result).toBeNull();
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });
});
