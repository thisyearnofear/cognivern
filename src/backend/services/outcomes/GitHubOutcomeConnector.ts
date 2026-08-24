/**
 * GitHubOutcomeConnector
 *
 * Fills the outcome pipe with independently verifiable evidence: watches a
 * mandate's configured GitHub sources for shipped work (merged PRs or branch
 * commits), verifies it against the GitHub API, and ingests each item as a
 * `verified_external_state` / `independently_verified` outcome observation
 * through the existing `OutcomeObservationService`.
 *
 * Trust model: the GitHub API is the attestor. A PR with `merged_at` set on
 * the target branch, or a commit listed as an ancestor of the branch head,
 * is external state that anyone can re-check — no operator assertion
 * involved. This extends the platform's receipt brand (verify without
 * trusting us) from spend to outcomes.
 *
 * Idempotency: every ingestion uses a stable key derived from the repo and
 * the item's SHA (`github:{repo}:pr{n}:{sha}` / `github:{repo}:commit:{sha}`),
 * enforced by the outcome_observations unique index. Re-running a sync never
 * duplicates observations — replays return the existing record.
 *
 * Auth: optional `GITHUB_TOKEN` env var (raises the rate limit from 60/hr to
 * 5000/hr). Public repos work unauthenticated. The token is read from the
 * environment, never stored in a mandate or observation.
 *
 * v1 bounds: operator-triggered (no webhooks), one page (100 items) per
 * source per sync, bounded below by `source.since` or the mandate's
 * measurement window start.
 */
import logger from "@backend/utils/logger.js";
import { FundedMandateService, type FundedMandate } from "../governance/FundedMandateService.js";
import {
  OutcomeObservationService,
  type CreateOutcomeObservationInput,
} from "../governance/OutcomeObservationService.js";
import { hydraDbMandateContext } from "../hydradb/HydraDbMandateContextService.js";
import type { GitHubOutcomeSource } from "./outcomeSourceConfig.js";

const GITHUB_API = "https://api.github.com";
const PAGE_SIZE = 100;
const DEFAULT_UNIT = "deliverables";

// ── GitHub API shapes (only the fields we use) ──────────────────────────────

interface GitHubPull {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  merge_commit_sha: string | null;
  base: { ref: string };
  labels: Array<{ name?: string }>;
}

interface GitHubCommit {
  sha: string;
  html_url: string;
  parents: Array<{ sha: string }>;
  commit: {
    message?: string;
    committer?: { date?: string | null } | null;
  };
}

interface GitHubPullFile {
  filename: string;
}

export interface OutcomeSourceSyncReport {
  repo: string;
  mode: "pr" | "commits";
  fetched: number;
  ingested: number;
  replayed: number;
  skipped: number;
  error?: string;
}

export interface OutcomeSyncResult {
  mandateId: string;
  sources: OutcomeSourceSyncReport[];
  totalIngested: number;
  totalReplayed: number;
}

// ── GitHub API client ───────────────────────────────────────────────────────

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cognivern-outcome-connector",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function githubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sinceFor(source: GitHubOutcomeSource, mandate: FundedMandate): string | undefined {
  if (source.since) return source.since;
  return mandate.measurementWindow?.startsAt;
}

function unitFor(source: GitHubOutcomeSource, mandate: FundedMandate): string {
  if (!source.metricId) return DEFAULT_UNIT;
  const metric = mandate.successMetrics.find((m) => m.id === source.metricId);
  return metric?.unit.trim() || DEFAULT_UNIT;
}

function firstLine(text: string | undefined, maxLength: number): string {
  const line = (text || "").split("\n")[0]?.trim() || "";
  return line.length > maxLength ? `${line.slice(0, maxLength)}…` : line;
}

function matchesLabels(pr: GitHubPull, labels: string[] | undefined): boolean {
  if (!labels || labels.length === 0) return true;
  const have = new Set(pr.labels.map((l) => (l.name || "").toLowerCase()));
  return labels.every((required) => have.has(required.toLowerCase()));
}

async function prTouchesPath(repo: string, prNumber: number, pathFilter: string): Promise<boolean> {
  const files = await githubFetch<GitHubPullFile[]>(
    `/repos/${repo}/pulls/${prNumber}/files?per_page=${PAGE_SIZE}`,
  );
  return files.some((file) => file.filename === pathFilter || file.filename.startsWith(`${pathFilter}/`));
}

// ── Per-mode sync ───────────────────────────────────────────────────────────

