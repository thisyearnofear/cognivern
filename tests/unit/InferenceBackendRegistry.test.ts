/**
 * Provider-agnosticism tests.
 *
 * These exist to make "we could swap providers later" a verified property
 * rather than an architectural intention. The whole suite runs against backends
 * that have no 0G code in them at all — if the gateway had leaked a hard
 * dependency on the 0G adapter, none of this would work.
 */

import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-registry-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.GATEWAY_STATIC_PRICES = JSON.stringify({
  "*": { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
});

const { getDb, closeDb } = await import("@backend/db/index.js");
const { CreditLedgerService } = await import("@backend/services/credits/CreditLedgerService.js");
const { CreditProgramService } = await import("@backend/services/credits/CreditProgramService.js");
const { InferenceRecordStore } = await import("@backend/services/credits/InferenceRecordStore.js");
const { InferenceGatewayService, GatewayDeniedError } = await import(
  "@backend/services/inference/InferenceGatewayService.js"
);
const { registerBackend, resolveBackend, listBackends, resetBackendRegistry } = await import(
  "@backend/services/inference/backendRegistry.js"
);
const { AuditLogService } = await import("@backend/services/governance/AuditLogService.js");
const { nanoToUsd } = await import("@backend/services/credits/money.js");

const WORKSPACE = "workspace-registry";

/** A backend with no relationship to 0G whatsoever. */
class GenericBackend {
  calls = 0;
  constructor(
    readonly id: string,
    private readonly configured = true,
  ) {}

  isConfigured() {
    return this.configured;
  }

  async listModels() {
    return [
      {
        id: `${this.id}-model`,
        promptPriceNative: null,
        completionPriceNative: null,
        contextWindow: 4096,
        verifiability: null,
        raw: { id: `${this.id}-model`, owned_by: this.id },
      },
    ];
  }

  async chatCompletion() {
    this.calls += 1;
    return {
      ok: true,
      status: 200,
      body: {
        id: `cmpl-${this.id}`,
        choices: [{ message: { role: "assistant", content: `hi from ${this.id}` } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      },
      usage: { inputTokens: 100, outputTokens: 50, cachedTokens: 0 },
      provider: `${this.id}-provider`,
      trustTier: null,
      upstreamRequestId: `req-${this.id}`,
      responseText: `hi from ${this.id}`,
    };
  }

  async chatCompletionStream() {
    this.calls += 1;
    const collected = {
      usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 },
      provider: `${this.id}-provider`,
      trustTier: null,
      upstreamRequestId: null,
      responseText: "streamed",
      usageMissing: false,
    };
    async function* generate() {
      yield new TextEncoder().encode("data: {}\n\n");
    }
    return { ok: true, status: 200, chunks: generate(), collected };
  }
}

let programs: InstanceType<typeof CreditProgramService>;
let ledger: InstanceType<typeof CreditLedgerService>;
let gateway: InstanceType<typeof InferenceGatewayService>;

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "user-registry",
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-registry", now, now);

  ledger = new CreditLedgerService(db);
  programs = new CreditProgramService(db, ledger);
});

afterAll(() => {
  resetBackendRegistry();
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      // Ignore SQLite cleanup races.
    }
  }
});

beforeEach(() => {
  const db = getDb();
  db.exec("DELETE FROM credit_ledger");
  db.exec("DELETE FROM inference_records");
  db.exec("DELETE FROM credit_participants");
  db.exec("DELETE FROM credit_programs");

  resetBackendRegistry();

  const audit = new AuditLogService();
  vi.spyOn(audit, "logAction").mockResolvedValue("run-registry");

  // No backend override: the gateway must resolve per program via the registry.
  gateway = new InferenceGatewayService(
    undefined,
    undefined,
    programs,
    ledger,
    new InferenceRecordStore(db),
    audit,
  );
});

function makeContext(backendId: string) {
  const program = programs.createProgram({
    workspaceId: WORKSPACE,
    name: `Program on ${backendId}`,
    baseAllocationUsd: 20,
    poolUsd: 100000,
    status: "active",
    backend: backendId,
  });
  const [{ participant }] = programs.provisionParticipants(program.id, [
    { handle: `p-${backendId}` },
  ]);
  return { program, participant };
}

const MESSAGES = [{ role: "user", content: "hello there, this is a test prompt" }];

describe("registry", () => {
  it("registers and resolves a backend with no 0G involvement", () => {
    const acme = new GenericBackend("acme-cloud");
    registerBackend(acme as never);

    expect(resolveBackend("acme-cloud")?.backend.id).toBe("acme-cloud");
    expect(listBackends().map((b) => b.id)).toContain("acme-cloud");
  });

  it("always has the 0G Router registered as a default", () => {
    // Resolution triggers lazy default registration.
    resolveBackend("anything");
    expect(listBackends().map((b) => b.id)).toContain("zerog-router");
  });
});

