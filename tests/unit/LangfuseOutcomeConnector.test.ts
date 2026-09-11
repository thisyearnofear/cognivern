import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-lf-outcomes-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;
process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
process.env.LANGFUSE_SECRET_KEY = "sk-test";

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationService } = await import("@backend/services/governance/OutcomeObservationService.js");
const { syncMandateOutcomes } = await import("@backend/services/outcomes/GitHubOutcomeConnector.js");

const NUMERIC_SCORE = {
  id: "score-1",
  projectId: "proj-abc",
  name: "quality",
  dataType: "NUMERIC",
  value: 0.87,
  timestamp: "2026-09-10T12:00:00.000Z",
  subject: { kind: "trace", id: "trace-aaa" },
};

const BOOLEAN_SCORE = {
  id: "score-2",
  projectId: "proj-abc",
  name: "pass",
  dataType: "BOOLEAN",
  value: true,
  timestamp: "2026-09-10T12:05:00.000Z",
  subject: { kind: "trace", id: "trace-bbb" },
};

const CATEGORICAL_SCORE = {
  id: "score-3",
  projectId: "proj-abc",
  name: "label",
  dataType: "CATEGORICAL",
  value: "good",
  timestamp: "2026-09-10T12:10:00.000Z",
  subject: { kind: "trace", id: "trace-ccc" },
};

const TRACE = {
  id: "trace-xyz-001",
  timestamp: "2026-09-10T11:00:00.000Z",
  name: "agent.run",
  htmlPath: "/project/proj-abc/traces/trace-xyz-001",
  totalCost: 0.042,
};

function langfuseOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(overrides: { scores?: unknown; traces?: unknown } = {}) {
  const calls: string[] = [];
  const mock = vi.fn(async (input: unknown) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    calls.push(url);
    const { pathname } = new URL(url);
    if (pathname.endsWith("/api/public/v3/scores")) {
      return langfuseOk({ data: overrides.scores ?? [NUMERIC_SCORE], meta: { limit: 100 } });
    }
    if (pathname.endsWith("/api/public/traces")) {
      return langfuseOk({ data: overrides.traces ?? [TRACE], meta: {} });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", mock);
  return { mock, calls };
}

const SUCCESS_METRICS = [
  { id: "quality", name: "Quality score", unit: "score" },
  { id: "runs", name: "Agent runs", unit: "runs" },
];

let scoresMandateId = "";
let tracesMandateId = "";
let replayMandateId = "";
let missingKeysMandateId = "";

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run(
    "lf-outcome-user",
    now,
    now,
  );
  db.prepare(
    "INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)",
  ).run("lf-outcome-workspace", "LF outcomes", "lf-outcome-user", now, now);

  scoresMandateId = FundedMandateService.create("lf-outcome-workspace", {
    name: "Scores mandate",
    objective: "Ingest Langfuse quality scores",
    successMetrics: SUCCESS_METRICS,
    outcomeSources: [
      {
        type: "langfuse",
        baseUrl: "https://cloud.langfuse.com",
        project: "prod-agents",
        mode: "scores",
        scoreNames: ["quality", "pass"],
        since: "2026-09-01T00:00:00Z",
        metricId: "quality",
      },
    ],
  }).id;

  tracesMandateId = FundedMandateService.create("lf-outcome-workspace", {
    name: "Traces mandate",
    objective: "Ingest Langfuse traces",
    successMetrics: SUCCESS_METRICS,
    measurementWindow: { startsAt: "2026-09-01T00:00:00.000Z" },
    outcomeSources: [
      {
        type: "langfuse",
        baseUrl: "https://cloud.langfuse.com",
        project: "prod-agents",
        mode: "traces",
        metricId: "runs",
      },
    ],
  }).id;

  replayMandateId = FundedMandateService.create("lf-outcome-workspace", {
    name: "Replay scores",
    objective: "Idempotency",
    successMetrics: SUCCESS_METRICS,
    outcomeSources: [
      {
        type: "langfuse",
        baseUrl: "https://cloud.langfuse.com",
        project: "prod-agents",
        mode: "scores",
        metricId: "quality",
      },
    ],
  }).id;

  missingKeysMandateId = FundedMandateService.create("lf-outcome-workspace", {
    name: "Missing keys",
    objective: "Surface auth errors",
    successMetrics: SUCCESS_METRICS,
    outcomeSources: [
      {
        type: "langfuse",
        baseUrl: "https://cloud.langfuse.com",
        project: "prod-agents",
        mode: "scores",
        metricId: "quality",
      },
    ],
  }).id;
});

