/**
 * ChainGPT Audit Service Tests
 *
 * Tests the ChainGPTAuditService with mock responses since we don't have a real API key.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ChainGPTAuditService,
} from "@backend/services/ai/ChainGPTAuditService.js";
import { ChainGptDailyBudget } from "@backend/services/ai/chainGptBudget.js";

// Mock fetch for testing — returns a streaming response matching ChainGPT's format
function mockStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const chunk = encoder.encode(text);
  return {
    ok: true,
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: async () => {
            if (!sent) {
              sent = true;
              return { done: false, value: chunk };
            }
            return { done: true, value: undefined };
          },
        };
      },
    },
  };
}

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeService(
  overrides: ConstructorParameters<typeof ChainGPTAuditService>[0] = {
    apiKey: "test-api-key", // pragma: allowlist secret
  },
) {
  return new ChainGPTAuditService({
    apiKey: "test-api-key", // pragma: allowlist secret
    blockOnSeverity: "high",
    holdOnMedium: true,
    cacheFile: null,
    budget: new ChainGptDailyBudget({ limit: 1000, storePath: null }),
    // Treat every address as a contract unless a test overrides this.
    hasContractCode: async () => true,
    ...overrides,
  });
}

describe("ChainGPTAuditService", () => {
  let service: ChainGPTAuditService;

  beforeEach(() => {
    service = makeService();
    mockFetch.mockReset();
  });

  describe("auditContract", () => {
    it("should approve safe contracts", async () => {
      mockFetch.mockResolvedValueOnce(
        mockStreamResponse(
          "SCORE: 95\nSAFE: true\nSEVERITY: informational\n\nFINDINGS:\n\nSUMMARY: No vulnerabilities found",
        ),
      );

      const result = await service.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
      );

      expect(result.decision).toBe("approve");
      expect(result.audit.safe).toBe(true);
      expect(result.audit.score).toBe(95);
    });

    it("should deny contracts with critical vulnerabilities", async () => {
      mockFetch.mockResolvedValueOnce(
        mockStreamResponse(
          "SCORE: 20\nSAFE: false\nSEVERITY: critical\n\nFINDINGS:\n- critical | Reentrancy Vulnerability | Contract is vulnerable to reentrancy attacks\n\nSUMMARY: Critical vulnerability found",
        ),
      );

      const result = await service.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
      );

      expect(result.decision).toBe("deny");
      expect(result.audit.safe).toBe(false);
      expect(result.audit.findings[0].severity).toBe("critical");
    });

    it("should hold contracts with high severity issues", async () => {
      mockFetch.mockResolvedValueOnce(
        mockStreamResponse(
          "SCORE: 45\nSAFE: false\nSEVERITY: high\n\nFINDINGS:\n- high | Unchecked External Call | External call result not checked\n\nSUMMARY: High severity issue found",
        ),
      );

      const result = await service.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
      );

      expect(result.decision).toBe("deny"); // blockOnSeverity is "high"
      expect(result.audit.findings[0].severity).toBe("high");
    });

    it("should hold contracts with medium severity issues when configured", async () => {
      mockFetch.mockResolvedValueOnce(
        mockStreamResponse(
          "SCORE: 60\nSAFE: false\nSEVERITY: medium\n\nFINDINGS:\n- medium | Centralization Risk | Owner has too much control\n\nSUMMARY: Medium severity issue found",
        ),
      );

      const result = await service.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
      );

      expect(result.decision).toBe("hold"); // holdOnMedium is true
    });

    it("should use cache for repeated requests", async () => {
      mockFetch.mockResolvedValueOnce(
        mockStreamResponse(
          "SCORE: 95\nSAFE: true\nSEVERITY: informational\n\nFINDINGS:\n\nSUMMARY: Safe",
        ),
      );

      await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");
      const result = await service.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.decision).toBe("approve");
      expect(result.audit.source).toBe("cache");
    });

    it("should skip cache when requested", async () => {
      mockFetch.mockResolvedValue(
        mockStreamResponse(
          "SCORE: 95\nSAFE: true\nSEVERITY: informational\n\nFINDINGS:\n\nSUMMARY: Safe",
        ),
      );

      await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");
      await service.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
        { skipCache: true },
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("skips ChainGPT for EOAs", async () => {
      const eoaService = makeService({
        apiKey: "test-api-key", // pragma: allowlist secret
        hasContractCode: async () => false,
      });

      const result = await eoaService.auditContract(
        "0x1111111111111111111111111111111111111111",
      );

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.decision).toBe("approve");
      expect(result.audit.source).toBe("skipped");
    });

    it("skips paid audits when the daily budget is exhausted", async () => {
      const tight = new ChainGptDailyBudget({ limit: 1, storePath: null });
      expect(tight.tryConsume()).toBe(true);

      const limited = makeService({
        apiKey: "test-api-key", // pragma: allowlist secret
        budget: tight,
        hasContractCode: async () => true,
      });

      const result = await limited.auditContract(
        "0x1234567890abcdef1234567890abcdef12345678",
      );
      expect(result.audit.source).toBe("skipped");
      expect(result.audit.summary).toMatch(/budget exhausted/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("auditContracts", () => {
    it("should batch audit multiple contracts", async () => {
      mockFetch.mockResolvedValue(
        mockStreamResponse(
          "SCORE: 90\nSAFE: true\nSEVERITY: informational\n\nFINDINGS:\n\nSUMMARY: Safe",
        ),
      );

      const contracts = [
        "0x1234567890abcdef1234567890abcdef12345678",
        "0xabcdef1234567890abcdef1234567890abcdef12",
      ];

      const results = await service.auditContracts(contracts);

      expect(results.size).toBe(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("parseContractInput", () => {
    it("should parse valid addresses", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      expect(service.parseContractInput(address)).toBe(address);
    });

    it("should reject invalid addresses", () => {
      expect(service.parseContractInput("not-an-address")).toBeNull();
      expect(service.parseContractInput("0x123")).toBeNull();
    });

    it("should extract address from calldata", () => {
      const calldata =
        "0x" +
        "aabbccdd".repeat(1) +
        "1234567890abcdef1234567890abcdef12345678" +
        "00".repeat(12); // pragma: allowlist secret
      const result = service.parseContractInput(calldata);
      expect(result).toBe("0x1234567890abcdef1234567890abcdef12345678");
    });
  });
});

describe("ChainGptDailyBudget", () => {
  it("enforces a hard daily cap", () => {
    const budget = new ChainGptDailyBudget({ limit: 2, storePath: null });
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(true);
    expect(budget.tryConsume()).toBe(false);
    expect(budget.used).toBe(2);
  });
});
