import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("@backend/utils/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const {
  mockStoreGovernanceAction,
  mockGetGovernanceRecord,
  mockAgents,
  mockRegisterAgent,
} = vi.hoisted(() => ({
  mockStoreGovernanceAction: vi.fn(),
  mockGetGovernanceRecord: vi.fn(),
  mockAgents: vi.fn(),
  mockRegisterAgent: vi.fn(),
}));

vi.mock("ethers", () => ({
  ethers: {
    JsonRpcProvider: vi.fn(function () { return {}; }),
    Wallet: vi.fn(function () { return { address: "0xMockWalletAddress" }; }),
    Contract: vi.fn(function () {
      return {
        storeGovernanceAction: mockStoreGovernanceAction,
        getGovernanceRecord: mockGetGovernanceRecord,
        agents: mockAgents,
        registerAgent: mockRegisterAgent,
      };
    }),
    keccak256: vi.fn().mockReturnValue("0xMockActionId"),
    toUtf8Bytes: vi.fn().mockImplementation((s: string) => s),
  },
}));

vi.mock("@backend/shared/config/index.js", () => ({
  get filecoinConfig() {
    return {
      rpcUrl: "https://api.calibration.node.glif.io/rpc/v1",
      chainId: 314159,
      network: "calibration",
      privateKey: process.env.FILECOIN_PRIVATE_KEY || "",
      contracts: {
        governance: "",
        storage: process.env.STORAGE_CONTRACT_ADDRESS || "",
      },
      explorerUrl: "https://calibration.filfox.info/en",
      get enabled() {
        return !!this.privateKey && !!this.contracts.storage;
      },
    };
  },
}));

const origKey = process.env.FILECOIN_PRIVATE_KEY;
const origAddr = process.env.STORAGE_CONTRACT_ADDRESS;

async function makeService(enabled: boolean) {
  if (enabled) {
    process.env.FILECOIN_PRIVATE_KEY = "0xtestkey";
    process.env.STORAGE_CONTRACT_ADDRESS = "0xtestcontract";
  } else {
    delete process.env.FILECOIN_PRIVATE_KEY;
    delete process.env.STORAGE_CONTRACT_ADDRESS;
  }
  vi.resetModules();
  const mod = await import("@backend/services/blockchain/FilecoinStorageService.js");
  return new mod.FilecoinStorageService();
}

function mockAgentRegistered() {
  mockAgents.mockResolvedValue({
    registrationTime: 1000n,
    active: true,
    totalActions: 0n,
    approvedActions: 0n,
    violations: 0n,
  });
}

function mockAgentNotRegistered() {
  mockAgents.mockResolvedValue({
    registrationTime: 0n,
    active: false,
    totalActions: 0n,
    approvedActions: 0n,
    violations: 0n,
  });
}

function mockStoreSuccess() {
  mockStoreGovernanceAction.mockResolvedValue({
    wait: () => Promise.resolve({ hash: "0xtxhash" }),
  });
}

function mockRegisterSuccess() {
  mockRegisterAgent.mockResolvedValue({
    wait: () => Promise.resolve({ hash: "0xregistertxhash" }),
  });
}