async function syncPrSource(
  workspaceId: string,
  mandate: FundedMandate,
  source: GitHubOutcomeSource,
): Promise<OutcomeSourceSyncReport> {
  const branch = source.branch || "main";
  const since = sinceFor(source, mandate);
  const sinceMs = since ? new Date(since).getTime() : undefined;
  const unit = unitFor(source, mandate);

  const pulls = await githubFetch<GitHubPull[]>(
    `/repos/${source.repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${PAGE_SIZE}`,
  );

  const report: OutcomeSourceSyncReport = {
    repo: source.repo,
    mode: "pr",
    fetched: pulls.length,
    ingested: 0,
    replayed: 0,
    skipped: 0,
  };

  for (const pr of pulls) {
    // The GitHub API attestation: merged (not just closed) into the target branch.
    if (!pr.merged_at || !pr.merge_commit_sha) {
      report.skipped += 1;
      continue;
    }
    if (pr.base.ref !== branch) {
      report.skipped += 1;
      continue;
    }
    if (sinceMs !== undefined && new Date(pr.merged_at).getTime() < sinceMs) {
      report.skipped += 1;
      continue;
    }
    if (!matchesLabels(pr, source.labels)) {
      report.skipped += 1;
      continue;
    }
    if (source.pathFilter && !(await prTouchesPath(source.repo, pr.number, source.pathFilter))) {
      report.skipped += 1;
      continue;
    }

    const input: CreateOutcomeObservationInput = {
      ...(source.metricId ? { metricId: source.metricId } : {}),
      kind: "verified_external_state",
      value: "1",
      unit,
      observedAt: new Date(pr.merged_at).toISOString(),
      source: `github:${source.repo}`,
      confidence: "independently_verified",
      evidence: [
        { type: "url", reference: pr.html_url },
        { type: "external_record", reference: pr.merge_commit_sha, hash: pr.merge_commit_sha },
      ],
      notes: `PR #${pr.number}: ${firstLine(pr.title, 300)}`,
    };
    const idempotencyKey = `github:${source.repo}:pr${pr.number}:${pr.merge_commit_sha}`.slice(0, 160);

    const result = OutcomeObservationService.create(workspaceId, mandate.id, input, idempotencyKey);
    if (result.replayed) report.replayed += 1;
    else report.ingested += 1;
  }

  return report;
}

async function syncCommitSource(
  workspaceId: string,
  mandate: FundedMandate,
  source: GitHubOutcomeSource,
): Promise<OutcomeSourceSyncReport> {
  const branch = source.branch || "main";
  const since = sinceFor(source, mandate);
  const unit = unitFor(source, mandate);

  // The commits endpoint with sha=<branch> lists ancestors of the branch
  // head, so reachability from the branch is guaranteed by construction —
  // that is the external-state attestation for commit mode. `path` is
  // natively supported and filters server-side.
  const params = new URLSearchParams({ sha: branch, per_page: String(PAGE_SIZE) });
  if (since) params.set("since", since);
  if (source.pathFilter) params.set("path", source.pathFilter);

  const commits = await githubFetch<GitHubCommit[]>(
    `/repos/${source.repo}/commits?${params.toString()}`,
  );

  const report: OutcomeSourceSyncReport = {
    repo: source.repo,
    mode: "commits",
    fetched: commits.length,
    ingested: 0,
    replayed: 0,
    skipped: 0,
  };

  for (const commit of commits) {
    // Merge commits are structural noise; the shipped work lives in the
    // merged PR or the individual commits.
    if (commit.parents.length > 1) {
      report.skipped += 1;
      continue;
    }
    const committedAt = commit.commit.committer?.date;
    if (!committedAt) {
      report.skipped += 1;
      continue;
    }

    const input: CreateOutcomeObservationInput = {
      ...(source.metricId ? { metricId: source.metricId } : {}),
      kind: "verified_external_state",
      value: "1",
      unit,
      observedAt: new Date(committedAt).toISOString(),
      source: `github:${source.repo}`,
      confidence: "independently_verified",
      evidence: [
        { type: "url", reference: commit.html_url },
        { type: "external_record", reference: commit.sha, hash: commit.sha },
      ],
      notes: `commit ${commit.sha.slice(0, 7)}: ${firstLine(commit.commit.message, 300)}`,
    };
    const idempotencyKey = `github:${source.repo}:commit:${commit.sha}`.slice(0, 160);

    const result = OutcomeObservationService.create(workspaceId, mandate.id, input, idempotencyKey);
    if (result.replayed) report.replayed += 1;
    else report.ingested += 1;
  }

  return report;
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Sync every GitHub outcome source configured on a mandate. Per-source
 * failures are captured in the report rather than aborting the whole sync;
 * the caller decides how to surface them.
 */
export async function syncMandateOutcomes(
  workspaceId: string,
  mandateId: string,
): Promise<OutcomeSyncResult> {
  const mandate = FundedMandateService.get(workspaceId, mandateId);
  if (!mandate) throw new Error("Mandate not found");

  const sources = mandate.outcomeSources || [];
  if (sources.length === 0) {
    throw new Error("Mandate has no outcome sources configured");
  }

  const reports: OutcomeSourceSyncReport[] = [];
  for (const source of sources) {
    try {
      const report =
        source.mode === "pr"
          ? await syncPrSource(workspaceId, mandate, source)
          : await syncCommitSource(workspaceId, mandate, source);
      reports.push(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Outcome source sync failed", { mandateId, repo: source.repo, error: message });
      reports.push({
        repo: source.repo,
        mode: source.mode,
        fetched: 0,
        ingested: 0,
        replayed: 0,
        skipped: 0,
        error: message,
      });
    }
  }

  const totalIngested = reports.reduce((sum, r) => sum + r.ingested, 0);
  const totalReplayed = reports.reduce((sum, r) => sum + r.replayed, 0);

  if (totalIngested > 0) {
    void hydraDbMandateContext.syncMandateBestEffort(workspaceId, mandateId, "outcome_created");
  }

  return { mandateId, sources: reports, totalIngested, totalReplayed };
}
