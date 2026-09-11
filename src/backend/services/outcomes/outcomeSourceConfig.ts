/**
 * Outcome source configuration for funded mandates.
 *
 * An outcome source tells the platform where to look for independently
 * verifiable (or system-observed) evidence that a mandate's work shipped.
 * Supported sources:
 *  - `github` — merged PRs or branch commits (independently_verified)
 *  - `langfuse` — scores or completed traces (system_observed; the Langfuse
 *    API attests the record exists, but score values are model/human-judged)
 *
 * Design constraints:
 *  - Sources are stored as JSON in `funded_mandates.outcome_sources`.
 *  - `metricId` must reference one of the mandate's `successMetrics` so the
 *    ingested observation carries the correct unit.
 *  - Credentials never live in the source config (GITHUB_TOKEN /
 *    LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY).
 */

export interface GitHubOutcomeSource {
  type: "github";
  /** "owner/name" — the repository to watch. */
  repo: string;
  /**
   * 'pr' watches merged pull requests; 'commits' watches commits on the
   * target branch. Use 'commits' for repos that ship without PRs.
   */
  mode: "pr" | "commits";
  /** Target branch. Defaults to "main". */
  branch?: string;
  /** PR mode only: only ingest PRs carrying all of these labels. */
  labels?: string[];
  /** Only ingest work touching paths under this prefix. */
  pathFilter?: string;
  /** ISO-8601 date; ignore work shipped before this point. */
  since?: string;
  /** Must reference one of the mandate's successMetrics ids. */
  metricId?: string;
}

export interface LangfuseOutcomeSource {
  type: "langfuse";
  /**
   * Langfuse API host, e.g. "https://cloud.langfuse.com" or a self-hosted
   * origin. Normalized to remove a trailing slash; never stores keys.
   */
  baseUrl: string;
  /**
   * Langfuse project name or id the traces/scores belong to. Used for
   * scoping notes and idempotency keys; auth is via env keys, not this.
   */
  project: string;
  /**
   * 'scores' ingests evaluation/annotation scores as quality outcomes;
   * 'traces' ingests trace completions as delivery outcomes.
   */
  mode: "scores" | "traces";
  /** Scores mode only: only ingest scores with these names (max 10). */
  scoreNames?: string[];
  /** Only ingest items at or after this ISO-8601 timestamp. */
  since?: string;
  /** Must reference one of the mandate's successMetrics ids. */
  metricId?: string;
}

export type OutcomeSource = GitHubOutcomeSource | LangfuseOutcomeSource;

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function normalizeSince(raw: unknown, index: number): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    throw new Error(`outcomeSources[${index}]: since must be a valid ISO-8601 date`);
  }
  return d.toISOString();
}

function normalizeMetricId(
  raw: unknown,
  index: number,
  successMetricIds: string[],
): string | undefined {
  const metricId = typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  if (metricId && !successMetricIds.includes(metricId)) {
    throw new Error(
      `outcomeSources[${index}]: metricId "${metricId}" must reference one of the mandate's successMetrics`,
    );
  }
  return metricId;
}

function normalizeGitHubSource(
  s: Record<string, unknown>,
  index: number,
  successMetricIds: string[],
): GitHubOutcomeSource {
  const repo = typeof s.repo === "string" ? s.repo.trim() : "";
  if (!REPO_PATTERN.test(repo)) {
    throw new Error(`outcomeSources[${index}]: repo must be "owner/name"`);
  }

  const mode = s.mode === "commits" ? "commits" : s.mode === "pr" ? "pr" : undefined;
  if (!mode) {
    throw new Error(`outcomeSources[${index}]: mode must be "pr" or "commits"`);
  }

  const branch = typeof s.branch === "string" && s.branch.trim() ? s.branch.trim() : undefined;

  const labels =
    mode === "pr" && Array.isArray(s.labels)
      ? (s.labels as unknown[]).filter(
          (l): l is string => typeof l === "string" && l.trim().length > 0,
        )
      : undefined;
  if (mode === "commits" && Array.isArray(s.labels) && s.labels.length > 0) {
    throw new Error(`outcomeSources[${index}]: labels are only valid in "pr" mode`);
  }

  const pathFilter =
    typeof s.pathFilter === "string" && s.pathFilter.trim()
      ? s.pathFilter.trim().replace(/\/+$/, "")
      : undefined;

  const since = normalizeSince(s.since, index);
  const metricId = normalizeMetricId(s.metricId, index, successMetricIds);

  const source: GitHubOutcomeSource = { type: "github", repo, mode };
  if (branch) source.branch = branch;
  if (labels && labels.length > 0) source.labels = labels;
  if (pathFilter) source.pathFilter = pathFilter;
  if (since) source.since = since;
  if (metricId) source.metricId = metricId;
  return source;
}

function normalizeLangfuseSource(
  s: Record<string, unknown>,
  index: number,
  successMetricIds: string[],
): LangfuseOutcomeSource {
  const baseUrlRaw = typeof s.baseUrl === "string" ? s.baseUrl.trim().replace(/\/+$/, "") : "";
  let parsed: URL;
  try {
    parsed = new URL(baseUrlRaw);
  } catch {
    throw new Error(`outcomeSources[${index}]: baseUrl must be a valid http(s) URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`outcomeSources[${index}]: baseUrl must be a valid http(s) URL`);
  }
  const baseUrl = parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, ""));

  const project = typeof s.project === "string" ? s.project.trim() : "";
  if (!project || project.length > 160) {
    throw new Error(`outcomeSources[${index}]: project must be a non-empty string (max 160)`);
  }

  const mode = s.mode === "scores" ? "scores" : s.mode === "traces" ? "traces" : undefined;
  if (!mode) {
    throw new Error(`outcomeSources[${index}]: mode must be "scores" or "traces"`);
  }

  let scoreNames: string[] | undefined;
  if (Array.isArray(s.scoreNames)) {
    if (mode !== "scores") {
      throw new Error(`outcomeSources[${index}]: scoreNames are only valid in "scores" mode`);
    }
    scoreNames = (s.scoreNames as unknown[])
      .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
      .map((n) => n.trim())
      .slice(0, 10);
    if (scoreNames.length === 0) scoreNames = undefined;
  }

  const since = normalizeSince(s.since, index);
  const metricId = normalizeMetricId(s.metricId, index, successMetricIds);

  const source: LangfuseOutcomeSource = { type: "langfuse", baseUrl, project, mode };
  if (scoreNames) source.scoreNames = scoreNames;
  if (since) source.since = since;
  if (metricId) source.metricId = metricId;
  return source;
}

/**
 * Validate and normalize an array of outcome sources.
 * Throws with a descriptive message on the first invalid entry.
 */
export function normalizeOutcomeSources(
  sources: unknown,
  successMetricIds: string[],
): OutcomeSource[] | undefined {
  if (sources === undefined || sources === null) return undefined;
  if (!Array.isArray(sources)) {
    throw new Error("outcomeSources must be an array");
  }
  if (sources.length === 0) return undefined;
  if (sources.length > 10) {
    throw new Error("A mandate may have at most 10 outcome sources");
  }

  return sources.map((raw, index) => {
    const s = raw as Record<string, unknown>;
    if (s.type === "github") {
      return normalizeGitHubSource(s, index, successMetricIds);
    }
    if (s.type === "langfuse") {
      return normalizeLangfuseSource(s, index, successMetricIds);
    }
    throw new Error(
      `outcomeSources[${index}]: type must be "github" or "langfuse"`,
    );
  });
}
