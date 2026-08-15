/**
 * HTTP-level tests for the gateway ingress.
 *
 * Runs a real Express server on an ephemeral port and drives it with `fetch`,
 * because the headline claim is "point an OpenAI SDK at this URL" and that is a
 * wire-format claim, not a function-call one. Status codes, error envelope
 * shape, cost headers, and SSE framing can only be verified over real HTTP.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { Server } from "node:http";

const dbPath = path.join(os.tmpdir(), `cognivern-gw-http-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.GATEWAY_STATIC_PRICES = JSON.stringify({
  "*": { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
});

const { getDb, closeDb } = await import("@backend/db/index.js");
const { CreditLedgerService } = await import("@backend/services/credits/CreditLedgerService.js");
const { CreditProgramService } = await import("@backend/services/credits/CreditProgramService.js");
const { InferenceRecordStore } = await import(
  "@backend/services/credits/InferenceRecordStore.js"
);
const { InferenceGatewayService } = await import(
  "@backend/services/inference/InferenceGatewayService.js"
);
const { ModelPricingService } = await import("@backend/services/inference/ModelPricingService.js");
const { InferenceGatewayController } = await import(
  "@backend/modules/api/controllers/InferenceGatewayController.js"
);
const { createInferenceGatewayRoutes } = await import(
  "@backend/modules/api/routes/inferenceGatewayRoutes.js"
);
const { AuditLogService } = await import("@backend/services/governance/AuditLogService.js");

const WORKSPACE = "workspace-gw-http";

class FakeBackend {
  readonly id = "fake-backend";
  nextUsage: { inputTokens: number; outputTokens: number; cachedTokens: number } | null = {
    inputTokens: 1000,
    outputTokens: 500,
    cachedTokens: 0,
  };
  streamChunks: string[] = [];

  isConfigured() {
    return true;
  }

  async listModels() {
    return [
      { id: "glm-5.2", promptPriceNative: null, completionPriceNative: null, contextWindow: 128000, verifiability: "TeeML", raw: { id: "glm-5.2", verifiability: "TeeML" } },
      { id: "blocked-model", promptPriceNative: null, completionPriceNative: null, contextWindow: 8192, verifiability: "TeeTLS", raw: { id: "blocked-model" } },
    ];
  }

  async chatCompletion() {
    return {
      ok: true,
      status: 200,
      body: {
        id: "chatcmpl-http",
        object: "chat.completion",
        choices: [{ index: 0, message: { role: "assistant", content: "pong" }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: this.nextUsage?.inputTokens ?? 0,
          completion_tokens: this.nextUsage?.outputTokens ?? 0,
        },
      },
      usage: this.nextUsage,
      provider: "0xprovider",
      trustTier: "private",
      upstreamRequestId: "req-http",
      responseText: "pong",
    };
  }

  async chatCompletionStream() {
    const collected = {
      usage: null as typeof this.nextUsage,
      provider: "0xprovider",
      trustTier: "private",
      upstreamRequestId: "req-http-stream",
      responseText: "",
      usageMissing: true,
    };
    const chunks = this.streamChunks;
    const usage = this.nextUsage;

    async function* generate() {
      for (const chunk of chunks) yield new TextEncoder().encode(chunk);
      collected.responseText = "pong";
      if (usage) {
        collected.usage = usage;
        collected.usageMissing = false;
      }
    }
    return { ok: true, status: 200, chunks: generate(), collected };
  }
}

let server: Server;
let baseUrl: string;
let programs: InstanceType<typeof CreditProgramService>;
let ledger: InstanceType<typeof CreditLedgerService>;
let backend: FakeBackend;

beforeAll(async () => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "user-gw-http",
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-gw-http", now, now);

  ledger = new CreditLedgerService(db);
  programs = new CreditProgramService(db, ledger);
  backend = new FakeBackend();

  const audit = new AuditLogService();
  vi.spyOn(audit, "logAction").mockResolvedValue("run-http");

  const gateway = new InferenceGatewayService(
    backend as never,
    new ModelPricingService(backend as never),
    programs,
    ledger,
    new InferenceRecordStore(db),
    audit,
  );

  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(createInferenceGatewayRoutes(new InferenceGatewayController(gateway)));

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

let currentKey: string;

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM credit_ledger");
  db.exec("DELETE FROM inference_records");
  db.exec("DELETE FROM credit_participants");
  db.exec("DELETE FROM credit_programs");

  backend.nextUsage = { inputTokens: 1000, outputTokens: 500, cachedTokens: 0 };

  const program = programs.createProgram({
    workspaceId: WORKSPACE,
    name: "HTTP Test Program",
    baseAllocationUsd: 20,
    poolUsd: 100000,
    status: "active",
    allowedModels: ["glm-5.2"],
  });
  const [{ key }] = programs.provisionParticipants(program.id, [
    { handle: "http-tester", projectTag: "proj-http", disclosureTier: "detailed" },
  ]);
  currentKey = key;
});

function post(pathname: string, body: unknown, key = currentKey) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

describe("authentication over HTTP", () => {
  it("returns a 401 in OpenAI error format when the key is missing", async () => {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "glm-5.2", messages: [{ role: "user", content: "hi" }] }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    // Shape matters: OpenAI client libraries parse error.message / error.code.
    expect(json.error).toBeDefined();
    expect(json.error.code).toBe("invalid_api_key");
    expect(typeof json.error.message).toBe("string");
  });

  it("returns a 401 for an unknown key", async () => {
    const res = await post(
      "/v1/chat/completions",
      { model: "glm-5.2", messages: [{ role: "user", content: "hi" }] },
      "cvk_not-a-real-key-at-all-here",
    );
    expect(res.status).toBe(401);
  });

  it("accepts the key via x-api-key as well as Authorization", async () => {
    const res = await fetch(`${baseUrl}/v1/credits`, {
      headers: { "x-api-key": currentKey },
    });
    expect(res.status).toBe(200);
  });
});

describe("chat completions over HTTP", () => {
  it("returns an OpenAI-shaped completion with metering headers", async () => {
    const res = await post("/v1/chat/completions", {
      model: "glm-5.2",
      messages: [{ role: "user", content: "ping" }],
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.object).toBe("chat.completion");
    expect(json.choices[0].message.content).toBe("pong");
    // Provider usage is passed through untouched.
    expect(json.usage.prompt_tokens).toBe(1000);

    // 1000 in @ $0.001/1K + 500 out @ $0.002/1K = $0.002
    expect(Number(res.headers.get("x-cognivern-cost-usd"))).toBeCloseTo(0.002, 9);
    // $20 base x 1.5 (detailed tier) = $30 allocated, less the $0.002 charge.
    expect(Number(res.headers.get("x-cognivern-remaining-usd"))).toBeCloseTo(29.998, 6);
    expect(res.headers.get("x-cognivern-record-id")).toMatch(/^inf_/);
  });

  it("returns 403 with a model outside the allowlist", async () => {
    const res = await post("/v1/chat/completions", {
      model: "blocked-model",
      messages: [{ role: "user", content: "ping" }],
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("model_not_allowed");
    expect(json.error.message).toContain("glm-5.2");
  });

  it("returns 402 insufficient_quota once credit runs out", async () => {
    // The participant holds $30 (detailed tier). Report 40M input tokens at
    // $0.001/1K = $40, which overshoots the allocation on settle and leaves
    // nothing available for the next request.
    backend.nextUsage = { inputTokens: 40_000_000, outputTokens: 0, cachedTokens: 0 };
    const drain = await post("/v1/chat/completions", {
      model: "glm-5.2",
      messages: [{ role: "user", content: "expensive" }],
    });
    expect(drain.status).toBe(200);
    expect(Number(drain.headers.get("x-cognivern-remaining-usd"))).toBe(0);

    backend.nextUsage = { inputTokens: 10, outputTokens: 10, cachedTokens: 0 };
    const res = await post("/v1/chat/completions", {
      model: "glm-5.2",
      messages: [{ role: "user", content: "ping" }],
    });

    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error.type).toBe("insufficient_quota");
    expect(json.error.code).toBe("insufficient_credits");
  });

  it("returns 400 for a malformed body", async () => {
    const res = await post("/v1/chat/completions", { messages: [] });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});

describe("streaming over HTTP", () => {
  it("streams SSE frames through unchanged", async () => {
    backend.streamChunks = [
      'data: {"choices":[{"delta":{"content":"po"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"ng"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    const res = await post("/v1/chat/completions", {
      model: "glm-5.2",
      messages: [{ role: "user", content: "ping" }],
      stream: true,
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("x-accel-buffering")).toBe("no");

    const text = await res.text();
    expect(text).toBe(backend.streamChunks.join(""));

    // The stream settled: credit was consumed even though the body was SSE.
    const participant = programs.getParticipantByHandle(
      programs.listPrograms(WORKSPACE)[0].id,
      "http-tester",
    )!;
    expect(ledger.getBalance(participant.id)!.consumedNano).toBeGreaterThan(0);
    expect(ledger.getBalance(participant.id)!.heldNano).toBe(0);
  });
});

describe("model catalog over HTTP", () => {
  it("lists only models the program allows", async () => {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${currentKey}` },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.object).toBe("list");
    expect(json.data.map((m: { id: string }) => m.id)).toEqual(["glm-5.2"]);
  });
});

describe("participant transparency over HTTP", () => {
  it("reports balance and every disclosure option with its allocation", async () => {
    const res = await fetch(`${baseUrl}/v1/credits`, {
      headers: { Authorization: `Bearer ${currentKey}` },
    });

    const json = await res.json();
    expect(json.participant.handle).toBe("http-tester");
    expect(json.balance.availableUsd).toBeCloseTo(30, 6); // $20 base x 1.5 detailed
    expect(json.disclosureOptions).toHaveLength(4);

    const open = json.disclosureOptions.find((t: { tier: string }) => t.tier === "open");
    expect(open.allocationUsd).toBeCloseTo(40, 6);
    expect(open.sponsorSees.length).toBeGreaterThan(0);
    expect(open.neverRecorded.length).toBeGreaterThan(0);

    const current = json.disclosureOptions.find((t: { current: boolean }) => t.current);
    expect(current.tier).toBe("detailed");
  });

  it("lets a participant raise their own tier and gain budget", async () => {
    const res = await fetch(`${baseUrl}/v1/credits/disclosure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentKey}` },
      body: JSON.stringify({ tier: "open" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.previousTier).toBe("detailed");
    expect(json.currentTier).toBe("open");
    expect(json.allocationUsd).toBeCloseTo(40, 6);
    expect(json.note).toMatch(/future calls only/i);
  });

  it("rejects an invalid tier", async () => {
    const res = await fetch(`${baseUrl}/v1/credits/disclosure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentKey}` },
      body: JSON.stringify({ tier: "public" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_tier");
  });

  it("shows the participant both their own view and the sponsor's view", async () => {
    await post("/v1/chat/completions", {
      model: "glm-5.2",
      messages: [{ role: "user", content: "Write a function that parses CSV in TypeScript" }],
    });

    const res = await fetch(`${baseUrl}/v1/credits/activity`, {
      headers: { Authorization: `Bearer ${currentKey}` },
    });
    const json = await res.json();

    expect(json.calls).toHaveLength(1);
    const [call] = json.calls;

    // Detailed tier: sponsor sees classification, but never content.
    expect(call.youSee.model).toBe("glm-5.2");
    expect(call.sponsorSees).not.toBeNull();
    expect(call.sponsorSees.taskClass).toBe("code");
    expect(call.sponsorSees.promptExcerpt).toBeUndefined();

    // The participant's view is strictly richer.
    expect(Object.keys(call.youSee).length).toBeGreaterThan(Object.keys(call.sponsorSees).length);
    expect(json.summary.requestCount).toBe(1);
    expect(json.explanation.storage).toMatch(/never written/i);
  });

  it("withholds per-call rows from the sponsor for a private participant", async () => {
    await fetch(`${baseUrl}/v1/credits/disclosure`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentKey}` },
      body: JSON.stringify({ tier: "private" }),
    });

    await post("/v1/chat/completions", {
      model: "glm-5.2",
      messages: [{ role: "user", content: "something private" }],
    });

    const res = await fetch(`${baseUrl}/v1/credits/activity`, {
      headers: { Authorization: `Bearer ${currentKey}` },
    });
    const json = await res.json();

    expect(json.withheldFromSponsor).toBe(1);
    expect(json.calls[0].sponsorSees).toBeNull();
    // Spend is still fully accounted for in the participant's own totals.
    expect(json.summary.costUsd).toBeGreaterThan(0);
  });
});
