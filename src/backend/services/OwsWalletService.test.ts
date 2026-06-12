import { describe, it, expect, beforeEach, vi } from "vitest";

const cfg = vi.hoisted(() => {
  const mockBlockchainConfig = {
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    rpcUrl: "https://testrpc.xlayer.tech",
    network: "xlayerTestnet",
    contracts: {
      governance: "0x755602bBcAD94ccA126Cfc9E5Fa697432D9e2DD6",
      storage: "0x1E0317beFf188e314BbC3483e06773EEfa28bB2D",
    },
    gasLimits: {
      evaluateAction: 200000,
      createPolicy: 100000,
      updateStatus: 50000,
      registerAgent: 150000,
    },
  };
  return { mockBlockchainConfig };
});

vi.mock("../shared/config/index.js", () => ({
  blockchainConfig: cfg.mockBlockchainConfig,
  config: { NODE_ENV: "test", PORT: 3000 },
  apiConfig: { port: 3000, apiKey: "test", corsOrigin: "*", rateLimit: {}, requestTimeout: 30000 },
  sapienceConfig: {},
  databaseConfig: {},
  cacheConfig: {},
  tradingConfig: {},
  mantleConfig: {},
  fhenixConfig: {},
  monitoringConfig: {},
  aiConfig: {},
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

const mockGetAgent = vi.fn();
const mockGetPolicy = vi.fn();
const mockEvaluateAction = vi.fn();
const mockCreatePolicy = vi.fn();
const mockUpdatePolicyStatus = vi.fn();
const mockRegisterAgent = vi.fn();
const mockUpdateAgentStatus = vi.fn();
const mockGetBlockNumber = vi.fn().mockResolvedValue(12345);

function createMockTx(hash = "0xabc123") {
  return {
    hash,
    wait: vi.fn().mockResolvedValue({ hash, blockNumber: 100 }),
  };
}

const mockContract = {
  getAgent: mockGetAgent,
  getPolicy: mockGetPolicy,
  evaluateAction: mockEvaluateAction,
  createPolicy: mockCreatePolicy,
  updatePolicyStatus: mockUpdatePolicyStatus,
  registerAgent: mockRegisterAgent,
  updateAgentStatus: mockUpdateAgentStatus,
};

vi.mock("ethers", async () => {
  const actual = await vi.importActual("ethers");
  return {
    ...actual,
    ethers: {
      ...(actual as any).ethers,
      JsonRpcProvider: vi.fn(function (this: any) {
        this.getBlockNumber = mockGetBlockNumber;
      }),
      Wallet: vi.fn(function (this: any) {
        this.address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      }),
      Contract: vi.fn(function () {
        return mockContract;
      }),
    },
  };
});

const mockExecute = vi.fn((fn: () => Promise<unknown>) => fn());
vi.mock("../shared/utils/circuitBreaker.js", () => ({
  circuitBreakers: {
    blockchain: { execute: (...args: unknown[]) => mockExecute(...args) },
  },
}));

vi.mock("../shared/utils/index.js", () => ({
  withTimeout: <T>(promise: Promise<T>, _ms: number) => promise,
  retry: <T>(fn: () => Promise<T>) => fn(),
  sleep: () => Promise.resolve(),
  formatBytes: () => "0 Bytes",
  generateId: () => "test-id",
  isValidEmail: () => true,
  deepClone: <T>(obj: T) => JSON.parse(JSON.stringify(obj)),
}));

describe("OwsWalletService — On-chain resilience", () => {
  beforeEach(() => {
    mockGetAgent.mockReset();
    mockGetPolicy.mockReset();
    mockEvaluateAction.mockReset();
    mockCreatePolicy.mockReset();
    mockUpdatePolicyStatus.mockReset();
    mockRegisterAgent.mockReset();
    mockUpdateAgentStatus.mockReset();
    mockExecute.mockClear();
    mockExecute.mockImplementation((fn: () => Promise<unknown>) => fn());
    cfg.mockBlockchainConfig.privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  });

  describe("recordOnChainApproval", () => {
    it("returns success: false when no private key is configured", async () => {
      cfg.mockBlockchainConfig.privateKey = "";

      const { OwsWalletService } = await import("./OwsWalletService.js");
      const service = new OwsWalletService();
      const result = await (service as any).onChainManager.recordOnChainApproval({
        intentId: "test-intent",
        agentId: "test-agent",
        actionType: "spend",
        metadata: {},
      });

      expect(result.success).toBe(false);
      expect(mockExecute).not.toHaveBeenCalled();
    }, 30000);

    it("wraps on-chain write in circuit breaker", async () => {
      mockGetAgent.mockResolvedValue({ status: 1n });
      mockEvaluateAction.mockResolvedValue(createMockTx("0xdeadbeef"));

      const { OwsWalletService } = await import("./OwsWalletService.js");
      const service = new OwsWalletService();
      await (service as any).onChainManager.recordOnChainApproval({
        intentId: "test-intent",
        agentId: "test-agent",
        actionType: "spend",
        metadata: {},
      });

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("returns success: true with txHash on successful write", async () => {
      mockGetAgent.mockResolvedValue({ status: 1n });
      mockEvaluateAction.mockResolvedValue(createMockTx("0xdeadbeef"));

      const { OwsWalletService } = await import("./OwsWalletService.js");
      const service = new OwsWalletService();
      const result = await (service as any).onChainManager.recordOnChainApproval({
        intentId: "test-intent",
        agentId: "test-agent",
        actionType: "spend",
        metadata: {},
      });

      expect(result.success).toBe(true);
      expect(result.txHash).toBe("0xdeadbeef");
    });

    it("returns success: false when circuit breaker is open", async () => {
      mockExecute.mockRejectedValue(
        new Error("BlockchainRPC circuit breaker is open"),
      );

      const { OwsWalletService } = await import("./OwsWalletService.js");
      const service = new OwsWalletService();
      const result = await (service as any).onChainManager.recordOnChainApproval({
        intentId: "test-intent",
        agentId: "test-agent",
        actionType: "spend",
        metadata: {},
      });

      expect(result.success).toBe(false);
    });
  });

  describe("ensureOnChainAgent", () => {
    it("uses non-zero rulesHash for default policy creation", async () => {
      mockGetAgent.mockRejectedValue(new Error("Agent not found"));
      mockGetPolicy.mockRejectedValue(new Error("Policy not found"));
      mockCreatePolicy.mockResolvedValue(createMockTx());
      mockUpdatePolicyStatus.mockResolvedValue(createMockTx());
      mockRegisterAgent.mockResolvedValue(createMockTx());
      mockUpdateAgentStatus.mockResolvedValue(createMockTx());

      const { OwsWalletService } = await import("./OwsWalletService.js");
      const service = new OwsWalletService();
      const mockWallet = { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" };

      await (service as any).onChainManager.ensureOnChainAgent(mockWallet, mockContract, "test-agent");

      expect(mockCreatePolicy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.not.stringMatching(/^0x0+$/),
        expect.any(Object),
      );
    });

    it("uses configurable gas limits", async () => {
      mockGetAgent.mockRejectedValue(new Error("Agent not found"));
      mockGetPolicy.mockResolvedValue({});
      mockRegisterAgent.mockResolvedValue(createMockTx());
      mockUpdateAgentStatus.mockResolvedValue(createMockTx());

      const { OwsWalletService } = await import("./OwsWalletService.js");
      const service = new OwsWalletService();
      const mockWallet = { address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" };

      await (service as any).onChainManager.ensureOnChainAgent(mockWallet, mockContract, "test-agent");

      expect(mockRegisterAgent).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        expect.any(String),
        { gasLimit: 150000 },
      );
    });
  });
});
