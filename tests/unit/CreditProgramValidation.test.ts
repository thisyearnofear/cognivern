/**
 * CreditProgramController validation-endpoint tests.
 *
 * Share/feedback/open handlers with stubbed services: auth scoping,
 * input validation, and the public-open privacy shape.
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
const COMMITMENT = { id: "cmt-1", programId: "prog-1" };

let controller: CreditProgramController;
let programs: { getProgram: ReturnType<typeof vi.fn> };
let commitments: { get: ReturnType<typeof vi.fn> };
let validation: {
  recordShare: ReturnType<typeof vi.fn>;
  recordOpen: ReturnType<typeof vi.fn>;
  recordFeedback: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  programs = { getProgram: vi.fn() };
  commitments = { get: vi.fn() };
  validation = {
    recordShare: vi.fn().mockReturnValue("shr_x"),
    recordOpen: vi.fn().mockReturnValue("opn_x"),
    recordFeedback: vi.fn().mockReturnValue("fdb_x"),
  };
  controller = new CreditProgramController(
    programs as never,
    {} as never,
    {} as never,
    commitments as never,
    validation as never,
  );
});

describe("recordShare", () => {
  it("records a share for the program's own commitment", async () => {
    programs.getProgram.mockReturnValue(PROGRAM);
    commitments.get.mockReturnValue(COMMITMENT);
    const res = new MockResponse();
    await controller.recordShare(mockReq({ programId: "prog-1" }, { commitmentId: "cmt-1" }, "ws-1"), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(validation.recordShare).toHaveBeenCalledWith({
      programId: "prog-1",
      workspaceId: "ws-1",
      commitmentId: "cmt-1",
    });
  });

  it("401s without a workspace", async () => {
    const res = new MockResponse();
    await controller.recordShare(mockReq({ programId: "prog-1" }, { commitmentId: "cmt-1" }), res as unknown as Response);
    expect(res.statusCode).toBe(401);
    expect(validation.recordShare).not.toHaveBeenCalled();
  });

  it("404s for another workspace's program", async () => {
    programs.getProgram.mockReturnValue({ ...PROGRAM, workspaceId: "ws-other" });
    const res = new MockResponse();
    await controller.recordShare(mockReq({ programId: "prog-1" }, { commitmentId: "cmt-1" }, "ws-1"), res as unknown as Response);
    expect(res.statusCode).toBe(404);
    expect(validation.recordShare).not.toHaveBeenCalled();
  });

  it("400s without a commitmentId and 404s for foreign commitments", async () => {
    programs.getProgram.mockReturnValue(PROGRAM);
    const res = new MockResponse();
    await controller.recordShare(mockReq({ programId: "prog-1" }, {}, "ws-1"), res as unknown as Response);
    expect(res.statusCode).toBe(400);

    commitments.get.mockReturnValue({ id: "cmt-9", programId: "prog-other" });
    const res2 = new MockResponse();
    await controller.recordShare(mockReq({ programId: "prog-1" }, { commitmentId: "cmt-9" }, "ws-1"), res2 as unknown as Response);
    expect(res2.statusCode).toBe(404);
    expect(validation.recordShare).not.toHaveBeenCalled();
  });
});

describe("submitFeedback", () => {
  it("records valid feedback", async () => {
    programs.getProgram.mockReturnValue(PROGRAM);
    const res = new MockResponse();
    await controller.submitFeedback(
      mockReq({ programId: "prog-1" }, { usefulness: 4, wouldReuse: true, note: "x".repeat(600) }, "ws-1"),
      res as unknown as Response,
    );
    expect(res.statusCode).toBe(200);
    expect(validation.recordFeedback).toHaveBeenCalledWith({
      programId: "prog-1",
      workspaceId: "ws-1",
      usefulness: 4,
      wouldReuse: true,
      note: "x".repeat(500),
    });
  });

  it("400s on out-of-range usefulness and non-boolean wouldReuse", async () => {
    programs.getProgram.mockReturnValue(PROGRAM);
    for (const body of [
      { usefulness: 0, wouldReuse: true },
      { usefulness: 6, wouldReuse: true },
      { usefulness: 3, wouldReuse: "yes" },
      { usefulness: "high", wouldReuse: false },
    ]) {
      const res = new MockResponse();
      await controller.submitFeedback(mockReq({ programId: "prog-1" }, body, "ws-1"), res as unknown as Response);
      expect(res.statusCode).toBe(400);
    }
    expect(validation.recordFeedback).not.toHaveBeenCalled();
  });
});

describe("recordOpen", () => {
  it("records opens for known commitments without auth", async () => {
    commitments.get.mockReturnValue(COMMITMENT);
    const res = new MockResponse();
    await controller.recordOpen(mockReq({ id: "cmt-1" }, {}), res as unknown as Response);
    expect(res.statusCode).toBe(200);
    expect(validation.recordOpen).toHaveBeenCalledWith("cmt-1");
  });

  it("404s unknown commitments without writing", async () => {
    commitments.get.mockReturnValue(null);
    const res = new MockResponse();
    await controller.recordOpen(mockReq({ id: "cmt-nope" }, {}), res as unknown as Response);
    expect(res.statusCode).toBe(404);
    expect(validation.recordOpen).not.toHaveBeenCalled();
  });
});
