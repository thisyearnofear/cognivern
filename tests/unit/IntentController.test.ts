import { describe, it, expect, beforeEach, vi } from "vitest";
import { IntentController } from "@backend/modules/api/controllers/IntentController";
import { WorkspaceDataService } from "@backend/services/WorkspaceDataService.js";

vi.mock("@backend/services/ai/MultiModelRouter.js", () => {
  return {
    MultiModelRouter: class MockMultiModelRouter {
      analyzeGovernance = vi
        .fn()
        .mockRejectedValue(new Error("All AI providers failed"));
    },
  };
});

vi.mock("@backend/services/governance/AuditLogService.js", () => {
  return {
    AuditLogService: class MockAuditLogService {
      logEvent = vi.fn().mockResolvedValue(undefined);
      getFilteredLogs = vi.fn().mockResolvedValue([]);
    },
  };
});

vi.mock("@backend/services/WorkspaceDataService.js", () => {
  return {
    WorkspaceDataService: {
      getAgents: vi.fn(),
      getPolicies: vi.fn(),
    },
  };
});

describe("IntentController", () => {
  let controller: IntentController;

  beforeEach(() => {
    vi.mocked(WorkspaceDataService.getAgents).mockReset();
    vi.mocked(WorkspaceDataService.getPolicies).mockReset();
    vi.mocked(WorkspaceDataService.getAgents).mockReturnValue([]);
    vi.mocked(WorkspaceDataService.getPolicies).mockReturnValue([]);
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
        { body: { query: "check governance health" }, workspaceId: "ws-test" } as any,
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
        { body: { query: "show my portfolio" }, workspaceId: "ws-test" } as any,
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
        { body: { query: "test" }, workspaceId: "ws-test" } as any,
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

    it("should reject unauthenticated requests", async () => {
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        { body: { query: "show my agents" } } as any,
        mockRes as any,
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it("ignores a client-supplied workspace id and uses the session workspace", async () => {
      vi.mocked(WorkspaceDataService.getAgents).mockImplementation((workspaceId: string) => {
        if (workspaceId === "victim-ws") {
          return [
            {
              id: "secret-agent",
              name: "Victim Agent",
              role: "trader",
              status: "active",
              chain: "base",
              trades: 12,
              budget: "$50,000",
            },
          ];
        }
        return [
          {
            id: "own-agent",
            name: "Own Agent",
            role: "general",
            status: "active",
            chain: "base",
            trades: 1,
            budget: "$5",
          },
        ];
      });

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.processIntent(
        {
          body: {
            query: "show my agents",
            context: { workspaceId: "victim-ws" },
          },
          workspaceId: "caller-ws",
        } as any,
        mockRes as any,
      );

      expect(WorkspaceDataService.getAgents).toHaveBeenCalledWith("caller-ws");
      expect(WorkspaceDataService.getAgents).not.toHaveBeenCalledWith("victim-ws");
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            type: "agent",
            component: expect.objectContaining({
              props: expect.objectContaining({
                agents: [
                  expect.objectContaining({ id: "own-agent", name: "Own Agent" }),
                ],
              }),
            }),
          }),
        }),
      );
    });
  });
});
