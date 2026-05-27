import { describe, it, expect, beforeEach, vi } from "vitest";
import { IntentController } from "./IntentController";

vi.mock("../../cloudflare-agents/MultiModelRouter.js", () => {
  return {
    MultiModelRouter: class MockMultiModelRouter {
      analyzeGovernance = vi
        .fn()
        .mockRejectedValue(new Error("All AI providers failed"));
    },
  };
});

vi.mock("../../../services/AuditLogService.js", () => {
  return {
    AuditLogService: class MockAuditLogService {
      logEvent = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe("IntentController", () => {
  let controller: IntentController;

  beforeEach(() => {
    controller = new IntentController();
  });

  describe("getMetrics", () => {
    it("should return initial metrics with zero values", () => {
      const metrics = controller.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.circuitBreakerState).toBe("closed");
    });
  });

  describe("intent processing", () => {
    it("should use keyword fallback when AI classification fails", async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        { body: { query: "check governance health" } } as any,
        mockRes as any,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            type: "governance",
          }),
        }),
      );
    });

    it("should use fallback response when AI generation fails", async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        { body: { query: "show my portfolio" } } as any,
        mockRes as any,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            response: expect.stringContaining("analyzed your request"),
          }),
        }),
      );
    });

    it("should track total requests", async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        { body: { query: "test" } } as any,
        mockRes as any,
      );

      const metrics = controller.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
    });

    it("should reject requests without a query", async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        { body: {} } as any,
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
