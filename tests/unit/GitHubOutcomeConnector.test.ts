import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dbPath = path.join(os.tmpdir(), `cognivern-gh-outcomes-${process.pid}-${Date.now()}.db`);
process.env.DB_PATH = dbPath;

const { getDb, closeDb } = await import("@backend/db/index.js");
const { FundedMandateService } = await import("@backend/services/governance/FundedMandateService.js");
const { OutcomeObservationService } = await import("@backend/services/governance/OutcomeObservationService.js");
const { syncMandateOutcomes } = await import("@backend/services/outcomes/GitHubOutcomeConnector.js");

// ── Canned GitHub payloads ───────────────────────────────────────────────────

const MERGED_PR = {
  number: 42,
  title: "feat: ship the connector",
  html_url: "https://github.com/owner/repo/pull/42",
  merged_at: "2026-08-10T10:00:00.000Z",
  merge_commit_sha: "abc123def456abc123def456abc123def456abc1",
  base: { ref: "main" },
  labels: [{ name: "mandate:delivery" }],
};

const CLOSED_ONLY_PR = { ...MERGED_PR, number: 43, merged_at: null, merge_commit_sha: null };
const WRONG_BRANCH_PR = { ...MERGED_PR, number: 44, base: { ref: "release" } };
const EARLY_PR = { ...MERGED_PR, number: 45, merged_at: "2026-07-01T10:00:00.000Z" };
const OTHER_LABEL_PR = { ...MERGED_PR, number: 46, labels: [{ name: "bug" }] };

const COMMIT = {
  sha: "def456abc123def456abc123def456abc123def4",
  html_url: "https://github.com/owner/repo/commit/def456",
  parents: [{ sha: "parent" }],
  commit: { message: "fix: wire the sync endpoint\n\nBody.", committer: { date: "2026-08-12T09:30:00.000Z" } },
};

const MERGE_COMMIT = {
  sha: "9999999999999999999999999999999999999999",
  html_url: "https://github.com/owner/repo/commit/9999999",
  parents: [{ sha: "a" }, { sha: "b" }],
  commit: { message: "Merge pull request #7", committer: { date: "2026-08-12T10:00:00.000Z" } },
};

const NO_DATE_COMMIT = {
  sha: "8888888888888888888888888888888888888888",
  html_url: "https://github.com/owner/repo/commit/8888888",
  parents: [{ sha: "a" }],
  commit: { message: "wip", committer: {} },
};

function githubOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Route mock fetch by pathname; records every call for assertions. */
function installFetchMock(overrides: { pulls?: unknown; commits?: unknown; files?: unknown } = {}) {
  const calls: string[] = [];
  const mock = vi.fn(async (input: unknown) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    calls.push(url);
    const { pathname } = new URL(url);
    if (/\/pulls\/\d+\/files$/.test(pathname)) {
      return githubOk(overrides.files ?? [{ filename: "src/backend/services/outcomes/GitHubOutcomeConnector.ts" }]);
    }
    if (/\/pulls$/.test(pathname)) {
      return githubOk(overrides.pulls ?? [MERGED_PR]);
    }
    if (/\/commits$/.test(pathname)) {
      return githubOk(overrides.commits ?? [COMMIT]);
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", mock);
  return { mock, calls };
}

// ── Mandate fixtures ────────────────────────────────────────────────────────

// Each test gets its own mandate (with its own repo) so the DB-level
// idempotency guarantee cannot leak between test cases.
let prMandateIds: Record<string, string> = {};
let commitMandateId = "";
let windowProbeMandateId = "";
let emptyMandateId = "";

const SUCCESS_METRICS = [{ id: "deliverables", name: "Deliverables shipped", unit: "deliverables" }];

function createPrMandate(key: string): string {
  return FundedMandateService.create("gh-outcome-workspace", {
    name: `PR-mode mandate ${key}`,
    objective: "Ship pull requests",
    successMetrics: SUCCESS_METRICS,
    outcomeSources: [
      {
        type: "github",
        repo: `owner/repo-${key}`,
        mode: "pr",
        branch: "main",
        labels: ["mandate:delivery"],
        since: "2026-08-01T00:00:00Z",
        metricId: "deliverables",
      },
    ],
  }).id;
}

beforeAll(() => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO users (id, created_at, last_login_at) VALUES (?, ?, ?)").run("gh-outcome-user", now, now);
  db.prepare("INSERT OR IGNORE INTO workspaces (id, name, owner_id, tier, created_at, updated_at) VALUES (?, ?, ?, 'live', ?, ?)").run("gh-outcome-workspace", "GH outcomes", "gh-outcome-user", now, now);

  prMandateIds = { ingest: createPrMandate("pr1"), filter: createPrMandate("pr2"), replay: createPrMandate("pr3"), failure: createPrMandate("pr4") };

  commitMandateId = FundedMandateService.create("gh-outcome-workspace", {
    name: "Commit-mode mandate",
    objective: "Ship direct commits",
    successMetrics: SUCCESS_METRICS,
    outcomeSources: [
      { type: "github", repo: "owner/repo-c1", mode: "commits", branch: "main", metricId: "deliverables" },
    ],
  }).id;

  windowProbeMandateId = FundedMandateService.create("gh-outcome-workspace", {
    name: "Window probe mandate",
    objective: "Verify since default",
    successMetrics: SUCCESS_METRICS,
    measurementWindow: { startsAt: "2026-08-01T00:00:00.000Z" },
    outcomeSources: [
      { type: "github", repo: "owner/repo-c2", mode: "commits", branch: "main", metricId: "deliverables" },
    ],
  }).id;

  emptyMandateId = FundedMandateService.create("gh-outcome-workspace", {
    name: "No sources",
    objective: "Nothing configured",
    successMetrics: SUCCESS_METRICS,
  }).id;
});

afterAll(() => {
  vi.unstubAllGlobals();
  closeDb();
  for (const suffix of ["", "-wal", "-shm"]) {
    try { fs.unlinkSync(`${dbPath}${suffix}`); } catch { /* best effort */ }
  }
});

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GitHubOutcomeConnector (pr mode)", () => {
  it("ingests merged PRs as independently verified outcomes", async () => {
    installFetchMock({ pulls: [MERGED_PR] });
    const result = await syncMandateOutcomes("gh-outcome-workspace", prMandateIds.ingest);

    expect(result.totalIngested).toBe(1);
    expect(result.sources[0]).toMatchObject({ mode: "pr", ingested: 1, replayed: 0 });

    const observations = OutcomeObservationService.list("gh-outcome-workspace", prMandateIds.ingest);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      kind: "verified_external_state",
      confidence: "independently_verified",
      value: "1",
      unit: "deliverables",
      source: "github:owner/repo-pr1",
    });
    expect(observations[0].evidence).toEqual([
      { type: "url", reference: MERGED_PR.html_url },
      { type: "external_record", reference: MERGED_PR.merge_commit_sha, hash: MERGED_PR.merge_commit_sha },
    ]);
    expect(observations[0].observedAt).toBe(MERGED_PR.merged_at);
  });

  it("skips unmerged, wrong-branch, too-early, and wrong-label PRs", async () => {
    installFetchMock({
      pulls: [MERGED_PR, CLOSED_ONLY_PR, WRONG_BRANCH_PR, EARLY_PR, OTHER_LABEL_PR],
    });
    const result = await syncMandateOutcomes("gh-outcome-workspace", prMandateIds.filter);

    expect(result.totalIngested).toBe(1);
    expect(result.sources[0].skipped).toBe(4);
  });

  it("is replay-safe across repeated syncs", async () => {
    installFetchMock({ pulls: [MERGED_PR] });
    const first = await syncMandateOutcomes("gh-outcome-workspace", prMandateIds.replay);
    const second = await syncMandateOutcomes("gh-outcome-workspace", prMandateIds.replay);

    expect(first.totalIngested).toBe(1);
    expect(second.totalIngested).toBe(0);
    expect(second.totalReplayed).toBe(1);
    expect(OutcomeObservationService.list("gh-outcome-workspace", prMandateIds.replay)).toHaveLength(1);
  });
});

