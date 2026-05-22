/**
 * ChainGPT Audit Service Tests
 *
 * Tests the ChainGPTAuditService with mock responses since we don't have a real API key.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChainGPTAuditService, AuditResult } from "../src/services/ChainGPTAuditService.js";

// Mock fetch for testing
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("ChainGPTAuditService", () => {
  let service: ChainGPTAuditService;

  beforeEach(() => {
    service = new ChainGPTAuditService({
      apiKey: "test-api-key", // pragma: allowlist secret
      blockOnSeverity: "high",
      holdOnMedium: true,
    });
    mockFetch.mockReset();
  });

  describe("auditContract", () => {
    it("should approve safe contracts", async () => {
      const mockResponse: AuditResult = {
        safe: true,
        score: 95,
        severity: "informational",
        findings: [],
        summary: "No vulnerabilities found",
        auditedAt: new Date().toISOString(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 95,
          findings: [],
          summary: "No vulnerabilities found",
        }),
      });

      const result = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      expect(result.decision).toBe("approve");
      expect(result.audit.safe).toBe(true);
      expect(result.audit.score).toBe(95);
    });

    it("should deny contracts with critical vulnerabilities", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 20,
          findings: [
            {
              title: "Reentrancy Vulnerability",
              description: "Contract is vulnerable to reentrancy attacks",
              severity: "critical",
              location: "withdraw()",
              recommendation: "Use ReentrancyGuard",
            },
          ],
          summary: "Critical vulnerability found",
        }),
      });

      const result = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      expect(result.decision).toBe("deny");
      expect(result.audit.safe).toBe(false);
      expect(result.audit.findings[0].severity).toBe("critical");
    });

    it("should hold contracts with high severity issues", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 45,
          findings: [
            {
              title: "Unchecked External Call",
              description: "External call result not checked",
              severity: "high",
              location: "transfer()",
            },
          ],
          summary: "High severity issue found",
        }),
      });

      const result = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      expect(result.decision).toBe("deny"); // blockOnSeverity is "high"
      expect(result.audit.findings[0].severity).toBe("high");
    });

    it("should hold contracts with medium severity issues when configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 60,
          findings: [
            {
              title: "Centralization Risk",
              description: "Owner has too much control",
              severity: "medium",
            },
          ],
          summary: "Medium severity issue found",
        }),
      });

      const result = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      expect(result.decision).toBe("hold"); // holdOnMedium is true
    });

    it("should use cache for repeated requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          score: 95,
          findings: [],
          summary: "Safe",
        }),
      });

      // First call
      await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      // Second call - should use cache
      const result = await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one API call
      expect(result.decision).toBe("approve");
    });

    it("should skip cache when requested", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          score: 95,
          findings: [],
          summary: "Safe",
        }),
      });

      // First call
      await service.auditContract("0x1234567890abcdef1234567890abcdef12345678");

      // Second call with skipCache
      await service.auditContract("0x1234567890abcdef1234567890abcdef12345678", { skipCache: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("auditContracts", () => {
    it("should batch audit multiple contracts", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          score: 90,
          findings: [],
          summary: "Safe",
        }),
      });

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
      const calldata = "0x" + "aabbccdd".repeat(1) + "1234567890abcdef1234567890abcdef12345678" + "00".repeat(12); // pragma: allowlist secret
      const result = service.parseContractInput(calldata);
      expect(result).toBe("0x1234567890abcdef1234567890abcdef12345678");
    });
  });

  describe("getAuditSummary", () => {
    it("should format critical findings", () => {
      const audit: AuditResult = {
        safe: false,
        score: 10,
        severity: "critical",
        findings: [
          { title: "Bug 1", description: "", severity: "critical" },
          { title: "Bug 2", description: "", severity: "critical" },
        ],
        summary: "Multiple critical issues",
        auditedAt: new Date().toISOString(),
      };

      expect(service.getAuditSummary(audit)).toContain("CRITICAL");
      expect(service.getAuditSummary(audit)).toContain("2");
    });

    it("should format high severity findings", () => {
      const audit: AuditResult = {
        safe: false,
        score: 40,
        severity: "high",
        findings: [{ title: "Bug 1", description: "", severity: "high" }],
        summary: "High risk",
        auditedAt: new Date().toISOString(),
      };

      expect(service.getAuditSummary(audit)).toContain("HIGH RISK");
    });

    it("should format safe contracts with score", () => {
      const audit: AuditResult = {
        safe: true,
        score: 95,
        severity: "informational",
        findings: [],
        summary: "No issues found",
        auditedAt: new Date().toISOString(),
      };

      expect(service.getAuditSummary(audit)).toContain("95/100");
    });
  });
});