afterAll(() => {
  vi.unstubAllGlobals();
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.unlinkSync(`${dbPath}${suffix}`);
    } catch {
      /* best effort */
    }
  }
});

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
  process.env.LANGFUSE_SECRET_KEY = "sk-test";
});

describe("LangfuseOutcomeConnector (scores mode)", () => {
  it("ingests numeric/boolean scores as system_observed outcomes", async () => {
    installFetchMock({ scores: [NUMERIC_SCORE, BOOLEAN_SCORE, CATEGORICAL_SCORE] });
    const result = await syncMandateOutcomes("lf-outcome-workspace", scoresMandateId);

    expect(result.totalIngested).toBe(2);
    expect(result.sources[0]).toMatchObject({
      sourceType: "langfuse",
      scope: "prod-agents",
      mode: "scores",
      ingested: 2,
      skipped: 1,
    });

    const observations = OutcomeObservationService.list("lf-outcome-workspace", scoresMandateId);
    expect(observations).toHaveLength(2);
    const byValue = Object.fromEntries(observations.map((o) => [o.value, o]));
    expect(byValue["0.87"]).toMatchObject({
      kind: "observed",
      confidence: "system_observed",
      unit: "score",
      source: "langfuse:prod-agents",
    });
    expect(byValue["1"]).toBeDefined();
  });

  it("is replay-safe across repeated syncs", async () => {
    installFetchMock({ scores: [NUMERIC_SCORE] });
    const first = await syncMandateOutcomes("lf-outcome-workspace", replayMandateId);
    const second = await syncMandateOutcomes("lf-outcome-workspace", replayMandateId);

    expect(first.totalIngested).toBe(1);
    expect(second.totalIngested).toBe(0);
    expect(second.totalReplayed).toBe(1);
    expect(OutcomeObservationService.list("lf-outcome-workspace", replayMandateId)).toHaveLength(1);
  });

  it("passes score name filter and fromTimestamp to the API", async () => {
    const { calls } = installFetchMock({ scores: [] });
    await syncMandateOutcomes("lf-outcome-workspace", scoresMandateId);

    const scoresCall = calls.find((url) => url.includes("/api/public/v3/scores"));
    expect(scoresCall).toBeDefined();
    const query = new URL(scoresCall!).searchParams;
    expect(query.get("name")).toBe("quality,pass");
    expect(query.get("fromTimestamp")).toBe("2026-09-01T00:00:00.000Z");
    expect(query.get("fields")).toBe("subject");
  });
});

describe("LangfuseOutcomeConnector (traces mode)", () => {
  it("ingests traces as delivery outcomes with cost notes", async () => {
    const { calls } = installFetchMock({ traces: [TRACE] });
    const result = await syncMandateOutcomes("lf-outcome-workspace", tracesMandateId);

    expect(result.totalIngested).toBe(1);
    expect(result.sources[0]).toMatchObject({ mode: "traces", ingested: 1 });

    const observations = OutcomeObservationService.list("lf-outcome-workspace", tracesMandateId);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      kind: "observed",
      confidence: "system_observed",
      value: "1",
      unit: "runs",
      source: "langfuse:prod-agents",
    });
    expect(observations[0].notes).toContain("cost=0.042");
    expect(observations[0].evidence[0].reference).toBe(
      "https://cloud.langfuse.com/project/proj-abc/traces/trace-xyz-001",
    );

    const tracesCall = calls.find((url) => url.includes("/api/public/traces"));
    expect(new URL(tracesCall!).searchParams.get("fromTimestamp")).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("LangfuseOutcomeConnector (failure surfaces)", () => {
  it("captures missing API keys in the source report instead of throwing", async () => {
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    const failed = await syncMandateOutcomes("lf-outcome-workspace", missingKeysMandateId);
    expect(failed.sources[0].error).toMatch(/LANGFUSE_PUBLIC_KEY/);
    expect(failed.totalIngested).toBe(0);
  });
});
