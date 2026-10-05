/**
 * Runware decisions adapter tests (mocked fetch — no API key needed).
 *
 * Contract under test: env-gated, never throws, validates the label against
 * TASK_CLASSES, clamps confidence, and resolves to null on every failure so
 * callers fall back to the keyword heuristic with zero behavior change.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  classifyWithDecisions,
  startTaskDecision,
} from "@backend/services/decisions/runwareDecisions.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const ENV_KEYS = [
  "RUNWARE_DECISIONS_ENABLED",
  "RUNWARE_API_KEY",
  "RUNWARE_DECISION_MODEL",
  "RUNWARE_DECISIONS_TIMEOUT_MS",
] as const;

let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  mockFetch.mockReset();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function enable() {
  process.env.RUNWARE_DECISIONS_ENABLED = "true";
  process.env.RUNWARE_API_KEY = "test-key";
}

function okAnswer(choice: unknown, confidence: unknown = 0.87) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ answers: { taskClass: { choice, confidence } } }),
  });
}

describe("classifyWithDecisions", () => {
  it("returns null when disabled (no fetch)", async () => {
    process.env.RUNWARE_API_KEY = "test-key";
    expect(await classifyWithDecisions("write a function")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when the key is missing (no fetch)", async () => {
    process.env.RUNWARE_DECISIONS_ENABLED = "true";
    expect(await classifyWithDecisions("write a function")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("maps a valid choice + confidence", async () => {
    enable();
    okAnswer("debug", 0.91);
    const decision = await classifyWithDecisions("why is this failing?");
    expect(decision).toEqual({ label: "debug", confidence: 0.91, model: "runware:laya@1" });
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe("runware:laya@1");
    expect(Object.keys(body.questions.taskClass.criteria)).toHaveLength(10);
  });

  it("rejects labels outside TASK_CLASSES", async () => {
    enable();
    okAnswer("recipes", 0.99);
    expect(await classifyWithDecisions("pasta?")).toBeNull();
  });

  it("clamps out-of-range confidence and defaults missing confidence", async () => {
    enable();
    okAnswer("code", 7);
    expect((await classifyWithDecisions("x"))?.confidence).toBe(1);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ answers: { taskClass: { choice: "code" } } }),
    });
    expect((await classifyWithDecisions("x"))?.confidence).toBe(0.5);
  });

  it("returns null on non-2xx and on network errors", async () => {
    enable();
    mockFetch.mockResolvedValue({ ok: false, status: 429 });
    expect(await classifyWithDecisions("x")).toBeNull();
    mockFetch.mockRejectedValue(new Error("boom"));
    expect(await classifyWithDecisions("x")).toBeNull();
  });

  it("returns null on blank input without fetching", async () => {
    enable();
    expect(await classifyWithDecisions("   ")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("startTaskDecision", () => {
  it("returns null when the tier forbids classification", () => {
    enable();
    expect(startTaskDecision(false, "write a function")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns a promise resolving to the decision when allowed", async () => {
    enable();
    okAnswer("docs", 0.6);
    const pending = startTaskDecision(true, "explain this readme");
    expect(pending).toBeInstanceOf(Promise);
    expect(await pending).toEqual({ label: "docs", confidence: 0.6, model: "runware:laya@1" });
  });
});
