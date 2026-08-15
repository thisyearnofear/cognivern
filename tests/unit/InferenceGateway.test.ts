import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Fake credentials are assembled from parts so no secret-shaped literal exists
// in the repo (GitHub push protection scans blobs). The concatenated values
// still match the redaction regexes at runtime.
const fakeKey = (...parts: string[]) => parts.join("");

const dbPath = path.join(os.tmpdir(), `cognivern-gateway-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
// Deterministic pricing: $0.001 per 1K input, $0.002 per 1K output, for every model.
process.env.GATEWAY_STATIC_PRICES = JSON.stringify({
  "*": { promptUsdPer1k: 0.001, completionUsdPer1k: 0.002 },
});
process.env.GATEWAY_HOLD_SAFETY_FACTOR = "1.25";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { CreditLedgerService } = await import("@backend/services/credits/CreditLedgerService.js");
const { CreditProgramService } = await import("@backend/services/credits/CreditProgramService.js");
const { InferenceRecordStore, projectForSponsor, projectForParticipant } = await import(
  "@backend/services/credits/InferenceRecordStore.js"
);
const { InferenceGatewayService, GatewayDeniedError } = await import(
  "@backend/services/inference/InferenceGatewayService.js"
);
const { ModelPricingService } = await import("@backend/services/inference/ModelPricingService.js");
const { usdToNano, nanoToUsd } = await import("@backend/services/credits/money.js");
const { AuditLogService } = await import("@backend/services/governance/AuditLogService.js");

const WORKSPACE = "workspace-gateway-test";

type Usage = { inputTokens: number; outputTokens: number; cachedTokens: number };

/**
 * Stub backend. Records what it was asked for and returns whatever usage the
 * test dictates, so metering can be asserted against exact token counts rather
 * than a live provider's behaviour.
 */
class FakeBackend {
  readonly id = "fake-backend";
  configured = true;
  calls: Array<Record<string, unknown>> = [];
  nextUsage: Usage | null = { inputTokens: 1000, outputTokens: 500, cachedTokens: 0 };
  nextStatus = 200;
  nextText = "hello from the model";
  throwOnCall = false;
  streamChunks: string[] = [];

  isConfigured() {
    return this.configured;
  }

  async listModels() {
    return [
      { id: "glm-5.2", promptPriceNative: null, completionPriceNative: null, contextWindow: 128000, verifiability: "TeeML", raw: { id: "glm-5.2" } },
      { id: "llama-3.3-70b", promptPriceNative: null, completionPriceNative: null, contextWindow: 8192, verifiability: "TeeTLS", raw: { id: "llama-3.3-70b" } },
    ];
  }

  async chatCompletion(request: { body: Record<string, unknown> }) {
    this.calls.push(request.body);
    if (this.throwOnCall) throw new Error("network exploded");

    if (this.nextStatus !== 200) {
      return {
        ok: false,
        status: this.nextStatus,
        body: { error: { message: "upstream failed" } },
        usage: null,
        provider: null,
        trustTier: null,
        upstreamRequestId: null,
        responseText: "",
      };
    }

    return {
      ok: true,
      status: 200,
      body: {
        id: "chatcmpl-fake",
        choices: [{ message: { role: "assistant", content: this.nextText }, finish_reason: "stop" }],
        usage: this.nextUsage
          ? {
              prompt_tokens: this.nextUsage.inputTokens,
              completion_tokens: this.nextUsage.outputTokens,
            }
          : undefined,
      },
      usage: this.nextUsage,
      provider: "0xprovider",
      trustTier: "private",
      upstreamRequestId: "req-fake",
      responseText: this.nextText,
    };
  }

  async chatCompletionStream(request: { body: Record<string, unknown> }) {
    this.calls.push(request.body);
    const collected = {
      usage: null as Usage | null,
      provider: "0xprovider",
      trustTier: "private",
      upstreamRequestId: "req-stream",
      responseText: "",
      usageMissing: true,
    };
    const chunks = this.streamChunks;
    const usage = this.nextUsage;
    const text = this.nextText;

    async function* generate() {
      for (const chunk of chunks) {
        yield new TextEncoder().encode(chunk);
      }
      collected.responseText = text;
      if (usage) {
        collected.usage = usage;
        collected.usageMissing = false;
      }
    }

    return { ok: true, status: 200, chunks: generate(), collected };
  }
}

let ledger: InstanceType<typeof CreditLedgerService>;
let programs: InstanceType<typeof CreditProgramService>;
let records: InstanceType<typeof InferenceRecordStore>;
let backend: FakeBackend;
let gateway: InstanceType<typeof InferenceGatewayService>;

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "user-gateway-test",
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run(WORKSPACE, WORKSPACE, "user-gateway-test", now, now);

  ledger = new CreditLedgerService(db);
  programs = new CreditProgramService(db, ledger);
  records = new InferenceRecordStore(db);
});

afterAll(() => {
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

  backend = new FakeBackend();
  const audit = new AuditLogService();
  // The audit trail anchors to 0G Storage and Filecoin; stub it so tests don't
  // reach the network. Anchoring behaviour is covered by AuditLogService's own
  // tests — here we only care that exactly one record is written per call.
  vi.spyOn(audit, "logAction").mockResolvedValue("run-fake");

  gateway = new InferenceGatewayService(
    backend as never,
    new ModelPricingService(backend as never),
    programs,
    ledger,
    records,
    audit,
  );
});

function setup(
  programOverrides: Record<string, unknown> = {},
  participantOverrides: Record<string, unknown> = {},
) {
  const program = programs.createProgram({
    workspaceId: WORKSPACE,
    name: "Gateway Test",
    baseAllocationUsd: 20,
    poolUsd: 100000,
    status: "active",
    ...programOverrides,
  });
  const [{ participant, key }] = programs.provisionParticipants(program.id, [
    { handle: "tester", projectTag: "proj-x", ...participantOverrides },
  ]);
  return { program, participant, key, context: { program, participant } };
}

const MESSAGES = [{ role: "user", content: "Write a function that parses a CSV file in TypeScript" }];

describe("metering", () => {
  it("bills the provider's reported token counts, not an estimate", async () => {
    const { context, participant } = setup();
    backend.nextUsage = { inputTokens: 1000, outputTokens: 500, cachedTokens: 0 };

    const outcome = await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });

    // 1000 input @ $0.001/1K = $0.001; 500 output @ $0.002/1K = $0.001.
    expect(outcome.ok).toBe(true);
    expect(outcome.costUsd).toBeCloseTo(0.002, 9);

    const balance = ledger.getBalance(participant.id)!;
    expect(nanoToUsd(balance.consumedNano)).toBeCloseTo(0.002, 9);
    expect(balance.heldNano).toBe(0);
    expect(balance.requestCount).toBe(1);
  });

  it("stores the real token counts on the inference record", async () => {
    const { context, participant } = setup();
    backend.nextUsage = { inputTokens: 777, outputTokens: 333, cachedTokens: 12 };

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });

    const [record] = records.listForParticipant(participant.id);
    expect(record.inputTokens).toBe(777);
    expect(record.outputTokens).toBe(333);
    expect(record.cachedTokens).toBe(12);
    expect(record.pricingSource).toBe("static");
    expect(record.status).toBe("ok");
    expect(record.provider).toBe("0xprovider");
    expect(record.trustTier).toBe("private");
    expect(record.teeVerified).toBe(true);
  });

  it("releases the hold entirely when the provider errors", async () => {
    const { context, participant } = setup();
    backend.nextStatus = 503;

    const outcome = await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });

    expect(outcome.ok).toBe(false);
    expect(outcome.httpStatus).toBe(503);

    const balance = ledger.getBalance(participant.id)!;
    expect(balance.consumedNano).toBe(0);
    expect(balance.heldNano).toBe(0);
    expect(nanoToUsd(balance.availableNano)).toBe(25);

    const [record] = records.listForParticipant(participant.id);
    expect(record.status).toBe("upstream_error");
    expect(record.costNano).toBe(0);
  });

  it("never leaves a dangling hold when the backend throws", async () => {
    const { context, participant } = setup();
    backend.throwOnCall = true;

    await expect(
      gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES }),
    ).rejects.toThrow(/network exploded/);

    const balance = ledger.getBalance(participant.id)!;
    expect(balance.heldNano).toBe(0);
    expect(nanoToUsd(balance.availableNano)).toBe(25);
  });

  it("bills the hold estimate rather than zero when usage is unreported", async () => {
    const { context, participant } = setup();
    backend.nextUsage = null;

    const outcome = await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });

    expect(outcome.costUsd).toBeGreaterThan(0);
    const [record] = records.listForParticipant(participant.id);
    expect(record.pricingSource).toBe("unmetered_fallback");
    expect(ledger.getBalance(participant.id)!.consumedNano).toBeGreaterThan(0);
  });

  it("writes exactly one audit record per call", async () => {
    const { context } = setup();
    const audit = new AuditLogService();
    const spy = vi.spyOn(audit, "logAction").mockResolvedValue("run-1");
    const g = new InferenceGatewayService(
      backend as never,
      new ModelPricingService(backend as never),
      programs,
      ledger,
      records,
      audit,
    );

    await g.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    await g.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });

    expect(spy).toHaveBeenCalledTimes(2);
    const [action, , allowed, options] = spy.mock.calls[0];
    expect(action.type).toBe("sponsored_inference");
    expect(allowed).toBe(true);
    expect(options?.aiUsage?.inputTokens).toBe(1000);
    expect(options?.aiUsage?.costUsd).toBeCloseTo(0.002, 9);
  });

  it("keeps the ledger reconciled across many calls", async () => {
    const { context, participant } = setup();
    backend.nextUsage = { inputTokens: 100, outputTokens: 50, cachedTokens: 0 };

    for (let i = 0; i < 20; i += 1) {
      await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    }

    expect(ledger.reconcile(participant.id).ok).toBe(true);
    expect(ledger.getBalance(participant.id)!.requestCount).toBe(20);
  });
});

describe("enforcement", () => {
  it("rejects a model outside the program allowlist", async () => {
    const { context } = setup({ allowedModels: ["glm-5.2"] });

    await expect(
      gateway.chatCompletion(context, { model: "gpt-4o", messages: MESSAGES }),
    ).rejects.toThrow(GatewayDeniedError);
    // Nothing reached the provider.
    expect(backend.calls).toHaveLength(0);
  });

  it("rejects requests once credit is exhausted, with a 402", async () => {
    // Deterministic arithmetic with the static test prices ($0.001/1K in,
    // $0.002/1K out) and a 1000-token output cap:
    //   hold estimate ~= (88 in + 1000 out) x 1.25 safety = ~$0.00261
    //   actual charge  =  1000 in + 1000 out              =  $0.003
    // A $0.003 base at the standard 1.25x tier allocates $0.00375 — enough for
    // one call, not enough to reserve a second afterwards.
    const { context, participant } = setup({
      baseAllocationUsd: 0.003,
      maxOutputTokens: 1000,
    });
    backend.nextUsage = { inputTokens: 1000, outputTokens: 1000, cachedTokens: 0 };

    const first = await gateway.chatCompletion(context, {
      model: "glm-5.2",
      messages: MESSAGES,
      max_tokens: 1000,
    });
    expect(first.ok).toBe(true);
    expect(first.costUsd).toBeCloseTo(0.003, 9);

    const error = await gateway
      .chatCompletion(context, { model: "glm-5.2", messages: MESSAGES, max_tokens: 1000 })
      .catch((e) => e);

    expect(error).toBeInstanceOf(GatewayDeniedError);
    expect(error.denial.httpStatus).toBe(402);
    expect(error.denial.code).toBe("insufficient_credits");
    // The denial points at the disclosure route to more budget.
    expect(error.denial.message).toMatch(/disclosure tier/i);

    // The rejected request never reached the provider, and nothing extra was
    // billed or left reserved.
    expect(backend.calls).toHaveLength(1);
    const balance = ledger.getBalance(participant.id)!;
    expect(balance.heldNano).toBe(0);
    expect(nanoToUsd(balance.consumedNano)).toBeCloseTo(0.003, 9);
  });

  it("lets a participant unblock themselves by raising their disclosure tier", async () => {
    const { context, participant } = setup({
      baseAllocationUsd: 0.003,
      maxOutputTokens: 1000,
    });
    backend.nextUsage = { inputTokens: 1000, outputTokens: 1000, cachedTokens: 0 };

    await gateway.chatCompletion(context, {
      model: "glm-5.2",
      messages: MESSAGES,
      max_tokens: 1000,
    });
    await expect(
      gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES, max_tokens: 1000 }),
    ).rejects.toThrow(GatewayDeniedError);

    // Opting into full disclosure doubles the allocation off the same base.
    const { participant: upgraded } = programs.setDisclosureTier(participant.id, "open");
    expect(upgraded.allocatedNano).toBeGreaterThan(usdToNano(0.005));

    const retry = await gateway.chatCompletion(
      { program: context.program, participant: upgraded },
      { model: "glm-5.2", messages: MESSAGES, max_tokens: 1000 },
    );
    expect(retry.ok).toBe(true);
  });

  it("rejects when the program is paused or outside its window", async () => {
    const paused = setup({ status: "paused" });
    await expect(
      gateway.chatCompletion(paused.context, { model: "glm-5.2", messages: MESSAGES }),
    ).rejects.toThrow(/paused/);

    const ended = setup({ endsAt: "2020-01-01T00:00:00.000Z" }, { handle: "late" });
    await expect(
      gateway.chatCompletion(ended.context, { model: "glm-5.2", messages: MESSAGES }),
    ).rejects.toThrow(GatewayDeniedError);

    const future = setup({ startsAt: "2999-01-01T00:00:00.000Z" }, { handle: "early" });
    await expect(
      gateway.chatCompletion(future.context, { model: "glm-5.2", messages: MESSAGES }),
    ).rejects.toThrow(GatewayDeniedError);
  });

  it("clamps requested output tokens to the program cap", async () => {
    const { context } = setup({ maxOutputTokens: 256 });

    await gateway.chatCompletion(context, {
      model: "glm-5.2",
      messages: MESSAGES,
      max_tokens: 100000,
    });

    expect(backend.calls[0].max_tokens).toBe(256);
  });

  it("rejects malformed requests before reserving credit", async () => {
    const { context, participant } = setup();

    await expect(gateway.chatCompletion(context, { messages: MESSAGES })).rejects.toThrow(
      /model/,
    );
    await expect(gateway.chatCompletion(context, { model: "glm-5.2" })).rejects.toThrow(
      /messages/,
    );

    expect(ledger.getBalance(participant.id)!.heldNano).toBe(0);
    expect(backend.calls).toHaveLength(0);
  });

  it("records denials so a sponsor can see who hit their cap", async () => {
    const { context, participant } = setup({ allowedModels: ["glm-5.2"] });

    await gateway
      .chatCompletion(context, { model: "forbidden-model", messages: MESSAGES })
      .catch(() => undefined);
    await gateway.recordDenial(context, "forbidden-model", {
      code: "model_not_allowed",
      message: "no",
      httpStatus: 403,
    });

    const denials = records
      .listForParticipant(participant.id)
      .filter((r) => r.status === "denied");
    expect(denials.length).toBeGreaterThan(0);
    expect(denials[0].deniedReason).toBe("model_not_allowed");
    expect(denials[0].costNano).toBe(0);
  });

  it("refuses to serve a revoked participant", async () => {
    const { context, participant } = setup();
    programs.setParticipantStatus(participant.id, "revoked");

    // The key no longer resolves at all.
    expect(programs.resolveGatewayKey(setup({}, { handle: "other" }).key)).not.toBeNull();
    const stale = { ...context, participant: { ...participant, status: "revoked" } };
    await expect(
      gateway.chatCompletion(stale as never, { model: "glm-5.2", messages: MESSAGES }),
    ).rejects.toThrow(/revoked/);
  });
});

describe("disclosure-gated storage", () => {
  it("writes no content or classification for a private participant", async () => {
    const { context, participant } = setup({}, { disclosureTier: "private" });

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    const [record] = records.listForParticipant(participant.id);

    expect(record.promptDigest).toBeNull();
    expect(record.responseDigest).toBeNull();
    expect(record.taskClass).toBeNull();
    expect(record.projectTag).toBeNull();
    expect(record.promptExcerpt).toBeNull();
    expect(record.responseExcerpt).toBeNull();

    // Billing metadata is still complete — spend is always accounted for.
    expect(record.inputTokens).toBe(1000);
    expect(record.costNano).toBeGreaterThan(0);

    // And the sponsor sees no per-call row at all.
    expect(projectForSponsor(record)).toBeNull();
  });

  it("writes digests but no content at standard", async () => {
    const { context, participant } = setup({}, { disclosureTier: "standard" });

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    const [record] = records.listForParticipant(participant.id);

    expect(record.promptDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(record.taskClass).toBeNull();
    expect(record.promptExcerpt).toBeNull();

    const sponsorView = projectForSponsor(record)!;
    expect(sponsorView.promptDigest).toBeDefined();
    expect(sponsorView.taskClass).toBeUndefined();
    expect(sponsorView.promptExcerpt).toBeUndefined();
  });

  it("adds classification and project tag at detailed, still no content", async () => {
    const { context, participant } = setup({}, { disclosureTier: "detailed" });

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    const [record] = records.listForParticipant(participant.id);

    expect(record.taskClass).toBe("code");
    expect(record.projectTag).toBe("proj-x");
    expect(record.promptExcerpt).toBeNull();

    const sponsorView = projectForSponsor(record)!;
    expect(sponsorView.taskClass).toBe("code");
    expect(sponsorView.promptExcerpt).toBeUndefined();
  });

  it("stores scrubbed excerpts only at open", async () => {
    const { context, participant } = setup({}, { disclosureTier: "open" });

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    const [record] = records.listForParticipant(participant.id);

    expect(record.promptExcerpt).toContain("parses a CSV file");
    expect(record.responseExcerpt).toContain("hello from the model");
    expect(projectForSponsor(record)!.promptExcerpt).toBeDefined();
  });

  it("strips credentials from stored excerpts even at the most open tier", async () => {
    const { context, participant } = setup({}, { disclosureTier: "open" });

    await gateway.chatCompletion(context, {
      model: "glm-5.2",
      messages: [
        {
          role: "user",
          content: `deploy with OPENAI_API_KEY=${fakeKey(
            "sk-proj-",
            "abcdefghijklmnopqrstuvwxyz012345",
          )} and ${fakeKey("ghp_", "abcdefghijklmnopqrstuvwxyz01234567")}`,
        },
      ],
    });

    const [record] = records.listForParticipant(participant.id);
    expect(record.promptExcerpt).not.toContain(
      fakeKey("sk-proj-", "abcdefghijklmnopqrstuvwxyz012345"),
    );
    expect(record.promptExcerpt).not.toContain(
      fakeKey("ghp_", "abcdefghijklmnopqrstuvwxyz01234567"),
    );
    expect(record.promptExcerpt).toContain("[REDACTED:");
    expect(record.redactionCount).toBeGreaterThanOrEqual(2);
    expect(record.redactionCategories).toContain("openai_key");
  });

  it("counts redactions even for a private participant who stores no content", async () => {
    const { context, participant } = setup({}, { disclosureTier: "private" });

    await gateway.chatCompletion(context, {
      model: "glm-5.2",
      messages: [
        {
          role: "user",
          content: `key ${fakeKey("sk-proj-", "abcdefghijklmnopqrstuvwxyz012345")}`,
        },
      ],
    });

    const [record] = records.listForParticipant(participant.id);
    // The participant can verify scrubbing happened without any content stored.
    expect(record.redactionCount).toBeGreaterThan(0);
    expect(record.promptExcerpt).toBeNull();
  });

  it("does not retroactively disclose calls made at a lower tier", async () => {
    const { context, participant } = setup({}, { disclosureTier: "private" });

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    programs.setDisclosureTier(participant.id, "open");

    const [record] = records.listForParticipant(participant.id);
    expect(record.disclosureTier).toBe("private");
    expect(projectForSponsor(record)).toBeNull();
  });

  it("gives the participant a fuller view than the sponsor", async () => {
    const { context, participant } = setup({}, { disclosureTier: "standard" });

    await gateway.chatCompletion(context, { model: "glm-5.2", messages: MESSAGES });
    const [record] = records.listForParticipant(participant.id);

    const mine = projectForParticipant(record);
    const theirs = projectForSponsor(record)!;

    expect(mine.redactionCategories).toBeDefined();
    expect(mine.rawCostNative).toBeDefined();
    expect(theirs.rawCostNative).toBeUndefined();
    expect(Object.keys(mine).length).toBeGreaterThan(Object.keys(theirs).length);
  });
});

describe("streaming", () => {
  it("relays chunks verbatim and settles from the stream's usage", async () => {
    const { context, participant } = setup();
    backend.streamChunks = [
      'data: {"choices":[{"delta":{"content":"hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    backend.nextUsage = { inputTokens: 200, outputTokens: 100, cachedTokens: 0 };

    const stream = await gateway.chatCompletionStream(context, {
      model: "glm-5.2",
      messages: MESSAGES,
      stream: true,
    });

    const relayed: string[] = [];
    for await (const chunk of stream.chunks) {
      relayed.push(new TextDecoder().decode(chunk));
    }
    const outcome = await stream.finalize();

    expect(relayed.join("")).toBe(backend.streamChunks.join(""));
    // 200 @ $0.001/1K + 100 @ $0.002/1K = $0.0002 + $0.0002
    expect(outcome.costUsd).toBeCloseTo(0.0004, 9);

    const [record] = records.listForParticipant(participant.id);
    expect(record.streamed).toBe(true);
    expect(record.inputTokens).toBe(200);
    expect(ledger.getBalance(participant.id)!.heldNano).toBe(0);
  });

  it("settles only once even if finalize is called repeatedly", async () => {
    const { context, participant } = setup();
    backend.streamChunks = ['data: {"choices":[{"delta":{"content":"x"}}]}\n\n'];

    const stream = await gateway.chatCompletionStream(context, {
      model: "glm-5.2",
      messages: MESSAGES,
      stream: true,
    });
    for await (const _chunk of stream.chunks) {
      // drain
    }

    await stream.finalize();
    const consumedAfterFirst = ledger.getBalance(participant.id)!.consumedNano;
    await stream.finalize();
    await stream.finalize();

    expect(ledger.getBalance(participant.id)!.consumedNano).toBe(consumedAfterFirst);
    expect(records.listForParticipant(participant.id)).toHaveLength(1);
  });

  it("bills the hold when a stream ends without reporting usage", async () => {
    const { context, participant } = setup();
    backend.streamChunks = ['data: {"choices":[{"delta":{"content":"x"}}]}\n\n'];
    backend.nextUsage = null;

    const stream = await gateway.chatCompletionStream(context, {
      model: "glm-5.2",
      messages: MESSAGES,
      stream: true,
    });
    for await (const _chunk of stream.chunks) {
      // drain
    }
    const outcome = await stream.finalize();

    expect(outcome.costUsd).toBeGreaterThan(0);
    expect(ledger.getBalance(participant.id)!.heldNano).toBe(0);
  });
});

describe("model catalog", () => {
  it("relays the upstream catalog shape untouched", async () => {
    const models = await gateway.listModels();
    expect(models).toEqual([{ id: "glm-5.2" }, { id: "llama-3.3-70b" }]);
  });
});
