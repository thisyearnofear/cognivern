/**
 * Outcome source configuration for funded mandates.
 *
 * An outcome source tells the platform where to look for independently
 * verifiable evidence that a mandate's work shipped. The first (and currently
 * only) supported source is GitHub — merged PRs or branch commits that the
 * GitHub API can attest without trusting the operator.
 *
 * Design constraints:
 *  - Sources are stored as JSON in `funded_mandates.outcome_sources`.
 *  - `metricId` must reference one of the mandate's `successMetrics` so the
 *    ingested observation carries the correct unit.
 *  - `mode: 'commits'` exists because this repo (and many solo-builder repos)
 *    ship direct commits to main with no PR flow.
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

export type OutcomeSource = GitHubOutcomeSource;

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

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
    if (s.type !== "github") {
      throw new Error(`outcomeSources[${index}]: only type "github" is supported`);
    }

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

    let since: string | undefined;
    if (typeof s.since === "string" && s.since.trim()) {
      const d = new Date(s.since.trim());
      if (Number.isNaN(d.getTime())) {
        throw new Error(`outcomeSources[${index}]: since must be a valid ISO-8601 date`);
      }
      since = d.toISOString();
    }

    const metricId = typeof s.metricId === "string" && s.metricId.trim() ? s.metricId.trim() : undefined;
    if (metricId && !successMetricIds.includes(metricId)) {
      throw new Error(
        `outcomeSources[${index}]: metricId "${metricId}" must reference one of the mandate's successMetrics`,
      );
    }

    const source: GitHubOutcomeSource = { type: "github", repo, mode };
    if (branch) source.branch = branch;
    if (labels && labels.length > 0) source.labels = labels;
    if (pathFilter) source.pathFilter = pathFilter;
    if (since) source.since = since;
    if (metricId) source.metricId = metricId;
    return source;
  });
}