describe("FilecoinStorageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentRegistered();
    mockStoreSuccess();
    mockRegisterSuccess();
  });

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.FILECOIN_PRIVATE_KEY = origKey;
    } else {
      delete process.env.FILECOIN_PRIVATE_KEY;
    }
    if (origAddr !== undefined) {
      process.env.STORAGE_CONTRACT_ADDRESS = origAddr;
    } else {
      delete process.env.STORAGE_CONTRACT_ADDRESS;
    }
  });

  describe("anchorAuditRecord", () => {
    it("returns null when disabled (no private key)", async () => {
      const service = await makeService(false);
      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
      expect(mockStoreGovernanceAction).not.toHaveBeenCalled();
    });

    it("returns null when disabled (no storage contract address)", async () => {
      process.env.FILECOIN_PRIVATE_KEY = "0xtestkey";
      delete process.env.STORAGE_CONTRACT_ADDRESS;
      const service = await makeService(false);
      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });

    it("returns FilecoinUploadResult on successful tx", async () => {
      const service = await makeService(true);
      const result = await service.anchorAuditRecord({
        runId: "test-run",
        workflow: "governance",
      });

      expect(result).not.toBeNull();
      expect(result!.cid).toContain("sha256:");
      expect(result!.localHash).toBeDefined();
      expect(result!.txHash).toBe("0xtxhash");
      expect(result!.network).toBe("filecoin-calibration");
      expect(result!.timestamp).toBeDefined();

      const expectedPayload = JSON.stringify({
        runId: "test-run",
        workflow: "governance",
      });
      const expectedHash = crypto
        .createHash("sha256")
        .update(expectedPayload)
        .digest("hex");
      expect(result!.localHash).toBe(expectedHash);
      expect(result!.cid).toBe(`sha256:${expectedHash}`);
    });

    it("returns null on RPC failure (non-fatal)", async () => {
      const service = await makeService(true);
      mockStoreGovernanceAction.mockRejectedValueOnce(
        new Error("RPC connection refused"),
      );

      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });

    it("returns null on tx.wait() timeout", async () => {
      const service = await makeService(true);
      mockStoreGovernanceAction.mockResolvedValueOnce({
        wait: () =>
          new Promise((_resolve, reject) =>
            setTimeout(
              () =>
                reject(new Error("tx.wait() timed out after 60000ms")),
              5,
            ),
          ),
      });

      const result = await service.anchorAuditRecord({ test: true });
      expect(result).toBeNull();
    });

    it("registers agent if not yet registered", async () => {
      const service = await makeService(true);
      mockAgentNotRegistered();

      await service.anchorAuditRecord({ test: true });

      expect(mockRegisterAgent).toHaveBeenCalledOnce();
      expect(mockStoreGovernanceAction).toHaveBeenCalledOnce();
    });

    it("skips agent registration if already registered", async () => {
      const service = await makeService(true);
      mockAgentRegistered();

      await service.anchorAuditRecord({ test: true });

      expect(mockRegisterAgent).not.toHaveBeenCalled();
      expect(mockStoreGovernanceAction).toHaveBeenCalledOnce();
    });
  });

  describe("retrieveRecord", () => {
    it("fetches and parses record by actionId", async () => {
      const service = await makeService(true);
      const record = {
        actionId: "0xabc",
        agentAddress: "0xaddr",
        actionType: "governance",
        description: "test",
        approved: true,
        policyCheckCount: 1n,
        policyResult: "{}",
        timestamp: 1000n,
        filecoinCID: "sha256:abc",
        isImmutable: true,
      };
      mockGetGovernanceRecord.mockResolvedValueOnce(record);

      const result = await service.retrieveRecord("0xabc");

      expect(result).not.toBeNull();
      expect(result!.actionType).toBe("governance");
      expect(result!.filecoinCID).toBe("sha256:abc");
      expect(result!.policyCheckCount).toBe("1");
      expect(result!.timestamp).toBe("1000");
    });

    it("returns null when disabled", async () => {
      const service = await makeService(false);
      const result = await service.retrieveRecord("0xabc");
      expect(result).toBeNull();
      expect(mockGetGovernanceRecord).not.toHaveBeenCalled();
    });

    it("returns null when record has zero timestamp (not found)", async () => {
      const service = await makeService(true);
      mockGetGovernanceRecord.mockResolvedValueOnce({
        actionId: "0x0",
        timestamp: 0n,
      });

      const result = await service.retrieveRecord("0xabc");
      expect(result).toBeNull();
    });

    it("returns null on RPC failure", async () => {
      const service = await makeService(true);
      mockGetGovernanceRecord.mockRejectedValueOnce(new Error("RPC down"));

      const result = await service.retrieveRecord("0xabc");
      expect(result).toBeNull();
    });
  });

  describe("verify", () => {
    it("returns true when CID matches expected hash", async () => {
      const service = await makeService(true);
      mockGetGovernanceRecord.mockResolvedValueOnce({
        actionId: "0xabc",
        timestamp: 1000n,
        filecoinCID: "sha256:expectedhash",
      });

      const result = await service.verify("0xabc", "expectedhash");
      expect(result).toBe(true);
    });

    it("returns false when CID does not match", async () => {
      const service = await makeService(true);
      mockGetGovernanceRecord.mockResolvedValueOnce({
        actionId: "0xabc",
        timestamp: 1000n,
        filecoinCID: "sha256:differenthash",
      });

      const result = await service.verify("0xabc", "expectedhash");
      expect(result).toBe(false);
    });

    it("returns false when retrieve fails", async () => {
      const service = await makeService(true);
      mockGetGovernanceRecord.mockRejectedValueOnce(new Error("not found"));

      const result = await service.verify("0xabc", "anyhash");
      expect(result).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("reports enabled when key and contract are set", async () => {
      const service = await makeService(true);
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.rpcUrl).toContain("calibration");
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
      mockStoreGovernanceAction.mockRejectedValue(new Error("RPC down"));

      await service.anchorAuditRecord({ a: 1 });
      await service.anchorAuditRecord({ a: 2 });
      await service.anchorAuditRecord({ a: 3 });

      mockStoreGovernanceAction.mockReset();
      const result = await service.anchorAuditRecord({ a: 4 });
      expect(result).toBeNull();
      expect(mockStoreGovernanceAction).not.toHaveBeenCalled();
    });

    it("recovers after reset period", async () => {
      vi.useFakeTimers();
      const service = await makeService(true);
      mockStoreGovernanceAction.mockRejectedValue(new Error("RPC down"));

      await service.anchorAuditRecord({ a: 1 });
      await service.anchorAuditRecord({ a: 2 });
      await service.anchorAuditRecord({ a: 3 });

      vi.advanceTimersByTime(31_000);

      mockStoreGovernanceAction.mockResolvedValueOnce({
        wait: () => Promise.resolve({ hash: "0xrecovered" }),
      });

      const result = await service.anchorAuditRecord({ a: 4 });
      vi.useRealTimers();
      expect(result).not.toBeNull();
      expect(result!.txHash).toBe("0xrecovered");
    });
  });
});
