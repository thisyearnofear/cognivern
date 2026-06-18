import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("../../src/backend/utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const originalKey = process.env.ZEROG_PRIVATE_KEY;

async function makeService(enabled: boolean) {
  if (enabled) {
    process.env.ZEROG_PRIVATE_KEY = "test-key";
  } else {
    delete process.env.ZEROG_PRIVATE_KEY;
  }
  vi.resetModules();
  const mod = await import("../../src/backend/services/blockchain/ZeroGStorageService.js");
  return new mod.ZeroGStorageService();
}

describe("ZeroGStorageService", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.ZEROG_PRIVATE_KEY = originalKey;
    } else {
      delete process.env.ZEROG_PRIVATE_KEY;
    }
  });

  describe("anchorAuditRecord", () => {
    it("returns null when disabled (no ZEROG_PRIVATE_KEY)", async () => {
      const service = await makeService(false);
      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("succeeds with valid response and returns rootHash + localHash", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root: "0xabc123", txHash: "0xtx456" }),
      });

      const result = await service.anchorAuditRecord({ runId: "test-run" });

      expect(result).not.toBeNull();
      expect(result!.rootHash).toBe("0xabc123");
      expect(result!.txHash).toBe("0xtx456");
      expect(result!.network).toBe("0g-newton-testnet");
      expect(result!.timestamp).toBeDefined();

      const expectedPayload = JSON.stringify({ runId: "test-run" });
      const expectedHash = crypto
        .createHash("sha256")
        .update(expectedPayload)
        .digest("hex");
      expect(result!.localHash).toBe(expectedHash);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain("/upload");
      expect(options.method).toBe("POST");
    });

    it("returns null on non-200 response", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });

    it("returns null on fetch timeout", async () => {
      const service = await makeService(true);
      mockFetch.mockRejectedValueOnce(
        new DOMException("Timeout", "AbortError"),
      );

      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });

    it("returns null on malformed response (no root hash)", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ foo: "bar" }),
      });

      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });

    it("returns null on non-object response", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => "not an object",
      });

      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });
  });

  describe("retrieveRecord", () => {
    it("fetches and parses record by rootHash", async () => {
      const service = await makeService(true);
      const record = { runId: "test", data: "value" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => record,
      });

      const result = await service.retrieveRecord("0xabc123");

      expect(result).toEqual(record);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain("/download/0xabc123");
    });

    it("returns null when disabled", async () => {
      const service = await makeService(false);
      const result = await service.retrieveRecord("0xabc123");
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns null on non-200 response", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await service.retrieveRecord("0xabc123");
      expect(result).toBeNull();
    });
  });

  describe("verify", () => {
    it("returns true when hash matches", async () => {
      const service = await makeService(true);
      const record = { runId: "test", value: 42 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => record,
      });

      const expectedHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(record))
        .digest("hex");

      const result = await service.verify("0xabc", expectedHash);
      expect(result).toBe(true);
    });

    it("returns false when hash does not match", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runId: "test" }),
      });

      const result = await service.verify("0xabc", "wrong-hash");
      expect(result).toBe(false);
    });

    it("returns false when retrieve fails", async () => {
      const service = await makeService(true);
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await service.verify("0xabc", "any-hash");
      expect(result).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("reports enabled when key is set", async () => {
      const service = await makeService(true);
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.indexerUrl).toContain("0g.ai");
    });

    it("reports disabled when key is not set", async () => {
      const service = await makeService(false);
      const status = service.getStatus();
      expect(status.enabled).toBe(false);
    });
  });

  describe("circuit breaker", () => {
    it("opens after repeated failures and rejects requests", async () => {
      const service = await makeService(true);
      mockFetch.mockRejectedValue(new Error("network down"));

      await service.anchorAuditRecord({ a: 1 });
      await service.anchorAuditRecord({ a: 2 });
      await service.anchorAuditRecord({ a: 3 });

      mockFetch.mockReset();
      const result = await service.anchorAuditRecord({ a: 4 });
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("recovers after reset period", async () => {
      vi.useFakeTimers();
      const service = await makeService(true);
      mockFetch.mockRejectedValue(new Error("network down"));

      await service.anchorAuditRecord({ a: 1 });
      await service.anchorAuditRecord({ a: 2 });
      await service.anchorAuditRecord({ a: 3 });

      vi.advanceTimersByTime(31_000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ root: "0xrecovered" }),
      });

      const result = await service.anchorAuditRecord({ a: 4 });
      vi.useRealTimers();
      expect(result).not.toBeNull();
      expect(result!.rootHash).toBe("0xrecovered");
    });
  });
});
