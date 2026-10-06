/**
 * Upstream-credential endpoint tests.
 *
 * Key-material bounds under test: set/rotate accept and validate, status
 * exposes hint metadata only, and no endpoint ever returns key material.
 */

import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditProgramController } from "@backend/modules/api/controllers/CreditProgramController.js";

class MockResponse {
  statusCode = 200;
  payload: Record<string, unknown> | undefined;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(payload: Record<string, unknown>) {
    this.payload = payload;
    return this;
  }
}

function mockReq(params: Record<string, string> = {}, body: unknown = {}, workspaceId?: string) {
  return { params, body, workspaceId } as unknown as Request;
}

const PROGRAM = { id: "prog-1", workspaceId: "ws-1" };

let controller: CreditProgramController;
let programs: { getProgram: ReturnType<typeof vi.fn> };
let upstream: {
  setCredential: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  revokeCredential: ReturnType<typeof vi.fn>;
};

const STATUS = {
  configured: true,
  provider: "anthropic",
  keyHint: "••••1234",
  updatedAt: "2026-10-06T00:00:00.000Z",
};

beforeEach(() => {
  programs = { getProgram: vi.fn().mockReturnValue(PROGRAM) };
  upstream = {
    setCredential: vi.fn().mockReturnValue(STATUS),
    status: vi.fn().mockReturnValue(STATUS),
    revokeCredential: vi.fn().mockReturnValue(true),
  };
  controller = new CreditProgramController(
    programs as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    upstream as never,
  );
});

describe("upstream credential endpoints", () => {
  it("stores a key and returns status without key material", async () => {
    const res = new MockResponse();
    await controller.setUpstreamCredential(
      mockReq({ programId: "prog-1" }, { provider: "anthropic", apiKey: "sk-ant-secret-value" }, "ws-1"),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.payload)).not.toContain("sk-ant-secret-value");
    expect(upstream.setCredential).toHaveBeenCalledWith("prog-1", "ws-1", "anthropic", "sk-ant-secret-value");
  });

  it("400s on unknown provider and short keys", async () => {
    const res = new MockResponse();
    await controller.setUpstreamCredential(
      mockReq({ programId: "prog-1" }, { provider: "openai", apiKey: "sk-ant-secret-value" }, "ws-1"),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(400);

    const res2 = new MockResponse();
    await controller.setUpstreamCredential(
      mockReq({ programId: "prog-1" }, { provider: "anthropic", apiKey: "short" }, "ws-1"),
      res2 as unknown as Response,
    );
    expect(res2.statusCode).toBe(400);
    expect(upstream.setCredential).not.toHaveBeenCalled();
  });

  it("401s without a workspace and 404s across workspaces", async () => {
    const res = new MockResponse();
    await controller.setUpstreamCredential(
      mockReq({ programId: "prog-1" }, { provider: "anthropic", apiKey: "sk-ant-secret-value" }),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(401);

    programs.getProgram.mockReturnValue({ ...PROGRAM, workspaceId: "ws-other" });
    const res2 = new MockResponse();
    await controller.revokeUpstreamCredential(
      mockReq({ programId: "prog-1" }, {}, "ws-1"),
      res2 as unknown as Response,
    );
    expect(res2.statusCode).toBe(404);
    expect(upstream.revokeCredential).not.toHaveBeenCalled();
  });

  it("reports status and revocation", async () => {
    const res = new MockResponse();
    await controller.getUpstreamCredentialStatus(
      mockReq({ programId: "prog-1" }, {}, "ws-1"),
      res as unknown as Response,
    );
    expect(res.payload).toEqual({ success: true, data: { credential: STATUS } });

    const res2 = new MockResponse();
    await controller.revokeUpstreamCredential(
      mockReq({ programId: "prog-1" }, {}, "ws-1"),
      res2 as unknown as Response,
    );
    expect(res2.payload).toEqual({ success: true, data: { revoked: true } });
  });
});