describe("per-program backend routing", () => {
  it("routes each program to the backend it names", async () => {
    const alpha = new GenericBackend("alpha-inference");
    const beta = new GenericBackend("beta-inference");
    registerBackend(alpha as never);
    registerBackend(beta as never);

    const a = makeContext("alpha-inference");
    const b = makeContext("beta-inference");

    const resA = await gateway.chatCompletion(a, {
      model: "alpha-inference-model",
      messages: MESSAGES,
    });
    const resB = await gateway.chatCompletion(b, {
      model: "beta-inference-model",
      messages: MESSAGES,
    });

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(alpha.calls).toBe(1);
    expect(beta.calls).toBe(1);
    // Neither program's traffic leaked to the other's provider.
    expect((resA.body as { id: string }).id).toBe("cmpl-alpha-inference");
    expect((resB.body as { id: string }).id).toBe("cmpl-beta-inference");
  });

  it("records the serving backend on the inference record", async () => {
    const acme = new GenericBackend("acme-cloud");
    registerBackend(acme as never);
    const context = makeContext("acme-cloud");

    await gateway.chatCompletion(context, { model: "acme-cloud-model", messages: MESSAGES });

    const records = new InferenceRecordStore(getDb()).listForParticipant(context.participant.id);
    expect(records[0].backend).toBe("acme-cloud");
    expect(records[0].provider).toBe("acme-cloud-provider");
  });

  it("meters and bills identically regardless of provider", async () => {
    const acme = new GenericBackend("acme-cloud");
    registerBackend(acme as never);
    const context = makeContext("acme-cloud");

    const outcome = await gateway.chatCompletion(context, {
      model: "acme-cloud-model",
      messages: MESSAGES,
    });

    // 100 in @ $0.001/1K + 50 out @ $0.002/1K = $0.0002 — the ledger does not
    // care which provider produced the tokens.
    expect(outcome.costUsd).toBeCloseTo(0.0002, 9);
    expect(nanoToUsd(ledger.getBalance(context.participant.id)!.consumedNano)).toBeCloseTo(
      0.0002,
      9,
    );
    expect(ledger.reconcile(context.participant.id).ok).toBe(true);
  });

  it("serves each program its own backend's catalog", async () => {
    const alpha = new GenericBackend("alpha-inference");
    registerBackend(alpha as never);
    const context = makeContext("alpha-inference");

    const models = await gateway.listModels(context.program);
    expect(models).toEqual([{ id: "alpha-inference-model", owned_by: "alpha-inference" }]);
  });

  it("streams through a non-0G backend", async () => {
    const acme = new GenericBackend("acme-cloud");
    registerBackend(acme as never);
    const context = makeContext("acme-cloud");

    const stream = await gateway.chatCompletionStream(context, {
      model: "acme-cloud-model",
      messages: MESSAGES,
      stream: true,
    });
    for await (const _chunk of stream.chunks) {
      // drain
    }
    const outcome = await stream.finalize();

    expect(outcome.ok).toBe(true);
    expect(outcome.costUsd).toBeGreaterThan(0);
    expect(ledger.getBalance(context.participant.id)!.heldNano).toBe(0);
  });
});

describe("misconfiguration is loud, not silent", () => {
  it("refuses a program naming an unregistered backend", async () => {
    const context = makeContext("does-not-exist");

    const error = await gateway
      .chatCompletion(context, { model: "whatever", messages: MESSAGES })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GatewayDeniedError);
    expect(error.denial.code).toBe("backend_unknown");
    expect(error.denial.httpStatus).toBe(503);
  });

  it("refuses a registered but unconfigured backend rather than falling back", async () => {
    // Falling back to a working provider would bill participants against a
    // model the sponsor never chose and record a provider id that lies.
    registerBackend(new GenericBackend("unconfigured-cloud", false) as never);
    const context = makeContext("unconfigured-cloud");

    const error = await gateway
      .chatCompletion(context, { model: "whatever", messages: MESSAGES })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GatewayDeniedError);
    expect(error.denial.code).toBe("backend_not_configured");
  });

  it("does not charge a participant for a backend misconfiguration", async () => {
    const context = makeContext("does-not-exist");
    await gateway
      .chatCompletion(context, { model: "whatever", messages: MESSAGES })
      .catch(() => undefined);

    const balance = ledger.getBalance(context.participant.id)!;
    expect(balance.consumedNano).toBe(0);
    expect(balance.heldNano).toBe(0);
  });
});
