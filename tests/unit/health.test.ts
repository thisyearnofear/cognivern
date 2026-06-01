import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Mocks                                                             */
/* ------------------------------------------------------------------ */

const mockPrepare = vi.fn().mockReturnValue({ get: vi.fn() });
const mockDb = { prepare: mockPrepare };
vi.mock("../../src/backend/db/index.js", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../../src/backend/modules/agents/AgentsModule.js", () => {
  return {
    AgentsModule: class {
      getAgents = vi.fn().mockResolvedValue([]);
      getAgentDecisions = vi.fn().mockResolvedValue([]);
    },
  };
});

const { HealthController } = await import(
  "../../src/backend/modules/api/controllers/HealthController.js"
);

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(query: Record<string, string> = {}) {
  return { query } as any;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

describe("HealthController", () => {
  let controller: InstanceType<typeof HealthController>;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new HealthController();
  });

  describe("GET /health (basic)", () => {
    it("returns ok status without deep checks", async () => {
      const res = mockRes();
      await controller.getHealth(mockReq(), res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "ok",
          message: "Server is running",
          timestamp: expect.any(String),
          uptime: expect.any(Number),
        }),
      );
    });

    it("does not include dependencies when deep is absent", async () => {
      const res = mockRes();
      await controller.getHealth(mockReq(), res);
      const body = res.json.mock.calls[0][0];
      expect(body.dependencies).toBeUndefined();
    });
  });

  describe("GET /health?deep=true", () => {
    it("includes an array of dependencies", async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: "notifications" }),
      });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: "true" }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.dependencies).toBeInstanceOf(Array);
      expect(body.dependencies).toHaveLength(2);
    });

    it("each dependency has the correct shape", async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: "notifications" }),
      });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: "true" }), res);
      const body = res.json.mock.calls[0][0];
      for (const dep of body.dependencies) {
        expect(dep).toEqual(
          expect.objectContaining({
            name: expect.any(String),
            status: expect.stringMatching(/^(healthy|unhealthy)$/),
            latencyMs: expect.any(Number),
          }),
        );
      }
    });

    it("reports ok when all dependencies are healthy", async () => {
      mockPrepare.mockReturnValue({
        get: vi.fn().mockReturnValue({ name: "notifications" }),
      });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: "true" }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe("ok");
      expect(body.message).toBe("All dependencies healthy");
    });

    it("reports degraded when a dependency is unhealthy", async () => {
      const selectOneGet = vi.fn().mockImplementation(() => {
        throw new Error("DB locked");
      });
      const notifGet = vi.fn().mockReturnValue({ name: "notifications" });
      mockPrepare
        .mockReturnValueOnce({ get: selectOneGet })
        .mockReturnValueOnce({ get: notifGet });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: "true" }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe("degraded");
      const sqliteCheck = body.dependencies.find(
        (d: any) => d.name === "sqlite",
      );
      expect(sqliteCheck.status).toBe("unhealthy");
      expect(sqliteCheck.error).toBe("DB locked");
    });

    it("reports unhealthy when notifications table is missing", async () => {
      const selectOneGet = vi.fn().mockReturnValue({ alive: 1 });
      const notifGet = vi.fn().mockReturnValue(undefined);
      mockPrepare
        .mockReturnValueOnce({ get: selectOneGet })
        .mockReturnValueOnce({ get: notifGet });
      const res = mockRes();
      await controller.getHealth(mockReq({ deep: "true" }), res);
      const body = res.json.mock.calls[0][0];
      expect(body.status).toBe("degraded");
      const notifCheck = body.dependencies.find(
        (d: any) => d.name === "notifications_table",
      );
      expect(notifCheck.status).toBe("unhealthy");
      expect(notifCheck.error).toBe("notifications table not found");
    });
  });

  describe("GET /health/ready", () => {
    it("returns ready status", async () => {
      const res = mockRes();
      await controller.getReadiness(mockReq(), res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ready" }),
      );
    });
  });

  describe("GET /health/live", () => {
    it("returns alive status", async () => {
      const res = mockRes();
      await controller.getLiveness(mockReq(), res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: "alive" }),
      );
    });
  });
});