describe("GitHubOutcomeConnector (commits mode)", () => {
  it("ingests branch commits and skips merge commits", async () => {
    installFetchMock({ commits: [COMMIT, MERGE_COMMIT, NO_DATE_COMMIT] });
    const result = await syncMandateOutcomes("gh-outcome-workspace", commitMandateId);

    expect(result.totalIngested).toBe(1);
    expect(result.sources[0]).toMatchObject({ mode: "commits", ingested: 1, skipped: 2 });

    const observations = OutcomeObservationService.list("gh-outcome-workspace", commitMandateId);
    expect(observations).toHaveLength(1);
    expect(observations[0].evidence[1]).toEqual({
      type: "external_record",
      reference: COMMIT.sha,
      hash: COMMIT.sha,
    });
    expect(observations[0].notes).toBe(`commit def456a: fix: wire the sync endpoint`);
  });

  it("defaults since to the mandate measurement window start", async () => {
    const { calls } = installFetchMock({ commits: [] });
    await syncMandateOutcomes("gh-outcome-workspace", windowProbeMandateId);

    const commitsCall = calls.find((url) => url.includes("/commits"));
    expect(commitsCall).toBeDefined();
    const query = new URL(commitsCall!).searchParams;
    expect(query.get("since")).toBe("2026-08-01T00:00:00.000Z");
    expect(query.get("sha")).toBe("main");
  });
});

describe("GitHubOutcomeConnector (failure surfaces)", () => {
  it("throws when the mandate has no outcome sources", async () => {
    await expect(syncMandateOutcomes("gh-outcome-workspace", emptyMandateId)).rejects.toThrow(
      /no outcome sources/i,
    );
  });

  it("rejects cross-workspace sync", async () => {
    await expect(syncMandateOutcomes("gh-other-workspace", prMandateIds.ingest)).rejects.toThrow(
      /mandate not found/i,
    );
  });

  it("captures a GitHub API failure in the source report instead of throwing", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("network down");
    });
    const failed = await syncMandateOutcomes("gh-outcome-workspace", prMandateIds.failure);
    expect(failed.sources[0].error).toMatch(/network down/);
    expect(failed.totalIngested).toBe(0);
    // Nothing was ingested for the failed run; a later healthy sync must work.
    installFetchMock({ pulls: [MERGED_PR] });
    const healthy = await syncMandateOutcomes("gh-outcome-workspace", prMandateIds.failure);
    expect(healthy.sources[0].error).toBeUndefined();
    expect(healthy.totalIngested).toBe(1);
  });
});

describe("FundedMandateService outcome sources", () => {
  it("persists, updates, and clears outcome sources through the mandate lifecycle", () => {
    const created = FundedMandateService.create("gh-outcome-workspace", {
      name: "Lifecycle sources",
      objective: "Carry source config",
      successMetrics: SUCCESS_METRICS,
      outcomeSources: [{ type: "github", repo: "owner/repo", mode: "pr", metricId: "deliverables" }],
    });
    expect(created.outcomeSources).toEqual([
      { type: "github", repo: "owner/repo", mode: "pr", metricId: "deliverables" },
    ]);

    const updated = FundedMandateService.update("gh-outcome-workspace", created.id, {
      outcomeSources: [{ type: "github", repo: "owner/repo", mode: "commits", branch: "main", metricId: "deliverables" }],
    });
    expect(updated?.outcomeSources?.[0].mode).toBe("commits");

    const cleared = FundedMandateService.update("gh-outcome-workspace", created.id, {
      outcomeSources: [],
    });
    expect(cleared?.outcomeSources).toBeUndefined();
  });

  it("rejects sources referencing unknown metrics", () => {
    expect(() =>
      FundedMandateService.create("gh-outcome-workspace", {
        name: "Bad source",
        objective: "Should fail",
        successMetrics: SUCCESS_METRICS,
        outcomeSources: [{ type: "github", repo: "owner/repo", mode: "pr", metricId: "nope" }],
      }),
    ).toThrow(/successMetrics/);
  });
});
